-- 045_policy_post_placement_lifecycle.sql
-- Post-placement policy lifecycle foundation.
--
-- Historical application placement stays on policy_applications.production_stage.
-- Once successfully placed, that stage remains in_force even if the contract
-- later terminates.
--
-- Current post-placement lifecycle belongs to the linked policies row:
--   issued → in_force → canceled | surrendered
--
-- Database terminology is canceled / surrendered. This is not a commission
-- chargeback. 035 chargebacks remain a separate, explicit ledger workflow.
--
-- Does NOT: alter policy_application_stage, mutate CRM-prod data, backfill
-- historical rows, refresh expected compensation, write commission events,
-- change writing_receivable_expected, or add UI.

-- =============================================================================
-- SECTION A — Termination facts
-- =============================================================================

ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS terminated_on date;

ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS termination_reason text;

COMMENT ON COLUMN public.policies.terminated_on IS
  'Calendar date the placed policy terminated, when known. NULL is allowed: historical outcomes may be known without an exact day. Never defaulted to CURRENT_DATE.';

COMMENT ON COLUMN public.policies.termination_reason IS
  'Owner reason for recording canceled or surrendered. Required by record_policy_post_placement_outcome. Max 500 characters, matching other CRM reason fields.';

ALTER TABLE public.policies
  DROP CONSTRAINT IF EXISTS policies_termination_reason_len_check;
ALTER TABLE public.policies
  ADD CONSTRAINT policies_termination_reason_len_check
  CHECK (
    termination_reason IS NULL
    OR char_length(termination_reason) BETWEEN 1 AND 500
  );

-- Linked production policies only. Unlinked/legacy rows keep free-text status
-- (pending, lapsed, etc.). Not an enum: converting policies.status would break
-- those rows.
ALTER TABLE public.policies
  DROP CONSTRAINT IF EXISTS policies_pp_linked_lifecycle_check;
ALTER TABLE public.policies
  ADD CONSTRAINT policies_pp_linked_lifecycle_check
  CHECK (
    source_application_id IS NULL
    OR (
      status IN ('issued', 'in_force', 'canceled', 'surrendered')
      AND (
        (
          status IN ('issued', 'in_force')
          AND terminated_on IS NULL
          AND termination_reason IS NULL
        )
        OR (
          status IN ('canceled', 'surrendered')
          AND termination_reason IS NOT NULL
          AND char_length(termination_reason) BETWEEN 1 AND 500
        )
      )
    )
  );

-- =============================================================================
-- SECTION B — Link guard: narrow lifecycle context only
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_policies_pp_link_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  -- Coalesced to '' so that an absent context compares as false rather than
  -- NULL: `NOT (NULL = ANY (...))` is NULL, which would silently skip the guard.
  v_ctx text := COALESCE(public.crm_rpc_context(), '');
  v_is_issue_ctx boolean := (v_ctx = 'transition_policy_application_stage');
  v_is_lifecycle_ctx boolean := (v_ctx = 'record_policy_post_placement_outcome');
BEGIN
  -- Absolute rule, enforced for every caller including service_role and
  -- migration SQL: once a policy carries a source_application_id it can never
  -- be re-pointed or unlinked.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.source_application_id IS NOT NULL
       AND NEW.source_application_id IS DISTINCT FROM OLD.source_application_id THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
  END IF;

  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.source_application_id IS NOT NULL THEN
      PERFORM public.pp_raise('delete_not_allowed');
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.source_application_id IS NULL THEN
      RETURN NEW;
    END IF;
    IF NOT v_is_issue_ctx THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.policy_applications a
      WHERE a.id = NEW.source_application_id
        AND a.household_id = NEW.household_id
    ) THEN
      PERFORM public.pp_raise('household_mismatch');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.policies p
      WHERE p.source_application_id = NEW.source_application_id
        AND p.id <> NEW.id
    ) THEN
      PERFORM public.pp_raise('duplicate_link');
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.source_application_id IS NULL AND NEW.source_application_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    PERFORM public.pp_raise('delete_not_allowed');
  END IF;

  -- Lifecycle RPC may change only status / terminated_on / termination_reason.
  -- updated_at is excluded because the row trigger may stamp it.
  IF v_is_lifecycle_ctx THEN
    IF (to_jsonb(NEW) - ARRAY['status', 'terminated_on', 'termination_reason', 'updated_at'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status', 'terminated_on', 'termination_reason', 'updated_at'])
    THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
    RETURN NEW;
  END IF;

  -- Termination facts are not writable from issue/in_force or direct DML.
  IF NEW.terminated_on IS DISTINCT FROM OLD.terminated_on
     OR NEW.termination_reason IS DISTINCT FROM OLD.termination_reason THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF (NEW.household_id IS DISTINCT FROM OLD.household_id
      OR NEW.carrier IS DISTINCT FROM OLD.carrier
      OR NEW.policy_number IS DISTINCT FROM OLD.policy_number
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.source_application_id IS DISTINCT FROM OLD.source_application_id)
     AND NOT v_is_issue_ctx THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF NEW.source_application_id IS NOT NULL
     AND NEW.source_application_id IS DISTINCT FROM OLD.source_application_id THEN
    IF EXISTS (
      SELECT 1 FROM public.policies p
      WHERE p.source_application_id = NEW.source_application_id
        AND p.id <> NEW.id
    ) THEN
      PERFORM public.pp_raise('duplicate_link');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_policies_pp_link_guard() IS
  'Protects production-linked policies. Issue/in-force remains transition_policy_application_stage. record_policy_post_placement_outcome may change only status, terminated_on, and termination_reason. Direct authenticated DML stays blocked.';

REVOKE ALL ON FUNCTION public.enforce_policies_pp_link_guard() FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION C — Owner-only RPC
-- =============================================================================

-- 12-month boundary (deterministic):
--   anniversary = placement_anchor + 12 months (PostgreSQL date + interval)
--   canceled    = terminated_on < anniversary  (still inside the first 12 months)
--   surrendered = terminated_on >= anniversary (on or after the 12-month mark)
-- Placement anchor, first available: in_force_date, policies.effective_date,
-- issue_date. CURRENT_DATE is never an anchor. If terminated_on is provided
-- and no anchor exists, the RPC refuses rather than inventing a date.

CREATE OR REPLACE FUNCTION public.record_policy_post_placement_outcome(
  p_application_id uuid,
  p_status text,
  p_reason text,
  p_terminated_on date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_status text := lower(btrim(COALESCE(p_status, '')));
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_app public.policy_applications;
  v_policy public.policies;
  v_anchor date;
  v_anniversary date;
  v_audit_id uuid;
  v_result jsonb;
BEGIN
  PERFORM public.pp_assert_owner();
  PERFORM public.pp_assert_can_access_application(p_application_id);

  IF v_status IS NULL OR v_status NOT IN ('canceled', 'surrendered') THEN
    PERFORM public.pp_raise('invalid_payload');
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
  IF v_app.production_stage IS DISTINCT FROM 'in_force' THEN
    PERFORM public.pp_raise('invalid_transition');
  END IF;

  SELECT * INTO v_policy
  FROM public.policies
  WHERE source_application_id = p_application_id
    AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.pp_raise('not_found');
  END IF;
  IF v_policy.household_id IS DISTINCT FROM v_app.household_id THEN
    PERFORM public.pp_raise('household_mismatch');
  END IF;
  IF v_policy.status IS DISTINCT FROM 'in_force' THEN
    PERFORM public.pp_raise('invalid_transition');
  END IF;

  v_anchor := COALESCE(v_app.in_force_date, v_policy.effective_date, v_app.issue_date);

  IF p_terminated_on IS NOT NULL THEN
    IF v_anchor IS NULL THEN
      -- A known termination day cannot be classified without a placement
      -- anchor, and this RPC must not invent one. Record the outcome with
      -- terminated_on NULL instead.
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    IF p_terminated_on < v_anchor THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    v_anniversary := (v_anchor + interval '12 months')::date;
    IF v_status = 'canceled' AND p_terminated_on >= v_anniversary THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    IF v_status = 'surrendered' AND p_terminated_on < v_anniversary THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
  END IF;

  PERFORM set_config('crm.rpc_context', 'record_policy_post_placement_outcome', true);
  BEGIN
    UPDATE public.policies
    SET status = v_status,
        terminated_on = p_terminated_on,
        termination_reason = v_reason
    WHERE id = v_policy.id;

    v_audit_id := public.crm_write_audit(
      'record_policy_post_placement_outcome',
      'policies',
      v_policy.id,
      jsonb_build_object(
        'application_id', p_application_id,
        'policy_id', v_policy.id,
        'status', v_policy.status,
        'terminated_on', v_policy.terminated_on,
        'termination_reason', v_policy.termination_reason
      ),
      jsonb_build_object(
        'application_id', p_application_id,
        'policy_id', v_policy.id,
        'status', v_status,
        'terminated_on', p_terminated_on,
        'termination_reason', v_reason,
        'reason', v_reason
      )
    );
    IF v_audit_id IS NULL THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;

    v_result := jsonb_build_object(
      'ok', true,
      'application_id', p_application_id,
      'policy_id', v_policy.id,
      'status', v_status,
      'prior_status', v_policy.status,
      'terminated_on', p_terminated_on,
      'termination_reason', v_reason,
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

COMMENT ON FUNCTION public.record_policy_post_placement_outcome(uuid, text, text, date) IS
  'Owner-only. Records canceled or surrendered on a linked in_force policy. Application production_stage stays in_force. Optional terminated_on; NULL date is allowed with an explicit status and reason. When a date and placement anchor both exist, canceled is terminated_on < anchor + 12 months and surrendered is terminated_on >= anchor + 12 months. Does not invent dates. Does not write commissions, expected compensation, or writing_receivable_expected. Audited via crm_write_audit.';

REVOKE ALL ON FUNCTION public.record_policy_post_placement_outcome(uuid, text, text, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_policy_post_placement_outcome(uuid, text, text, date)
  TO authenticated;

-- This migration creates ZERO production rows and performs ZERO backfill.
-- Commission isolation: no 035 event writer, no 034 expected refresh, no 042 receivable setter.

