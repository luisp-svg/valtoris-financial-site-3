-- 052_fix_intake_archive_activity_order.sql
-- Corrective replacement of archive_intake_lead only.
--
-- Migration 051 wrote the private CRM Activity after SET leads.deleted_at.
-- crm_assert_subject_fks_same_household (029) requires the Activity lead
-- subject to have deleted_at IS NULL, so the Activity write failed with
-- CRM029:subject_relationship_invalid and the archive transaction rolled back.
--
-- This migration keeps every 051 semantic and only reorders the writes:
--   1) determine linked ordinary follow-up completion
--   2) write one Intake archived Activity while the lead is still active
--   3) complete only that verified ordinary follow-up task, if applicable
--   4) SET leads.deleted_at
--
-- One transaction. No new table, column, RPC name, restore, or hard delete.

CREATE OR REPLACE FUNCTION public.archive_intake_lead(
  p_lead_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_lead public.leads;
  v_can_mutate boolean := false;
  v_pending_dup boolean := false;
  v_task public.tasks;
  v_task_completed boolean := false;
  v_completed_task_id uuid := NULL;
  v_assessment_type text := NULL;
  v_product text;
  v_reason_label text;
  v_meta jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CRM_INTAKE:not_authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF v_reason IS NULL
     OR v_reason NOT IN ('dismissed', 'not_a_fit', 'spam', 'test_or_accidental') THEN
    RAISE EXCEPTION 'CRM_INTAKE:invalid_reason'
      USING ERRCODE = '22023';
  END IF;

  IF p_lead_id IS NULL THEN
    RAISE EXCEPTION 'CRM_INTAKE:not_authorized'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CRM_INTAKE:not_authorized'
      USING ERRCODE = '42501';
  END IF;

  v_can_mutate := (
    public.crm_is_owner()
    OR public.crm_can_access_household(v_lead.household_id)
  );

  IF NOT v_can_mutate THEN
    RAISE EXCEPTION 'CRM_INTAKE:not_authorized'
      USING ERRCODE = '42501';
  END IF;

  IF v_lead.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'CRM_INTAKE:already_archived'
      USING ERRCODE = '22023';
  END IF;

  IF v_lead.lead_type NOT IN (
    'Family Report Card',
    'Business Report Card',
    'Retirement Report Card',
    'Protection Gap',
    'Student Loan Report Card',
    'Credit Report Card',
    'Digital Identity'
  ) THEN
    RAISE EXCEPTION 'CRM_INTAKE:not_intake_lead'
      USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.duplicate_reviews dr
    WHERE dr.incoming_lead_id = v_lead.id
      AND dr.status = 'pending'
  )
  INTO v_pending_dup;

  IF v_lead.status = 'duplicate_review'::public.lead_status
     OR v_pending_dup THEN
    RAISE EXCEPTION 'CRM_INTAKE:duplicate_review_pending'
      USING ERRCODE = '22023';
  END IF;

  IF v_lead.follow_up_task_id IS NOT NULL THEN
    SELECT *
    INTO v_task
    FROM public.tasks
    WHERE id = v_lead.follow_up_task_id
    FOR UPDATE;

    IF FOUND
       AND v_task.id = v_lead.follow_up_task_id
       AND v_task.lead_id IS NOT DISTINCT FROM v_lead.id
       AND v_task.household_id IS NOT DISTINCT FROM v_lead.household_id
       AND v_task.deleted_at IS NULL
       AND v_task.status IN ('open', 'in_progress')
       AND v_task.workflow_type IN (
         'review_initial_diagnostic',
         'review_digital_identity_lead'
       )
       AND v_task.workflow_type NOT IN (
         'resolve_possible_duplicate',
         'resolve_digital_identity_duplicate'
       ) THEN
      v_task_completed := true;
      v_completed_task_id := v_task.id;
    END IF;
  END IF;

  SELECT a.assessment_type::text
  INTO v_assessment_type
  FROM public.assessments a
  WHERE a.lead_id = v_lead.id
    AND a.deleted_at IS NULL
  ORDER BY a.completed_at DESC NULLS LAST
  LIMIT 1;

  v_product := v_lead.lead_type;
  v_reason_label := CASE v_reason
    WHEN 'dismissed' THEN 'Dismissed'
    WHEN 'not_a_fit' THEN 'Not a Fit'
    WHEN 'spam' THEN 'Spam'
    WHEN 'test_or_accidental' THEN 'Test / Accidental'
  END;

  v_meta := jsonb_build_object(
    'lead_id', v_lead.id,
    'household_id', v_lead.household_id,
    'archive_reason', v_reason,
    'lead_type', v_lead.lead_type,
    'follow_up_task_completed', v_task_completed
  );

  IF v_assessment_type IS NOT NULL THEN
    v_meta := v_meta || jsonb_build_object('assessment_type', v_assessment_type);
  END IF;

  IF v_task_completed AND v_completed_task_id IS NOT NULL THEN
    v_meta := v_meta || jsonb_build_object('follow_up_task_id', v_completed_task_id);
  END IF;

  PERFORM public.crm_write_activity(
    v_lead.household_id,
    'system'::public.activity_type,
    'Intake archived',
    v_product || ' Intake archived as ' || v_reason_label || '.',
    v_meta,
    NULL,
    NULL,
    v_lead.id,
    NULL
  );

  IF v_task_completed AND v_completed_task_id IS NOT NULL THEN
    UPDATE public.tasks
    SET
      status = 'done',
      completed_at = now()
    WHERE id = v_completed_task_id
      AND deleted_at IS NULL
      AND status IN ('open', 'in_progress')
      AND workflow_type IN (
        'review_initial_diagnostic',
        'review_digital_identity_lead'
      );

    IF NOT FOUND THEN
      RAISE EXCEPTION 'CRM_INTAKE:not_authorized'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.leads
  SET deleted_at = now()
  WHERE id = v_lead.id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CRM_INTAKE:already_archived'
      USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'lead_id', v_lead.id,
    'archived', true,
    'reason', v_reason,
    'follow_up_task_completed', v_task_completed
  );
END;
$$;

ALTER FUNCTION public.archive_intake_lead(uuid, text) OWNER TO postgres;

COMMENT ON FUNCTION public.archive_intake_lead(uuid, text) IS
  'Authenticated Intake archive. Writes one private CRM Activity while the lead is still active, completes only the linked ordinary follow-up task (review_initial_diagnostic | review_digital_identity_lead), then sets leads.deleted_at. Owner or assigned-household advisor. Rejects pending duplicate review. Never completes resolve_possible_duplicate or resolve_digital_identity_duplicate. Reasons: dismissed | not_a_fit | spam | test_or_accidental.';

REVOKE ALL ON FUNCTION public.archive_intake_lead(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_intake_lead(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.archive_intake_lead(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.archive_intake_lead(uuid, text) TO authenticated;
