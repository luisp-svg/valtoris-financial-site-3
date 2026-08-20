-- 044_policy_application_requirements.sql
-- Case Management Phase 2A — requirements foundation.
-- CRM-dev only. Do not apply to CRM-prod from this change set.
--
-- A requirement is a CHILD of policy_applications. It is not a Case, a
-- production stage, a task, a document, or a commission object.
--
-- Privacy: this table tracks ADMINISTRATIVE requirement status only
-- (signature needed, paramed scheduled, APS requested, suitability pending,
-- funds outstanding). It is not a medical record. There is no notes column
-- and no unconstrained JSON payload column. Do not store diagnoses, lab values,
-- medications, health answers, medical-record content, or physician
-- narratives. custom_label is short operational text for code = other only.
--
-- This migration creates ZERO requirement rows, performs ZERO backfill,
-- rewrites ZERO application stages, creates ZERO tasks/activities, and
-- writes ZERO commission data.

-- =============================================================================
-- SECTION A — Types
-- =============================================================================

DO $$
BEGIN
  CREATE TYPE public.policy_application_requirement_code AS ENUM (
    'signature',
    'replacement_form',
    'delivery',
    'other',
    'paramed_exam',
    'aps',
    'illustration',
    'initial_premium',
    'suitability',
    'exchange_1035',
    'funds'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE public.policy_application_requirement_code IS
  'MVP administrative requirement codes. Universal: signature, replacement_form, delivery, other. Life-only: paramed_exam, aps, illustration, initial_premium. FIA-only: suitability, exchange_1035, funds. Product-line legality is enforced server-side.';

DO $$
BEGIN
  CREATE TYPE public.policy_application_requirement_status AS ENUM (
    'open',
    'scheduled',
    'complete',
    'waived',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE public.policy_application_requirement_status IS
  'Administrative requirement status. If a requirement is not needed, no row exists. cancelled is terminal. complete and waived reopen to open only with a persisted operational reason.';

-- =============================================================================
-- SECTION B — Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.policy_application_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.policy_applications(id) ON DELETE CASCADE,
  requirement_code public.policy_application_requirement_code NOT NULL,
  custom_label text,
  status public.policy_application_requirement_status NOT NULL,
  due_date date,
  scheduled_for date,
  completed_at timestamptz,
  waived_at timestamptz,
  created_by_user_id uuid NOT NULL,
  updated_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT policy_application_requirements_other_label_check
    CHECK (
      (
        requirement_code = 'other'
        AND custom_label IS NOT NULL
        AND custom_label = btrim(custom_label)
        AND char_length(custom_label) BETWEEN 1 AND 80
      )
      OR (
        requirement_code <> 'other'
        AND custom_label IS NULL
      )
    ),
  CONSTRAINT policy_application_requirements_scheduled_for_check
    CHECK (status <> 'scheduled' OR scheduled_for IS NOT NULL),
  CONSTRAINT policy_application_requirements_completion_check
    CHECK (
      (
        status = 'complete'
        AND completed_at IS NOT NULL
        AND waived_at IS NULL
      )
      OR (
        status = 'waived'
        AND waived_at IS NOT NULL
        AND completed_at IS NULL
      )
      OR (
        status NOT IN ('complete', 'waived')
        AND completed_at IS NULL
        AND waived_at IS NULL
      )
    )
);

CREATE INDEX IF NOT EXISTS policy_application_requirements_application_idx
  ON public.policy_application_requirements (application_id);

CREATE INDEX IF NOT EXISTS policy_application_requirements_application_status_live_idx
  ON public.policy_application_requirements (application_id, status)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.policy_application_requirements IS
  'Administrative Case-work requirements, child of policy_applications. Not a Case, stage, task, document, or commission object. Tracks status only — no diagnoses, lab values, medications, health answers, medical-record content, or physician narratives. No notes column. No unconstrained JSON payload column. Server owns completed_at / waived_at. Soft delete is owner-only.';

COMMENT ON COLUMN public.policy_application_requirements.custom_label IS
  'Short operational label required only when requirement_code = other. Trimmed, nonblank, max 80 characters. Null for every other code. Not for medical details.';

COMMENT ON COLUMN public.policy_application_requirements.completed_at IS
  'Server-managed. Set only when status becomes complete; cleared on reopen.';

COMMENT ON COLUMN public.policy_application_requirements.waived_at IS
  'Server-managed. Set only when status becomes waived; cleared on reopen.';

CREATE TABLE IF NOT EXISTS public.policy_application_requirement_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES public.policy_application_requirements(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.policy_applications(id) ON DELETE CASCADE,
  from_status public.policy_application_requirement_status,
  to_status public.policy_application_requirement_status NOT NULL,
  changed_by_user_id uuid,
  reason text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT policy_application_requirement_history_reason_check
    CHECK (
      reason IS NULL
      OR (
        reason = btrim(reason)
        AND char_length(reason) BETWEEN 1 AND 500
      )
    )
);

CREATE INDEX IF NOT EXISTS policy_application_requirement_history_req_changed_idx
  ON public.policy_application_requirement_history (requirement_id, changed_at DESC);

COMMENT ON TABLE public.policy_application_requirement_history IS
  'Append-only audit of requirement status transitions (and owner soft-delete). Not a generic audit framework. Reopen reasons are persisted here. Operational text only — UI must later prohibit medical details.';

COMMENT ON COLUMN public.policy_application_requirement_history.reason IS
  'Required for complete -> open and waived -> open. Optional otherwise. Soft-delete uses reason = soft_delete without inventing a fake status. Max 500 characters. Operational only.';

-- =============================================================================
-- SECTION C — Triggers
-- =============================================================================

DROP TRIGGER IF EXISTS policy_application_requirements_set_updated_at
  ON public.policy_application_requirements;
CREATE TRIGGER policy_application_requirements_set_updated_at
  BEFORE UPDATE ON public.policy_application_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.pp_assert_requirement_code_legal(
  p_code public.policy_application_requirement_code,
  p_line public.insurance_product_line
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF p_code IS NULL OR p_line IS NULL THEN
    PERFORM public.pp_raise('invalid_requirement_code');
  END IF;

  IF p_code IN ('signature', 'replacement_form', 'delivery', 'other') THEN
    RETURN;
  END IF;

  IF p_code IN ('paramed_exam', 'aps', 'illustration', 'initial_premium') THEN
    IF p_line NOT IN ('life_term', 'life_permanent') THEN
      PERFORM public.pp_raise('invalid_requirement_code');
    END IF;
    RETURN;
  END IF;

  IF p_code IN ('suitability', 'exchange_1035', 'funds') THEN
    IF p_line IS DISTINCT FROM 'fia' THEN
      PERFORM public.pp_raise('invalid_requirement_code');
    END IF;
    RETURN;
  END IF;

  PERFORM public.pp_raise('invalid_requirement_code');
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_pp_requirement_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_ctx text := COALESCE(public.crm_rpc_context(), '');
  v_line public.insurance_product_line;
  v_write_contexts text[] := ARRAY[
    'create_policy_application_requirement',
    'update_policy_application_requirement',
    'transition_policy_application_requirement_status',
    'soft_delete_policy_application_requirement'
  ];
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT a.product_line INTO v_line
    FROM public.policy_applications a
    WHERE a.id = NEW.application_id;
    IF v_line IS NULL THEN
      PERFORM public.pp_raise('not_found');
    END IF;
    PERFORM public.pp_assert_requirement_code_legal(NEW.requirement_code, v_line);
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
    IF v_ctx IS DISTINCT FROM 'create_policy_application_requirement' THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
    IF NEW.deleted_at IS NOT NULL
       OR NEW.status NOT IN ('open', 'scheduled')
       OR NEW.completed_at IS NOT NULL
       OR NEW.waived_at IS NOT NULL THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (v_ctx = ANY (v_write_contexts)) THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.application_id IS DISTINCT FROM OLD.application_id
     OR NEW.requirement_code IS DISTINCT FROM OLD.requirement_code
     OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF v_ctx = 'update_policy_application_requirement' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
       OR NEW.waived_at IS DISTINCT FROM OLD.waived_at
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
  ELSIF v_ctx = 'transition_policy_application_requirement_status' THEN
    IF NEW.due_date IS DISTINCT FROM OLD.due_date
       OR NEW.custom_label IS DISTINCT FROM OLD.custom_label
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
  ELSIF v_ctx = 'soft_delete_policy_application_requirement' THEN
    IF OLD.deleted_at IS NOT NULL OR NEW.deleted_at IS NULL THEN
      PERFORM public.pp_raise('delete_not_allowed');
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.due_date IS DISTINCT FROM OLD.due_date
       OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for
       OR NEW.custom_label IS DISTINCT FROM OLD.custom_label
       OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
       OR NEW.waived_at IS DISTINCT FROM OLD.waived_at THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
  ELSE
    PERFORM public.pp_raise('not_authorized');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS policy_application_requirements_immutability
  ON public.policy_application_requirements;
CREATE TRIGGER policy_application_requirements_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.policy_application_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pp_requirement_immutability();

DROP TRIGGER IF EXISTS policy_application_requirement_history_append_only
  ON public.policy_application_requirement_history;
CREATE TRIGGER policy_application_requirement_history_append_only
  BEFORE UPDATE OR DELETE ON public.policy_application_requirement_history
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pp_history_append_only();

CREATE OR REPLACE FUNCTION public.enforce_pp_requirement_history_insert_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_ctx text := COALESCE(public.crm_rpc_context(), '');
  v_app uuid;
BEGIN
  SELECT r.application_id INTO v_app
  FROM public.policy_application_requirements r
  WHERE r.id = NEW.requirement_id;
  IF v_app IS NULL OR v_app IS DISTINCT FROM NEW.application_id THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_ctx IS DISTINCT FROM 'create_policy_application_requirement'
     AND v_ctx IS DISTINCT FROM 'transition_policy_application_requirement_status'
     AND v_ctx IS DISTINCT FROM 'soft_delete_policy_application_requirement' THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS policy_application_requirement_history_insert_context
  ON public.policy_application_requirement_history;
CREATE TRIGGER policy_application_requirement_history_insert_context
  BEFORE INSERT ON public.policy_application_requirement_history
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pp_requirement_history_insert_context();

-- =============================================================================
-- SECTION D — Internal helpers (REVOKE from authenticated)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pp_parse_requirement_code(p_code text)
RETURNS public.policy_application_requirement_code
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_raw text := lower(btrim(COALESCE(p_code, '')));
  v_out public.policy_application_requirement_code;
BEGIN
  IF v_raw = '' THEN
    PERFORM public.pp_raise('invalid_requirement_code');
  END IF;
  BEGIN
    v_out := v_raw::public.policy_application_requirement_code;
  EXCEPTION WHEN invalid_text_representation THEN
    PERFORM public.pp_raise('invalid_requirement_code');
  END;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_parse_requirement_status(p_status text)
RETURNS public.policy_application_requirement_status
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_raw text := lower(btrim(COALESCE(p_status, '')));
  v_out public.policy_application_requirement_status;
BEGIN
  IF v_raw = '' THEN
    PERFORM public.pp_raise('invalid_requirement_transition');
  END IF;
  BEGIN
    v_out := v_raw::public.policy_application_requirement_status;
  EXCEPTION WHEN invalid_text_representation THEN
    PERFORM public.pp_raise('invalid_requirement_transition');
  END;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_normalize_requirement_label(
  p_label text,
  p_code public.policy_application_requirement_code
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_label text := NULLIF(btrim(COALESCE(p_label, '')), '');
BEGIN
  IF p_code = 'other' THEN
    IF v_label IS NULL OR char_length(v_label) > 80 THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    RETURN v_label;
  END IF;
  IF v_label IS NOT NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_normalize_requirement_reason(
  p_reason text,
  p_required boolean
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF COALESCE(p_required, false) AND v_reason IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF v_reason IS NOT NULL AND char_length(v_reason) > 500 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  RETURN v_reason;
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_assert_requirement_transition(
  p_from public.policy_application_requirement_status,
  p_to public.policy_application_requirement_status,
  p_has_reason boolean
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from = p_to THEN
    PERFORM public.pp_raise('invalid_requirement_transition');
  END IF;

  IF p_from = 'cancelled' THEN
    PERFORM public.pp_raise('invalid_requirement_transition');
  END IF;

  IF p_from = 'open' AND p_to IN ('scheduled', 'complete', 'waived', 'cancelled') THEN
    RETURN;
  END IF;

  IF p_from = 'scheduled' AND p_to IN ('open', 'complete', 'waived', 'cancelled') THEN
    RETURN;
  END IF;

  IF p_from IN ('complete', 'waived') AND p_to = 'open' THEN
    IF NOT COALESCE(p_has_reason, false) THEN
      PERFORM public.pp_raise('missing_required_fields');
    END IF;
    RETURN;
  END IF;

  PERFORM public.pp_raise('invalid_requirement_transition');
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_requirement_json(p_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT jsonb_build_object(
    'id', r.id,
    'application_id', r.application_id,
    'requirement_code', r.requirement_code::text,
    'custom_label', r.custom_label,
    'status', r.status::text,
    'due_date', r.due_date,
    'scheduled_for', r.scheduled_for,
    'completed_at', r.completed_at,
    'waived_at', r.waived_at,
    'created_by_user_id', r.created_by_user_id,
    'updated_by_user_id', r.updated_by_user_id,
    'created_at', r.created_at,
    'updated_at', r.updated_at,
    'deleted_at', r.deleted_at
  )
  FROM public.policy_application_requirements r
  WHERE r.id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.pp_insert_requirement_history(
  p_requirement_id uuid,
  p_application_id uuid,
  p_from public.policy_application_requirement_status,
  p_to public.policy_application_requirement_status,
  p_actor uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  INSERT INTO public.policy_application_requirement_history (
    requirement_id,
    application_id,
    from_status,
    to_status,
    changed_by_user_id,
    reason
  ) VALUES (
    p_requirement_id,
    p_application_id,
    p_from,
    p_to,
    p_actor,
    p_reason
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pp_load_live_requirement(p_id uuid)
RETURNS public.policy_application_requirements
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_req public.policy_application_requirements;
BEGIN
  IF p_id IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  SELECT * INTO v_req
  FROM public.policy_application_requirements
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  PERFORM public.pp_assert_can_access_application(v_req.application_id);

  IF v_req.deleted_at IS NOT NULL AND NOT public.crm_is_owner() THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  RETURN v_req;
END;
$$;

-- =============================================================================
-- SECTION E — Mutation RPCs
-- Actor UUIDs are derived from auth.uid(). Browser-supplied creator/updater
-- identifiers are not accepted. These RPCs do not mutate production_stage,
-- delivery_status, tasks, activities, or commissions.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_policy_application_requirement(
  p_application_id uuid,
  p_code text,
  p_custom_label text DEFAULT NULL,
  p_due_date date DEFAULT NULL,
  p_scheduled_for date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_app public.policy_applications;
  v_code public.policy_application_requirement_code;
  v_label text;
  v_status public.policy_application_requirement_status;
  v_id uuid;
  v_result jsonb;
BEGIN
  PERFORM public.pp_assert_authenticated();
  PERFORM public.pp_assert_can_access_application(p_application_id);

  SELECT * INTO v_app
  FROM public.policy_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND OR v_app.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  -- Legitimate submitted Case only. Draft / pre_submitted are not Cases in
  -- the operational sense; missing submission_date is not a live Case.
  IF v_app.production_stage IN ('draft', 'pre_submitted')
     OR v_app.submission_date IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  v_code := public.pp_parse_requirement_code(p_code);
  PERFORM public.pp_assert_requirement_code_legal(v_code, v_app.product_line);
  v_label := public.pp_normalize_requirement_label(p_custom_label, v_code);

  IF p_scheduled_for IS NOT NULL THEN
    v_status := 'scheduled';
  ELSE
    v_status := 'open';
  END IF;

  PERFORM set_config('crm.rpc_context', 'create_policy_application_requirement', true);
  BEGIN
    INSERT INTO public.policy_application_requirements (
      application_id,
      requirement_code,
      custom_label,
      status,
      due_date,
      scheduled_for,
      created_by_user_id,
      updated_by_user_id
    ) VALUES (
      p_application_id,
      v_code,
      v_label,
      v_status,
      p_due_date,
      p_scheduled_for,
      v_uid,
      v_uid
    ) RETURNING id INTO v_id;

    PERFORM public.pp_insert_requirement_history(
      v_id,
      p_application_id,
      NULL,
      v_status,
      v_uid,
      NULL
    );

    v_result := jsonb_build_object(
      'ok', true,
      'requirement', public.pp_requirement_json(v_id)
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.create_policy_application_requirement(uuid, text, text, date, date) IS
  'Creates one administrative requirement on a live submitted Case. If scheduled_for is provided, initial status is scheduled; otherwise open. Actor is auth.uid(). Does not mutate production_stage, delivery_status, tasks, activities, or commissions. custom_label is operational text for code=other only — not medical content.';

CREATE OR REPLACE FUNCTION public.update_policy_application_requirement(
  p_id uuid,
  p_fields jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.policy_application_requirements;
  v_due date;
  v_sched date;
  v_label text;
  v_result jsonb;
BEGIN
  PERFORM public.pp_assert_authenticated();
  v_req := public.pp_load_live_requirement(p_id);
  IF v_req.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  PERFORM public.pp_assert_payload_size(p_fields);
  PERFORM public.pp_assert_object_keys(
    p_fields,
    ARRAY['due_date', 'scheduled_for', 'custom_label']
  );
  IF p_fields = '{}'::jsonb THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  v_due := v_req.due_date;
  v_sched := v_req.scheduled_for;
  v_label := v_req.custom_label;

  IF p_fields ? 'due_date' THEN
    v_due := public.pp_json_date(p_fields, 'due_date');
  END IF;
  IF p_fields ? 'scheduled_for' THEN
    v_sched := public.pp_json_date(p_fields, 'scheduled_for');
  END IF;
  IF p_fields ? 'custom_label' THEN
    v_label := public.pp_normalize_requirement_label(
      public.pp_json_text(p_fields, 'custom_label'),
      v_req.requirement_code
    );
  END IF;

  -- Status stays put. Scheduling that needs a status change must use the
  -- transition RPC. Clearing scheduled_for while status is scheduled is
  -- rejected rather than silently reopening.
  IF v_req.status = 'scheduled' AND v_sched IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  PERFORM set_config('crm.rpc_context', 'update_policy_application_requirement', true);
  BEGIN
    UPDATE public.policy_application_requirements
    SET
      due_date = v_due,
      scheduled_for = v_sched,
      custom_label = v_label,
      updated_by_user_id = v_uid
    WHERE id = p_id;

    v_result := jsonb_build_object(
      'ok', true,
      'requirement', public.pp_requirement_json(p_id)
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.update_policy_application_requirement(uuid, jsonb) IS
  'Non-status update of due_date, scheduled_for, and custom_label (other only). Does not change requirement_code, status, application_id, actor fields, or deleted_at. Does not mutate production_stage, delivery_status, tasks, activities, or commissions.';

CREATE OR REPLACE FUNCTION public.transition_policy_application_requirement_status(
  p_id uuid,
  p_to_status text,
  p_scheduled_for date DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.policy_application_requirements;
  v_to public.policy_application_requirement_status;
  v_reason text;
  v_sched date;
  v_completed_at timestamptz;
  v_waived_at timestamptz;
  v_needs_reason boolean;
  v_result jsonb;
BEGIN
  PERFORM public.pp_assert_authenticated();
  v_req := public.pp_load_live_requirement(p_id);
  IF v_req.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  v_to := public.pp_parse_requirement_status(p_to_status);
  v_needs_reason := v_req.status IN ('complete', 'waived') AND v_to = 'open';
  v_reason := public.pp_normalize_requirement_reason(p_reason, v_needs_reason);
  PERFORM public.pp_assert_requirement_transition(v_req.status, v_to, v_reason IS NOT NULL);

  v_sched := COALESCE(p_scheduled_for, v_req.scheduled_for);
  IF v_to = 'scheduled' AND v_sched IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  IF v_to = 'complete' THEN
    v_completed_at := now();
    v_waived_at := NULL;
  ELSIF v_to = 'waived' THEN
    v_waived_at := now();
    v_completed_at := NULL;
  ELSIF v_to = 'open' THEN
    v_completed_at := NULL;
    v_waived_at := NULL;
  ELSE
    v_completed_at := v_req.completed_at;
    v_waived_at := v_req.waived_at;
  END IF;

  PERFORM set_config('crm.rpc_context', 'transition_policy_application_requirement_status', true);
  BEGIN
    UPDATE public.policy_application_requirements
    SET
      status = v_to,
      scheduled_for = v_sched,
      completed_at = v_completed_at,
      waived_at = v_waived_at,
      updated_by_user_id = v_uid
    WHERE id = p_id;

    PERFORM public.pp_insert_requirement_history(
      p_id,
      v_req.application_id,
      v_req.status,
      v_to,
      v_uid,
      v_reason
    );

    v_result := jsonb_build_object(
      'ok', true,
      'requirement', public.pp_requirement_json(p_id)
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.transition_policy_application_requirement_status(uuid, text, date, text) IS
  'Enforces the approved requirement status matrix. Server sets completed_at / waived_at. Reopen from complete or waived requires a persisted operational reason. Does not mutate production_stage, delivery_status, tasks, activities, or commissions.';

CREATE OR REPLACE FUNCTION public.soft_delete_policy_application_requirement(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.policy_application_requirements;
  v_result jsonb;
BEGIN
  PERFORM public.pp_assert_authenticated();
  PERFORM public.pp_assert_owner();
  v_req := public.pp_load_live_requirement(p_id);
  IF v_req.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  PERFORM set_config('crm.rpc_context', 'soft_delete_policy_application_requirement', true);
  BEGIN
    UPDATE public.policy_application_requirements
    SET
      deleted_at = now(),
      updated_by_user_id = v_uid
    WHERE id = p_id;

    -- Record deletion without inventing a fake requirement status. from_status
    -- and to_status stay at the current status; reason = soft_delete.
    PERFORM public.pp_insert_requirement_history(
      p_id,
      v_req.application_id,
      v_req.status,
      v_req.status,
      v_uid,
      'soft_delete'
    );

    v_result := jsonb_build_object(
      'ok', true,
      'requirement', public.pp_requirement_json(p_id)
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.soft_delete_policy_application_requirement(uuid) IS
  'Owner-only soft delete. Advisors cancel a requirement that no longer applies. Does not hard-delete. Does not mutate production_stage, delivery_status, tasks, activities, or commissions.';

-- =============================================================================
-- SECTION F — RLS + grants
-- =============================================================================

ALTER TABLE public.policy_application_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_application_requirements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.policy_application_requirement_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_application_requirement_history FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_application_requirements_select
  ON public.policy_application_requirements;
CREATE POLICY policy_application_requirements_select
  ON public.policy_application_requirements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.policy_applications a
      WHERE a.id = policy_application_requirements.application_id
        AND (
          public.crm_is_owner()
          OR (
            a.deleted_at IS NULL
            AND policy_application_requirements.deleted_at IS NULL
            AND public.crm_can_access_household(a.household_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS policy_application_requirement_history_select
  ON public.policy_application_requirement_history;
CREATE POLICY policy_application_requirement_history_select
  ON public.policy_application_requirement_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.policy_applications a
      WHERE a.id = policy_application_requirement_history.application_id
        AND (
          public.crm_is_owner()
          OR (a.deleted_at IS NULL AND public.crm_can_access_household(a.household_id))
        )
    )
  );

REVOKE ALL ON TABLE public.policy_application_requirements FROM PUBLIC;
REVOKE ALL ON TABLE public.policy_application_requirements FROM anon;
REVOKE ALL ON TABLE public.policy_application_requirements FROM authenticated;
GRANT SELECT ON TABLE public.policy_application_requirements TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.policy_application_requirements FROM authenticated;
GRANT ALL ON TABLE public.policy_application_requirements TO service_role;

REVOKE ALL ON TABLE public.policy_application_requirement_history FROM PUBLIC;
REVOKE ALL ON TABLE public.policy_application_requirement_history FROM anon;
REVOKE ALL ON TABLE public.policy_application_requirement_history FROM authenticated;
GRANT SELECT ON TABLE public.policy_application_requirement_history TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.policy_application_requirement_history FROM authenticated;
GRANT ALL ON TABLE public.policy_application_requirement_history TO service_role;

REVOKE ALL ON FUNCTION public.pp_assert_requirement_code_legal(
  public.policy_application_requirement_code, public.insurance_product_line
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_pp_requirement_immutability()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_pp_requirement_history_insert_context()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_parse_requirement_code(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_parse_requirement_status(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_normalize_requirement_label(
  text, public.policy_application_requirement_code
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_normalize_requirement_reason(text, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_assert_requirement_transition(
  public.policy_application_requirement_status,
  public.policy_application_requirement_status,
  boolean
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_requirement_json(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_insert_requirement_history(
  uuid,
  uuid,
  public.policy_application_requirement_status,
  public.policy_application_requirement_status,
  uuid,
  text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pp_load_live_requirement(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_policy_application_requirement(uuid, text, text, date, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_policy_application_requirement(uuid, text, text, date, date)
  TO authenticated;

REVOKE ALL ON FUNCTION public.update_policy_application_requirement(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_policy_application_requirement(uuid, jsonb)
  TO authenticated;

REVOKE ALL ON FUNCTION public.transition_policy_application_requirement_status(uuid, text, date, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_policy_application_requirement_status(uuid, text, date, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.soft_delete_policy_application_requirement(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_policy_application_requirement(uuid)
  TO authenticated;
