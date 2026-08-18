-- 042_writing_receivable_eligibility.sql
-- Durable application-level writing-receivable eligibility for Expected Compensation.
--
-- writing_receivable_expected = true (default): Valtoris currently expects writing
-- compensation. 034 behaves as before.
-- writing_receivable_expected = false: the application remains in Policy Production
-- for servicing, protection, and history, but 034 writes no live Expected dollars,
-- review_required rows, or unavailable rows.
--
-- Not inferred from stage, dates, created_at, household lead_source, notes,
-- historical_entry, carrier, product, or compensation schedule dates.
-- historical_entry remains a catalog/date RPC switch and does not set this flag.
--
-- Default true preserves organic / current production. 035 actuals are untouched.
-- Does not change Pending, Paid, Chargebacks, allocations, stages, or rate cards.

-- =============================================================================
-- SECTION A — Durable column
-- =============================================================================

ALTER TABLE public.policy_applications
  ADD COLUMN IF NOT EXISTS writing_receivable_expected boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.policy_applications.writing_receivable_expected IS
  'Whether Valtoris currently expects writing compensation from this application. true (default) = 034 generates Expected snapshots. false = no live Expected dollars, review, or unavailable rows. Independent of production_stage, policy in-force status, historical_entry, and household lead_source. Owner-only mutation.';

-- =============================================================================
-- SECTION B — Protect the column (owner RPC context only)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_policy_application_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  -- Coalesced to '' so that an absent context compares as false rather than
  -- NULL: `NOT (NULL = ANY (...))` is NULL, which would silently skip the guard.
  v_ctx text := COALESCE(public.crm_rpc_context(), '');
  v_write_contexts text[] := ARRAY[
    'create_policy_application',
    'update_policy_application',
    'transition_policy_application_stage',
    'set_policy_application_number',
    'correct_policy_application_number',
    'soft_delete_policy_application',
    'set_policy_application_writing_receivable_expected'
  ];
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Applications are soft-deleted only.
    PERFORM public.pp_raise('delete_not_allowed');
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_ctx IS DISTINCT FROM 'create_policy_application' THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (v_ctx = ANY (v_write_contexts)) THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  -- Immutable for the lifetime of the row.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.household_id IS DISTINCT FROM OLD.household_id
     OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF (NEW.production_stage IS DISTINCT FROM OLD.production_stage
      OR NEW.underwriting_disposition IS DISTINCT FROM OLD.underwriting_disposition
      OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
      OR NEW.in_force_date IS DISTINCT FROM OLD.in_force_date
      OR NEW.decision_date IS DISTINCT FROM OLD.decision_date)
     AND v_ctx IS DISTINCT FROM 'transition_policy_application_stage' THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  -- Delivery progress is tracked between issue and in force, so
  -- update_policy_application may advance it; the in_force gate itself still
  -- lives in the transition RPC.
  IF NEW.delivery_status IS DISTINCT FROM OLD.delivery_status
     AND v_ctx IS DISTINCT FROM 'transition_policy_application_stage'
     AND v_ctx IS DISTINCT FROM 'update_policy_application' THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF (NEW.application_number IS DISTINCT FROM OLD.application_number
      OR NEW.application_number_normalized IS DISTINCT FROM OLD.application_number_normalized)
     AND v_ctx IS DISTINCT FROM 'set_policy_application_number'
     AND v_ctx IS DISTINCT FROM 'correct_policy_application_number' THEN
    PERFORM public.pp_raise('identifier_locked');
  END IF;

  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     AND v_ctx IS DISTINCT FROM 'soft_delete_policy_application' THEN
    PERFORM public.pp_raise('delete_not_allowed');
  END IF;

  IF (NEW.policy_number IS DISTINCT FROM OLD.policy_number
      OR NEW.policy_number_normalized IS DISTINCT FROM OLD.policy_number_normalized)
     AND v_ctx IS DISTINCT FROM 'transition_policy_application_stage'
     AND v_ctx IS DISTINCT FROM 'update_policy_application' THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF (NEW.carrier_id IS DISTINCT FROM OLD.carrier_id
      OR NEW.product_id IS DISTINCT FROM OLD.product_id
      OR NEW.product_line IS DISTINCT FROM OLD.product_line)
     AND v_ctx IS DISTINCT FROM 'update_policy_application' THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  -- Writing-receivable eligibility is owner-only. Advisors and generic
  -- application editors cannot flip Expected Compensation on or off.
  IF NEW.writing_receivable_expected IS DISTINCT FROM OLD.writing_receivable_expected
     AND v_ctx IS DISTINCT FROM 'set_policy_application_writing_receivable_expected' THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  RETURN NEW;
END;
$$;

-- Live Expected rows may only be superseded from approved write contexts.
-- Eligibility changes must be able to close live snapshots without deleting history.
CREATE OR REPLACE FUNCTION public.enforce_policy_expected_comp_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_ctx text := COALESCE(public.crm_rpc_context(), '');
  v_write_contexts text[] := ARRAY[
    'transition_policy_application_stage',
    'update_policy_application',
    'set_policy_application_allocations',
    'recalculate_policy_application_expected_compensation',
    'set_policy_application_writing_receivable_expected'
  ];
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.pp_raise('delete_not_allowed');
    RETURN OLD;
  END IF;

  IF NOT (v_ctx = ANY (v_write_contexts)) THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.application_id IS DISTINCT FROM OLD.application_id
     OR NEW.allocation_id IS DISTINCT FROM OLD.allocation_id
     OR NEW.advisor_id IS DISTINCT FROM OLD.advisor_id
     OR NEW.product_compensation_schedule_id IS DISTINCT FROM OLD.product_compensation_schedule_id
     OR NEW.writing_contract_level IS DISTINCT FROM OLD.writing_contract_level
     OR NEW.writing_rate IS DISTINCT FROM OLD.writing_rate
     OR NEW.compensation_base_cents IS DISTINCT FROM OLD.compensation_base_cents
     OR NEW.commission_bps IS DISTINCT FROM OLD.commission_bps
     OR NEW.expected_compensation_cents IS DISTINCT FROM OLD.expected_compensation_cents
     OR NEW.calculation_status IS DISTINCT FROM OLD.calculation_status
     OR NEW.review_reason IS DISTINCT FROM OLD.review_reason
     OR NEW.lookup_date IS DISTINCT FROM OLD.lookup_date
     OR NEW.calculated_at IS DISTINCT FROM OLD.calculated_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF OLD.superseded_at IS NOT NULL OR NEW.superseded_at IS NULL THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_policy_expected_comp_immutability()
  FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION C — 034 engine honors eligibility
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pp_refresh_application_expected_compensation(
  p_application_id uuid,
  p_reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_app public.policy_applications;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_lookup date;
  v_base bigint;
  v_base_status text;
  v_base_reason text;
  v_live_card_count integer;
  v_date_card_count integer;
  v_schedule public.product_compensation_schedules;
  v_schedule_id uuid;
  v_card_status text;
  v_card_reason text;
  v_alloc public.policy_agent_allocations;
  v_rate numeric(8, 6);
  v_status text;
  v_review text;
  v_cents bigint;
  v_existing public.policy_application_expected_compensations;
  v_written integer := 0;
BEGIN
  IF v_reason IS NULL OR char_length(v_reason) > 500 THEN
    v_reason := 'recalculated';
  END IF;

  SELECT * INTO v_app
  FROM public.policy_applications
  WHERE id = p_application_id
  FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  -- Draft / pre_submitted: do not freeze money.
  IF v_app.production_stage IN ('draft', 'pre_submitted') THEN
    RETURN 0;
  END IF;

  -- No current writing receivable: supersede live snapshots and write none.
  -- Does not delete history. Does not infer from stage, dates, or historical_entry.
  IF v_app.writing_receivable_expected IS NOT TRUE THEN
    UPDATE public.policy_application_expected_compensations e
    SET superseded_at = now(),
        supersede_reason = v_reason
    WHERE e.application_id = p_application_id
      AND e.superseded_at IS NULL;
    RETURN 0;
  END IF;

  v_lookup := COALESCE(v_app.submission_date, v_app.issue_date);

  v_base_status := NULL;
  v_base_reason := NULL;
  v_base := NULL;
  IF v_app.product_line = 'fia' THEN
    IF v_app.annuity_deposit_cents IS NULL OR v_app.annuity_deposit_cents <= 0 THEN
      v_base_status := 'review_required';
      v_base_reason := 'missing_compensation_base';
    ELSE
      v_base := v_app.annuity_deposit_cents;
    END IF;
  ELSE
    IF v_app.submitted_premium_cents IS NULL OR v_app.submitted_premium_cents <= 0 THEN
      v_base_status := 'review_required';
      v_base_reason := 'missing_compensation_base';
    ELSIF v_app.premium_mode IS NULL
          OR v_app.premium_mode IN ('single', 'other') THEN
      v_base_status := 'review_required';
      v_base_reason := 'premium_mode_not_annualizable';
    ELSIF v_app.premium_mode = 'monthly' THEN
      v_base := v_app.submitted_premium_cents * 12;
    ELSIF v_app.premium_mode = 'quarterly' THEN
      v_base := v_app.submitted_premium_cents * 4;
    ELSIF v_app.premium_mode = 'semi_annual' THEN
      v_base := v_app.submitted_premium_cents * 2;
    ELSIF v_app.premium_mode = 'annual' THEN
      v_base := v_app.submitted_premium_cents;
    ELSE
      v_base_status := 'review_required';
      v_base_reason := 'premium_mode_not_annualizable';
    END IF;
  END IF;

  SELECT count(*)::int INTO v_live_card_count
  FROM public.product_compensation_schedules s
  WHERE s.product_id = v_app.product_id
    AND s.deleted_at IS NULL;

  v_schedule_id := NULL;
  v_card_status := NULL;
  v_card_reason := NULL;

  IF v_live_card_count = 0 THEN
    v_card_status := 'unavailable';
    v_card_reason := 'no_rate_card';
  ELSIF v_lookup IS NULL THEN
    v_card_status := 'review_required';
    v_card_reason := 'missing_lookup_date';
  ELSE
    SELECT count(*)::int INTO v_date_card_count
    FROM public.product_compensation_schedules s
    WHERE s.product_id = v_app.product_id
      AND s.deleted_at IS NULL
      AND s.is_active IS TRUE
      AND s.effective_from <= v_lookup
      AND (s.effective_to IS NULL OR v_lookup <= s.effective_to);

    IF v_date_card_count = 0 THEN
      v_card_status := 'review_required';
      v_card_reason := 'no_rate_card_for_lookup_date';
    ELSIF v_date_card_count > 1 THEN
      -- Multiple date-valid cards: true age-dependent (or overlapping) set.
      -- Fail closed. Do not invent an issue-age convention to pick one.
      v_card_status := 'review_required';
      v_card_reason := 'age_sensitive_rate_card';
    ELSE
      SELECT s.* INTO v_schedule
      FROM public.product_compensation_schedules s
      WHERE s.product_id = v_app.product_id
        AND s.deleted_at IS NULL
        AND s.is_active IS TRUE
        AND s.effective_from <= v_lookup
        AND (s.effective_to IS NULL OR v_lookup <= s.effective_to);

      -- Unique date-valid card. age_min NULL/0 is an administrative cap
      -- (life NULL–75, FIA 0–75), not a selector among rates. A positive
      -- age_min is a source-printed floor: applicability depends on age.
      IF COALESCE(v_schedule.age_min, 0) > 0 THEN
        v_card_status := 'review_required';
        v_card_reason := 'age_sensitive_rate_card';
        v_schedule := NULL;
      ELSE
        v_schedule_id := v_schedule.id;
      END IF;
    END IF;
  END IF;

  -- Close live rows whose allocation is no longer a current writing advisor.
  UPDATE public.policy_application_expected_compensations e
  SET superseded_at = now(),
      supersede_reason = v_reason
  WHERE e.application_id = p_application_id
    AND e.superseded_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.policy_agent_allocations al
      WHERE al.id = e.allocation_id
        AND al.application_id = p_application_id
        AND al.effective_to IS NULL
        AND al.recipient_type = 'advisor'
        AND al.allocation_role = 'writing'
        AND al.advisor_id IS NOT NULL
    );

  FOR v_alloc IN
    SELECT *
    FROM public.policy_agent_allocations al
    WHERE al.application_id = p_application_id
      AND al.effective_to IS NULL
      AND al.recipient_type = 'advisor'
      AND al.allocation_role = 'writing'
      AND al.advisor_id IS NOT NULL
    ORDER BY al.advisor_id
  LOOP
    v_status := NULL;
    v_review := NULL;
    v_rate := NULL;
    v_cents := NULL;

    IF v_card_status IS NOT NULL THEN
      v_status := v_card_status;
      v_review := v_card_reason;
    ELSIF v_base_status IS NOT NULL THEN
      v_status := v_base_status;
      v_review := v_base_reason;
    ELSIF v_alloc.writing_contract_level IS NULL THEN
      v_status := 'review_required';
      v_review := 'missing_writing_contract_level';
    ELSE
      v_rate := public.pp_expected_comp_select_rate(
        v_alloc.writing_contract_level,
        v_schedule.fa_rate,
        v_schedule.sfa_rate,
        v_schedule.sm_rate,
        v_schedule.ed_rate
      );
      v_cents := public.pp_expected_comp_round_cents(
        v_base, v_rate, v_alloc.commission_bps
      );
      IF v_rate IS NULL OR v_cents IS NULL THEN
        v_status := 'review_required';
        v_review := 'missing_writing_contract_level';
        v_rate := NULL;
        v_cents := NULL;
      ELSE
        v_status := 'resolved';
        v_review := NULL;
      END IF;
    END IF;

    SELECT * INTO v_existing
    FROM public.policy_application_expected_compensations e
    WHERE e.allocation_id = v_alloc.id
      AND e.superseded_at IS NULL
    LIMIT 1;

    IF FOUND THEN
      IF v_reason IS DISTINCT FROM 'issued'
         AND v_existing.calculation_status IS NOT DISTINCT FROM v_status
         AND v_existing.review_reason IS NOT DISTINCT FROM v_review
         AND v_existing.product_compensation_schedule_id IS NOT DISTINCT FROM (
           CASE WHEN v_card_status IS NULL THEN v_schedule_id ELSE NULL END
         )
         AND v_existing.writing_contract_level IS NOT DISTINCT FROM v_alloc.writing_contract_level
         AND v_existing.writing_rate IS NOT DISTINCT FROM v_rate
         AND v_existing.compensation_base_cents IS NOT DISTINCT FROM (
           CASE WHEN v_base_status IS NULL THEN v_base ELSE NULL END
         )
         AND v_existing.commission_bps IS NOT DISTINCT FROM v_alloc.commission_bps
         AND v_existing.expected_compensation_cents IS NOT DISTINCT FROM v_cents
         AND v_existing.lookup_date IS NOT DISTINCT FROM v_lookup THEN
        v_written := v_written + 1;
        CONTINUE;
      END IF;

      UPDATE public.policy_application_expected_compensations
      SET superseded_at = now(),
          supersede_reason = v_reason
      WHERE id = v_existing.id;
    END IF;

    INSERT INTO public.policy_application_expected_compensations (
      application_id,
      allocation_id,
      advisor_id,
      product_compensation_schedule_id,
      writing_contract_level,
      writing_rate,
      compensation_base_cents,
      commission_bps,
      expected_compensation_cents,
      calculation_status,
      review_reason,
      lookup_date,
      calculated_at
    ) VALUES (
      p_application_id,
      v_alloc.id,
      v_alloc.advisor_id,
      CASE WHEN v_card_status IS NULL THEN v_schedule_id ELSE NULL END,
      v_alloc.writing_contract_level,
      v_rate,
      CASE WHEN v_base_status IS NULL THEN v_base ELSE NULL END,
      v_alloc.commission_bps,
      v_cents,
      v_status,
      v_review,
      v_lookup,
      now()
    );
    v_written := v_written + 1;
  END LOOP;

  RETURN v_written;
END;
$$;

COMMENT ON FUNCTION public.pp_refresh_application_expected_compensation(uuid, text) IS
  'Internal. Writes writing-advisor expected snapshots for current allocations. Never raises for missing rates; writes unavailable/review_required instead. Does nothing in draft/pre_submitted. When writing_receivable_expected is false, supersedes live rows and writes none. Supersedes rather than overwriting cents.';

-- =============================================================================
-- SECTION D — Snapshot includes the semantic
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pp_application_snapshot(p_application_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT jsonb_build_object(
    'id', a.id,
    'household_id', a.household_id,
    'opportunity_id', a.opportunity_id,
    'carrier_id', a.carrier_id,
    'product_id', a.product_id,
    'product_line', a.product_line::text,
    'state', a.state,
    'application_number', a.application_number,
    'policy_number', a.policy_number,
    'policy_number_normalized', a.policy_number_normalized,
    'is_replacement', a.is_replacement,
    'is_exchange_or_transfer', a.is_exchange_or_transfer,
    'face_amount_cents', a.face_amount_cents,
    'annuity_deposit_cents', a.annuity_deposit_cents,
    'premium_mode', a.premium_mode,
    'submitted_premium_cents', a.submitted_premium_cents,
    'target_premium_cents', a.target_premium_cents,
    'total_points_scaled', a.total_points_scaled,
    'production_stage', a.production_stage::text,
    'underwriting_disposition', a.underwriting_disposition::text,
    'delivery_status', a.delivery_status::text,
    'submission_date', a.submission_date,
    'decision_date', a.decision_date,
    'issue_date', a.issue_date,
    'in_force_date', a.in_force_date,
    'next_follow_up_date', a.next_follow_up_date,
    'production_month', a.production_month,
    'notes', a.notes,
    'created_by_user_id', a.created_by_user_id,
    'created_at', a.created_at,
    'updated_at', a.updated_at,
    'deleted_at', a.deleted_at,
    'writing_receivable_expected', a.writing_receivable_expected,
    'expected_compensation', public.pp_expected_compensation_snapshot(p_application_id),
    'beneficiaries', public.pp_current_beneficiaries_json(p_application_id)
  )
  FROM public.policy_applications a
  WHERE a.id = p_application_id;
$$;

-- =============================================================================
-- SECTION E — Future create/import can set the flag explicitly
-- =============================================================================

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
    'historical_entry',
    'writing_receivable_expected'
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
  v_writing_receivable boolean := true;
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

  -- Explicit writing-receivable flag. historical_entry does NOT set this.
  v_writing_receivable := COALESCE(
    public.pp_json_bool(p_payload, 'writing_receivable_expected', true),
    true
  );
  IF v_writing_receivable IS NOT TRUE THEN
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
      created_by_user_id, writing_receivable_expected
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
      v_uid,
      v_writing_receivable
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
  'Creates a draft policy application with optional participants/allocations and the opening NULL->draft history row. New-business catalog must be active. Owner historical_entry may preserve an exact inactive product FK. Does not reactivate or substitute products. writing_receivable_expected defaults true; owner may set false explicitly. historical_entry does not change writing-receivable eligibility.';

-- =============================================================================
-- SECTION F — Owner-only eligibility RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_policy_application_writing_receivable_expected(
  p_application_id uuid,
  p_writing_receivable_expected boolean,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_app public.policy_applications;
  v_before boolean;
  v_count integer;
  v_audit_id uuid;
BEGIN
  PERFORM public.pp_assert_owner();
  PERFORM public.pp_assert_can_access_application(p_application_id);

  IF p_writing_receivable_expected IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF v_reason IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF char_length(v_reason) > 500 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  SELECT * INTO v_app
  FROM public.policy_applications
  WHERE id = p_application_id
  FOR UPDATE;
  IF NOT FOUND OR v_app.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  v_before := v_app.writing_receivable_expected;

  PERFORM set_config(
    'crm.rpc_context',
    'set_policy_application_writing_receivable_expected',
    true
  );
  BEGIN
    IF v_before IS DISTINCT FROM p_writing_receivable_expected THEN
      UPDATE public.policy_applications
      SET writing_receivable_expected = p_writing_receivable_expected,
          updated_at = now()
      WHERE id = p_application_id;
    END IF;

    v_count := public.pp_refresh_application_expected_compensation(
      p_application_id,
      v_reason
    );

    v_audit_id := public.crm_write_audit(
      'set_policy_application_writing_receivable_expected',
      'policy_applications',
      p_application_id,
      jsonb_build_object(
        'writing_receivable_expected', v_before
      ),
      jsonb_build_object(
        'writing_receivable_expected', p_writing_receivable_expected,
        'reason', v_reason,
        'written', v_count,
        'changed', v_before IS DISTINCT FROM p_writing_receivable_expected
      )
    );
    IF v_audit_id IS NULL THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;

    PERFORM public.crm_clear_rpc_context();
    RETURN jsonb_build_object(
      'ok', true,
      'application_id', p_application_id,
      'writing_receivable_expected', p_writing_receivable_expected,
      'prior_writing_receivable_expected', v_before,
      'changed', v_before IS DISTINCT FROM p_writing_receivable_expected,
      'written', v_count,
      'audit_id', v_audit_id,
      'reason', v_reason,
      'application', public.pp_application_snapshot(p_application_id)
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.set_policy_application_writing_receivable_expected(uuid, boolean, text) IS
  'Owner-only. Sets writing_receivable_expected and refreshes 034. false supersedes live Expected snapshots without deleting history and writes no new live rows. Advisors cannot execute. Requires a reason. Reuses crm_write_audit. Does not change stage, protection, allocations, 035, Pending, Paid, or Chargebacks.';

GRANT EXECUTE ON FUNCTION public.set_policy_application_writing_receivable_expected(uuid, boolean, text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.set_policy_application_writing_receivable_expected(uuid, boolean, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_policy_application(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.create_policy_application(jsonb) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.pp_refresh_application_expected_compensation(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_application_snapshot(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_policy_application_protected_columns()
  FROM PUBLIC, anon, authenticated;
