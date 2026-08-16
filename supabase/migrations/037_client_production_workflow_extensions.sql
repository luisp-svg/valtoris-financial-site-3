-- Migration 037 — Client + Policy Production workflow extensions
--
-- LOCAL AUTHORING ONLY in this run. Do not apply to CRM-dev or CRM-prod here.
--
-- Scope (nothing else):
--   1. Production stages: paramed, sent_to_draft, premium_drafted
--   2. Structured policy-specific beneficiaries
--   3. quick_add_contact optional date_of_birth on household_members.date_of_birth
--
-- `draft` remains application draft. It must never mean premium drafted.
-- Compensation migrations 033–036 are not rewritten. No commission-release stages.

-- =============================================================================
-- SECTION A — Stage enum extension
-- =============================================================================

ALTER TYPE public.policy_application_stage ADD VALUE IF NOT EXISTS 'paramed';
ALTER TYPE public.policy_application_stage ADD VALUE IF NOT EXISTS 'sent_to_draft';
ALTER TYPE public.policy_application_stage ADD VALUE IF NOT EXISTS 'premium_drafted';

COMMENT ON TYPE public.policy_application_stage IS
  '032 stages plus 037 operational stages paramed, sent_to_draft, premium_drafted. draft is application draft only — never premium drafted. No closed, pending, eligible, or commission-release values.';

-- Stage/disposition table CHECK must stay aligned with pp_validate_stage_disposition.
ALTER TABLE public.policy_applications
  DROP CONSTRAINT IF EXISTS policy_applications_stage_disposition_check;

ALTER TABLE public.policy_applications
  ADD CONSTRAINT policy_applications_stage_disposition_check
  CHECK (
    CASE
      -- ::text so newly added 037 enum labels can be referenced in this
      -- same transaction (PG rejects unsafe use of new enum values).
      WHEN production_stage::text IN (
        'draft', 'pre_submitted', 'submitted', 'in_underwriting', 'paramed'
      ) THEN underwriting_disposition = 'pending'
      WHEN production_stage::text IN (
        'approved', 'issued', 'in_force', 'sent_to_draft', 'premium_drafted'
      ) THEN underwriting_disposition IN (
        'approved_as_applied',
        'approved_other_than_applied',
        'approved_with_amendment'
      )
      WHEN production_stage::text = 'declined' THEN underwriting_disposition = 'declined'
      WHEN production_stage::text = 'postponed' THEN underwriting_disposition = 'postponed'
      ELSE true
    END
  );

-- =============================================================================
-- SECTION B — Transition architecture (extend 032; do not add a second workflow)
-- =============================================================================
-- Allowed 037 edges (non-linear; not every policy traverses every stage):
--   submitted      → paramed | in_underwriting | approved | withdrawn | incomplete
--   paramed        → in_underwriting | approved | declined | postponed | withdrawn | incomplete
--   approved       → sent_to_draft | issued | not_taken | withdrawn
--                    approved → in_underwriting remains owner-only
--   sent_to_draft  → premium_drafted | issued | withdrawn | not_taken
--   premium_drafted → issued | not_taken | withdrawn
--
-- Intentionally NOT allowed (issuance / workflow integrity):
--   draft / pre_submitted → paramed | sent_to_draft | premium_drafted
--   submitted → issued | sent_to_draft | premium_drafted | in_force
--   paramed → sent_to_draft | premium_drafted | issued | in_force
--   in_underwriting → paramed
--   approved → premium_drafted (must go sent_to_draft, or issue directly)
--   sent_to_draft → in_force | approved | paramed
--   premium_drafted → in_force
--     Issuance creates the policies.source_application_id link. Skipping issued
--     would weaken that gate. Path is premium_drafted → issued → in_force.
--   any new stage as a reopen of declined | withdrawn | incomplete | not_taken | in_force
--   closed | pending | eligible | released | commission-release statuses (not enum values)

CREATE OR REPLACE FUNCTION public.pp_validate_stage_disposition(
  p_stage public.policy_application_stage,
  p_disposition public.policy_underwriting_disposition
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF p_stage IS NULL OR p_disposition IS NULL THEN
    PERFORM public.pp_raise('invalid_disposition');
  END IF;

  CASE p_stage::text
    WHEN 'draft', 'pre_submitted', 'submitted', 'in_underwriting', 'paramed' THEN
      IF p_disposition <> 'pending' THEN
        PERFORM public.pp_raise('invalid_disposition');
      END IF;
    WHEN 'approved', 'issued', 'in_force', 'sent_to_draft', 'premium_drafted' THEN
      IF p_disposition NOT IN (
        'approved_as_applied',
        'approved_other_than_applied',
        'approved_with_amendment'
      ) THEN
        PERFORM public.pp_raise('invalid_disposition');
      END IF;
    WHEN 'declined' THEN
      IF p_disposition <> 'declined' THEN
        PERFORM public.pp_raise('invalid_disposition');
      END IF;
    WHEN 'postponed' THEN
      IF p_disposition <> 'postponed' THEN
        PERFORM public.pp_raise('invalid_disposition');
      END IF;
    WHEN 'withdrawn', 'incomplete', 'not_taken' THEN
      NULL;
    ELSE
      PERFORM public.pp_raise('invalid_disposition');
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_assert_transition_allowed(
  p_from public.policy_application_stage,
  p_to public.policy_application_stage,
  p_is_owner boolean
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_allowed boolean := false;
  v_owner_only boolean := false;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from = p_to THEN
    PERFORM public.pp_raise('invalid_transition');
  END IF;

  CASE p_from::text
    WHEN 'draft' THEN
      v_allowed := p_to::text IN ('pre_submitted', 'submitted', 'withdrawn');
    WHEN 'pre_submitted' THEN
      v_allowed := p_to::text IN ('submitted', 'withdrawn');
    WHEN 'submitted' THEN
      v_allowed := p_to::text IN (
        'paramed', 'in_underwriting', 'approved', 'withdrawn', 'incomplete'
      );
    WHEN 'paramed' THEN
      v_allowed := p_to::text IN (
        'in_underwriting', 'approved', 'declined', 'postponed',
        'withdrawn', 'incomplete'
      );
    WHEN 'in_underwriting' THEN
      v_allowed := p_to::text IN (
        'submitted', 'approved', 'declined', 'postponed',
        'withdrawn', 'incomplete'
      );
    WHEN 'postponed' THEN
      v_allowed := p_to::text IN ('in_underwriting', 'withdrawn', 'declined');
    WHEN 'approved' THEN
      IF p_to::text = 'in_underwriting' THEN
        v_allowed := true;
        v_owner_only := true;
      ELSE
        v_allowed := p_to::text IN ('sent_to_draft', 'issued', 'not_taken', 'withdrawn');
      END IF;
    WHEN 'sent_to_draft' THEN
      v_allowed := p_to::text IN ('premium_drafted', 'issued', 'withdrawn', 'not_taken');
    WHEN 'premium_drafted' THEN
      -- withdrawn is allowed as abandonment after a drafted premium; in_force is not.
      v_allowed := p_to::text IN ('issued', 'not_taken', 'withdrawn');
    WHEN 'issued' THEN
      v_allowed := p_to::text IN ('in_force', 'not_taken');
    WHEN 'in_force', 'declined', 'withdrawn', 'incomplete', 'not_taken' THEN
      v_allowed := false;
    ELSE
      v_allowed := false;
  END CASE;

  IF NOT v_allowed THEN
    PERFORM public.pp_raise('invalid_transition');
  END IF;

  IF v_owner_only AND NOT COALESCE(p_is_owner, false) THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;
END;
$$;

COMMENT ON FUNCTION public.pp_assert_transition_allowed(public.policy_application_stage, public.policy_application_stage, boolean) IS
  '032 matrix plus 037 non-linear carrier edges. draft is application draft. premium_drafted never aliases draft. premium_drafted → in_force is rejected so issuance still creates the policy link. approved → in_underwriting remains owner-only.';

-- Disposition defaults and p_fields for the new stages. 032 transition body is
-- otherwise unchanged: issue still requires a policy number and creates the
-- policies.source_application_id link; in_force still requires that link plus
-- the existing delivery gate.
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
      'issue_date', 'policy_number', 'production_month', 'next_follow_up_date'
    ]
    WHEN 'in_force' THEN ARRAY[
      'in_force_date', 'production_month', 'next_follow_up_date'
    ]
    ELSE ARRAY[]::text[]
  END;
  PERFORM public.pp_assert_object_keys(v_fields, v_allowed_keys);

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
  IF v_to = 'issued' AND v_issue_date IS NULL THEN
    v_issue_date := GREATEST(current_date, COALESCE(v_submission_date, current_date));
  END IF;
  IF v_to = 'in_force' AND v_in_force_date IS NULL THEN
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
  '032 state machine plus 037 stages. Issuance still creates policies.source_application_id. in_force still requires that link and the delivery gate. premium_drafted cannot skip issued.';

-- =============================================================================
-- SECTION C — Structured policy-specific beneficiaries
-- =============================================================================
-- Identity: beneficiary_name is always stored (display). household_member_id is
-- optional and, when present, must belong to the same household as the
-- application. Payload never supplies application_id, so rows cannot silently
-- cross applications.
--
-- Percentages are integer basis points (100% = 10000). Primary and contingent
-- totals are independent. Each group may be incomplete (<100%) so draft
-- designations are allowed. Group total may not exceed 10000. Row 0 / negative
-- / >10000 is rejected. Missing beneficiaries do not block submit.
--
-- No tax-id, bank, PHI, or DOB columns.

CREATE TABLE IF NOT EXISTS public.policy_application_beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.policy_applications(id) ON DELETE CASCADE,
  household_member_id uuid REFERENCES public.household_members(id),
  beneficiary_name text NOT NULL,
  beneficiary_type text NOT NULL,
  percentage_bps integer NOT NULL,
  relationship text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by_user_id uuid,
  CONSTRAINT policy_application_beneficiaries_type_check
    CHECK (beneficiary_type IN ('primary', 'contingent')),
  CONSTRAINT policy_application_beneficiaries_name_check
    CHECK (char_length(btrim(beneficiary_name)) BETWEEN 1 AND 200),
  CONSTRAINT policy_application_beneficiaries_bps_check
    CHECK (percentage_bps > 0 AND percentage_bps <= 10000),
  CONSTRAINT policy_application_beneficiaries_rel_check
    CHECK (relationship IS NULL OR char_length(btrim(relationship)) BETWEEN 1 AND 100)
);

CREATE INDEX IF NOT EXISTS policy_application_beneficiaries_application_live_idx
  ON public.policy_application_beneficiaries (application_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS policy_application_beneficiaries_member_idx
  ON public.policy_application_beneficiaries (household_member_id)
  WHERE household_member_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE public.policy_application_beneficiaries IS
  'Policy-specific beneficiary designations. CRM recordkeeping only — not carrier suitability. No tax-id/bank/PHI/DOB. Does not affect writing splits or compensation.';

COMMENT ON COLUMN public.policy_application_beneficiaries.percentage_bps IS
  'Integer basis points. 100% = 10000, 50% = 5000. Primary and contingent groups total independently and may be incomplete.';

DROP TRIGGER IF EXISTS policy_application_beneficiaries_set_updated_at
  ON public.policy_application_beneficiaries;
CREATE TRIGGER policy_application_beneficiaries_set_updated_at
  BEFORE UPDATE ON public.policy_application_beneficiaries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_pp_beneficiary_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_ctx text := COALESCE(public.crm_rpc_context(), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.household_member_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.policy_applications a
      JOIN public.household_members hm ON hm.id = NEW.household_member_id
      WHERE a.id = NEW.application_id
        AND hm.deleted_at IS NULL
        AND hm.household_id = a.household_id
    ) THEN
      PERFORM public.pp_raise('household_mismatch');
    END IF;
  END IF;

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

  IF TG_OP = 'INSERT' THEN
    IF v_ctx IS DISTINCT FROM 'set_policy_application_beneficiaries' THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
    RETURN NEW;
  END IF;

  IF v_ctx IS DISTINCT FROM 'set_policy_application_beneficiaries' THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.application_id IS DISTINCT FROM OLD.application_id
     OR NEW.household_member_id IS DISTINCT FROM OLD.household_member_id
     OR NEW.beneficiary_name IS DISTINCT FROM OLD.beneficiary_name
     OR NEW.beneficiary_type IS DISTINCT FROM OLD.beneficiary_type
     OR NEW.percentage_bps IS DISTINCT FROM OLD.percentage_bps
     OR NEW.relationship IS DISTINCT FROM OLD.relationship
     OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF OLD.deleted_at IS NOT NULL OR NEW.deleted_at IS NULL THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS policy_application_beneficiaries_immutability
  ON public.policy_application_beneficiaries;
CREATE TRIGGER policy_application_beneficiaries_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.policy_application_beneficiaries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pp_beneficiary_immutability();

CREATE OR REPLACE FUNCTION public.pp_current_beneficiaries_json(p_application_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'household_member_id', b.household_member_id,
        'beneficiary_name', b.beneficiary_name,
        'beneficiary_type', b.beneficiary_type,
        'percentage_bps', b.percentage_bps,
        'relationship', b.relationship
      )
      ORDER BY b.beneficiary_type, b.created_at, b.id
    ),
    '[]'::jsonb
  )
  FROM public.policy_application_beneficiaries b
  WHERE b.application_id = p_application_id
    AND b.deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.pp_assert_beneficiaries_valid(
  p_application_id uuid,
  p_beneficiaries jsonb
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_allowed_keys text[] := ARRAY[
    'household_member_id',
    'beneficiary_name',
    'beneficiary_type',
    'percentage_bps',
    'relationship'
  ];
  v_el jsonb;
  v_name text;
  v_type text;
  v_bps integer;
  v_rel text;
  v_member uuid;
  v_primary bigint := 0;
  v_contingent bigint := 0;
BEGIN
  IF p_beneficiaries IS NULL OR jsonb_typeof(p_beneficiaries) <> 'array' THEN
    PERFORM public.pp_raise('invalid_beneficiaries');
  END IF;
  IF jsonb_array_length(p_beneficiaries) > 20 THEN
    PERFORM public.pp_raise('invalid_beneficiaries');
  END IF;

  FOR v_el IN SELECT value FROM jsonb_array_elements(p_beneficiaries)
  LOOP
    IF jsonb_typeof(v_el) <> 'object' THEN
      PERFORM public.pp_raise('invalid_beneficiaries');
    END IF;
    PERFORM public.pp_assert_object_keys(v_el, v_allowed_keys, 'invalid_beneficiaries');

    v_name := NULLIF(btrim(COALESCE(public.pp_json_text(v_el, 'beneficiary_name'), '')), '');
    IF v_name IS NULL OR char_length(v_name) > 200 THEN
      PERFORM public.pp_raise('invalid_beneficiaries');
    END IF;

    v_type := lower(COALESCE(public.pp_json_text(v_el, 'beneficiary_type'), ''));
    IF v_type NOT IN ('primary', 'contingent') THEN
      PERFORM public.pp_raise('invalid_beneficiaries');
    END IF;

    v_bps := public.pp_json_int(v_el, 'percentage_bps', 'invalid_beneficiaries');
    IF v_bps IS NULL OR v_bps <= 0 OR v_bps > 10000 THEN
      PERFORM public.pp_raise('invalid_beneficiaries');
    END IF;

    v_rel := NULLIF(btrim(COALESCE(public.pp_json_text(v_el, 'relationship'), '')), '');
    IF v_rel IS NOT NULL AND char_length(v_rel) > 100 THEN
      PERFORM public.pp_raise('invalid_beneficiaries');
    END IF;

    v_member := public.pp_json_uuid(v_el, 'household_member_id', 'invalid_beneficiaries');
    IF v_member IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.policy_applications a
      JOIN public.household_members hm ON hm.id = v_member
      WHERE a.id = p_application_id
        AND hm.deleted_at IS NULL
        AND hm.household_id = a.household_id
    ) THEN
      PERFORM public.pp_raise('household_mismatch');
    END IF;

    IF v_type = 'primary' THEN
      v_primary := v_primary + v_bps;
    ELSE
      v_contingent := v_contingent + v_bps;
    END IF;
  END LOOP;

  IF v_primary > 10000 OR v_contingent > 10000 THEN
    PERFORM public.pp_raise('invalid_beneficiaries');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_policy_application_beneficiaries(
  p_application_id uuid,
  p_beneficiaries jsonb,
  p_reason text DEFAULT NULL
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
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_el jsonb;
  v_count integer := 0;
  v_result jsonb;
BEGIN
  PERFORM public.pp_assert_can_access_application(p_application_id);

  SELECT * INTO v_app FROM public.policy_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND OR v_app.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  -- Pre-submit: owner or assigned advisor. After submit (including issued):
  -- owner plus a reason. Advisors may not restructure designations post-submit.
  -- Beneficiaries are CRM recordkeeping and may change after issue; they do not
  -- rewrite compensation.
  IF v_app.production_stage NOT IN ('draft', 'pre_submitted') THEN
    IF NOT v_is_owner THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
    IF v_reason IS NULL THEN
      PERFORM public.pp_raise('missing_required_fields');
    END IF;
  END IF;

  IF v_reason IS NOT NULL AND char_length(v_reason) > 500 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  PERFORM public.pp_assert_beneficiaries_valid(p_application_id, p_beneficiaries);

  PERFORM set_config('crm.rpc_context', 'set_policy_application_beneficiaries', true);
  BEGIN
    UPDATE public.policy_application_beneficiaries
    SET deleted_at = now()
    WHERE application_id = p_application_id
      AND deleted_at IS NULL;

    FOR v_el IN SELECT value FROM jsonb_array_elements(COALESCE(p_beneficiaries, '[]'::jsonb))
    LOOP
      INSERT INTO public.policy_application_beneficiaries (
        application_id,
        household_member_id,
        beneficiary_name,
        beneficiary_type,
        percentage_bps,
        relationship,
        created_by_user_id
      ) VALUES (
        p_application_id,
        public.pp_json_uuid(v_el, 'household_member_id', 'invalid_beneficiaries'),
        btrim(public.pp_json_text(v_el, 'beneficiary_name')),
        lower(public.pp_json_text(v_el, 'beneficiary_type')),
        public.pp_json_int(v_el, 'percentage_bps', 'invalid_beneficiaries'),
        NULLIF(btrim(COALESCE(public.pp_json_text(v_el, 'relationship'), '')), ''),
        v_uid
      );
      v_count := v_count + 1;
    END LOOP;

    v_result := jsonb_build_object(
      'ok', true,
      'application_id', p_application_id,
      'beneficiary_count', v_count,
      'beneficiaries', public.pp_current_beneficiaries_json(p_application_id)
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.set_policy_application_beneficiaries(uuid, jsonb, text) IS
  'Replaces the live beneficiary set for one application. Payload cannot set application_id or protected columns. Pre-submit: owner/advisor. Post-submit: owner plus reason. Does not touch compensation.';

-- 034 snapshot plus live beneficiaries. expected_compensation is unchanged.
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
    'expected_compensation', public.pp_expected_compensation_snapshot(p_application_id),
    'beneficiaries', public.pp_current_beneficiaries_json(p_application_id)
  )
  FROM public.policy_applications a
  WHERE a.id = p_application_id;
$$;

ALTER TABLE public.policy_application_beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_application_beneficiaries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_application_beneficiaries_select
  ON public.policy_application_beneficiaries;
CREATE POLICY policy_application_beneficiaries_select
  ON public.policy_application_beneficiaries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.policy_applications a
      WHERE a.id = policy_application_beneficiaries.application_id
        AND (
          public.crm_is_owner()
          OR (a.deleted_at IS NULL AND public.crm_can_access_household(a.household_id))
        )
    )
  );

REVOKE ALL ON TABLE public.policy_application_beneficiaries FROM PUBLIC;
REVOKE ALL ON TABLE public.policy_application_beneficiaries FROM anon;
REVOKE ALL ON TABLE public.policy_application_beneficiaries FROM authenticated;
GRANT SELECT ON TABLE public.policy_application_beneficiaries TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.policy_application_beneficiaries FROM authenticated;
GRANT ALL ON TABLE public.policy_application_beneficiaries TO service_role;

REVOKE ALL ON FUNCTION public.enforce_pp_beneficiary_immutability()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_current_beneficiaries_json(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_assert_beneficiaries_valid(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_policy_application_beneficiaries(uuid, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_policy_application_beneficiaries(uuid, jsonb, text)
  TO authenticated;

-- =============================================================================
-- SECTION D — quick_add_contact optional DOB on household_members.date_of_birth
-- =============================================================================
-- Reuses the existing 004 column. No second DOB field. Omitted DOB stays NULL.

CREATE OR REPLACE FUNCTION public.quick_add_parse_date_of_birth(p_payload jsonb)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_raw text;
  v_dob date;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN NULL;
  END IF;
  IF NOT (p_payload ? 'date_of_birth') THEN
    RETURN NULL;
  END IF;
  v_raw := NULLIF(btrim(COALESCE(p_payload->>'date_of_birth', '')), '');
  IF v_raw IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    v_dob := v_raw::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_date_of_birth' USING ERRCODE = '22023';
  END;
  IF v_dob > current_date THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_date_of_birth' USING ERRCODE = '22023';
  END IF;
  IF v_dob < DATE '1900-01-01' THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_date_of_birth' USING ERRCODE = '22023';
  END IF;
  RETURN v_dob;
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_add_contact(
  p_payload jsonb,
  p_mode text,
  p_create_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_owner boolean;
  v_mode text := lower(btrim(COALESCE(p_mode, '')));
  v_first text; v_last text; v_display text;
  v_email_raw text; v_phone_raw text;
  v_email extensions.citext; v_phone text;
  v_company text; v_job_title text; v_website text;
  v_city text; v_state text; v_how_we_met text;
  v_category public.contact_category;
  v_note text; v_task_title text; v_task_due date;
  v_dob date;
  v_consent jsonb;
  v_assign_advisor_id uuid; v_owner_advisor_id uuid;
  v_fingerprint text; v_rows jsonb; v_ack_current jsonb;
  v_token public.quick_add_duplicate_tokens; v_token_hash text;
  v_pipeline_id uuid := '22222222-2222-2222-2222-222222222201'::uuid;
  v_stage_id uuid := '33333333-3333-3333-3333-333333333001'::uuid;
  v_household_id uuid; v_member_id uuid; v_lead_id uuid;
  v_note_id uuid; v_task_id uuid;
  v_now timestamptz := now();
  v_assigned_user_id uuid;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'QUICK_ADD:not_authenticated' USING ERRCODE = '42501'; END IF;
  PERFORM public.quick_add_assert_payload_size(p_payload);
  PERFORM public.quick_add_assert_object_keys(
    p_payload,
    ARRAY[
      'first_name','last_name','email','phone','company','job_title','website',
      'city','state','contact_category','how_we_met','note','private_note',
      'follow_up_task_title','follow_up_due_date','assigned_advisor_id','consent',
      'date_of_birth'
    ]
  );
  IF v_mode NOT IN ('create', 'create_separate') THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_mode' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.crm_is_owner() OR public.crm_is_advisor()) THEN
    RAISE EXCEPTION 'QUICK_ADD:not_authorized' USING ERRCODE = '42501';
  END IF;
  v_is_owner := public.crm_is_owner();

  v_first := NULLIF(btrim(COALESCE(p_payload->>'first_name', '')), '');
  v_last := NULLIF(btrim(COALESCE(p_payload->>'last_name', '')), '');
  IF v_first IS NULL OR v_last IS NULL OR char_length(v_first) > 100 OR char_length(v_last) > 100 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_name' USING ERRCODE = '22023';
  END IF;
  v_display := btrim(v_first || ' ' || v_last);
  v_email_raw := NULLIF(btrim(COALESCE(p_payload->>'email', '')), '');
  v_phone_raw := NULLIF(btrim(COALESCE(p_payload->>'phone', '')), '');
  v_email := public.crm_normalize_quick_add_email(v_email_raw);
  v_phone := public.crm_normalize_quick_add_phone(v_phone_raw);
  IF v_email IS NULL AND v_phone IS NULL THEN
    RAISE EXCEPTION 'QUICK_ADD:contact_required' USING ERRCODE = '22023';
  END IF;
  v_company := public.crm_normalize_quick_add_company(p_payload->>'company');
  IF v_company IS NOT NULL AND char_length(v_company) > 200 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_field' USING ERRCODE = '22023';
  END IF;
  v_job_title := NULLIF(btrim(COALESCE(p_payload->>'job_title', '')), '');
  IF v_job_title IS NOT NULL AND char_length(v_job_title) > 200 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_field' USING ERRCODE = '22023';
  END IF;
  v_website := NULLIF(btrim(COALESCE(p_payload->>'website', '')), '');
  IF v_website IS NOT NULL AND NOT public.quick_add_is_safe_website(v_website) THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_website' USING ERRCODE = '22023';
  END IF;
  v_city := NULLIF(btrim(COALESCE(p_payload->>'city', '')), '');
  v_state := NULLIF(btrim(COALESCE(p_payload->>'state', '')), '');
  IF (v_city IS NOT NULL AND char_length(v_city) > 100) OR (v_state IS NOT NULL AND char_length(v_state) > 50) THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_field' USING ERRCODE = '22023';
  END IF;
  v_how_we_met := NULLIF(btrim(COALESCE(p_payload->>'how_we_met', '')), '');
  IF v_how_we_met IS NOT NULL AND char_length(v_how_we_met) > 500 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_field' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_category := (NULLIF(btrim(COALESCE(p_payload->>'contact_category', '')), ''))::public.contact_category;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_category' USING ERRCODE = '22023';
  END;
  IF v_category IS NULL THEN RAISE EXCEPTION 'QUICK_ADD:invalid_category' USING ERRCODE = '22023'; END IF;

  v_note := NULLIF(btrim(COALESCE(p_payload->>'note', p_payload->>'private_note', '')), '');
  IF v_note IS NOT NULL AND char_length(v_note) > 5000 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_field' USING ERRCODE = '22023';
  END IF;
  v_task_title := NULLIF(btrim(COALESCE(p_payload->>'follow_up_task_title', '')), '');
  IF v_task_title IS NOT NULL AND char_length(v_task_title) > 200 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_field' USING ERRCODE = '22023';
  END IF;
  IF p_payload ? 'follow_up_due_date' AND NULLIF(p_payload->>'follow_up_due_date', '') IS NOT NULL THEN
    BEGIN v_task_due := (p_payload->>'follow_up_due_date')::date;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'QUICK_ADD:invalid_due_date' USING ERRCODE = '22023'; END;
  END IF;
  IF v_task_due IS NOT NULL AND v_task_title IS NULL THEN v_task_title := 'Follow up — ' || v_display; END IF;
  IF v_task_title IS NOT NULL AND v_task_due IS NULL THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_due_date' USING ERRCODE = '22023';
  END IF;

  v_dob := public.quick_add_parse_date_of_birth(p_payload);

  v_consent := public.quick_add_parse_consent(p_payload);

  SELECT ap.id INTO v_owner_advisor_id FROM public.advisor_profiles ap
  WHERE ap.user_id = v_uid AND ap.deleted_at IS NULL AND ap.is_active = true LIMIT 1;

  IF v_is_owner THEN
    IF NULLIF(p_payload->>'assigned_advisor_id', '') IS NOT NULL THEN
      BEGIN v_assign_advisor_id := (p_payload->>'assigned_advisor_id')::uuid;
      EXCEPTION WHEN others THEN RAISE EXCEPTION 'QUICK_ADD:invalid_advisor' USING ERRCODE = '22023'; END;
    ELSE
      v_assign_advisor_id := v_owner_advisor_id;
    END IF;
    IF v_assign_advisor_id IS NULL THEN RAISE EXCEPTION 'QUICK_ADD:advisor_required' USING ERRCODE = '22023'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.advisor_profiles ap
      WHERE ap.id = v_assign_advisor_id AND ap.deleted_at IS NULL AND ap.is_active = true
    ) THEN RAISE EXCEPTION 'QUICK_ADD:invalid_advisor' USING ERRCODE = '22023'; END IF;
  ELSE
    v_assign_advisor_id := public.crm_advisor_id();
    IF v_assign_advisor_id IS NULL THEN RAISE EXCEPTION 'QUICK_ADD:not_authorized' USING ERRCODE = '42501'; END IF;
    IF NULLIF(p_payload->>'assigned_advisor_id', '') IS NOT NULL
       AND (p_payload->>'assigned_advisor_id')::uuid IS DISTINCT FROM v_assign_advisor_id THEN
      RAISE EXCEPTION 'QUICK_ADD:assignment_spoof' USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM public.quick_add_cleanup_tokens();
  v_fingerprint := public.quick_add_payload_fingerprint(v_email, v_phone, v_first, v_last, v_company);
  PERFORM public.quick_add_acquire_identity_locks(v_email, v_phone);
  v_rows := public.quick_add_collect_match_rows(v_email, v_phone, v_first, v_last, v_company, NULL);
  v_ack_current := public.quick_add_collision_ack_from_rows(v_rows, v_is_owner);

  IF v_mode = 'create' THEN
    IF jsonb_array_length(v_rows) > 0 THEN
      RETURN jsonb_build_object(
        'ok', false, 'reason', 'collision',
        'matches', (public.quick_add_format_match_response(v_rows, v_is_owner))->'matches',
        'has_restricted_collision', (public.quick_add_format_match_response(v_rows, v_is_owner))->'has_restricted_collision'
      );
    END IF;
  ELSE
    IF p_create_token IS NULL OR btrim(p_create_token) = '' THEN
      RAISE EXCEPTION 'QUICK_ADD:invalid_token' USING ERRCODE = '22023';
    END IF;
    v_token_hash := encode(extensions.digest(btrim(p_create_token), 'sha256'), 'hex');
    SELECT * INTO v_token FROM public.quick_add_duplicate_tokens t
    WHERE t.token_hash = v_token_hash AND t.actor_user_id = v_uid
      AND t.operation = 'create' AND t.consumed_at IS NULL AND t.expires_at > v_now
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'QUICK_ADD:invalid_token' USING ERRCODE = '22023'; END IF;
    IF v_token.payload_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'QUICK_ADD:invalid_token' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(v_rows) > 0
       AND NOT public.quick_add_ack_covers_current(v_token.acknowledged, v_ack_current) THEN
      RAISE EXCEPTION 'QUICK_ADD:invalid_token' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM set_config('crm.rpc_context', 'quick_add_contact', true);
  BEGIN
    INSERT INTO public.households (
      display_name, status, primary_email, normalized_email, primary_phone, normalized_phone,
      city, state, relationship_pipeline_id, relationship_stage_id, stage_entered_at, lead_source,
      assigned_advisor_id, assigned_at, assigned_by_user_id, assignment_reason,
      original_advisor_id, created_by_user_id
    ) VALUES (
      v_display, 'lead', v_email_raw, v_email, v_phone_raw, v_phone, v_city, v_state,
      v_pipeline_id, v_stage_id, v_now, 'manual_contact',
      v_assign_advisor_id, v_now, v_uid, 'manual', v_assign_advisor_id, v_uid
    ) RETURNING id INTO v_household_id;

    INSERT INTO public.advisor_assignments (
      household_id, advisor_id, assignment_role, reason, is_attribution_source,
      assigned_by_user_id, effective_from
    ) VALUES (v_household_id, v_assign_advisor_id, 'primary', 'manual', false, v_uid, v_now);

    INSERT INTO public.household_members (
      household_id, first_name, last_name, relationship, is_primary_contact,
      email, normalized_email, phone, normalized_phone, company, job_title, website,
      date_of_birth
    ) VALUES (
      v_household_id, v_first, v_last, 'primary', true,
      v_email_raw, v_email, v_phone_raw, v_phone, v_company, v_job_title, v_website,
      v_dob
    ) RETURNING id INTO v_member_id;

    INSERT INTO public.leads (
      household_id, lead_type, status, source_page, submitted_at, attribution_method,
      assigned_advisor_id, assigned_at, assigned_by_user_id, assignment_reason, original_advisor_id,
      normalized_email, normalized_phone, consent_snapshot, contact_category, how_we_met,
      created_by_user_id, raw_payload, original_source_metadata, sheets_sync_status
    ) VALUES (
      v_household_id, 'Manual Contact', 'assigned', 'crm_quick_add', v_now, 'unknown',
      v_assign_advisor_id, v_now, v_uid, 'manual', v_assign_advisor_id,
      v_email, v_phone, v_consent, v_category, v_how_we_met,
      v_uid, '{}'::jsonb, '{}'::jsonb, 'skipped'
    ) RETURNING id INTO v_lead_id;

    IF v_note IS NOT NULL THEN
      INSERT INTO public.notes (household_id, author_user_id, body, visibility)
      VALUES (v_household_id, v_uid, v_note, 'internal') RETURNING id INTO v_note_id;
    END IF;

    IF v_task_title IS NOT NULL THEN
      SELECT ap.user_id INTO v_assigned_user_id FROM public.advisor_profiles ap
      WHERE ap.id = v_assign_advisor_id AND ap.deleted_at IS NULL LIMIT 1;
      INSERT INTO public.tasks (
        household_id, lead_id, title, due_date, priority, status,
        assigned_user_id, created_by_user_id, source_type
      ) VALUES (
        v_household_id, v_lead_id, v_task_title, v_task_due, 'medium', 'open',
        v_assigned_user_id, v_uid, 'manual'
      ) RETURNING id INTO v_task_id;
    END IF;

    IF v_mode = 'create_separate' THEN
      UPDATE public.quick_add_duplicate_tokens
      SET consumed_at = v_now
      WHERE id = v_token.id AND consumed_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'QUICK_ADD:invalid_token' USING ERRCODE = '22023'; END IF;
    END IF;

    v_result := jsonb_build_object(
      'ok', true, 'created', true,
      'household_id', v_household_id, 'member_id', v_member_id, 'lead_id', v_lead_id,
      'note_id', v_note_id, 'task_id', v_task_id, 'mode', v_mode
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.quick_add_contact(jsonb, text, text) IS
  'Transactional Manual Contact create. Optional date_of_birth writes household_members.date_of_birth only. Omitted DOB remains NULL.';

REVOKE ALL ON FUNCTION public.quick_add_parse_date_of_birth(jsonb)
  FROM PUBLIC, anon, authenticated;
