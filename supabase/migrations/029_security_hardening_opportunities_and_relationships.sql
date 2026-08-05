-- 029_security_hardening_opportunities_and_relationships.sql
-- Phase A security foundation (backward-compatible with deployed browser Activity INSERT).
--
-- A) H1: Opportunity authorization = owner OR household access (never stale assignee alone)
-- B) H2: Cross-household FK integrity for documents/notes/activities/tasks
-- C) H3 foundation: record_crm_activity RPC for two proven browser events only
-- D) Revoke authenticated UPDATE/DELETE on activities; keep INSERT temporarily
-- E) Activity integrity trigger (FK + metadata object/size) for direct INSERT and RPC
--
-- H3 is only partially mitigated here: direct authenticated INSERT remains until a later
-- app writer migration and a later INSERT-revoke migration.
--
-- Out of scope: browser Activity INSERT revoke, task-done lifecycle work,
-- cases/workflows, Serverless Functions, and any later activity-insert revoke migration.

-- =============================================================================
-- Shared FK household assertion (trigger + RPC use; not callable by clients)
-- Missing/deleted/cross-household refs share one non-enumerating error class.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.crm_assert_subject_fks_same_household(
  p_household_id uuid,
  p_opportunity_id uuid DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL,
  p_assessment_id uuid DEFAULT NULL,
  p_recommendation_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF p_household_id IS NULL THEN
    RAISE EXCEPTION 'CRM029:household_id_required'
      USING ERRCODE = '22023';
  END IF;

  IF p_opportunity_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.opportunities o
      WHERE o.id = p_opportunity_id
        AND o.household_id = p_household_id
        AND o.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'CRM029:subject_relationship_invalid'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF p_lead_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = p_lead_id
        AND l.household_id = p_household_id
        AND l.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'CRM029:subject_relationship_invalid'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF p_assessment_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.assessments a
      WHERE a.id = p_assessment_id
        AND a.household_id = p_household_id
        AND a.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'CRM029:subject_relationship_invalid'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF p_recommendation_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.recommendations r
      WHERE r.id = p_recommendation_id
        AND r.household_id = p_household_id
        AND r.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'CRM029:subject_relationship_invalid'
        USING ERRCODE = '23514';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_assert_subject_fks_same_household(uuid, uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.crm_assert_subject_fks_same_household(uuid, uuid, uuid, uuid, uuid) IS
  'Asserts optional subject FKs belong to the given household. Missing/deleted/cross-HH refs raise CRM029:subject_relationship_invalid. Client EXECUTE revoked.';

-- =============================================================================
-- SECTION A — H1 opportunity authorization
-- =============================================================================

CREATE OR REPLACE FUNCTION public.crm_can_access_opportunity(p_opportunity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    public.crm_is_owner()
    OR EXISTS (
      SELECT 1
      FROM public.opportunities o
      WHERE o.id = p_opportunity_id
        AND o.deleted_at IS NULL
        AND public.crm_can_access_household(o.household_id)
    );
$$;

COMMENT ON FUNCTION public.crm_can_access_opportunity(uuid) IS
  'Owner or household-authorized advisor. Stale opportunities.assigned_advisor_id never grants access.';

REVOKE ALL ON FUNCTION public.crm_can_access_opportunity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_can_access_opportunity(uuid) TO authenticated;

DROP POLICY IF EXISTS opportunities_select ON public.opportunities;
CREATE POLICY opportunities_select ON public.opportunities
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.crm_is_owner()
      OR public.crm_can_access_household(household_id)
    )
  );

DROP POLICY IF EXISTS opportunities_update ON public.opportunities;
CREATE POLICY opportunities_update ON public.opportunities
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.crm_is_owner()
      OR public.crm_can_access_household(household_id)
    )
  )
  WITH CHECK (
    public.crm_is_owner()
    OR public.crm_can_access_household(household_id)
  );

CREATE OR REPLACE FUNCTION public.enforce_opportunity_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_ctx text := public.crm_rpc_context();
BEGIN
  IF NEW.household_id IS DISTINCT FROM OLD.household_id
     OR NEW.service_vertical_id IS DISTINCT FROM OLD.service_vertical_id
     OR NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id THEN
    RAISE EXCEPTION 'opportunity household/vertical/pipeline cannot be changed after create'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id
     OR NEW.stage_entered_at IS DISTINCT FROM OLD.stage_entered_at
     OR NEW.closed_at IS DISTINCT FROM OLD.closed_at
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF v_ctx IS DISTINCT FROM 'move_opportunity_stage' THEN
      RAISE EXCEPTION 'opportunity stage/status/closed_at require move_opportunity_stage RPC'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.assigned_advisor_id IS DISTINCT FROM OLD.assigned_advisor_id
     OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at
     OR NEW.assigned_by_user_id IS DISTINCT FROM OLD.assigned_by_user_id
     OR NEW.assignment_reason IS DISTINCT FROM OLD.assignment_reason THEN
    IF v_ctx IS DISTINCT FROM 'assign_opportunity'
       AND v_ctx IS DISTINCT FROM 'convert_recommendation_to_opportunity'
       AND v_ctx IS DISTINCT FROM 'assign_household' THEN
      RAISE EXCEPTION 'opportunity assignment fields require assign_opportunity, assign_household, or convert_recommendation_to_opportunity RPC'
        USING ERRCODE = '42501';
    END IF;
    IF v_ctx = 'assign_opportunity' AND NOT public.crm_is_owner() THEN
      RAISE EXCEPTION 'opportunity reassignment is owner-only'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_opportunity_protected_columns() FROM PUBLIC, anon, authenticated;

-- assign_household: sync active opportunities + opportunity-scoped assignment history.
CREATE OR REPLACE FUNCTION public.assign_household(
  p_household_id uuid,
  p_advisor_id uuid,
  p_reason public.assignment_reason DEFAULT 'manual',
  p_notes text DEFAULT NULL
)
RETURNS public.households
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_before public.households;
  v_after public.households;
  v_advisor public.advisor_profiles;
  v_opp record;
  v_synced integer := 0;
  v_history_rows integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.crm_is_owner() THEN
    RAISE EXCEPTION 'only owners can assign households in V1'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_before
  FROM public.households
  WHERE id = p_household_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'household not found'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_advisor
  FROM public.advisor_profiles
  WHERE id = p_advisor_id
    AND deleted_at IS NULL
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'advisor not found or inactive'
      USING ERRCODE = 'P0002';
  END IF;

  -- Household-level assignment history (opportunity_id IS NULL).
  UPDATE public.advisor_assignments
  SET effective_to = now()
  WHERE household_id = p_household_id
    AND opportunity_id IS NULL
    AND assignment_role = 'primary'
    AND effective_to IS NULL;

  INSERT INTO public.advisor_assignments (
    household_id,
    advisor_id,
    assignment_role,
    reason,
    is_attribution_source,
    assigned_by_user_id,
    effective_from,
    notes
  )
  VALUES (
    p_household_id,
    p_advisor_id,
    'primary',
    p_reason,
    false,
    auth.uid(),
    now(),
    p_notes
  );

  PERFORM set_config('crm.rpc_context', 'assign_household', true);

  UPDATE public.households
  SET
    assigned_advisor_id = p_advisor_id,
    assigned_at = now(),
    assigned_by_user_id = auth.uid(),
    assignment_reason = p_reason,
    updated_at = now()
  WHERE id = p_household_id
  RETURNING * INTO v_after;

  UPDATE public.leads
  SET
    assigned_advisor_id = p_advisor_id,
    assigned_at = now(),
    assigned_by_user_id = auth.uid(),
    assignment_reason = p_reason,
    status = CASE WHEN status IN ('unassigned', 'new') THEN 'assigned'::public.lead_status ELSE status END,
    updated_at = now()
  WHERE household_id = p_household_id
    AND deleted_at IS NULL
    AND status NOT IN ('converted', 'closed_lost');

  -- Active opportunities: sync assignee + opportunity-scoped advisor_assignments history.
  -- won/lost are not synchronized (historical assignee retained; no access via assignee alone).
  FOR v_opp IN
    SELECT o.id
    FROM public.opportunities o
    WHERE o.household_id = p_household_id
      AND o.deleted_at IS NULL
      AND o.status IN (
        'open'::public.opportunity_status,
        'on_hold'::public.opportunity_status
      )
    FOR UPDATE
  LOOP
    UPDATE public.advisor_assignments
    SET effective_to = now()
    WHERE household_id = p_household_id
      AND opportunity_id = v_opp.id
      AND assignment_role = 'primary'
      AND effective_to IS NULL;

    INSERT INTO public.advisor_assignments (
      household_id,
      advisor_id,
      opportunity_id,
      assignment_role,
      reason,
      is_attribution_source,
      assigned_by_user_id,
      effective_from,
      notes
    )
    VALUES (
      p_household_id,
      p_advisor_id,
      v_opp.id,
      'primary',
      p_reason,
      false,
      auth.uid(),
      now(),
      p_notes
    );
    v_history_rows := v_history_rows + 1;

    UPDATE public.opportunities
    SET
      assigned_advisor_id = p_advisor_id,
      assigned_at = now(),
      assigned_by_user_id = auth.uid(),
      assignment_reason = p_reason,
      updated_at = now()
    WHERE id = v_opp.id;

    v_synced := v_synced + 1;
  END LOOP;

  PERFORM public.crm_write_activity(
    p_household_id,
    'assignment_changed',
    'Household assigned',
    COALESCE(p_notes, 'Advisor assignment updated'),
    jsonb_build_object(
      'from_advisor_id', v_before.assigned_advisor_id,
      'to_advisor_id', p_advisor_id,
      'reason', p_reason,
      'active_opportunities_synced', v_synced,
      'opportunity_assignment_history_rows', v_history_rows
    )
  );

  PERFORM public.crm_write_audit(
    'assignment.changed',
    'households',
    p_household_id,
    to_jsonb(v_before),
    to_jsonb(v_after)
  );

  PERFORM public.crm_clear_rpc_context();
  RETURN v_after;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.assign_household(uuid, uuid, public.assignment_reason, text) IS
  'Owner-only household assignment. Syncs open/on_hold opportunity assignees and writes opportunity-scoped advisor_assignments history. Clears crm.rpc_context.';

REVOKE ALL ON FUNCTION public.assign_household(uuid, uuid, public.assignment_reason, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_household(uuid, uuid, public.assignment_reason, text)
  TO authenticated;

-- =============================================================================
-- SECTION B — H2 cross-household integrity triggers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_document_relationship_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  PERFORM public.crm_assert_subject_fks_same_household(
    NEW.household_id,
    NEW.opportunity_id,
    NEW.lead_id,
    NULL,
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_relationship_integrity ON public.documents;
CREATE TRIGGER documents_relationship_integrity
  BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_document_relationship_integrity();

REVOKE ALL ON FUNCTION public.enforce_document_relationship_integrity()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_note_relationship_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  PERFORM public.crm_assert_subject_fks_same_household(
    NEW.household_id,
    NEW.opportunity_id,
    NULL,
    NULL,
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notes_relationship_integrity ON public.notes;
CREATE TRIGGER notes_relationship_integrity
  BEFORE INSERT OR UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_note_relationship_integrity();

REVOKE ALL ON FUNCTION public.enforce_note_relationship_integrity()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_activity_relationship_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  PERFORM public.crm_assert_subject_fks_same_household(
    NEW.household_id,
    NEW.opportunity_id,
    NEW.lead_id,
    NEW.assessment_id,
    NEW.recommendation_id
  );

  -- Shape + size only on legacy direct INSERT (no key allowlist — preserves deployed writers).
  IF NEW.metadata IS NULL OR jsonb_typeof(NEW.metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'CRM029:activity_metadata_must_be_object'
      USING ERRCODE = '22P02';
  END IF;

  IF octet_length(NEW.metadata::text) > 4096 THEN
    RAISE EXCEPTION 'CRM029:activity_metadata_too_large'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activities_relationship_integrity ON public.activities;
CREATE TRIGGER activities_relationship_integrity
  BEFORE INSERT OR UPDATE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_activity_relationship_integrity();

REVOKE ALL ON FUNCTION public.enforce_activity_relationship_integrity()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_task_access_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.household_id IS DISTINCT FROM OLD.household_id THEN
      IF NOT (
        public.crm_is_owner()
        OR (
          public.crm_can_access_household(OLD.household_id)
          AND public.crm_can_access_household(NEW.household_id)
        )
      ) THEN
        RAISE EXCEPTION 'cannot move task to a household outside your access'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  PERFORM public.crm_assert_subject_fks_same_household(
    NEW.household_id,
    NEW.opportunity_id,
    NEW.lead_id,
    NEW.assessment_id,
    NULL
  );

  IF TG_OP = 'UPDATE'
     AND NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
     AND NEW.opportunity_id IS NOT NULL THEN
    IF NOT public.crm_can_access_opportunity(NEW.opportunity_id) THEN
      RAISE EXCEPTION 'cannot link task to an inaccessible opportunity'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_access_integrity ON public.tasks;
CREATE TRIGGER tasks_access_integrity
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_task_access_integrity();

REVOKE ALL ON FUNCTION public.enforce_task_access_integrity()
  FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION C — Controlled Activity-write RPC (two proven browser events only)
-- =============================================================================
-- Drop prior broader signature if present from earlier 029 drafts on local resets.
DROP FUNCTION IF EXISTS public.record_crm_activity(
  uuid, public.activity_type, text, text, jsonb, uuid, uuid, uuid, uuid, timestamptz
);

CREATE OR REPLACE FUNCTION public.record_crm_activity(
  p_household_id uuid,
  p_event_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_opportunity_id uuid DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL,
  p_assessment_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_event_key text := NULLIF(btrim(COALESCE(p_event_key, '')), '');
  v_meta_in jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_key text;
  v_val jsonb;
  v_task_id uuid;
  v_task public.tasks;
  v_assessment public.assessments;
  v_activity_type public.activity_type;
  v_title text;
  v_opp uuid;
  v_lead uuid;
  v_assess uuid;
  v_workflow text;
  v_source text;
  v_idem text;
  v_assessment_type text;
  v_final jsonb;
  v_id uuid;
  v_str text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CRM029:not_authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF p_household_id IS NULL THEN
    RAISE EXCEPTION 'CRM029:household_id_required'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (
    public.crm_is_owner()
    OR public.crm_can_access_household(p_household_id)
  ) THEN
    RAISE EXCEPTION 'CRM029:not_authorized'
      USING ERRCODE = '42501';
  END IF;

  IF v_event_key IS NULL
     OR v_event_key NOT IN ('tasks.manual.created', 'onboarding.completed') THEN
    RAISE EXCEPTION 'CRM029:event_key_not_allowed'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_meta_in) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'CRM029:activity_metadata_must_be_object'
      USING ERRCODE = '22P02';
  END IF;
  IF octet_length(v_meta_in::text) > 4096 THEN
    RAISE EXCEPTION 'CRM029:activity_metadata_too_large'
      USING ERRCODE = '22023';
  END IF;

  IF v_event_key = 'tasks.manual.created' THEN
    -- Client metadata allowlist: taskId, workflowType, sourceType, idempotencyKey only.
    FOR v_key, v_val IN SELECT key, value FROM jsonb_each(v_meta_in)
    LOOP
      IF v_key NOT IN ('taskId', 'workflowType', 'sourceType', 'idempotencyKey') THEN
        RAISE EXCEPTION 'CRM029:metadata_key_not_allowed'
          USING ERRCODE = '22023';
      END IF;
      IF jsonb_typeof(v_val) NOT IN ('string', 'null') THEN
        RAISE EXCEPTION 'CRM029:metadata_value_invalid'
          USING ERRCODE = '22023';
      END IF;
    END LOOP;

    v_str := NULLIF(btrim(COALESCE(v_meta_in ->> 'taskId', '')), '');
    IF v_str IS NULL THEN
      RAISE EXCEPTION 'CRM029:task_id_required'
        USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_task_id := v_str::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'CRM029:task_id_required'
          USING ERRCODE = '22023';
    END;

    SELECT * INTO v_task
    FROM public.tasks t
    WHERE t.id = v_task_id
      AND t.household_id = p_household_id
      AND t.deleted_at IS NULL;

    IF NOT FOUND THEN
      -- Non-enumerating: missing/foreign/deleted task looks the same.
      RAISE EXCEPTION 'CRM029:subject_relationship_invalid'
        USING ERRCODE = '23514';
    END IF;

    v_workflow := NULLIF(btrim(COALESCE(v_meta_in ->> 'workflowType', '')), '');
    IF v_workflow IS NOT NULL AND char_length(v_workflow) > 64 THEN
      RAISE EXCEPTION 'CRM029:metadata_value_too_long'
        USING ERRCODE = '22023';
    END IF;

    v_source := NULLIF(btrim(COALESCE(v_meta_in ->> 'sourceType', '')), '');
    IF v_source IS NOT NULL THEN
      IF char_length(v_source) > 32 OR v_source IS DISTINCT FROM 'manual' THEN
        RAISE EXCEPTION 'CRM029:metadata_value_invalid'
          USING ERRCODE = '22023';
      END IF;
    ELSE
      v_source := 'manual';
    END IF;

    v_idem := NULLIF(btrim(COALESCE(v_meta_in ->> 'idempotencyKey', '')), '');
    IF v_idem IS NOT NULL AND char_length(v_idem) > 120 THEN
      RAISE EXCEPTION 'CRM029:metadata_value_too_long'
        USING ERRCODE = '22023';
    END IF;

    -- Optional subject params must match the task row when provided.
    IF p_opportunity_id IS NOT NULL AND p_opportunity_id IS DISTINCT FROM v_task.opportunity_id THEN
      RAISE EXCEPTION 'CRM029:subject_relationship_invalid'
        USING ERRCODE = '23514';
    END IF;
    IF p_lead_id IS NOT NULL AND p_lead_id IS DISTINCT FROM v_task.lead_id THEN
      RAISE EXCEPTION 'CRM029:subject_relationship_invalid'
        USING ERRCODE = '23514';
    END IF;
    IF p_assessment_id IS NOT NULL AND p_assessment_id IS DISTINCT FROM v_task.assessment_id THEN
      RAISE EXCEPTION 'CRM029:subject_relationship_invalid'
        USING ERRCODE = '23514';
    END IF;

    v_opp := COALESCE(p_opportunity_id, v_task.opportunity_id);
    v_lead := COALESCE(p_lead_id, v_task.lead_id);
    v_assess := COALESCE(p_assessment_id, v_task.assessment_id);

    PERFORM public.crm_assert_subject_fks_same_household(
      p_household_id, v_opp, v_lead, v_assess, NULL
    );

    v_activity_type := 'task_created'::public.activity_type;
    v_title := NULLIF(btrim(COALESCE(v_task.title, '')), '');
    IF v_title IS NULL THEN
      v_title := 'Task created';
    END IF;
    IF char_length(v_title) > 240 THEN
      v_title := left(v_title, 240);
    END IF;

    v_final := jsonb_strip_nulls(
      jsonb_build_object(
        'eventKey', 'tasks.manual.created',
        'module', 'tasks',
        'entityType', 'task',
        'entityId', v_task_id,
        'visibility', 'internal',
        'pinned', false,
        'actorKind', 'user',
        'taskId', v_task_id,
        'workflowType', v_workflow,
        'sourceType', v_source,
        'idempotencyKey', v_idem
      )
    );

  ELSIF v_event_key = 'onboarding.completed' THEN
    IF p_opportunity_id IS NOT NULL OR p_lead_id IS NOT NULL THEN
      RAISE EXCEPTION 'CRM029:subject_parameter_not_allowed'
        USING ERRCODE = '22023';
    END IF;

    FOR v_key, v_val IN SELECT key, value FROM jsonb_each(v_meta_in)
    LOOP
      IF v_key NOT IN ('assessmentType', 'idempotencyKey') THEN
        RAISE EXCEPTION 'CRM029:metadata_key_not_allowed'
          USING ERRCODE = '22023';
      END IF;
      IF jsonb_typeof(v_val) NOT IN ('string', 'null') THEN
        RAISE EXCEPTION 'CRM029:metadata_value_invalid'
          USING ERRCODE = '22023';
      END IF;
    END LOOP;

    IF p_assessment_id IS NULL THEN
      RAISE EXCEPTION 'CRM029:assessment_id_required'
        USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_assessment
    FROM public.assessments a
    WHERE a.id = p_assessment_id
      AND a.household_id = p_household_id
      AND a.deleted_at IS NULL
      AND a.assessment_type = 'household_onboarding'::public.assessment_type
      AND a.status = 'completed'::public.assessment_status
      AND a.completed_at IS NOT NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'CRM029:subject_relationship_invalid'
        USING ERRCODE = '23514';
    END IF;

    v_assessment_type := NULLIF(btrim(COALESCE(v_meta_in ->> 'assessmentType', '')), '');
    IF v_assessment_type IS NULL THEN
      v_assessment_type := 'household_onboarding';
    END IF;
    IF v_assessment_type IS DISTINCT FROM 'household_onboarding'
       OR char_length(v_assessment_type) > 64 THEN
      RAISE EXCEPTION 'CRM029:metadata_value_invalid'
        USING ERRCODE = '22023';
    END IF;

    v_idem := NULLIF(btrim(COALESCE(v_meta_in ->> 'idempotencyKey', '')), '');
    IF v_idem IS NOT NULL AND char_length(v_idem) > 120 THEN
      RAISE EXCEPTION 'CRM029:metadata_value_too_long'
        USING ERRCODE = '22023';
    END IF;

    v_opp := NULL;
    v_lead := NULL;
    v_assess := p_assessment_id;

    v_activity_type := 'assessment_completed'::public.activity_type;
    v_title := 'Household Onboarding completed';

    v_final := jsonb_strip_nulls(
      jsonb_build_object(
        'eventKey', 'onboarding.completed',
        'module', 'households',
        'entityType', 'assessment',
        'entityId', p_assessment_id,
        'visibility', 'internal',
        'pinned', false,
        'actorKind', 'user',
        'assessmentType', v_assessment_type,
        'idempotencyKey', v_idem
      )
    );
  ELSE
    RAISE EXCEPTION 'CRM029:event_key_not_allowed'
      USING ERRCODE = '22023';
  END IF;

  IF octet_length(v_final::text) > 4096 THEN
    RAISE EXCEPTION 'CRM029:activity_metadata_too_large'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.activities (
    household_id,
    opportunity_id,
    lead_id,
    assessment_id,
    recommendation_id,
    actor_user_id,
    activity_type,
    title,
    body,
    metadata,
    occurred_at
  )
  VALUES (
    p_household_id,
    v_opp,
    v_lead,
    v_assess,
    NULL,
    v_uid,
    v_activity_type,
    v_title,
    NULL,
    v_final,
    now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.record_crm_activity(uuid, text, jsonb, uuid, uuid, uuid) IS
  'Authenticated browser Activity foundation for tasks.manual.created and onboarding.completed only. Derives type/title/visibility/occurred_at server-side. Soft idempotencyKey accepted but not uniquely enforced in 029. Actor from auth.uid().';

REVOKE ALL ON FUNCTION public.record_crm_activity(uuid, text, jsonb, uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_crm_activity(uuid, text, jsonb, uuid, uuid, uuid)
  TO authenticated;

-- =============================================================================
-- SECTION D — Activity grant correction (deterministic across environments)
-- =============================================================================
REVOKE ALL ON TABLE public.activities FROM PUBLIC;
REVOKE ALL ON TABLE public.activities FROM anon;
REVOKE ALL ON TABLE public.activities FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.activities TO authenticated;
GRANT ALL ON TABLE public.activities TO service_role;

-- =============================================================================
-- End Migration 029
-- =============================================================================
