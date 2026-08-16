-- 034_writing_advisor_expected_compensation.sql
-- Writing-advisor EXPECTED compensation snapshots.
--
-- Adds:
--   public.policy_application_expected_compensations
--   internal helper pp_refresh_application_expected_compensation
--   owner RPC recalculate_policy_application_expected_compensation
--   submit / issue / pre-issue input-change refresh
--   role-filtered snapshot JSON on pp_application_snapshot
--
-- This is writing-advisor expected compensation only. It does NOT model
-- upline, generational, hierarchy, spread, or override compensation.
-- House and servicing allocations do not receive expected rows.
--
-- It does NOT store pending / eligible / released / paid / adjusted /
-- chargeback ledger states. Those belong to a later actual-commission
-- ledger. Withdrawn, declined, not_taken, or later chargeback do not
-- rewrite expected cents to $0.
--
-- First snapshot: entering submitted from draft/pre_submitted.
-- Keep current through underwriting via supersede (never in-place cents
-- overwrite). Final automatic recalc at issued, then freeze.
-- Post-issue corrections: owner-only recalculate RPC.
--
-- Do not calculate while the case is merely Draft.
--
-- Rate-card effective lookup date:
--   1. policy_applications.submission_date
--   2. fallback policy_applications.issue_date
--   3. otherwise review_required
-- Do NOT use created_at for money calculations.
--
-- Issue age is NOT modeled in 034. Carrier/product age conventions
-- (last birthday, nearest birthday, attained age, and others) are not
-- approved yet. 034 never derives a compensation age from DOB and never
-- uses household_members.age.
--
-- Age-band distinction for the 177-card package:
--   A. Administrative eligibility cap: exactly one date-valid card whose
--      age_min is NULL or 0 (the 143 life cards are NULL–75; most FIA
--      singles are 0–75). That cap is not a selector among rates, so the
--      unique card may resolve without an issue-age convention.
--   B. True age-dependent schedule: more than one date-valid card, or a
--      unique card with age_min > 0 (source-printed floor). Fail closed
--      as review_required / age_sensitive_rate_card. Do not pick first,
--      highest, or latest, and do not invent an age to disambiguate.
--
-- Fail closed. Missing/ambiguous data is review_required or unavailable.
-- Never store $0 for those cases. Submit still succeeds.
--
-- Expected compensation uses policy_agent_allocations.writing_contract_level,
-- never the advisor's current advisor_profiles.contract_level.

-- =============================================================================
-- SECTION A — Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.policy_application_expected_compensations (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.policy_applications (id) ON DELETE RESTRICT,
  allocation_id uuid NOT NULL REFERENCES public.policy_agent_allocations (id) ON DELETE RESTRICT,
  advisor_id uuid NOT NULL REFERENCES public.advisor_profiles (id) ON DELETE RESTRICT,
  product_compensation_schedule_id uuid
    REFERENCES public.product_compensation_schedules (id) ON DELETE RESTRICT,
  writing_contract_level text,
  writing_rate numeric(8, 6),
  compensation_base_cents bigint,
  commission_bps integer,
  expected_compensation_cents bigint,
  calculation_status text NOT NULL,
  review_reason text,
  lookup_date date,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  supersede_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT policy_expected_comp_status_check
    CHECK (calculation_status IN ('resolved', 'review_required', 'unavailable')),
  CONSTRAINT policy_expected_comp_review_reason_check
    CHECK (
      review_reason IS NULL
      OR review_reason IN (
        'missing_writing_contract_level',
        'missing_lookup_date',
        'missing_compensation_base',
        'premium_mode_not_annualizable',
        'no_rate_card',
        'no_rate_card_for_lookup_date',
        'age_sensitive_rate_card'
      )
    ),
  CONSTRAINT policy_expected_comp_status_shape_check
    CHECK (
      (
        calculation_status = 'resolved'
        AND review_reason IS NULL
        AND expected_compensation_cents IS NOT NULL
        AND compensation_base_cents IS NOT NULL
        AND writing_rate IS NOT NULL
        AND writing_contract_level IS NOT NULL
        AND commission_bps IS NOT NULL
        AND product_compensation_schedule_id IS NOT NULL
        AND lookup_date IS NOT NULL
      )
      OR (
        calculation_status IN ('review_required', 'unavailable')
        AND expected_compensation_cents IS NULL
        AND review_reason IS NOT NULL
      )
    ),
  CONSTRAINT policy_expected_comp_unavailable_reason_check
    CHECK (
      calculation_status <> 'unavailable'
      OR review_reason = 'no_rate_card'
    ),
  CONSTRAINT policy_expected_comp_rank_check
    CHECK (
      writing_contract_level IS NULL
      OR writing_contract_level IN ('FA', 'SFA', 'SM', 'ED')
    ),
  CONSTRAINT policy_expected_comp_rate_range_check
    CHECK (writing_rate IS NULL OR (writing_rate >= 0 AND writing_rate <= 2)),
  CONSTRAINT policy_expected_comp_base_nonnegative_check
    CHECK (compensation_base_cents IS NULL OR compensation_base_cents >= 0),
  CONSTRAINT policy_expected_comp_cents_nonnegative_check
    CHECK (expected_compensation_cents IS NULL OR expected_compensation_cents >= 0),
  CONSTRAINT policy_expected_comp_bps_range_check
    CHECK (commission_bps IS NULL OR commission_bps BETWEEN 0 AND 10000),
  CONSTRAINT policy_expected_comp_supersede_shape_check
    CHECK (
      (superseded_at IS NULL AND supersede_reason IS NULL)
      OR (
        superseded_at IS NOT NULL
        AND supersede_reason IS NOT NULL
        AND char_length(btrim(supersede_reason)) BETWEEN 1 AND 500
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS policy_expected_comp_live_allocation_idx
  ON public.policy_application_expected_compensations (allocation_id)
  WHERE superseded_at IS NULL;

CREATE INDEX IF NOT EXISTS policy_expected_comp_application_live_idx
  ON public.policy_application_expected_compensations (application_id)
  WHERE superseded_at IS NULL;

CREATE INDEX IF NOT EXISTS policy_expected_comp_advisor_idx
  ON public.policy_application_expected_compensations (advisor_id);

DROP TRIGGER IF EXISTS policy_expected_comp_set_updated_at
  ON public.policy_application_expected_compensations;
CREATE TRIGGER policy_expected_comp_set_updated_at
  BEFORE UPDATE ON public.policy_application_expected_compensations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.policy_application_expected_compensations IS
  'Writing-advisor expected compensation snapshots. One live row per writing-advisor allocation. House and servicing allocations are excluded. Historical versions are superseded, never overwritten in place. Not an actual commission ledger.';
COMMENT ON COLUMN public.policy_application_expected_compensations.writing_contract_level IS
  'Copied from policy_agent_allocations.writing_contract_level at calculation time. Not the advisor current profile rank.';
COMMENT ON COLUMN public.policy_application_expected_compensations.writing_rate IS
  'Selected FA/SFA/SM/ED decimal fraction from the matched rate card. NUMERIC, never float.';
COMMENT ON COLUMN public.policy_application_expected_compensations.compensation_base_cents IS
  'Life: annualized submitted_premium_cents. FIA: annuity_deposit_cents. Integer cents.';
COMMENT ON COLUMN public.policy_application_expected_compensations.expected_compensation_cents IS
  'round(base * writing_rate * commission_bps / 10000). NULL when not resolved. Never $0 for review_required/unavailable.';
COMMENT ON COLUMN public.policy_application_expected_compensations.lookup_date IS
  'Rate-card effective lookup date: submission_date, else issue_date. Never created_at.';
COMMENT ON COLUMN public.policy_application_expected_compensations.review_reason IS
  'Deterministic fail-closed reason. age_sensitive_rate_card means more than one date-valid card, or a unique card with a positive age_min, and no approved issue-age convention exists.';

-- =============================================================================
-- SECTION B — Immutability
-- =============================================================================

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
    'recalculate_policy_application_expected_compensation'
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

DROP TRIGGER IF EXISTS policy_expected_comp_immutability
  ON public.policy_application_expected_compensations;
CREATE TRIGGER policy_expected_comp_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.policy_application_expected_compensations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_policy_expected_comp_immutability();

REVOKE ALL ON FUNCTION public.enforce_policy_expected_comp_immutability()
  FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION C — Calculation helpers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pp_expected_comp_select_rate(
  p_level text,
  p_fa numeric,
  p_sfa numeric,
  p_sm numeric,
  p_ed numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT CASE p_level
    WHEN 'FA' THEN p_fa
    WHEN 'SFA' THEN p_sfa
    WHEN 'SM' THEN p_sm
    WHEN 'ED' THEN p_ed
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.pp_expected_comp_round_cents(
  p_base_cents bigint,
  p_rate numeric,
  p_commission_bps integer
)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT CASE
    WHEN p_base_cents IS NULL OR p_rate IS NULL OR p_commission_bps IS NULL THEN NULL
    ELSE round(
      p_base_cents::numeric * p_rate * p_commission_bps::numeric / 10000,
      0
    )::bigint
  END;
$$;

CREATE OR REPLACE FUNCTION public.pp_expected_compensation_snapshot(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_is_owner boolean := public.crm_is_owner();
  v_advisor uuid := public.crm_advisor_id();
  v_rows jsonb;
  v_total bigint;
BEGIN
  IF v_is_owner THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id,
      'allocation_id', e.allocation_id,
      'advisor_id', e.advisor_id,
      'advisor_display_name', ap.display_name,
      'product_compensation_schedule_id', e.product_compensation_schedule_id,
      'writing_contract_level', e.writing_contract_level,
      'writing_rate', e.writing_rate,
      'compensation_base_cents', e.compensation_base_cents,
      'commission_bps', e.commission_bps,
      'expected_compensation_cents', e.expected_compensation_cents,
      'calculation_status', e.calculation_status,
      'review_reason', e.review_reason,
      'lookup_date', e.lookup_date,
      'calculated_at', e.calculated_at
    ) ORDER BY ap.display_name, e.id), '[]'::jsonb)
    INTO v_rows
    FROM public.policy_application_expected_compensations e
    JOIN public.advisor_profiles ap ON ap.id = e.advisor_id
    WHERE e.application_id = p_application_id
      AND e.superseded_at IS NULL;

    SELECT coalesce(sum(e.expected_compensation_cents), 0)
    INTO v_total
    FROM public.policy_application_expected_compensations e
    WHERE e.application_id = p_application_id
      AND e.superseded_at IS NULL
      AND e.calculation_status = 'resolved';

    RETURN jsonb_build_object(
      'viewer', 'owner',
      'rows', v_rows,
      'resolved_total_cents', v_total,
      'review_required_count', (
        SELECT count(*)::int
        FROM public.policy_application_expected_compensations e
        WHERE e.application_id = p_application_id
          AND e.superseded_at IS NULL
          AND e.calculation_status = 'review_required'
      ),
      'unavailable_count', (
        SELECT count(*)::int
        FROM public.policy_application_expected_compensations e
        WHERE e.application_id = p_application_id
          AND e.superseded_at IS NULL
          AND e.calculation_status = 'unavailable'
      )
    );
  END IF;

  SELECT jsonb_build_object(
    'id', e.id,
    'writing_contract_level', e.writing_contract_level,
    'writing_rate', e.writing_rate,
    'compensation_base_cents', e.compensation_base_cents,
    'commission_bps', e.commission_bps,
    'expected_compensation_cents', e.expected_compensation_cents,
    'calculation_status', e.calculation_status,
    'review_reason', e.review_reason,
    'lookup_date', e.lookup_date,
    'calculated_at', e.calculated_at
  )
  INTO v_rows
  FROM public.policy_application_expected_compensations e
  WHERE e.application_id = p_application_id
    AND e.superseded_at IS NULL
    AND e.advisor_id = v_advisor
  LIMIT 1;

  RETURN jsonb_build_object(
    'viewer', 'advisor',
    'row', v_rows
  );
END;
$$;

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
    'expected_compensation', public.pp_expected_compensation_snapshot(p_application_id)
  )
  FROM public.policy_applications a
  WHERE a.id = p_application_id;
$$;

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
  'Internal. Writes writing-advisor expected snapshots for current allocations. Never raises for missing rates; writes unavailable/review_required instead. Does nothing in draft/pre_submitted. Supersedes rather than overwriting cents.';

CREATE OR REPLACE FUNCTION public.pp_trg_refresh_application_expected_compensation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  PERFORM public.pp_refresh_application_expected_compensation(
    NEW.id,
    CASE
      WHEN NEW.production_stage = 'submitted'
           AND OLD.production_stage IN ('draft', 'pre_submitted') THEN 'submitted'
      WHEN NEW.production_stage = 'issued' THEN 'issued'
      ELSE 'inputs_changed'
    END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS policy_applications_refresh_expected_compensation
  ON public.policy_applications;
CREATE TRIGGER policy_applications_refresh_expected_compensation
  AFTER UPDATE ON public.policy_applications
  FOR EACH ROW
  WHEN (
    (
      NEW.production_stage = 'submitted'
      AND OLD.production_stage IN ('draft', 'pre_submitted')
    )
    OR (
      NEW.production_stage = 'issued'
      AND OLD.production_stage IS DISTINCT FROM 'issued'
    )
    OR (
      NEW.production_stage IN ('submitted', 'in_underwriting', 'postponed', 'approved')
      AND (
        NEW.submitted_premium_cents IS DISTINCT FROM OLD.submitted_premium_cents
        OR NEW.premium_mode IS DISTINCT FROM OLD.premium_mode
        OR NEW.annuity_deposit_cents IS DISTINCT FROM OLD.annuity_deposit_cents
        OR NEW.submission_date IS DISTINCT FROM OLD.submission_date
        OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
      )
    )
  )
  EXECUTE FUNCTION public.pp_trg_refresh_application_expected_compensation();

-- =============================================================================
-- SECTION D — Wire allocation changes + owner recalc RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_policy_application_allocations(
  p_application_id uuid,
  p_allocations jsonb,
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
  v_count integer;
  v_result jsonb;
BEGIN
  PERFORM public.pp_assert_can_access_application(p_application_id);

  SELECT * INTO v_app FROM public.policy_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND OR v_app.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  PERFORM public.pp_assert_allocations_valid(p_allocations);
  PERFORM public.pp_assert_house_rows_authorized(p_allocations);

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

  PERFORM set_config('crm.rpc_context', 'set_policy_application_allocations', true);
  BEGIN
    v_count := public.pp_apply_allocations(p_application_id, p_allocations, v_reason, v_uid);

    IF v_app.production_stage IN ('submitted', 'in_underwriting', 'postponed', 'approved') THEN
      PERFORM public.pp_refresh_application_expected_compensation(
        p_application_id,
        'allocation_changed'
      );
    END IF;

    v_result := jsonb_build_object(
      'ok', true,
      'application_id', p_application_id,
      'allocation_count', v_count,
      'allocations', public.pp_current_allocations_json(p_application_id)
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.set_policy_application_allocations(uuid, jsonb, text) IS
  'Supersedes the whole current allocation set. Writing rows sum to 10000 bps on commission and production credit independently; servicing rows are zeroed. House rows are owner-only; post-submit changes are owner-only plus reason. Refreshes expected writing compensation before issue.';

CREATE OR REPLACE FUNCTION public.recalculate_policy_application_expected_compensation(
  p_application_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_count integer;
  v_before jsonb;
  v_after jsonb;
  v_changed boolean;
  v_audit_id uuid;
BEGIN
  PERFORM public.pp_assert_owner();
  PERFORM public.pp_assert_can_access_application(p_application_id);

  IF v_reason IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF char_length(v_reason) > 500 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  PERFORM set_config(
    'crm.rpc_context',
    'recalculate_policy_application_expected_compensation',
    true
  );
  BEGIN
    v_before := public.pp_expected_compensation_snapshot(p_application_id);
    v_count := public.pp_refresh_application_expected_compensation(
      p_application_id,
      v_reason
    );
    v_after := public.pp_expected_compensation_snapshot(p_application_id);
    v_changed := v_before IS DISTINCT FROM v_after;

    -- Always write one audit_logs row, including financial no-ops.
    -- Do not manufacture a superseded expected-comp version solely to
    -- record the request. Reuses public.crm_write_audit / audit_logs.
    v_audit_id := public.crm_write_audit(
      'recalculate_policy_application_expected_compensation',
      'policy_applications',
      p_application_id,
      v_before,
      jsonb_build_object(
        'reason', v_reason,
        'written', v_count,
        'financial_values_changed', v_changed,
        'expected_compensation', v_after
      )
    );
    IF v_audit_id IS NULL THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;

    PERFORM public.crm_clear_rpc_context();
    RETURN jsonb_build_object(
      'ok', true,
      'application_id', p_application_id,
      'written', v_count,
      'financial_values_changed', v_changed,
      'audit_id', v_audit_id,
      'expected_compensation', v_after
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.recalculate_policy_application_expected_compensation(uuid, text) IS
  'Owner-only. Refreshes expected snapshots (supersede+insert when values change; skip identical). Always writes one public.audit_logs row via crm_write_audit with the required reason, even on a financial no-op. Never overwrites cents in place. Advisors cannot execute this.';

-- =============================================================================
-- SECTION E — RLS / grants
-- Expected dollars are advisor-private. A writing advisor may SELECT only
-- rows where advisor_id = crm_advisor_id(), including when they are a split
-- writer who is not the household assignee. That SELECT does not grant
-- household or application access. Owners see every row. No advisor DML.
-- =============================================================================

ALTER TABLE public.policy_application_expected_compensations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_application_expected_compensations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_expected_comp_select
  ON public.policy_application_expected_compensations;
CREATE POLICY policy_expected_comp_select
  ON public.policy_application_expected_compensations
  FOR SELECT TO authenticated
  USING (
    public.crm_is_owner()
    OR advisor_id = public.crm_advisor_id()
  );

REVOKE ALL ON TABLE public.policy_application_expected_compensations FROM PUBLIC;
REVOKE ALL ON TABLE public.policy_application_expected_compensations FROM anon;
REVOKE ALL ON TABLE public.policy_application_expected_compensations FROM authenticated;

GRANT SELECT ON TABLE public.policy_application_expected_compensations TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.policy_application_expected_compensations
  FROM authenticated;

GRANT ALL ON TABLE public.policy_application_expected_compensations TO service_role;

REVOKE ALL ON FUNCTION public.pp_expected_comp_select_rate(text, numeric, numeric, numeric, numeric)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_expected_comp_round_cents(bigint, numeric, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_refresh_application_expected_compensation(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_trg_refresh_application_expected_compensation()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_expected_compensation_snapshot(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.recalculate_policy_application_expected_compensation(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_policy_application_expected_compensation(uuid, text) TO authenticated;
