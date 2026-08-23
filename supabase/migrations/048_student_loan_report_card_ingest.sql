-- 048_student_loan_report_card_ingest.sql
-- Enable student_loan as a first-class public Report Card assessment type.
--
-- Verified gap: public.assessment_type has no student_loan value, while
-- assessments.assessment_type is NOT NULL and ingest_public_report_card /
-- create_public_family_follow_up_task / resolve_public_family_duplicate_review
-- allowlist only family/business/retirement/protection.
--
-- Adds enum value student_loan (018 ADD VALUE IF NOT EXISTS pattern) and
-- replaces the three existing public ingest/follow-up/duplicate functions
-- so they accept student_loan. No new ingest RPC. No new tables/columns.
-- Does not create Opportunities. Does not change Family/Business/Retirement/
-- Protection lead_type or lead_source mappings.
--
-- student_loan:
--   lead_type   = Student Loan Report Card
--   lead_source = student_loan_report_card

ALTER TYPE public.assessment_type ADD VALUE IF NOT EXISTS 'student_loan';

COMMENT ON TYPE public.assessment_type IS
  'Assessment product type. family/business/retirement/protection/student_loan are public report-card flows; household_onboarding is CRM guided evidence capture.';


CREATE OR REPLACE FUNCTION public.ingest_public_report_card(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key uuid;
  v_match_status text;
  v_matched_household_id uuid;
  v_candidate_household_id uuid;
  v_household_id uuid;
  v_member_id uuid;
  v_lead_id uuid;
  v_assessment_id uuid;
  v_duplicate_review_id uuid;
  v_existing record;
  v_pipeline_id uuid := '22222222-2222-2222-2222-222222222201'::uuid;
  v_stage_id uuid := '33333333-3333-3333-3333-333333333001'::uuid;
  v_display_name text;
  v_first_name text;
  v_last_name text;
  v_email text;
  v_phone text;
  v_normalized_email extensions.citext;
  v_normalized_phone text;
  v_submitted_at timestamptz;
  v_lead_status public.lead_status;
  v_created boolean := true;
  v_assessment_type text;
  v_lead_type text;
  v_payload_lead_type text;
  v_lead_source text;
  v_advisor_profile_id uuid;
  v_advisor_slug text;
  v_campaign_code text;
  v_attribution public.attribution_method;
  v_assign_advisor boolean := false;
  v_activity_lead_title text;
  v_activity_lead_body text;
  v_activity_assess_title text;
  v_activity_assess_body text;
  v_activity_source text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_key := (p_payload->>'idempotency_key')::uuid;
  EXCEPTION
    WHEN others THEN
      RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE = '22023';
  END;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE = '22023';
  END IF;

  v_assessment_type := NULLIF(trim(COALESCE(p_payload->>'assessment_type', '')), '');
  IF v_assessment_type IS NULL OR v_assessment_type NOT IN (
    'family', 'business', 'retirement', 'protection', 'student_loan'
  ) THEN
    RAISE EXCEPTION 'invalid_assessment_type' USING ERRCODE = '22023';
  END IF;

  v_lead_type := CASE v_assessment_type
    WHEN 'family' THEN 'Family Report Card'
    WHEN 'business' THEN 'Business Report Card'
    WHEN 'retirement' THEN 'Retirement Report Card'
    WHEN 'protection' THEN 'Protection Gap'
    WHEN 'student_loan' THEN 'Student Loan Report Card'
  END;
  v_lead_source := CASE v_assessment_type
    WHEN 'family' THEN 'family_report_card'
    WHEN 'business' THEN 'business_report_card'
    WHEN 'retirement' THEN 'retirement_report_card'
    WHEN 'protection' THEN 'protection_gap'
    WHEN 'student_loan' THEN 'student_loan_report_card'
  END;

  v_payload_lead_type := NULLIF(trim(COALESCE(p_payload->>'lead_type', '')), '');
  IF v_payload_lead_type IS NOT NULL AND v_payload_lead_type IS DISTINCT FROM v_lead_type THEN
    RAISE EXCEPTION 'invalid_lead_type' USING ERRCODE = '22023';
  END IF;

  -- Idempotent replay (any of the five public types for this UUID).
  SELECT l.id AS lead_id,
         l.household_id,
         l.ingest_match_status,
         l.sheets_sync_status,
         a.id AS assessment_id
    INTO v_existing
  FROM public.leads l
  LEFT JOIN public.assessments a
    ON a.lead_id = l.id
   AND a.deleted_at IS NULL
   AND a.assessment_type IN ('family', 'business', 'retirement', 'protection', 'student_loan')
  WHERE l.public_ingest_idempotency_key = v_key
    AND l.deleted_at IS NULL
  ORDER BY a.completed_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND AND v_existing.lead_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'created', false,
      'lead_id', v_existing.lead_id,
      'household_id', v_existing.household_id,
      'assessment_id', v_existing.assessment_id,
      'match_status', v_existing.ingest_match_status,
      'sheets_sync_status', v_existing.sheets_sync_status,
      'duplicate_review_id', NULL
    );
  END IF;

  v_match_status := p_payload->>'match_status';
  IF v_match_status IS NULL OR v_match_status NOT IN (
    'exact_trusted_match', 'possible_match', 'new_prospect'
  ) THEN
    RAISE EXCEPTION 'invalid_match_status' USING ERRCODE = '22023';
  END IF;

  v_matched_household_id := NULLIF(p_payload->>'matched_household_id', '')::uuid;
  v_candidate_household_id := NULLIF(p_payload->>'candidate_household_id', '')::uuid;
  v_display_name := NULLIF(trim(COALESCE(p_payload->>'display_name', '')), '');
  v_first_name := NULLIF(trim(COALESCE(p_payload->>'first_name', '')), '');
  v_last_name := NULLIF(trim(COALESCE(p_payload->>'last_name', '')), '');
  v_email := NULLIF(trim(COALESCE(p_payload->>'email', '')), '');
  v_phone := NULLIF(trim(COALESCE(p_payload->>'phone', '')), '');
  v_normalized_email := NULLIF(lower(trim(COALESCE(p_payload->>'normalized_email', ''))), '')::extensions.citext;
  v_normalized_phone := NULLIF(trim(COALESCE(p_payload->>'normalized_phone', '')), '');
  v_submitted_at := COALESCE(
    NULLIF(p_payload->>'submitted_at', '')::timestamptz,
    now()
  );
  v_advisor_profile_id := NULLIF(p_payload->>'advisor_profile_id', '')::uuid;
  v_advisor_slug := NULLIF(trim(COALESCE(p_payload->>'advisor_slug', '')), '');
  v_campaign_code := NULLIF(trim(COALESCE(p_payload->>'campaign_code', '')), '');

  IF v_first_name IS NULL OR v_last_name IS NULL THEN
    RAISE EXCEPTION 'invalid_name' USING ERRCODE = '22023';
  END IF;

  IF v_display_name IS NULL THEN
    v_display_name := trim(v_first_name || ' ' || v_last_name);
  END IF;

  IF v_advisor_profile_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.advisor_profiles ap
      WHERE ap.id = v_advisor_profile_id
        AND ap.deleted_at IS NULL
        AND ap.is_active = true
    ) THEN
      RAISE EXCEPTION 'invalid_advisor' USING ERRCODE = '22023';
    END IF;
    v_attribution := 'advisor_link';
    v_assign_advisor := (v_match_status = 'new_prospect');
  ELSE
    v_attribution := 'unknown';
    v_assign_advisor := false;
    v_advisor_slug := NULL;
    v_campaign_code := NULL;
  END IF;

  v_activity_lead_title := CASE v_assessment_type
    WHEN 'family' THEN 'Initial Financial Diagnostic submitted'
    WHEN 'business' THEN 'Business Report Card submitted'
    WHEN 'retirement' THEN 'Retirement Report Card submitted'
    WHEN 'protection' THEN 'Protection Gap submitted'
    WHEN 'student_loan' THEN 'Student Loan Report Card submitted'
  END;
  v_activity_lead_body := CASE v_assessment_type
    WHEN 'family' THEN 'Public Family Report Card captured as Initial Financial Diagnostic.'
    WHEN 'business' THEN 'Public Business Report Card captured.'
    WHEN 'retirement' THEN 'Public Retirement Report Card captured.'
    WHEN 'protection' THEN 'Public Protection Gap captured.'
    WHEN 'student_loan' THEN 'Public Student Loan Report Card captured.'
  END;
  v_activity_assess_title := CASE v_assessment_type
    WHEN 'family' THEN 'Family Report Card assessment completed'
    WHEN 'business' THEN 'Business Report Card assessment completed'
    WHEN 'retirement' THEN 'Retirement Report Card assessment completed'
    WHEN 'protection' THEN 'Protection Gap assessment completed'
    WHEN 'student_loan' THEN 'Student Loan Report Card assessment completed'
  END;
  v_activity_assess_body :=
    'Public self-report assessment stored. Not advisor-reviewed Financial Progress.';
  v_activity_source := CASE v_assessment_type
    WHEN 'family' THEN 'public_family_report_card'
    WHEN 'business' THEN 'public_business_report_card'
    WHEN 'retirement' THEN 'public_retirement_report_card'
    WHEN 'protection' THEN 'public_protection_gap'
    WHEN 'student_loan' THEN 'public_student_loan_report_card'
  END;

  IF v_match_status = 'exact_trusted_match' THEN
    IF v_matched_household_id IS NULL THEN
      RAISE EXCEPTION 'matched_household_required' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.households h
      WHERE h.id = v_matched_household_id
        AND h.deleted_at IS NULL
        AND h.merged_into_household_id IS NULL
    ) THEN
      RAISE EXCEPTION 'matched_household_not_found' USING ERRCODE = '22023';
    END IF;
    v_household_id := v_matched_household_id;
    -- Never overwrite trusted household contact data from public self-report.
    SELECT hm.id INTO v_member_id
    FROM public.household_members hm
    WHERE hm.household_id = v_household_id
      AND hm.deleted_at IS NULL
      AND hm.is_primary_contact = true
    ORDER BY hm.created_at ASC
    LIMIT 1;
    v_lead_status := 'unassigned';
  ELSE
    INSERT INTO public.households (
      display_name,
      status,
      primary_email,
      normalized_email,
      primary_phone,
      normalized_phone,
      relationship_pipeline_id,
      relationship_stage_id,
      stage_entered_at,
      lead_source,
      original_advisor_id,
      original_advisor_slug,
      original_campaign,
      original_source_metadata,
      assigned_advisor_id,
      assigned_at,
      assignment_reason,
      potential_duplicate_of,
      duplicate_review_status
    ) VALUES (
      v_display_name,
      'lead',
      v_email,
      v_normalized_email,
      v_phone,
      v_normalized_phone,
      v_pipeline_id,
      v_stage_id,
      v_submitted_at,
      v_lead_source,
      v_advisor_profile_id,
      v_advisor_slug,
      v_campaign_code,
      COALESCE(p_payload->'original_source_metadata', '{}'::jsonb),
      CASE WHEN v_assign_advisor THEN v_advisor_profile_id ELSE NULL END,
      CASE WHEN v_assign_advisor THEN v_submitted_at ELSE NULL END,
      CASE WHEN v_assign_advisor THEN 'advisor_link'::public.assignment_reason ELSE NULL END,
      CASE
        WHEN v_match_status = 'possible_match' THEN v_candidate_household_id
        ELSE NULL
      END,
      CASE
        WHEN v_match_status = 'possible_match' THEN 'pending'::public.duplicate_review_status
        ELSE 'none'::public.duplicate_review_status
      END
    )
    RETURNING id INTO v_household_id;

    INSERT INTO public.household_members (
      household_id,
      first_name,
      last_name,
      relationship,
      is_primary_contact,
      email,
      normalized_email,
      phone,
      normalized_phone,
      age
    ) VALUES (
      v_household_id,
      v_first_name,
      v_last_name,
      'primary',
      true,
      v_email,
      v_normalized_email,
      v_phone,
      v_normalized_phone,
      NULLIF(p_payload->>'age', '')::integer
    )
    RETURNING id INTO v_member_id;

    v_lead_status := CASE
      WHEN v_match_status = 'possible_match' THEN 'duplicate_review'::public.lead_status
      WHEN v_assign_advisor THEN 'assigned'::public.lead_status
      ELSE 'unassigned'::public.lead_status
    END;
  END IF;

  BEGIN
    INSERT INTO public.leads (
      household_id,
      lead_type,
      status,
      assessment_type,
      source_page,
      submitted_at,
      original_advisor_id,
      original_advisor_slug,
      original_campaign,
      original_source_metadata,
      attribution_method,
      assigned_advisor_id,
      assigned_at,
      assignment_reason,
      overall_score,
      overall_grade,
      top_priorities,
      raw_payload,
      normalized_email,
      normalized_phone,
      potential_duplicate_of_household_id,
      duplicate_review_status,
      public_ingest_idempotency_key,
      sheets_sync_status,
      consent_snapshot,
      ingest_match_status
    ) VALUES (
      v_household_id,
      v_lead_type,
      v_lead_status,
      v_assessment_type::public.assessment_type,
      NULLIF(p_payload->>'source_page', ''),
      v_submitted_at,
      v_advisor_profile_id,
      v_advisor_slug,
      v_campaign_code,
      COALESCE(p_payload->'original_source_metadata', '{}'::jsonb),
      v_attribution,
      CASE WHEN v_assign_advisor THEN v_advisor_profile_id ELSE NULL END,
      CASE WHEN v_assign_advisor THEN v_submitted_at ELSE NULL END,
      CASE WHEN v_assign_advisor THEN 'advisor_link'::public.assignment_reason ELSE NULL END,
      NULLIF(p_payload->>'overall_score', '')::numeric,
      NULLIF(p_payload->>'overall_grade', ''),
      COALESCE(p_payload->'top_priorities', '[]'::jsonb),
      COALESCE(p_payload->'raw_payload', '{}'::jsonb),
      v_normalized_email,
      v_normalized_phone,
      CASE
        WHEN v_match_status = 'possible_match' THEN v_candidate_household_id
        ELSE NULL
      END,
      CASE
        WHEN v_match_status = 'possible_match' THEN 'pending'::public.duplicate_review_status
        ELSE 'none'::public.duplicate_review_status
      END,
      v_key,
      'pending',
      COALESCE(p_payload->'consent_snapshot', '{}'::jsonb),
      v_match_status
    )
    RETURNING id INTO v_lead_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT l.id AS lead_id,
             l.household_id,
             l.ingest_match_status,
             l.sheets_sync_status,
             a.id AS assessment_id
        INTO v_existing
      FROM public.leads l
      LEFT JOIN public.assessments a
        ON a.lead_id = l.id
       AND a.deleted_at IS NULL
       AND a.assessment_type IN ('family', 'business', 'retirement', 'protection', 'student_loan')
      WHERE l.public_ingest_idempotency_key = v_key
        AND l.deleted_at IS NULL
      ORDER BY a.completed_at DESC NULLS LAST
      LIMIT 1;

      RETURN jsonb_build_object(
        'created', false,
        'lead_id', v_existing.lead_id,
        'household_id', v_existing.household_id,
        'assessment_id', v_existing.assessment_id,
        'match_status', v_existing.ingest_match_status,
        'sheets_sync_status', v_existing.sheets_sync_status,
        'duplicate_review_id', NULL
      );
  END;

  INSERT INTO public.assessments (
    household_id,
    lead_id,
    assessment_type,
    status,
    completed_at,
    overall_score,
    overall_grade,
    priorities,
    answers,
    derived_metrics,
    scoring_version,
    capture_channel,
    report_path
  ) VALUES (
    v_household_id,
    v_lead_id,
    v_assessment_type::public.assessment_type,
    'completed',
    v_submitted_at,
    NULLIF(p_payload->>'overall_score', '')::numeric,
    NULLIF(p_payload->>'overall_grade', ''),
    COALESCE(p_payload->'top_priorities', '[]'::jsonb),
    COALESCE(p_payload->'answers', '{}'::jsonb),
    COALESCE(p_payload->'derived_metrics', '{}'::jsonb),
    COALESCE(NULLIF(p_payload->>'scoring_version', '')::integer, 1),
    'public_self_report',
    NULLIF(p_payload->>'report_path', '')
  )
  RETURNING id INTO v_assessment_id;

  IF v_match_status = 'possible_match' AND v_candidate_household_id IS NOT NULL THEN
    INSERT INTO public.duplicate_reviews (
      incoming_lead_id,
      candidate_household_id,
      provisional_household_id,
      match_reason,
      match_confidence,
      status,
      payload_snapshot
    ) VALUES (
      v_lead_id,
      v_candidate_household_id,
      v_household_id,
      COALESCE(NULLIF(p_payload->>'match_reason', ''), 'possible_contact_match'),
      COALESCE(NULLIF(p_payload->>'match_confidence', ''), 'medium'),
      'pending',
      COALESCE(p_payload->'raw_payload', '{}'::jsonb)
    )
    RETURNING id INTO v_duplicate_review_id;
  END IF;

  INSERT INTO public.activities (
    household_id,
    lead_id,
    assessment_id,
    actor_user_id,
    activity_type,
    title,
    body,
    metadata,
    occurred_at
  ) VALUES (
    v_household_id,
    v_lead_id,
    v_assessment_id,
    NULL,
    'lead_created',
    v_activity_lead_title,
    v_activity_lead_body,
    jsonb_build_object(
      'source', v_activity_source,
      'match_status', v_match_status,
      'idempotency_key', v_key,
      'assessment_type', v_assessment_type
    ),
    v_submitted_at
  );

  INSERT INTO public.activities (
    household_id,
    lead_id,
    assessment_id,
    actor_user_id,
    activity_type,
    title,
    body,
    metadata,
    occurred_at
  ) VALUES (
    v_household_id,
    v_lead_id,
    v_assessment_id,
    NULL,
    'assessment_completed',
    v_activity_assess_title,
    v_activity_assess_body,
    jsonb_build_object(
      'capture_channel', 'public_self_report',
      'assessment_type', v_assessment_type
    ),
    v_submitted_at
  );

  RETURN jsonb_build_object(
    'created', v_created,
    'lead_id', v_lead_id,
    'household_id', v_household_id,
    'member_id', v_member_id,
    'assessment_id', v_assessment_id,
    'match_status', v_match_status,
    'sheets_sync_status', 'pending',
    'duplicate_review_id', v_duplicate_review_id
  );
END;
$$;

COMMENT ON FUNCTION public.ingest_public_report_card(jsonb) IS
  'Atomic public Report Card CRM ingest for family/business/retirement/protection/student_loan. Callable only with service_role. Validates allowlisted assessment_type ↔ lead_type pairs. Creates household/member when needed, always creates new lead+assessment history, never overwrites trusted matches or invents arbitrary types.';

REVOKE ALL ON FUNCTION public.ingest_public_report_card(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ingest_public_report_card(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.ingest_public_report_card(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_public_report_card(jsonb) TO service_role;

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
-- Duplicate resolution: allow the four public_self_report assessment types
-- without rewriting assessment_type back to family
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_public_family_duplicate_review(
  p_duplicate_review_id uuid,
  p_action text,
  p_resolution_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_action text := lower(btrim(COALESCE(p_action, '')));
  v_notes text;
  v_review public.duplicate_reviews;
  v_lead public.leads;
  v_assessment public.assessments;
  v_provisional public.households;
  v_candidate public.households;
  v_now timestamptz := now();
  v_resulting_household_id uuid;
  v_prior_action text;
  v_member_count integer;
  v_lead_count integer;
  v_assessment_count integer;
  v_opp_count integer;
  v_task_count integer;
  v_note_count integer;
  v_appt_count integer;
  v_policy_count integer;
  v_review_count integer;
  v_doc_count integer;
  v_rec_count integer;
  v_portal_count integer;
  v_assign_count integer;
  v_activity_title text;
  v_activity_event text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CRM_DUP:not_authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.crm_is_owner() THEN
    RAISE EXCEPTION 'CRM_DUP:not_authorized'
      USING ERRCODE = '42501';
  END IF;

  IF v_action NOT IN ('confirm_same_household', 'keep_separate') THEN
    RAISE EXCEPTION 'CRM_DUP:invalid_action'
      USING ERRCODE = '22023';
  END IF;

  IF p_duplicate_review_id IS NULL THEN
    RAISE EXCEPTION 'CRM_DUP:not_found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Sanitize notes (trim; reject oversized). Notes are optional.
  -- IMPORTANT: Do NOT use chr(0) or replace(..., chr(0), ...) on PostgreSQL text.
  -- PostgreSQL text cannot store U+0000; evaluating chr(0) raises
  -- "null character not permitted" even when the input note is ordinary text.
  v_notes := NULLIF(btrim(COALESCE(p_resolution_notes, '')), '');
  IF v_notes IS NOT NULL THEN
    IF char_length(v_notes) > 2000 THEN
      RAISE EXCEPTION 'CRM_DUP:notes_too_long'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT *
  INTO v_review
  FROM public.duplicate_reviews
  WHERE id = p_duplicate_review_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CRM_DUP:not_found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency / conflict for already-resolved reviews
  IF v_review.status IS DISTINCT FROM 'pending' THEN
    v_prior_action := CASE v_review.status
      WHEN 'merged' THEN 'confirm_same_household'
      WHEN 'confirmed_unique' THEN 'keep_separate'
      ELSE NULL
    END;

    IF v_prior_action IS NOT NULL AND v_prior_action = v_action THEN
      SELECT *
      INTO v_lead
      FROM public.leads
      WHERE id = v_review.incoming_lead_id;

      SELECT *
      INTO v_assessment
      FROM public.assessments
      WHERE lead_id = v_review.incoming_lead_id
        AND assessment_type IN ('family', 'business', 'retirement', 'protection', 'student_loan')
        AND capture_channel = 'public_self_report'
        AND deleted_at IS NULL
      ORDER BY completed_at DESC NULLS LAST, created_at DESC
      LIMIT 1;

      v_resulting_household_id := CASE
        WHEN v_action = 'confirm_same_household' THEN v_review.candidate_household_id
        ELSE COALESCE(v_review.provisional_household_id, v_lead.household_id)
      END;

      RETURN jsonb_build_object(
        'ok', true,
        'action', v_action,
        'duplicate_review_id', v_review.id,
        'lead_id', v_review.incoming_lead_id,
        'assessment_id', v_assessment.id,
        'resulting_household_id', v_resulting_household_id,
        'provisional_household_id', v_review.provisional_household_id,
        'resolved_at', COALESCE(v_review.resolved_at, v_now),
        'already_resolved', true
      );
    END IF;

    RAISE EXCEPTION 'CRM_DUP:already_resolved_conflict'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_review.incoming_lead_id IS NULL THEN
    RAISE EXCEPTION 'CRM_DUP:not_found'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT *
  INTO v_lead
  FROM public.leads
  WHERE id = v_review.incoming_lead_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CRM_DUP:not_found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_lead.ingest_match_status IS DISTINCT FROM 'possible_match'
     AND v_lead.lead_type NOT IN (
       'Family Report Card',
       'Business Report Card',
       'Retirement Report Card',
       'Protection Gap',
       'Student Loan Report Card'
     ) THEN
    RAISE EXCEPTION 'CRM_DUP:invalid_assessment'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_assessment
  FROM public.assessments
  WHERE lead_id = v_lead.id
    AND assessment_type IN ('family', 'business', 'retirement', 'protection', 'student_loan')
    AND capture_channel = 'public_self_report'
    AND deleted_at IS NULL
  ORDER BY completed_at DESC NULLS LAST, created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CRM_DUP:invalid_assessment'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_assessment.capture_channel IS DISTINCT FROM 'public_self_report'
     OR v_assessment.assessment_type NOT IN ('family', 'business', 'retirement', 'protection', 'student_loan') THEN
    RAISE EXCEPTION 'CRM_DUP:invalid_assessment'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_review.provisional_household_id IS NULL THEN
    RAISE EXCEPTION 'CRM_DUP:invalid_provisional'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_provisional
  FROM public.households
  WHERE id = v_review.provisional_household_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_provisional.deleted_at IS NOT NULL
     OR v_provisional.merged_into_household_id IS NOT NULL THEN
    RAISE EXCEPTION 'CRM_DUP:invalid_provisional'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_lead.household_id IS DISTINCT FROM v_provisional.id THEN
    RAISE EXCEPTION 'CRM_DUP:invalid_provisional'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_assessment.household_id IS DISTINCT FROM v_provisional.id THEN
    RAISE EXCEPTION 'CRM_DUP:invalid_assessment'
      USING ERRCODE = 'P0001';
  END IF;

  -- -------------------------------------------------------------------------
  -- keep_separate
  -- -------------------------------------------------------------------------
  IF v_action = 'keep_separate' THEN
    UPDATE public.duplicate_reviews
    SET
      status = 'confirmed_unique',
      resolution_notes = v_notes,
      resolved_by_user_id = v_uid,
      resolved_at = v_now,
      payload_snapshot = COALESCE(payload_snapshot, '{}'::jsonb) || jsonb_build_object(
        'resolution_action', 'keep_separate',
        'resulting_household_id', v_provisional.id,
        'resolved_at', v_now
      ),
      updated_at = v_now
    WHERE id = v_review.id
      AND status = 'pending';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'CRM_DUP:already_resolved_conflict'
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.leads
    SET
      duplicate_review_status = 'confirmed_unique',
      status = CASE
        WHEN status = 'duplicate_review' THEN 'unassigned'::public.lead_status
        ELSE status
      END,
      potential_duplicate_of_household_id = NULL,
      updated_at = v_now
    WHERE id = v_lead.id;

    UPDATE public.households
    SET
      duplicate_review_status = 'confirmed_unique',
      potential_duplicate_of = NULL,
      updated_at = v_now
    WHERE id = v_provisional.id;

    PERFORM public.crm_write_activity(
      v_provisional.id,
      'system',
      'Duplicate review kept separate',
      'Owner confirmed the provisional household is not a duplicate of the candidate household.',
      jsonb_build_object(
        'event', 'public_duplicate_kept_separate',
        'duplicate_review_id', v_review.id,
        'action', 'keep_separate',
        'provisional_household_id', v_provisional.id,
        'resulting_household_id', v_provisional.id,
        'candidate_household_id', v_review.candidate_household_id,
        'lead_id', v_lead.id,
        'assessment_id', v_assessment.id,
        'resolver_user_id', v_uid,
        'resolved_at', v_now
      ),
      NULL,
      NULL,
      v_lead.id,
      v_assessment.id
    );


    -- Migration 023: complete the matching open resolve task (history retained; no soft-delete).
    UPDATE public.tasks
    SET
      status = 'done',
      completed_at = v_now,
      updated_at = v_now
    WHERE assessment_id = v_assessment.id
      AND lead_id = v_lead.id
      AND workflow_type = 'resolve_possible_duplicate'
      AND deleted_at IS NULL
      AND status IN ('open', 'in_progress');

    RETURN jsonb_build_object(
      'ok', true,
      'action', 'keep_separate',
      'duplicate_review_id', v_review.id,
      'lead_id', v_lead.id,
      'assessment_id', v_assessment.id,
      'resulting_household_id', v_provisional.id,
      'provisional_household_id', v_provisional.id,
      'resolved_at', v_now,
      'already_resolved', false
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- confirm_same_household
  -- -------------------------------------------------------------------------
  SELECT *
  INTO v_candidate
  FROM public.households
  WHERE id = v_review.candidate_household_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_candidate.deleted_at IS NOT NULL
     OR v_candidate.merged_into_household_id IS NOT NULL THEN
    RAISE EXCEPTION 'CRM_DUP:invalid_candidate'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_candidate.id = v_provisional.id THEN
    RAISE EXCEPTION 'CRM_DUP:same_household'
      USING ERRCODE = 'P0001';
  END IF;

  -- Expected provisional dependents from public ingest only:
  -- 1 primary member, 1 lead (this review), 1 public family assessment.
  -- Abort if unrelated advisor-entered work exists.
  SELECT count(*)::integer INTO v_member_count
  FROM public.household_members
  WHERE household_id = v_provisional.id
    AND deleted_at IS NULL;

  SELECT count(*)::integer INTO v_lead_count
  FROM public.leads
  WHERE household_id = v_provisional.id
    AND deleted_at IS NULL;

  SELECT count(*)::integer INTO v_assessment_count
  FROM public.assessments
  WHERE household_id = v_provisional.id
    AND deleted_at IS NULL;

  SELECT count(*)::integer INTO v_opp_count
  FROM public.opportunities
  WHERE household_id = v_provisional.id
    AND deleted_at IS NULL;

  -- Migration 023: exclude the automatic ingest resolve task expected on possible matches.
  SELECT count(*)::integer INTO v_task_count
  FROM public.tasks
  WHERE household_id = v_provisional.id
    AND deleted_at IS NULL
    AND NOT (
      workflow_type = 'resolve_possible_duplicate'
      AND assessment_id = v_assessment.id
      AND lead_id = v_lead.id
      AND source_type IN ('public_family_ingest', 'duplicate_resolution', 'system')
    );

  SELECT count(*)::integer INTO v_note_count
  FROM public.notes
  WHERE household_id = v_provisional.id
    AND deleted_at IS NULL;

  SELECT count(*)::integer INTO v_appt_count
  FROM public.appointments
  WHERE household_id = v_provisional.id
    AND deleted_at IS NULL;

  SELECT count(*)::integer INTO v_policy_count
  FROM public.policies
  WHERE household_id = v_provisional.id
    AND deleted_at IS NULL;

  SELECT count(*)::integer INTO v_review_count
  FROM public.annual_reviews
  WHERE household_id = v_provisional.id
    AND deleted_at IS NULL;

  SELECT count(*)::integer INTO v_doc_count
  FROM public.documents
  WHERE household_id = v_provisional.id
    AND deleted_at IS NULL;

  SELECT count(*)::integer INTO v_rec_count
  FROM public.recommendations
  WHERE household_id = v_provisional.id
    AND deleted_at IS NULL;

  SELECT count(*)::integer INTO v_portal_count
  FROM public.client_portal_accounts
  WHERE household_id = v_provisional.id
    AND deleted_at IS NULL;

  SELECT count(*)::integer INTO v_assign_count
  FROM public.advisor_assignments
  WHERE household_id = v_provisional.id
    AND effective_to IS NULL;

  IF v_member_count <> 1
     OR v_lead_count <> 1
     OR v_assessment_count <> 1
     OR v_opp_count <> 0
     OR v_task_count <> 0
     OR v_note_count <> 0
     OR v_appt_count <> 0
     OR v_policy_count <> 0
     OR v_review_count <> 0
     OR v_doc_count <> 0
     OR v_rec_count <> 0
     OR v_portal_count <> 0
     OR v_assign_count <> 0 THEN
    RAISE EXCEPTION 'CRM_DUP:unsafe_dependents'
      USING ERRCODE = 'P0001';
  END IF;

  -- Ensure the single lead/assessment are exactly the ones under review
  IF NOT EXISTS (
    SELECT 1
    FROM public.leads
    WHERE id = v_lead.id
      AND household_id = v_provisional.id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'CRM_DUP:unsafe_dependents'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.assessments
    WHERE id = v_assessment.id
      AND household_id = v_provisional.id
      AND lead_id = v_lead.id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'CRM_DUP:unsafe_dependents'
      USING ERRCODE = 'P0001';
  END IF;

  -- Re-link lead + assessment to canonical household. Do NOT touch candidate
  -- contact fields or member identity fields.
  UPDATE public.leads
  SET
    household_id = v_candidate.id,
    duplicate_review_status = 'merged',
    status = CASE
      WHEN status = 'duplicate_review' THEN 'new'::public.lead_status
      ELSE status
    END,
    potential_duplicate_of_household_id = NULL,
    updated_at = v_now
  WHERE id = v_lead.id
    AND deleted_at IS NULL;

  UPDATE public.assessments
  SET
    household_id = v_candidate.id,
    -- Explicitly preserve provenance columns (no promotion / no type rewrite)
    capture_channel = 'public_self_report',
    updated_at = v_now
  WHERE id = v_assessment.id
    AND deleted_at IS NULL
    AND lead_id = v_lead.id
    AND capture_channel = 'public_self_report'
    AND assessment_type IN ('family', 'business', 'retirement', 'protection', 'student_loan');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CRM_DUP:invalid_assessment'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.duplicate_reviews
  SET
    status = 'merged',
    resolution_notes = v_notes,
    resolved_by_user_id = v_uid,
    resolved_at = v_now,
    payload_snapshot = COALESCE(payload_snapshot, '{}'::jsonb) || jsonb_build_object(
      'resolution_action', 'confirm_same_household',
      'resulting_household_id', v_candidate.id,
      'resolved_at', v_now
    ),
    updated_at = v_now
  WHERE id = v_review.id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CRM_DUP:already_resolved_conflict'
      USING ERRCODE = 'P0001';
  END IF;

  -- Archive provisional via merge target (no hard delete; no contact overwrite)
  UPDATE public.households
  SET
    merged_into_household_id = v_candidate.id,
    duplicate_review_status = 'merged',
    potential_duplicate_of = NULL,
    updated_at = v_now
  WHERE id = v_provisional.id
    AND deleted_at IS NULL
    AND merged_into_household_id IS NULL
    AND id <> v_candidate.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CRM_DUP:invalid_provisional'
      USING ERRCODE = 'P0001';
  END IF;

  v_activity_title := 'Public duplicate confirmed';
  v_activity_event := 'public_duplicate_confirmed';

  PERFORM public.crm_write_activity(
    v_candidate.id,
    'system',
    v_activity_title,
    'Owner confirmed the public Family Report Card submission belongs to this household. Canonical contact details were not changed.',
    jsonb_build_object(
      'event', v_activity_event,
      'duplicate_review_id', v_review.id,
      'action', 'confirm_same_household',
      'provisional_household_id', v_provisional.id,
      'resulting_household_id', v_candidate.id,
      'candidate_household_id', v_candidate.id,
      'lead_id', v_lead.id,
      'assessment_id', v_assessment.id,
      'resolver_user_id', v_uid,
      'resolved_at', v_now
    ),
    NULL,
    NULL,
    v_lead.id,
    v_assessment.id
  );


    -- Migration 023: complete the matching open resolve task (history retained; no soft-delete).
    UPDATE public.tasks
    SET
      status = 'done',
      completed_at = v_now,
      updated_at = v_now
    WHERE assessment_id = v_assessment.id
      AND lead_id = v_lead.id
      AND workflow_type = 'resolve_possible_duplicate'
      AND deleted_at IS NULL
      AND status IN ('open', 'in_progress');

  RETURN jsonb_build_object(
    'ok', true,
    'action', 'confirm_same_household',
    'duplicate_review_id', v_review.id,
    'lead_id', v_lead.id,
    'assessment_id', v_assessment.id,
    'resulting_household_id', v_candidate.id,
    'provisional_household_id', v_provisional.id,
    'resolved_at', v_now,
    'already_resolved', false
  );
END;
$$;

COMMENT ON FUNCTION public.resolve_public_family_duplicate_review(uuid, text, text) IS
  'Owner-only transactional resolution for public Family Report Card possible matches. Actions: confirm_same_household | keep_separate. Never overwrites canonical contact data, never deletes lead/assessment history, never promotes public_self_report assessments. Provisional households are merged via merged_into_household_id (no hard delete). Abort if provisional has unexpected dependents beyond ingest-created member/lead/assessment. Migration 023: the automatic resolve_possible_duplicate task for this assessment is an expected dependent and does not block confirm_same_household; it is completed on successful resolution. Migration 024: notes sanitization no longer uses chr(0).';

REVOKE ALL ON FUNCTION public.resolve_public_family_duplicate_review(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_public_family_duplicate_review(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_public_family_duplicate_review(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_public_family_duplicate_review(uuid, text, text) TO authenticated;

ALTER FUNCTION public.resolve_public_family_duplicate_review(uuid, text, text) OWNER TO postgres;
