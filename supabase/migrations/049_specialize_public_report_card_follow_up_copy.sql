-- Migration 049: specialize public report-card follow-up task / activity copy.
--
-- Scope: CREATE OR REPLACE public.create_public_family_follow_up_task only.
-- Human-readable title, description, and follow-up Activity body are mapped
-- by assessment_type. Family wording is preserved exactly.
--
-- Does not add tables, columns, enums, RPCs, RLS, triggers, Opportunities,
-- scoring, ingest persist, or insurance/commission/revenue behavior.
-- workflow_type remains review_initial_diagnostic.

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
  v_activity_body text;
  v_product text;
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
     OR v_assessment.assessment_type NOT IN ('family', 'business', 'retirement', 'protection', 'student_loan')
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

  v_product := CASE v_assessment.assessment_type::text
    WHEN 'family' THEN 'Initial Financial Diagnostic'
    WHEN 'business' THEN 'Business Report Card'
    WHEN 'retirement' THEN 'Retirement Report Card'
    WHEN 'protection' THEN 'Protection Gap Analysis'
    WHEN 'student_loan' THEN 'Student Loan Report Card'
  END;

  IF v_workflow = 'resolve_possible_duplicate' THEN
    v_title := 'Resolve possible duplicate diagnostic submission';
    IF v_assessment.assessment_type = 'family' THEN
      v_description :=
        'Owner review required for a possible duplicate public Family Report Card submission.'
        || E'\n' || 'Review provisional and candidate household identity in Intake.'
        || E'\n' || 'Do not initiate outreach before identity review is complete.'
        || E'\n' || 'Resolve through Confirm Same Household or Keep as Separate Household.';
    ELSE
      v_description :=
        'Owner review required for a possible duplicate public ' || v_product || ' submission.'
        || E'\n' || 'Review provisional and candidate household identity in Intake.'
        || E'\n' || 'Do not initiate outreach before identity review is complete.'
        || E'\n' || 'Resolve through Confirm Same Household or Keep as Separate Household.';
    END IF;
    v_priority := 'high';
    v_due := (COALESCE(v_assessment.completed_at, v_lead.submitted_at, v_now))::date + 1;
    v_assigned_user_id := NULL;
  ELSIF v_contact THEN
    IF v_assessment.assessment_type = 'family' THEN
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
    ELSE
      IF v_lead.ingest_match_status = 'exact_trusted_match' THEN
        v_title := 'Review new ' || v_product || ' for existing household';
      ELSE
        v_title := 'Review ' || v_product || ' and follow up';
      END IF;
      v_description :=
        'Review the public ' || v_product || ' results and contact the prospect within one business day.'
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
    END IF;
    v_priority := 'high';
    v_due := (COALESCE(v_assessment.completed_at, v_lead.submitted_at, v_now))::date + 1;
  ELSIF (v_consent->>'contactPermission') = 'false' THEN
    IF v_assessment.assessment_type = 'family' THEN
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
    ELSE
      IF v_lead.ingest_match_status = 'exact_trusted_match' THEN
        v_title := 'Review new ' || v_product || ' for existing household — verify contact authority';
      ELSE
        v_title := 'Review ' || v_product || ' — no contact permission';
      END IF;
      v_description :=
        'Internal CRM review task for a public ' || v_product || '.'
        || E'\n' || 'Contact permission was not granted.'
        || E'\n' || 'Internal review only. Do not initiate outreach based solely on this submission.'
        || E'\n' || 'Completing this task does not mark the diagnostic as advisor-reviewed.';
    END IF;
    v_priority := 'medium';
    v_due := (COALESCE(v_assessment.completed_at, v_lead.submitted_at, v_now))::date + 3;
  ELSE
    IF v_assessment.assessment_type = 'family' THEN
      v_title := 'Review Initial Financial Diagnostic — verify contact permission';
      v_description :=
        'Internal CRM review task for a public Family Report Card Initial Financial Diagnostic.'
        || E'\n' || 'Contact permission could not be determined from the consent snapshot.'
        || E'\n' || 'Verify contact authority before any outreach based on this diagnostic.'
        || E'\n' || 'Completing this task does not mark the diagnostic as advisor-reviewed.';
    ELSE
      v_title := 'Review ' || v_product || ' — verify contact permission';
      v_description :=
        'Internal CRM review task for a public ' || v_product || '.'
        || E'\n' || 'Contact permission could not be determined from the consent snapshot.'
        || E'\n' || 'Verify contact authority before any outreach based on this diagnostic.'
        || E'\n' || 'Completing this task does not mark the diagnostic as advisor-reviewed.';
    END IF;
    v_priority := 'medium';
    v_due := (COALESCE(v_assessment.completed_at, v_lead.submitted_at, v_now))::date + 3;
  END IF;

  IF v_assessment.assessment_type = 'family' THEN
    v_activity_body := 'Internal review task created for a public Family Initial Financial Diagnostic.';
  ELSE
    v_activity_body := 'Follow-up review task created for public ' || v_product || '.';
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
    v_activity_body,
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
  'Owner or service-role idempotent creator for public report-card follow-up tasks. Human-readable copy is specialized by assessment_type. Derives household/lead/consent/assignment from trusted rows. Soft-deleted automatic keys require manual review (no silent recreate).';

REVOKE ALL ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_family_follow_up_task(uuid, text, text) TO service_role;

ALTER FUNCTION public.create_public_family_follow_up_task(uuid, text, text) OWNER TO postgres;
