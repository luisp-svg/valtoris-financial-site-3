-- 022_public_family_task_automation.sql
-- Sprint 4A.3 Phase 6: consent-aware internal follow-up task automation for
-- public Family Initial Financial Diagnostics.
--
-- Invariants:
--   - Automatic tasks are internal review only (never outbound messaging)
--   - Task failure never rolls back lead/assessment/household persistence
--   - Idempotent on public_family:{assessment_id}:{workflow_type}
--   - Soft-deleted automatic tasks are NOT silently recreated on ordinary retries
--   - Browser must not supply household/lead/consent/title as trusted inputs
--   - Completing a task does not promote assessment provenance

-- ---------------------------------------------------------------------------
-- Enums (CHECK-constrained text is used where enums would be heavier; match
-- sheets_sync_error_category / ingest_match_status style from 020).
-- ---------------------------------------------------------------------------

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assessment_id uuid REFERENCES public.assessments (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS workflow_type text,
  ADD COLUMN IF NOT EXISTS automation_idempotency_key text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.tasks
SET source_type = 'manual'
WHERE source_type IS NULL;

ALTER TABLE public.tasks
  ALTER COLUMN source_type SET DEFAULT 'manual',
  ALTER COLUMN source_type SET NOT NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_source_type_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_source_type_check
  CHECK (
    source_type IN ('manual', 'public_family_ingest', 'duplicate_resolution', 'system')
  );

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_workflow_type_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_workflow_type_check
  CHECK (
    workflow_type IS NULL
    OR workflow_type IN (
      'review_initial_diagnostic',
      'resolve_possible_duplicate'
    )
  );

COMMENT ON COLUMN public.tasks.lead_id IS
  'Optional originating lead. Automatic public-family tasks set this from assessments.lead_id.';
COMMENT ON COLUMN public.tasks.assessment_id IS
  'Optional originating assessment. Required for public-family automation idempotency.';
COMMENT ON COLUMN public.tasks.source_type IS
  'manual | public_family_ingest | duplicate_resolution | system';
COMMENT ON COLUMN public.tasks.workflow_type IS
  'review_initial_diagnostic | resolve_possible_duplicate (null for legacy/manual freeform).';
COMMENT ON COLUMN public.tasks.automation_idempotency_key IS
  'public_family:{assessment_id}:{workflow_type}. Null for manual tasks.';
COMMENT ON COLUMN public.tasks.metadata IS
  'Minimal operational metadata only. Never store answers, PII, or raw errors.';

CREATE UNIQUE INDEX IF NOT EXISTS tasks_automation_idempotency_key_uidx
  ON public.tasks (automation_idempotency_key)
  WHERE automation_idempotency_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS tasks_assessment_id_idx
  ON public.tasks (assessment_id)
  WHERE assessment_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS tasks_lead_id_idx
  ON public.tasks (lead_id)
  WHERE lead_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS tasks_workflow_source_idx
  ON public.tasks (workflow_type, source_type)
  WHERE deleted_at IS NULL AND workflow_type IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Lead automation status fields
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS follow_up_task_automation_status text,
  ADD COLUMN IF NOT EXISTS follow_up_task_id uuid REFERENCES public.tasks (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS follow_up_task_automation_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_task_automation_error_category text;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_follow_up_task_automation_status_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_follow_up_task_automation_status_check
  CHECK (
    follow_up_task_automation_status IS NULL
    OR follow_up_task_automation_status IN (
      'task_created',
      'task_not_required',
      'task_pending',
      'task_failed',
      'task_manually_created'
    )
  );

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_follow_up_task_automation_error_category_len;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_follow_up_task_automation_error_category_len
  CHECK (
    follow_up_task_automation_error_category IS NULL
    OR char_length(follow_up_task_automation_error_category) <= 64
  );

CREATE INDEX IF NOT EXISTS leads_follow_up_task_automation_status_idx
  ON public.leads (follow_up_task_automation_status)
  WHERE follow_up_task_automation_status IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.leads.follow_up_task_automation_status IS
  'Public-family follow-up automation outcome. Null = unknown/historical.';
COMMENT ON COLUMN public.leads.follow_up_task_id IS
  'Latest automatic or manually linked follow-up task for this ingest lead.';
COMMENT ON COLUMN public.leads.follow_up_task_automation_error_category IS
  'Safe short category (e.g. rpc_error, validation_error). Never raw SQL.';

-- ---------------------------------------------------------------------------
-- create_public_family_follow_up_task
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_public_family_follow_up_task(
  p_assessment_id uuid,
  p_workflow_type text,
  p_creation_source text DEFAULT 'system'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_workflow text := lower(btrim(COALESCE(p_workflow_type, '')));
  v_source text := lower(btrim(COALESCE(p_creation_source, 'system')));
  v_assessment public.assessments;
  v_household public.households;
  v_lead public.leads;
  v_existing public.tasks;
  v_deleted public.tasks;
  v_key text;
  v_title text;
  v_description text;
  v_priority public.task_priority;
  v_due date;
  v_contact boolean;
  v_email_mkt boolean;
  v_sms_mkt boolean;
  v_consent jsonb;
  v_assigned_user_id uuid;
  v_task public.tasks;
  v_now timestamptz := now();
  v_pending_dup boolean;
  v_dup_task public.tasks;
BEGIN
  -- Authenticated callers: owner-only in v1. Service role (auth.uid null) allowed.
  IF v_uid IS NOT NULL AND NOT public.crm_is_owner() THEN
    RAISE EXCEPTION 'CRM_TASK:not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_assessment_id IS NULL THEN
    RAISE EXCEPTION 'CRM_TASK:invalid_assessment' USING ERRCODE = '22023';
  END IF;

  IF v_workflow NOT IN ('review_initial_diagnostic', 'resolve_possible_duplicate') THEN
    RAISE EXCEPTION 'CRM_TASK:invalid_workflow' USING ERRCODE = '22023';
  END IF;

  IF v_source NOT IN ('manual', 'public_family_ingest', 'duplicate_resolution', 'system') THEN
    RAISE EXCEPTION 'CRM_TASK:invalid_source' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_assessment
  FROM public.assessments
  WHERE id = p_assessment_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_assessment.deleted_at IS NOT NULL
     OR v_assessment.assessment_type IS DISTINCT FROM 'family'
     OR v_assessment.capture_channel IS DISTINCT FROM 'public_self_report'
     OR v_assessment.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'CRM_TASK:invalid_assessment' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_household
  FROM public.households
  WHERE id = v_assessment.household_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_household.deleted_at IS NOT NULL
     OR v_household.merged_into_household_id IS NOT NULL THEN
    RAISE EXCEPTION 'CRM_TASK:invalid_household' USING ERRCODE = 'P0001';
  END IF;

  IF v_assessment.lead_id IS NULL THEN
    RAISE EXCEPTION 'CRM_TASK:invalid_lead' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_lead
  FROM public.leads
  WHERE id = v_assessment.lead_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_lead.deleted_at IS NOT NULL
     OR v_lead.household_id IS DISTINCT FROM v_household.id THEN
    RAISE EXCEPTION 'CRM_TASK:invalid_lead' USING ERRCODE = 'P0001';
  END IF;

  v_pending_dup := (
    v_lead.ingest_match_status = 'possible_match'
    AND COALESCE(v_lead.duplicate_review_status::text, 'none') = 'pending'
  );

  IF v_workflow = 'resolve_possible_duplicate' THEN
    IF v_lead.ingest_match_status IS DISTINCT FROM 'possible_match' OR NOT v_pending_dup THEN
      RAISE EXCEPTION 'CRM_TASK:workflow_not_allowed' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_workflow = 'review_initial_diagnostic' AND v_pending_dup THEN
    RAISE EXCEPTION 'CRM_TASK:workflow_not_allowed' USING ERRCODE = 'P0001';
  END IF;

  v_key := 'public_family:' || v_assessment.id::text || ':' || v_workflow;

  -- Soft-deleted automatic task: do not silently recreate.
  SELECT * INTO v_deleted
  FROM public.tasks
  WHERE automation_idempotency_key = v_key
    AND deleted_at IS NOT NULL
  ORDER BY deleted_at DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.leads
    SET
      follow_up_task_automation_status = 'task_failed',
      follow_up_task_automation_attempted_at = v_now,
      follow_up_task_automation_error_category = 'soft_deleted_task_exists',
      updated_at = v_now
    WHERE id = v_lead.id;

    RETURN jsonb_build_object(
      'ok', true,
      'already_exists', false,
      'needs_manual_review', true,
      'task_id', NULL,
      'workflow_type', v_workflow,
      'lead_id', v_lead.id,
      'assessment_id', v_assessment.id,
      'household_id', v_household.id,
      'message', 'soft_deleted_task_exists'
    );
  END IF;

  SELECT * INTO v_existing
  FROM public.tasks
  WHERE automation_idempotency_key = v_key
    AND deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.leads
    SET
      follow_up_task_automation_status = 'task_created',
      follow_up_task_id = v_existing.id,
      follow_up_task_automation_attempted_at = v_now,
      follow_up_task_automation_error_category = NULL,
      updated_at = v_now
    WHERE id = v_lead.id;

    RETURN jsonb_build_object(
      'ok', true,
      'already_exists', true,
      'needs_manual_review', false,
      'task_id', v_existing.id,
      'workflow_type', v_workflow,
      'lead_id', v_lead.id,
      'assessment_id', v_assessment.id,
      'household_id', v_household.id
    );
  END IF;

  -- After duplicate resolution, complete open resolve tasks before creating review.
  IF v_source = 'duplicate_resolution' AND v_workflow = 'review_initial_diagnostic' THEN
    FOR v_dup_task IN
      SELECT *
      FROM public.tasks
      WHERE assessment_id = v_assessment.id
        AND workflow_type = 'resolve_possible_duplicate'
        AND deleted_at IS NULL
        AND status IN ('open', 'in_progress')
      FOR UPDATE
    LOOP
      UPDATE public.tasks
      SET
        status = 'done',
        completed_at = v_now,
        updated_at = v_now
      WHERE id = v_dup_task.id;
    END LOOP;
  END IF;

  v_consent := COALESCE(v_lead.consent_snapshot, '{}'::jsonb);
  v_contact := (v_consent->>'contactPermission') = 'true';
  v_email_mkt := (v_consent->>'emailMarketingConsent') = 'true';
  v_sms_mkt := (v_consent->>'smsMarketingConsent') = 'true';

  IF v_workflow = 'resolve_possible_duplicate' THEN
    v_title := 'Resolve possible duplicate diagnostic submission';
    v_description :=
      'Owner review required for a possible duplicate public Family Report Card submission.'
      || E'\n' || 'Review provisional and candidate household identity in Intake.'
      || E'\n' || 'Do not initiate outreach before identity review is complete.'
      || E'\n' || 'Resolve through Confirm Same Household or Keep as Separate Household.';
    v_priority := 'high';
    v_due := (COALESCE(v_assessment.completed_at, v_lead.submitted_at, v_now))::date + 1;
    v_assigned_user_id := NULL;
  ELSIF v_contact THEN
    IF v_lead.ingest_match_status = 'exact_trusted_match' THEN
      v_title := 'Review new Initial Financial Diagnostic for existing household';
    ELSE
      v_title := 'Review Initial Financial Diagnostic and follow up';
    END IF;
    v_description :=
      'Internal CRM review task for a public Family Report Card Initial Financial Diagnostic.'
      || E'\n' || 'Contact permission was granted on this submission.'
      || E'\n' || CASE WHEN v_email_mkt
           THEN 'Email marketing consent was granted (marketing only; not general contact).'
           ELSE 'Email marketing consent was not granted.' END
      || E'\n' || CASE WHEN v_sms_mkt
           THEN 'SMS marketing consent was granted (marketing only; not general contact).'
           ELSE 'SMS marketing consent was not granted.' END
      || E'\n' || 'Review the diagnostic before any outreach.'
      || E'\n' || 'Do not assume a communication channel without its channel consent.'
      || E'\n' || 'Completing this task does not mark the diagnostic as advisor-reviewed.';
    v_priority := 'high';
    v_due := (COALESCE(v_assessment.completed_at, v_lead.submitted_at, v_now))::date + 1;
  ELSIF (v_consent->>'contactPermission') = 'false' THEN
    IF v_lead.ingest_match_status = 'exact_trusted_match' THEN
      v_title := 'Review new diagnostic for existing household — verify contact authority';
    ELSE
      v_title := 'Review Initial Financial Diagnostic — no contact permission';
    END IF;
    v_description :=
      'Internal CRM review task for a public Family Report Card Initial Financial Diagnostic.'
      || E'\n' || 'Contact permission was not granted.'
      || E'\n' || 'Internal review only. Do not initiate outreach based solely on this submission.'
      || E'\n' || 'Completing this task does not mark the diagnostic as advisor-reviewed.';
    v_priority := 'medium';
    v_due := (COALESCE(v_assessment.completed_at, v_lead.submitted_at, v_now))::date + 3;
  ELSE
    v_title := 'Review Initial Financial Diagnostic — verify contact permission';
    v_description :=
      'Internal CRM review task for a public Family Report Card Initial Financial Diagnostic.'
      || E'\n' || 'Contact permission could not be determined from the consent snapshot.'
      || E'\n' || 'Verify contact authority before any outreach based on this diagnostic.'
      || E'\n' || 'Completing this task does not mark the diagnostic as advisor-reviewed.';
    v_priority := 'medium';
    v_due := (COALESCE(v_assessment.completed_at, v_lead.submitted_at, v_now))::date + 3;
  END IF;

  -- Map assigned advisor_profiles.id → profiles.id (tasks.assigned_user_id)
  IF v_workflow = 'review_initial_diagnostic' THEN
    SELECT ap.user_id INTO v_assigned_user_id
    FROM public.advisor_profiles ap
    WHERE ap.id = COALESCE(v_household.assigned_advisor_id, v_lead.assigned_advisor_id)
      AND ap.deleted_at IS NULL
      AND ap.is_active = true
    LIMIT 1;
  END IF;

  INSERT INTO public.tasks (
    household_id,
    lead_id,
    assessment_id,
    title,
    description,
    due_date,
    priority,
    status,
    assigned_user_id,
    created_by_user_id,
    source_type,
    workflow_type,
    automation_idempotency_key,
    metadata
  ) VALUES (
    v_household.id,
    v_lead.id,
    v_assessment.id,
    v_title,
    v_description,
    v_due,
    v_priority,
    'open',
    v_assigned_user_id,
    v_uid,
    v_source,
    v_workflow,
    v_key,
    jsonb_build_object(
      'public_family_diagnostic', true,
      'match_status', v_lead.ingest_match_status,
      'contact_permission', CASE
        WHEN (v_consent->>'contactPermission') = 'true' THEN true
        WHEN (v_consent->>'contactPermission') = 'false' THEN false
        ELSE NULL
      END,
      'email_marketing_consent', v_email_mkt,
      'sms_marketing_consent', v_sms_mkt,
      'creation_source', v_source
    )
  )
  RETURNING * INTO v_task;

  UPDATE public.leads
  SET
    follow_up_task_automation_status = 'task_created',
    follow_up_task_id = v_task.id,
    follow_up_task_automation_attempted_at = v_now,
    follow_up_task_automation_error_category = NULL,
    updated_at = v_now
  WHERE id = v_lead.id;

  PERFORM public.crm_write_activity(
    v_household.id,
    'system',
    'Follow-up review task created',
    'Internal review task created for a public Family Initial Financial Diagnostic.',
    jsonb_build_object(
      'event', 'public_family_follow_up_task_created',
      'task_id', v_task.id,
      'lead_id', v_lead.id,
      'assessment_id', v_assessment.id,
      'household_id', v_household.id,
      'workflow_type', v_workflow,
      'creation_source', v_source,
      'assignee_user_id', v_assigned_user_id
    ),
    NULL,
    NULL,
    v_lead.id,
    v_assessment.id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_exists', false,
    'needs_manual_review', false,
    'task_id', v_task.id,
    'workflow_type', v_workflow,
    'lead_id', v_lead.id,
    'assessment_id', v_assessment.id,
    'household_id', v_household.id
  );
END;
$$;

COMMENT ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) IS
  'Owner or service-role idempotent creator for public Family diagnostic follow-up tasks. Derives household/lead/consent/assignment from trusted rows. Soft-deleted automatic keys require manual review (no silent recreate).';

REVOKE ALL ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) TO service_role;

ALTER FUNCTION public.create_public_family_follow_up_task(uuid, text, text) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- update_public_family_task_automation_status (service_role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_public_family_task_automation_status(
  p_lead_id uuid,
  p_status text,
  p_task_id uuid DEFAULT NULL,
  p_error_category text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_status text := lower(btrim(COALESCE(p_status, '')));
  v_lead public.leads;
  v_task public.tasks;
  v_err text;
  v_now timestamptz := now();
BEGIN
  -- Service-role path: reject authenticated user calls.
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'CRM_TASK:not_authorized' USING ERRCODE = '42501';
  END IF;

  IF v_status NOT IN (
    'task_created',
    'task_not_required',
    'task_pending',
    'task_failed',
    'task_manually_created'
  ) THEN
    RAISE EXCEPTION 'CRM_TASK:invalid_status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND OR v_lead.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'CRM_TASK:invalid_lead' USING ERRCODE = 'P0001';
  END IF;

  IF p_task_id IS NOT NULL THEN
    SELECT * INTO v_task
    FROM public.tasks
    WHERE id = p_task_id;

    IF NOT FOUND
       OR v_task.deleted_at IS NOT NULL
       OR v_task.lead_id IS DISTINCT FROM v_lead.id
       OR v_task.household_id IS DISTINCT FROM v_lead.household_id THEN
      RAISE EXCEPTION 'CRM_TASK:invalid_task' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_err := NULLIF(btrim(COALESCE(p_error_category, '')), '');
  IF v_err IS NOT NULL THEN
    v_err := left(regexp_replace(v_err, '[^a-zA-Z0-9_.-]', '', 'g'), 64);
  END IF;

  -- Do not replace a successful task reference with a bare failure.
  IF v_status = 'task_failed'
     AND v_lead.follow_up_task_automation_status = 'task_created'
     AND v_lead.follow_up_task_id IS NOT NULL
     AND p_task_id IS NULL THEN
    UPDATE public.leads
    SET
      follow_up_task_automation_attempted_at = v_now,
      follow_up_task_automation_error_category = COALESCE(v_err, 'rpc_error'),
      updated_at = v_now
    WHERE id = v_lead.id;
    RETURN;
  END IF;

  UPDATE public.leads
  SET
    follow_up_task_automation_status = v_status,
    follow_up_task_id = COALESCE(p_task_id, follow_up_task_id),
    follow_up_task_automation_attempted_at = v_now,
    follow_up_task_automation_error_category = CASE
      WHEN v_status = 'task_failed' THEN COALESCE(v_err, 'rpc_error')
      ELSE NULL
    END,
    updated_at = v_now
  WHERE id = v_lead.id;
END;
$$;

COMMENT ON FUNCTION public.update_public_family_task_automation_status(uuid, text, uuid, text) IS
  'Service-role-only lead follow-up automation status bookkeeping. Authenticated callers are rejected. Never stores raw SQL errors.';

REVOKE ALL ON FUNCTION public.update_public_family_task_automation_status(uuid, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_public_family_task_automation_status(uuid, text, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.update_public_family_task_automation_status(uuid, text, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_public_family_task_automation_status(uuid, text, uuid, text) TO service_role;

ALTER FUNCTION public.update_public_family_task_automation_status(uuid, text, uuid, text) OWNER TO postgres;
