-- 038_historical_import_support.sql
-- Owner-only historical import support. Removes three verified blockers:
--   A. Canonical household/member creation without email or phone
--   B. Exact inactive product preservation on the historical path only
--   C. Explicit historical issue / in-force dates (never CURRENT_DATE)
--
-- Scope is intentionally narrow. Does not weaken quick_add_contact.
-- Does not change 034 expected compensation, 035 actual ledger, or 036 import
-- semantics. Does not create a second client or policy system. Does not
-- reactivate, rename, duplicate, or substitute catalog products.
-- New-business / Product picker behavior remains active-catalog only.
-- premium_drafted → in_force remains rejected. Issuance still creates
-- policies.source_application_id.

-- =============================================================================
-- SECTION A — Owner-only canonical client creation without contact info
-- =============================================================================
-- Reuses existing households + household_members. DOB writes only
-- household_members.date_of_birth. No fake email/phone. No public access.

CREATE OR REPLACE FUNCTION public.create_canonical_client(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed_keys text[] := ARRAY[
    'first_name',
    'last_name',
    'email',
    'phone',
    'date_of_birth',
    'assigned_advisor_id'
  ];
  v_first text;
  v_last text;
  v_display text;
  v_email_raw text;
  v_phone_raw text;
  v_email extensions.citext;
  v_phone text;
  v_dob date;
  v_assign_advisor_id uuid;
  v_owner_advisor_id uuid;
  v_email_household uuid;
  v_phone_household uuid;
  v_pipeline_id uuid := '22222222-2222-2222-2222-222222222201'::uuid;
  v_stage_id uuid := '33333333-3333-3333-3333-333333333001'::uuid;
  v_now timestamptz := now();
  v_household_id uuid;
  v_member_id uuid;
  v_audit_id uuid;
  v_result jsonb;
BEGIN
  PERFORM public.pp_assert_owner();
  PERFORM public.pp_assert_payload_size(p_payload);
  PERFORM public.pp_assert_object_keys(p_payload, v_allowed_keys);

  v_first := NULLIF(btrim(COALESCE(p_payload->>'first_name', '')), '');
  v_last := NULLIF(btrim(COALESCE(p_payload->>'last_name', '')), '');
  IF v_first IS NULL OR v_last IS NULL
     OR char_length(v_first) > 100 OR char_length(v_last) > 100 THEN
    RAISE EXCEPTION 'HISTORICAL_CLIENT:invalid_name' USING ERRCODE = '22023';
  END IF;
  v_display := btrim(v_first || ' ' || v_last);

  v_email_raw := NULLIF(btrim(COALESCE(p_payload->>'email', '')), '');
  v_phone_raw := NULLIF(btrim(COALESCE(p_payload->>'phone', '')), '');
  v_email := public.crm_normalize_quick_add_email(v_email_raw);
  v_phone := public.crm_normalize_quick_add_phone(v_phone_raw);
  -- Email and phone are optional. Do not invent placeholder contact information.

  v_dob := public.quick_add_parse_date_of_birth(p_payload);

  SELECT ap.id INTO v_owner_advisor_id
  FROM public.advisor_profiles ap
  WHERE ap.user_id = v_uid
    AND ap.deleted_at IS NULL
    AND ap.is_active = true
  LIMIT 1;

  IF NULLIF(p_payload->>'assigned_advisor_id', '') IS NOT NULL THEN
    BEGIN
      v_assign_advisor_id := (p_payload->>'assigned_advisor_id')::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'HISTORICAL_CLIENT:invalid_advisor' USING ERRCODE = '22023';
    END;
  ELSE
    v_assign_advisor_id := v_owner_advisor_id;
  END IF;
  IF v_assign_advisor_id IS NULL THEN
    RAISE EXCEPTION 'HISTORICAL_CLIENT:advisor_required' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.advisor_profiles ap
    WHERE ap.id = v_assign_advisor_id
      AND ap.deleted_at IS NULL
      AND ap.is_active = true
  ) THEN
    RAISE EXCEPTION 'HISTORICAL_CLIENT:invalid_advisor' USING ERRCODE = '22023';
  END IF;

  IF v_email IS NOT NULL OR v_phone IS NOT NULL THEN
    PERFORM public.quick_add_acquire_identity_locks(v_email, v_phone);
  END IF;

  IF v_email IS NOT NULL THEN
    SELECT x.household_id INTO v_email_household
    FROM (
      SELECT h.id AS household_id
      FROM public.households h
      WHERE h.deleted_at IS NULL
        AND h.merged_into_household_id IS NULL
        AND h.normalized_email = v_email
      UNION
      SELECT m.household_id
      FROM public.household_members m
      JOIN public.households h ON h.id = m.household_id
      WHERE m.deleted_at IS NULL
        AND h.deleted_at IS NULL
        AND h.merged_into_household_id IS NULL
        AND m.normalized_email = v_email
    ) x
    LIMIT 1;
  END IF;

  IF v_phone IS NOT NULL THEN
    SELECT x.household_id INTO v_phone_household
    FROM (
      SELECT h.id AS household_id
      FROM public.households h
      WHERE h.deleted_at IS NULL
        AND h.merged_into_household_id IS NULL
        AND h.normalized_phone = v_phone
      UNION
      SELECT m.household_id
      FROM public.household_members m
      JOIN public.households h ON h.id = m.household_id
      WHERE m.deleted_at IS NULL
        AND h.deleted_at IS NULL
        AND h.merged_into_household_id IS NULL
        AND m.normalized_phone = v_phone
    ) x
    LIMIT 1;
  END IF;

  IF v_email_household IS NOT NULL AND v_phone_household IS NOT NULL
     AND v_email_household IS DISTINCT FROM v_phone_household THEN
    RAISE EXCEPTION 'HISTORICAL_CLIENT:identity_conflict' USING ERRCODE = '22023';
  END IF;
  IF v_email_household IS NOT NULL OR v_phone_household IS NOT NULL THEN
    RAISE EXCEPTION 'HISTORICAL_CLIENT:duplicate_identity' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('crm.rpc_context', 'create_canonical_client', true);
  BEGIN
    INSERT INTO public.households (
      display_name, status, primary_email, normalized_email, primary_phone, normalized_phone,
      relationship_pipeline_id, relationship_stage_id, stage_entered_at, lead_source,
      assigned_advisor_id, assigned_at, assigned_by_user_id, assignment_reason,
      original_advisor_id, created_by_user_id
    ) VALUES (
      v_display, 'client', v_email_raw, v_email, v_phone_raw, v_phone,
      v_pipeline_id, v_stage_id, v_now, 'historical_import',
      v_assign_advisor_id, v_now, v_uid, 'manual',
      v_assign_advisor_id, v_uid
    ) RETURNING id INTO v_household_id;

    INSERT INTO public.advisor_assignments (
      household_id, advisor_id, assignment_role, reason, is_attribution_source,
      assigned_by_user_id, effective_from
    ) VALUES (
      v_household_id, v_assign_advisor_id, 'primary', 'manual', false, v_uid, v_now
    );

    INSERT INTO public.household_members (
      household_id, first_name, last_name, relationship, is_primary_contact,
      email, normalized_email, phone, normalized_phone, date_of_birth
    ) VALUES (
      v_household_id, v_first, v_last, 'primary', true,
      v_email_raw, v_email, v_phone_raw, v_phone, v_dob
    ) RETURNING id INTO v_member_id;

    v_audit_id := public.crm_write_audit(
      'create_canonical_client',
      'households',
      v_household_id,
      NULL,
      jsonb_build_object(
        'household_id', v_household_id,
        'member_id', v_member_id,
        'has_email', v_email IS NOT NULL,
        'has_phone', v_phone IS NOT NULL,
        'has_dob', v_dob IS NOT NULL
      )
    );

    v_result := jsonb_build_object(
      'ok', true,
      'created', true,
      'household_id', v_household_id,
      'member_id', v_member_id,
      'audit_id', v_audit_id
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.create_canonical_client(jsonb) IS
  'Owner-only canonical client create on existing households + household_members. first_name and last_name required. email, phone, and date_of_birth optional. DOB writes household_members.date_of_birth only. No fake contact. Deterministic duplicate_identity / identity_conflict when supplied contact matches an existing live household. Does not weaken quick_add_contact.';

REVOKE ALL ON FUNCTION public.create_canonical_client(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_canonical_client(jsonb) TO authenticated;

-- =============================================================================
-- SECTION B — Historical inactive product support
-- =============================================================================
-- 4-arg resolver is an internal helper. Existing 3-arg pp_resolve_catalog
-- remains the new-business path and still rejects inactive catalog rows.
-- Owner create_policy_application with historical_entry=true may preserve the
-- exact inactive product FK. No reactivation. No substitution.

CREATE OR REPLACE FUNCTION public.pp_resolve_catalog(
  p_carrier_id uuid,
  p_product_id uuid,
  p_product_line public.insurance_product_line,
  p_allow_inactive boolean
)
RETURNS public.insurance_product_line
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_carrier public.carriers;
  v_product public.insurance_products;
BEGIN
  IF p_carrier_id IS NULL OR p_product_id IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;

  SELECT * INTO v_carrier FROM public.carriers WHERE id = p_carrier_id;
  IF NOT FOUND OR v_carrier.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;
  IF NOT v_carrier.is_active AND NOT COALESCE(p_allow_inactive, false) THEN
    PERFORM public.pp_raise('catalog_inactive');
  END IF;

  SELECT * INTO v_product FROM public.insurance_products WHERE id = p_product_id;
  IF NOT FOUND OR v_product.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;
  IF v_product.carrier_id <> p_carrier_id THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF NOT v_product.is_active AND NOT COALESCE(p_allow_inactive, false) THEN
    PERFORM public.pp_raise('catalog_inactive');
  END IF;

  IF p_product_line IS NOT NULL AND p_product_line <> v_product.product_line THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  RETURN v_product.product_line;
END;
$$;

COMMENT ON FUNCTION public.pp_resolve_catalog(uuid, uuid, public.insurance_product_line, boolean) IS
  'Internal catalog resolve. p_allow_inactive is true only for the owner historical import/entry path. New-business continues to use the 3-arg form, which rejects inactive catalog rows. Does not reactivate or substitute products.';

REVOKE ALL ON FUNCTION public.pp_resolve_catalog(
  uuid, uuid, public.insurance_product_line, boolean
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_resolve_catalog(
  p_carrier_id uuid,
  p_product_id uuid,
  p_product_line public.insurance_product_line DEFAULT NULL
)
RETURNS public.insurance_product_line
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  RETURN public.pp_resolve_catalog(p_carrier_id, p_product_id, p_product_line, false);
END;
$$;

COMMENT ON FUNCTION public.pp_resolve_catalog(uuid, uuid, public.insurance_product_line) IS
  'New-business catalog resolve. Inactive carriers and products remain rejected.';

REVOKE ALL ON FUNCTION public.pp_resolve_catalog(
  uuid, uuid, public.insurance_product_line
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_policy_application(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed_keys text[] := ARRAY[
    'household_id',
    'opportunity_id',
    'carrier_id',
    'product_id',
    'product_line',
    'state',
    'application_number',
    'is_replacement',
    'is_exchange_or_transfer',
    'face_amount_cents',
    'annuity_deposit_cents',
    'premium_mode',
    'submitted_premium_cents',
    'target_premium_cents',
    'total_points_scaled',
    'submission_date',
    'next_follow_up_date',
    'production_month',
    'notes',
    'participants',
    'allocations',
    'historical_entry'
  ];
  v_household_id uuid;
  v_opportunity_id uuid;
  v_carrier_id uuid;
  v_product_id uuid;
  v_product_line public.insurance_product_line;
  v_historical boolean := false;
  v_state text;
  v_app_number text;
  v_app_number_norm text;
  v_premium_mode text;
  v_notes text;
  v_production_month date;
  v_participants jsonb;
  v_allocations jsonb;
  v_application_id uuid;
  v_result jsonb;
BEGIN
  PERFORM public.pp_assert_authenticated();
  PERFORM public.pp_assert_payload_size(p_payload);
  PERFORM public.pp_assert_object_keys(p_payload, v_allowed_keys);

  v_household_id := public.pp_json_uuid(p_payload, 'household_id');
  IF v_household_id IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = v_household_id
      AND h.deleted_at IS NULL
      AND h.merged_into_household_id IS NULL
  ) THEN
    PERFORM public.pp_raise('not_found');
  END IF;
  IF NOT (public.crm_is_owner() OR public.crm_can_access_household(v_household_id)) THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  v_historical := COALESCE(public.pp_json_bool(p_payload, 'historical_entry', false), false);
  IF v_historical THEN
    PERFORM public.pp_assert_owner();
  END IF;

  v_carrier_id := public.pp_json_uuid(p_payload, 'carrier_id');
  v_product_id := public.pp_json_uuid(p_payload, 'product_id');
  v_product_line := public.pp_resolve_catalog(
    v_carrier_id,
    v_product_id,
    public.pp_parse_product_line(public.pp_json_text(p_payload, 'product_line')),
    v_historical
  );

  v_state := upper(COALESCE(public.pp_json_text(p_payload, 'state'), ''));
  IF v_state !~ '^[A-Z]{2}$' THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;

  v_opportunity_id := public.pp_json_uuid(p_payload, 'opportunity_id');
  IF v_opportunity_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = v_opportunity_id
        AND o.deleted_at IS NULL
        AND o.household_id = v_household_id
    ) THEN
      PERFORM public.pp_raise('household_mismatch');
    END IF;
  END IF;

  v_premium_mode := lower(COALESCE(public.pp_json_text(p_payload, 'premium_mode'), ''));
  v_premium_mode := NULLIF(v_premium_mode, '');
  IF NOT public.pp_premium_mode_is_valid(v_premium_mode) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  v_app_number := public.pp_json_text(p_payload, 'application_number');
  IF v_app_number IS NOT NULL THEN
    IF char_length(v_app_number) > 60 THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    v_app_number_norm := public.pp_normalize_text(v_app_number);
    IF v_app_number_norm IS NULL THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.policy_applications a
      WHERE a.deleted_at IS NULL
        AND a.carrier_id = v_carrier_id
        AND a.application_number_normalized = v_app_number_norm
    ) THEN
      PERFORM public.pp_raise('duplicate_application_number');
    END IF;
  END IF;

  v_notes := public.pp_json_text(p_payload, 'notes');
  IF v_notes IS NOT NULL AND char_length(v_notes) > 5000 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  v_production_month := public.pp_json_date(p_payload, 'production_month');
  IF v_production_month IS NOT NULL THEN
    v_production_month := (date_trunc('month', v_production_month::timestamp))::date;
  END IF;

  v_participants := COALESCE(p_payload -> 'participants', '[]'::jsonb);
  IF jsonb_typeof(v_participants) <> 'array' THEN
    PERFORM public.pp_raise('invalid_participants');
  END IF;

  v_allocations := COALESCE(p_payload -> 'allocations', '[]'::jsonb);
  IF jsonb_typeof(v_allocations) <> 'array' THEN
    PERFORM public.pp_raise('invalid_allocations');
  END IF;
  IF jsonb_array_length(v_allocations) > 0 THEN
    PERFORM public.pp_assert_allocations_valid(v_allocations);
    PERFORM public.pp_assert_house_rows_authorized(v_allocations);
  END IF;

  -- Keep money shape consistent with product line at create time.
  IF v_product_line = 'fia' THEN
    IF public.pp_json_bigint(p_payload, 'face_amount_cents') IS NOT NULL
       OR public.pp_json_bigint(p_payload, 'target_premium_cents') IS NOT NULL THEN
      PERFORM public.pp_raise('invalid_premium');
    END IF;
  ELSIF public.pp_json_bigint(p_payload, 'annuity_deposit_cents') IS NOT NULL THEN
    PERFORM public.pp_raise('invalid_premium');
  END IF;

  PERFORM set_config('crm.rpc_context', 'create_policy_application', true);
  BEGIN
    INSERT INTO public.policy_applications (
      household_id, opportunity_id, carrier_id, product_id, product_line,
      state, application_number, application_number_normalized,
      is_replacement, is_exchange_or_transfer,
      face_amount_cents, annuity_deposit_cents, premium_mode,
      submitted_premium_cents, target_premium_cents, total_points_scaled,
      production_stage, underwriting_disposition, delivery_status,
      submission_date, next_follow_up_date, production_month, notes,
      created_by_user_id
    ) VALUES (
      v_household_id, v_opportunity_id, v_carrier_id, v_product_id, v_product_line,
      v_state, v_app_number, v_app_number_norm,
      COALESCE(public.pp_json_bool(p_payload, 'is_replacement', false), false),
      COALESCE(public.pp_json_bool(p_payload, 'is_exchange_or_transfer', false), false),
      public.pp_json_bigint(p_payload, 'face_amount_cents'),
      public.pp_json_bigint(p_payload, 'annuity_deposit_cents'),
      v_premium_mode,
      public.pp_json_bigint(p_payload, 'submitted_premium_cents'),
      public.pp_json_bigint(p_payload, 'target_premium_cents'),
      public.pp_json_int(p_payload, 'total_points_scaled'),
      'draft', 'pending', 'pre_issue',
      public.pp_json_date(p_payload, 'submission_date'),
      public.pp_json_date(p_payload, 'next_follow_up_date'),
      v_production_month,
      v_notes,
      v_uid
    ) RETURNING id INTO v_application_id;

    IF jsonb_array_length(v_participants) > 0 THEN
      PERFORM public.pp_apply_participants(v_application_id, v_participants, NULL, v_uid);
    END IF;

    IF jsonb_array_length(v_allocations) > 0 THEN
      PERFORM public.pp_apply_allocations(v_application_id, v_allocations, NULL, v_uid);
    END IF;

    -- Opening history entry: NULL -> draft.
    INSERT INTO public.policy_application_stage_history (
      application_id, from_stage, to_stage,
      from_disposition, to_disposition,
      from_delivery_status, to_delivery_status,
      reason, changed_by_user_id
    ) VALUES (
      v_application_id, NULL, 'draft',
      NULL, 'pending',
      NULL, 'pre_issue',
      'created', v_uid
    );

    v_result := jsonb_build_object(
      'ok', true,
      'created', true,
      'application_id', v_application_id,
      'application', public.pp_application_snapshot(v_application_id)
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.create_policy_application(jsonb) IS
  'Creates a draft policy application with optional participants/allocations and the opening NULL->draft history row. New-business catalog must be active. Owner historical_entry may preserve an exact inactive product FK. Does not reactivate or substitute products.';

GRANT EXECUTE ON FUNCTION public.create_policy_application(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.create_policy_application(jsonb) FROM PUBLIC, anon;

-- =============================================================================
-- SECTION C — Historical issue / in-force dates
-- =============================================================================
-- Signature stays (uuid, text, text, text, text, jsonb). historical_entry is an
-- owner-only p_fields key on issued / in_force only.

CREATE OR REPLACE FUNCTION public.transition_policy_application_stage(
  p_application_id uuid,
  p_to_stage text,
  p_disposition text DEFAULT NULL,
  p_delivery_status text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_fields jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_owner boolean := public.crm_is_owner();
  v_app public.policy_applications;
  v_to public.policy_application_stage;
  v_from public.policy_application_stage;
  v_disp public.policy_underwriting_disposition;
  v_delivery public.policy_delivery_status;
  v_requested_delivery public.policy_delivery_status;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_allowed_keys text[];
  v_fields jsonb := COALESCE(p_fields, '{}'::jsonb);
  v_submission_date date;
  v_decision_date date;
  v_issue_date date;
  v_in_force_date date;
  v_follow_up date;
  v_production_month date;
  v_policy_number text;
  v_policy_number_norm text;
  v_carrier_name text;
  v_product_name text;
  v_policy_type text;
  v_insured_member uuid;
  v_owner_member uuid;
  v_annuitant_member uuid;
  v_servicing_advisor uuid;
  v_policy_id uuid;
  v_linked_policy_id uuid;
  v_constraint text;
  v_coverage numeric(14, 2);
  v_premium numeric(14, 2);
  v_details jsonb;
  v_result jsonb;
  v_historical boolean := false;
BEGIN
  PERFORM public.pp_assert_can_access_application(p_application_id);

  v_to := public.pp_parse_stage(p_to_stage);
  IF v_to IS NULL THEN
    PERFORM public.pp_raise('invalid_transition');
  END IF;

  SELECT * INTO v_app FROM public.policy_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND OR v_app.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  v_from := v_app.production_stage;

  SELECT p.id INTO v_linked_policy_id
  FROM public.policies p
  WHERE p.source_application_id = p_application_id
    AND p.deleted_at IS NULL
  LIMIT 1;

  PERFORM public.pp_assert_transition_allowed(v_from, v_to, v_is_owner);

  IF public.pp_is_backward_transition(v_from, v_to) AND v_reason IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF v_reason IS NOT NULL AND char_length(v_reason) > 1000 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  v_disp := public.pp_parse_disposition(p_disposition);
  IF v_disp IS NULL THEN
    v_disp := CASE
      WHEN v_to::text IN ('draft', 'pre_submitted', 'submitted', 'in_underwriting', 'paramed') THEN 'pending'
      WHEN v_to::text = 'declined' THEN 'declined'
      WHEN v_to::text = 'postponed' THEN 'postponed'
      WHEN v_to::text IN ('approved', 'issued', 'in_force', 'sent_to_draft', 'premium_drafted') THEN
        CASE
          WHEN v_app.underwriting_disposition IN (
            'approved_as_applied',
            'approved_other_than_applied',
            'approved_with_amendment'
          ) THEN v_app.underwriting_disposition
          ELSE 'approved_as_applied'
        END
      ELSE v_app.underwriting_disposition
    END;
  END IF;
  PERFORM public.pp_validate_stage_disposition(v_to, v_disp);

  v_requested_delivery := public.pp_parse_delivery_status(p_delivery_status);
  IF v_requested_delivery IS NOT NULL THEN
    v_delivery := v_requested_delivery;
  ELSIF v_to = 'issued' THEN
    v_delivery := 'not_started';
  ELSIF v_to = 'in_force' THEN
    v_delivery := v_app.delivery_status;
  ELSE
    v_delivery := CASE
      WHEN v_app.delivery_status = 'not_required' THEN 'not_required'
      ELSE 'pre_issue'
    END;
  END IF;

  IF v_to = 'in_force' THEN
    PERFORM public.pp_assert_in_force_delivery(
      v_app.product_line, v_delivery, v_is_owner, v_reason
    );
  END IF;
  PERFORM public.pp_assert_delivery_status_allowed(v_to, v_delivery);

  IF jsonb_typeof(v_fields) <> 'object' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  v_allowed_keys := CASE v_to::text
    WHEN 'pre_submitted' THEN ARRAY['next_follow_up_date']
    WHEN 'submitted' THEN ARRAY['submission_date', 'next_follow_up_date']
    WHEN 'paramed' THEN ARRAY['next_follow_up_date']
    WHEN 'in_underwriting' THEN ARRAY['next_follow_up_date']
    WHEN 'approved' THEN ARRAY[
      'decision_date', 'policy_number', 'target_premium_cents', 'next_follow_up_date'
    ]
    WHEN 'sent_to_draft' THEN ARRAY['next_follow_up_date']
    WHEN 'premium_drafted' THEN ARRAY['next_follow_up_date']
    WHEN 'declined' THEN ARRAY['decision_date', 'next_follow_up_date']
    WHEN 'postponed' THEN ARRAY['decision_date', 'next_follow_up_date']
    WHEN 'withdrawn' THEN ARRAY['decision_date', 'next_follow_up_date']
    WHEN 'incomplete' THEN ARRAY['decision_date', 'next_follow_up_date']
    WHEN 'not_taken' THEN ARRAY['decision_date', 'next_follow_up_date']
    WHEN 'issued' THEN ARRAY[
      'issue_date', 'policy_number', 'production_month', 'next_follow_up_date',
      'historical_entry'
    ]
    WHEN 'in_force' THEN ARRAY[
      'in_force_date', 'production_month', 'next_follow_up_date',
      'historical_entry'
    ]
    ELSE ARRAY[]::text[]
  END;
  PERFORM public.pp_assert_object_keys(v_fields, v_allowed_keys);

  v_historical := COALESCE(public.pp_json_bool(v_fields, 'historical_entry', false), false);
  IF v_historical THEN
    PERFORM public.pp_assert_owner();
  END IF;

  v_submission_date := COALESCE(public.pp_json_date(v_fields, 'submission_date'), v_app.submission_date);
  v_decision_date := COALESCE(public.pp_json_date(v_fields, 'decision_date'), v_app.decision_date);
  v_issue_date := COALESCE(public.pp_json_date(v_fields, 'issue_date'), v_app.issue_date);
  v_in_force_date := COALESCE(public.pp_json_date(v_fields, 'in_force_date'), v_app.in_force_date);
  v_follow_up := CASE WHEN v_fields ? 'next_follow_up_date'
    THEN public.pp_json_date(v_fields, 'next_follow_up_date') ELSE v_app.next_follow_up_date END;
  v_production_month := CASE WHEN v_fields ? 'production_month'
    THEN (date_trunc('month', public.pp_json_date(v_fields, 'production_month')::timestamp))::date
    ELSE v_app.production_month END;
  v_policy_number := COALESCE(public.pp_json_text(v_fields, 'policy_number'), v_app.policy_number);
  IF v_policy_number IS NOT NULL AND char_length(v_policy_number) > 60 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF v_policy_number IS NOT NULL THEN
    v_policy_number_norm := public.pp_normalize_text(v_policy_number);
    IF v_policy_number_norm IS NULL THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    IF v_policy_number_norm IS DISTINCT FROM v_app.policy_number_normalized
       AND EXISTS (
         SELECT 1 FROM public.policy_applications a
         WHERE a.id <> p_application_id
           AND a.carrier_id = v_app.carrier_id
           AND a.policy_number_normalized = v_policy_number_norm
       ) THEN
      PERFORM public.pp_raise('duplicate_policy_number');
    END IF;
  END IF;

  IF v_to = 'submitted' AND v_submission_date IS NULL THEN
    v_submission_date := current_date;
  END IF;
  IF v_to IN ('approved', 'declined', 'postponed', 'withdrawn', 'incomplete', 'not_taken')
     AND v_decision_date IS NULL THEN
    v_decision_date := current_date;
  END IF;
  -- Ordinary new-business still manufactures CURRENT_DATE when dates are omitted.
  -- Owner historical_entry preserves NULL instead of substituting today.
  IF v_to = 'issued' AND v_issue_date IS NULL AND NOT v_historical THEN
    v_issue_date := GREATEST(current_date, COALESCE(v_submission_date, current_date));
  END IF;
  IF v_to = 'in_force' AND v_in_force_date IS NULL AND NOT v_historical THEN
    v_in_force_date := GREATEST(current_date, COALESCE(v_issue_date, current_date));
  END IF;

  IF v_issue_date IS NOT NULL AND v_submission_date IS NOT NULL
     AND v_issue_date < v_submission_date THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF v_in_force_date IS NOT NULL AND v_issue_date IS NOT NULL
     AND v_in_force_date < v_issue_date THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  IF v_to = 'submitted' AND v_from IN ('draft', 'pre_submitted') THEN
    PERFORM public.pp_assert_participants_for_submit(p_application_id, v_app.product_line);
    PERFORM public.pp_assert_premium_for_submit(
      v_app.product_line,
      v_app.face_amount_cents,
      v_app.annuity_deposit_cents,
      v_app.submitted_premium_cents,
      v_app.premium_mode
    );
    PERFORM public.pp_assert_allocations_valid(public.pp_current_allocations_json(p_application_id));
  END IF;

  IF v_to = 'issued' THEN
    IF v_policy_number IS NULL THEN
      PERFORM public.pp_raise('missing_required_fields');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.policies p
      WHERE p.source_application_id = p_application_id
    ) THEN
      PERFORM public.pp_raise('duplicate_link');
    END IF;
    PERFORM public.pp_assert_participants_for_submit(p_application_id, v_app.product_line);
    PERFORM public.pp_assert_premium_for_submit(
      v_app.product_line,
      v_app.face_amount_cents,
      v_app.annuity_deposit_cents,
      v_app.submitted_premium_cents,
      v_app.premium_mode
    );
  END IF;

  IF v_to = 'in_force' AND v_linked_policy_id IS NULL THEN
    PERFORM public.pp_raise('issue_failed');
  END IF;

  PERFORM set_config('crm.rpc_context', 'transition_policy_application_stage', true);
  BEGIN
    IF v_to = 'issued' THEN
      SELECT c.name INTO v_carrier_name FROM public.carriers c WHERE c.id = v_app.carrier_id;
      SELECT ip.name INTO v_product_name
      FROM public.insurance_products ip WHERE ip.id = v_app.product_id;
      IF v_carrier_name IS NULL THEN
        PERFORM public.pp_raise('issue_failed');
      END IF;
      v_policy_type := COALESCE(NULLIF(btrim(COALESCE(v_product_name, '')), ''), v_app.product_line::text);

      SELECT pa.household_member_id INTO v_insured_member
      FROM public.policy_application_participants pa
      WHERE pa.application_id = p_application_id
        AND pa.effective_to IS NULL
        AND pa.role = 'insured'
      LIMIT 1;

      SELECT pa.household_member_id INTO v_owner_member
      FROM public.policy_application_participants pa
      WHERE pa.application_id = p_application_id
        AND pa.effective_to IS NULL
        AND pa.role = 'owner'
      LIMIT 1;

      SELECT pa.household_member_id INTO v_annuitant_member
      FROM public.policy_application_participants pa
      WHERE pa.application_id = p_application_id
        AND pa.effective_to IS NULL
        AND pa.role = 'annuitant'
      LIMIT 1;

      SELECT al.advisor_id INTO v_servicing_advisor
      FROM public.policy_agent_allocations al
      WHERE al.application_id = p_application_id
        AND al.effective_to IS NULL
        AND al.advisor_id IS NOT NULL
      ORDER BY (al.allocation_role = 'servicing') DESC, al.production_credit_bps DESC, al.advisor_id
      LIMIT 1;

      IF v_app.product_line = 'fia' THEN
        v_coverage := NULL;
        v_premium := NULL;
        v_details := jsonb_build_object(
          'source', 'policy_production',
          'product_line', v_app.product_line::text,
          'product_id', v_app.product_id,
          'carrier_id', v_app.carrier_id,
          'annuity_deposit_cents', v_app.annuity_deposit_cents,
          'annuitant_member_id', v_annuitant_member,
          'application_id', p_application_id
        );
      ELSE
        v_coverage := (v_app.face_amount_cents::numeric / 100.0);
        v_premium := (v_app.submitted_premium_cents::numeric / 100.0);
        v_details := jsonb_build_object(
          'source', 'policy_production',
          'product_line', v_app.product_line::text,
          'product_id', v_app.product_id,
          'carrier_id', v_app.carrier_id,
          'premium_mode', v_app.premium_mode,
          'target_premium_cents', v_app.target_premium_cents,
          'application_id', p_application_id
        );
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.policies p
        WHERE p.deleted_at IS NULL
          AND p.carrier = v_carrier_name
          AND p.policy_number = v_policy_number
      ) THEN
        PERFORM public.pp_raise('duplicate_policy_number');
      END IF;

      INSERT INTO public.policies (
        household_id, insured_member_id, policy_owner_member_id, opportunity_id,
        servicing_advisor_id, carrier, policy_type, policy_number,
        coverage_amount, premium, payment_frequency, effective_date,
        status, details, source_application_id
      ) VALUES (
        v_app.household_id,
        CASE WHEN v_app.product_line = 'fia' THEN NULL ELSE v_insured_member END,
        v_owner_member,
        v_app.opportunity_id,
        v_servicing_advisor,
        v_carrier_name,
        v_policy_type,
        v_policy_number,
        v_coverage,
        v_premium,
        CASE WHEN v_app.product_line = 'fia'
          THEN NULL
          ELSE public.pp_payment_frequency_from_mode(v_app.premium_mode) END,
        v_issue_date,
        'issued',
        jsonb_strip_nulls(v_details),
        p_application_id
      ) RETURNING id INTO v_policy_id;

      IF v_policy_id IS NULL THEN
        PERFORM public.pp_raise('issue_failed');
      END IF;
    END IF;

    IF v_to = 'in_force' THEN
      UPDATE public.policies
      SET status = 'in_force',
          effective_date = COALESCE(effective_date, v_in_force_date)
      WHERE source_application_id = p_application_id
        AND deleted_at IS NULL;
      IF NOT FOUND THEN
        PERFORM public.pp_raise('issue_failed');
      END IF;
    END IF;

    UPDATE public.policy_applications
    SET production_stage = v_to,
        underwriting_disposition = v_disp,
        delivery_status = v_delivery,
        submission_date = v_submission_date,
        decision_date = v_decision_date,
        issue_date = v_issue_date,
        in_force_date = v_in_force_date,
        next_follow_up_date = v_follow_up,
        production_month = v_production_month,
        policy_number = v_policy_number,
        policy_number_normalized = v_policy_number_norm,
        target_premium_cents = COALESCE(
          public.pp_json_bigint(v_fields, 'target_premium_cents'),
          target_premium_cents
        )
    WHERE id = p_application_id;

    INSERT INTO public.policy_application_stage_history (
      application_id, from_stage, to_stage,
      from_disposition, to_disposition,
      from_delivery_status, to_delivery_status,
      reason, changed_by_user_id
    ) VALUES (
      p_application_id, v_from, v_to,
      v_app.underwriting_disposition, v_disp,
      v_app.delivery_status, v_delivery,
      v_reason, v_uid
    );

    SELECT p.id INTO v_policy_id
    FROM public.policies p
    WHERE p.source_application_id = p_application_id
      AND p.deleted_at IS NULL
    LIMIT 1;

    v_result := jsonb_build_object(
      'ok', true,
      'application_id', p_application_id,
      'from_stage', v_from::text,
      'to_stage', v_to::text,
      'underwriting_disposition', v_disp::text,
      'delivery_status', v_delivery::text,
      'policy_id', v_policy_id,
      'application', public.pp_application_snapshot(p_application_id)
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      PERFORM public.crm_clear_rpc_context();
      IF v_constraint = 'policies_source_application_unique_idx' THEN
        PERFORM public.pp_raise('duplicate_link');
      ELSIF v_constraint IN (
        'policy_applications_carrier_policy_number_unique_idx',
        'policies_carrier_number_unique_idx'
      ) THEN
        PERFORM public.pp_raise('duplicate_policy_number');
      END IF;
      RAISE;
    WHEN OTHERS THEN
      PERFORM public.crm_clear_rpc_context();
      RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.transition_policy_application_stage(uuid, text, text, text, text, jsonb) IS
  '032/037 state machine. Issuance still creates policies.source_application_id. in_force still requires that link and the delivery gate. premium_drafted cannot skip issued. Owner historical_entry on issued/in_force preserves explicit dates and leaves unknown historical dates NULL instead of CURRENT_DATE. Ordinary new-business date behavior is unchanged.';

GRANT EXECUTE ON FUNCTION public.transition_policy_application_stage(
  uuid, text, text, text, text, jsonb
) TO authenticated;
REVOKE ALL ON FUNCTION public.transition_policy_application_stage(
  uuid, text, text, text, text, jsonb
) FROM PUBLIC, anon;
