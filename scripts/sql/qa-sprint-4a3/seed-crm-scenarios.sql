-- Sprint 4A.3 local QA seed (NOT a migration).
-- Synthetic data only. Safe to re-run (deletes prior [QA4A3] rows first).
-- Does not touch auth.users.

BEGIN;

-- ---------------------------------------------------------------------------
-- Cleanup prior QA4A3 rows (order respects FKs)
-- ---------------------------------------------------------------------------
DELETE FROM public.tasks
WHERE household_id IN (
  SELECT id FROM public.households WHERE display_name LIKE '[QA4A3]%'
);

DELETE FROM public.notes
WHERE household_id IN (
  SELECT id FROM public.households WHERE display_name LIKE '[QA4A3]%'
);

DELETE FROM public.activities
WHERE household_id IN (
  SELECT id FROM public.households WHERE display_name LIKE '[QA4A3]%'
);

DELETE FROM public.duplicate_reviews
WHERE provisional_household_id IN (
  SELECT id FROM public.households WHERE display_name LIKE '[QA4A3]%'
)
OR candidate_household_id IN (
  SELECT id FROM public.households WHERE display_name LIKE '[QA4A3]%'
)
OR incoming_lead_id IN (
  SELECT id FROM public.leads WHERE source_page = '/qa-sprint-4a3'
);

DELETE FROM public.assessments
WHERE household_id IN (
  SELECT id FROM public.households WHERE display_name LIKE '[QA4A3]%'
);

DELETE FROM public.leads
WHERE household_id IN (
  SELECT id FROM public.households WHERE display_name LIKE '[QA4A3]%'
)
OR source_page = '/qa-sprint-4a3';

DELETE FROM public.household_members
WHERE household_id IN (
  SELECT id FROM public.households WHERE display_name LIKE '[QA4A3]%'
);

DELETE FROM public.households
WHERE display_name LIKE '[QA4A3]%';

-- ---------------------------------------------------------------------------
-- Constants
-- ---------------------------------------------------------------------------
-- Pipeline: 22222222-2222-2222-2222-222222222201
-- Stage new_lead: 33333333-3333-3333-3333-333333333001

DO $$
DECLARE
  v_pipeline uuid := '22222222-2222-2222-2222-222222222201';
  v_stage uuid := '33333333-3333-3333-3333-333333333001';
  v_advisor uuid;
  v_now timestamptz := timestamptz '2026-07-28 18:00:00+00';
BEGIN
  SELECT id INTO v_advisor
  FROM public.advisor_profiles
  WHERE slug = 'advisor-a'
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_advisor IS NULL THEN
    RAISE NOTICE 'QA4A3: no advisor-a profile found; S11 assignment skipped (unassigned).';
  END IF;

  -- Helper inline inserts ---------------------------------------------------

  -- S01 new prospect contact true
  INSERT INTO public.households (
    id, display_name, status, primary_email, normalized_email, primary_phone, normalized_phone,
    relationship_pipeline_id, relationship_stage_id, stage_entered_at, created_at, updated_at
  ) VALUES (
    'a4a30001-0001-4000-8000-000000000001',
    '[QA4A3] Prospect Contact True',
    'lead',
    'qa.contact.true@example.test',
    'qa.contact.true@example.test',
    '555-010-0001',
    '+15550100001',
    v_pipeline, v_stage, v_now, v_now, v_now
  );

  INSERT INTO public.leads (
    id, household_id, lead_type, status, assessment_type, source_page, submitted_at,
    overall_score, overall_grade, normalized_email, normalized_phone,
    ingest_match_status, sheets_sync_status, consent_snapshot,
    public_ingest_idempotency_key, follow_up_task_automation_status,
    raw_payload, created_at, updated_at
  ) VALUES (
    'b4a30001-0001-4000-8000-000000000001',
    'a4a30001-0001-4000-8000-000000000001',
    'Family Report Card', 'unassigned', 'family', '/qa-sprint-4a3', v_now,
    78, 'C+',
    'qa.contact.true@example.test', '+15550100001',
    'new_prospect', 'succeeded',
    jsonb_build_object(
      'assessmentStorageAcknowledged', true,
      'contactPermission', true,
      'emailMarketingConsent', false,
      'smsMarketingConsent', false,
      'privacyAcknowledged', true,
      'consentVersion', 'family-report-card-consent-v1',
      'consentedAt', v_now
    ),
    'b4a30001-0001-4000-9000-000000000001'::uuid,
    'task_created',
    jsonb_build_object('firstName','Casey','lastName','True','email','qa.contact.true@example.test','phone','555-010-0001'),
    v_now, v_now
  );

  INSERT INTO public.assessments (
    id, household_id, lead_id, assessment_type, status, capture_channel,
    completed_at, overall_score, overall_grade, priorities, answers, derived_metrics,
    scoring_version, created_at, updated_at
  ) VALUES (
    'c4a30001-0001-4000-8000-000000000001',
    'a4a30001-0001-4000-8000-000000000001',
    'b4a30001-0001-4000-8000-000000000001',
    'family', 'completed', 'public_self_report',
    v_now, 78, 'C+',
    '[{"title":"Build emergency savings"}]'::jsonb,
    '{"family":{"firstName":"Casey","lastName":"True"}}'::jsonb,
    '{"categories":[{"id":"cash","title":"Cash Flow","score":70,"grade":"C"}]}'::jsonb,
    1, v_now, v_now
  );

  INSERT INTO public.tasks (
    id, household_id, lead_id, assessment_id, title, description, due_date, priority, status,
    source_type, workflow_type, automation_idempotency_key, metadata, created_at, updated_at
  ) VALUES (
    'd4a30001-0001-4000-8000-000000000001',
    'a4a30001-0001-4000-8000-000000000001',
    'b4a30001-0001-4000-8000-000000000001',
    'c4a30001-0001-4000-8000-000000000001',
    'Review Initial Financial Diagnostic and follow up',
    'Contact permission was granted on this submission.' || E'\n' || 'Review the diagnostic before any outreach.',
    (v_now::date + 1), 'high', 'open',
    'public_family_ingest', 'review_initial_diagnostic',
    'public_family:c4a30001-0001-4000-8000-000000000001:review_initial_diagnostic',
    '{"public_family_diagnostic":true,"contact_permission":true,"creation_source":"public_family_ingest"}'::jsonb,
    v_now, v_now
  );

  UPDATE public.leads
  SET follow_up_task_id = 'd4a30001-0001-4000-8000-000000000001'
  WHERE id = 'b4a30001-0001-4000-8000-000000000001';

  -- S02 contact false
  INSERT INTO public.households (
    id, display_name, status, primary_email, normalized_email,
    relationship_pipeline_id, relationship_stage_id, stage_entered_at, created_at, updated_at
  ) VALUES (
    'a4a30002-0002-4000-8000-000000000002',
    '[QA4A3] Prospect Contact False',
    'lead', 'qa.contact.false@example.test', 'qa.contact.false@example.test',
    v_pipeline, v_stage, v_now, v_now, v_now
  );

  INSERT INTO public.leads (
    id, household_id, lead_type, status, assessment_type, source_page, submitted_at,
    overall_score, overall_grade, normalized_email, ingest_match_status, sheets_sync_status,
    consent_snapshot, public_ingest_idempotency_key, follow_up_task_automation_status,
    raw_payload, created_at, updated_at
  ) VALUES (
    'b4a30002-0002-4000-8000-000000000002',
    'a4a30002-0002-4000-8000-000000000002',
    'Family Report Card', 'unassigned', 'family', '/qa-sprint-4a3', v_now + interval '1 minute',
    65, 'D', 'qa.contact.false@example.test', 'new_prospect', 'succeeded',
    jsonb_build_object(
      'assessmentStorageAcknowledged', true,
      'contactPermission', false,
      'emailMarketingConsent', false,
      'smsMarketingConsent', false,
      'privacyAcknowledged', true
    ),
    'b4a30002-0001-4000-9000-000000000002'::uuid, 'task_created',
    jsonb_build_object('firstName','Drew','lastName','False','email','qa.contact.false@example.test'),
    v_now, v_now
  );

  INSERT INTO public.assessments (
    id, household_id, lead_id, assessment_type, status, capture_channel,
    completed_at, overall_score, overall_grade, priorities, answers, derived_metrics, scoring_version, created_at, updated_at
  ) VALUES (
    'c4a30002-0002-4000-8000-000000000002',
    'a4a30002-0002-4000-8000-000000000002',
    'b4a30002-0002-4000-8000-000000000002',
    'family', 'completed', 'public_self_report',
    v_now + interval '1 minute', 65, 'D', '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, 1, v_now, v_now
  );

  INSERT INTO public.tasks (
    id, household_id, lead_id, assessment_id, title, description, due_date, priority, status,
    source_type, workflow_type, automation_idempotency_key, metadata, created_at, updated_at
  ) VALUES (
    'd4a30002-0002-4000-8000-000000000002',
    'a4a30002-0002-4000-8000-000000000002',
    'b4a30002-0002-4000-8000-000000000002',
    'c4a30002-0002-4000-8000-000000000002',
    'Review Initial Financial Diagnostic — no contact permission',
    'Contact permission was not granted.' || E'\n' || 'Internal review only. Do not initiate outreach based solely on this submission.',
    (v_now::date + 3), 'medium', 'open',
    'public_family_ingest', 'review_initial_diagnostic',
    'public_family:c4a30002-0002-4000-8000-000000000002:review_initial_diagnostic',
    '{"public_family_diagnostic":true,"contact_permission":false}'::jsonb,
    v_now, v_now
  );

  UPDATE public.leads SET follow_up_task_id = 'd4a30002-0002-4000-8000-000000000002'
  WHERE id = 'b4a30002-0002-4000-8000-000000000002';

  -- S03 missing contact permission (empty snapshot keys)
  INSERT INTO public.households (
    id, display_name, status, primary_email, normalized_email,
    relationship_pipeline_id, relationship_stage_id, stage_entered_at, created_at, updated_at
  ) VALUES (
    'a4a30003-0003-4000-8000-000000000003',
    '[QA4A3] Prospect Contact Unknown',
    'lead', 'qa.contact.unknown@example.test', 'qa.contact.unknown@example.test',
    v_pipeline, v_stage, v_now, v_now, v_now
  );

  INSERT INTO public.leads (
    id, household_id, lead_type, status, assessment_type, source_page, submitted_at,
    overall_score, overall_grade, normalized_email, ingest_match_status, sheets_sync_status,
    consent_snapshot, public_ingest_idempotency_key, follow_up_task_automation_status,
    raw_payload, created_at, updated_at
  ) VALUES (
    'b4a30003-0003-4000-8000-000000000003',
    'a4a30003-0003-4000-8000-000000000003',
    'Family Report Card', 'unassigned', 'family', '/qa-sprint-4a3', v_now + interval '2 minutes',
    70, 'C', 'qa.contact.unknown@example.test', 'new_prospect', 'skipped',
    jsonb_build_object('assessmentStorageAcknowledged', true, 'privacyAcknowledged', true),
    'b4a30003-0001-4000-9000-000000000003'::uuid, 'task_created',
    jsonb_build_object('firstName','Quinn','lastName','Unknown'),
    v_now, v_now
  );

  INSERT INTO public.assessments (
    id, household_id, lead_id, assessment_type, status, capture_channel,
    completed_at, overall_score, overall_grade, priorities, answers, derived_metrics, scoring_version, created_at, updated_at
  ) VALUES (
    'c4a30003-0003-4000-8000-000000000003',
    'a4a30003-0003-4000-8000-000000000003',
    'b4a30003-0003-4000-8000-000000000003',
    'family', 'completed', 'public_self_report',
    v_now + interval '2 minutes', 70, 'C', '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, 1, v_now, v_now
  );

  INSERT INTO public.tasks (
    id, household_id, lead_id, assessment_id, title, description, due_date, priority, status,
    source_type, workflow_type, automation_idempotency_key, created_at, updated_at
  ) VALUES (
    'd4a30003-0003-4000-8000-000000000003',
    'a4a30003-0003-4000-8000-000000000003',
    'b4a30003-0003-4000-8000-000000000003',
    'c4a30003-0003-4000-8000-000000000003',
    'Review Initial Financial Diagnostic — verify contact permission',
    'Contact permission could not be determined from the consent snapshot.',
    (v_now::date + 3), 'medium', 'open',
    'public_family_ingest', 'review_initial_diagnostic',
    'public_family:c4a30003-0003-4000-8000-000000000003:review_initial_diagnostic',
    v_now, v_now
  );

  UPDATE public.leads SET follow_up_task_id = 'd4a30003-0003-4000-8000-000000000003'
  WHERE id = 'b4a30003-0003-4000-8000-000000000003';

  -- S04 exact trusted match (canonical already exists; lead linked to it)
  INSERT INTO public.households (
    id, display_name, status, primary_email, normalized_email, primary_phone, normalized_phone,
    relationship_pipeline_id, relationship_stage_id, stage_entered_at, created_at, updated_at
  ) VALUES (
    'a4a30004-0004-4000-8000-000000000004',
    '[QA4A3] Canonical Exact Match',
    'client', 'qa.exact@example.test', 'qa.exact@example.test', '555-010-0004', '+15550100004',
    v_pipeline, v_stage, v_now - interval '30 days', v_now - interval '30 days', v_now
  );

  INSERT INTO public.leads (
    id, household_id, lead_type, status, assessment_type, source_page, submitted_at,
    overall_score, overall_grade, normalized_email, normalized_phone, ingest_match_status,
    sheets_sync_status, consent_snapshot, public_ingest_idempotency_key,
    follow_up_task_automation_status, raw_payload, created_at, updated_at
  ) VALUES (
    'b4a30004-0004-4000-8000-000000000004',
    'a4a30004-0004-4000-8000-000000000004',
    'Family Report Card', 'new', 'family', '/qa-sprint-4a3', v_now + interval '3 minutes',
    88, 'B+', 'qa.exact@example.test', '+15550100004', 'exact_trusted_match',
    'succeeded',
    jsonb_build_object('assessmentStorageAcknowledged', true, 'contactPermission', true, 'privacyAcknowledged', true),
    'b4a30004-0001-4000-9000-000000000004'::uuid, 'task_created',
    jsonb_build_object('firstName','Exact','lastName','Match','email','qa.exact@example.test','phone','555-010-0004'),
    v_now, v_now
  );

  INSERT INTO public.assessments (
    id, household_id, lead_id, assessment_type, status, capture_channel,
    completed_at, overall_score, overall_grade, priorities, answers, derived_metrics, scoring_version, created_at, updated_at
  ) VALUES (
    'c4a30004-0004-4000-8000-000000000004',
    'a4a30004-0004-4000-8000-000000000004',
    'b4a30004-0004-4000-8000-000000000004',
    'family', 'completed', 'public_self_report',
    v_now + interval '3 minutes', 88, 'B+', '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, 1, v_now, v_now
  );

  -- S05 possible duplicate: candidate + provisional + pending review + resolve task
  INSERT INTO public.households (
    id, display_name, status, primary_email, normalized_email, primary_phone, normalized_phone,
    relationship_pipeline_id, relationship_stage_id, stage_entered_at,
    duplicate_review_status, created_at, updated_at
  ) VALUES (
    'a4a30005-0005-4000-8000-0000000000c5',
    '[QA4A3] Candidate Possible Match',
    'client', 'qa.possible@example.test', 'qa.possible@example.test', '555-010-0005', '+15550100005',
    v_pipeline, v_stage, v_now - interval '60 days', 'none', v_now - interval '60 days', v_now
  );

  INSERT INTO public.households (
    id, display_name, status, primary_email, normalized_email, primary_phone, normalized_phone,
    relationship_pipeline_id, relationship_stage_id, stage_entered_at,
    potential_duplicate_of, duplicate_review_status, created_at, updated_at
  ) VALUES (
    'a4a30005-0005-4000-8000-000000000005',
    '[QA4A3] Provisional Possible Match',
    'lead', 'qa.possible@example.test', 'qa.possible@example.test', '555-010-0005', '+15550100005',
    v_pipeline, v_stage, v_now,
    'a4a30005-0005-4000-8000-0000000000c5', 'pending', v_now, v_now
  );

  INSERT INTO public.leads (
    id, household_id, lead_type, status, assessment_type, source_page, submitted_at,
    overall_score, overall_grade, normalized_email, normalized_phone, ingest_match_status,
    duplicate_review_status, potential_duplicate_of_household_id,
    sheets_sync_status, consent_snapshot, public_ingest_idempotency_key,
    follow_up_task_automation_status, raw_payload, created_at, updated_at
  ) VALUES (
    'b4a30005-0005-4000-8000-000000000005',
    'a4a30005-0005-4000-8000-000000000005',
    'Family Report Card', 'duplicate_review', 'family', '/qa-sprint-4a3', v_now + interval '4 minutes',
    72, 'C', 'qa.possible@example.test', '+15550100005', 'possible_match',
    'pending', 'a4a30005-0005-4000-8000-0000000000c5',
    'pending',
    jsonb_build_object('assessmentStorageAcknowledged', true, 'contactPermission', true, 'privacyAcknowledged', true),
    'b4a30005-0001-4000-9000-000000000005'::uuid, 'task_created',
    jsonb_build_object('firstName','Pat','lastName','Possible','email','qa.possible@example.test'),
    v_now, v_now
  );

  INSERT INTO public.household_members (
    id, household_id, first_name, last_name, relationship, is_primary_contact,
    email, normalized_email, phone, normalized_phone, created_at, updated_at
  ) VALUES (
    'f4a30005-0005-4000-8000-000000000005',
    'a4a30005-0005-4000-8000-000000000005',
    'Pat', 'Possible', 'primary', true,
    'qa.possible@example.test', 'qa.possible@example.test',
    '555-010-0005', '+15550100005', v_now, v_now
  );

  INSERT INTO public.assessments (
    id, household_id, lead_id, assessment_type, status, capture_channel,
    completed_at, overall_score, overall_grade, priorities, answers, derived_metrics, scoring_version, created_at, updated_at
  ) VALUES (
    'c4a30005-0005-4000-8000-000000000005',
    'a4a30005-0005-4000-8000-000000000005',
    'b4a30005-0005-4000-8000-000000000005',
    'family', 'completed', 'public_self_report',
    v_now + interval '4 minutes', 72, 'C', '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, 1, v_now, v_now
  );

  INSERT INTO public.duplicate_reviews (
    id, incoming_lead_id, candidate_household_id, provisional_household_id,
    match_reason, match_confidence, status, created_at, updated_at
  ) VALUES (
    'e4a30005-0005-4000-8000-000000000005',
    'b4a30005-0005-4000-8000-000000000005',
    'a4a30005-0005-4000-8000-0000000000c5',
    'a4a30005-0005-4000-8000-000000000005',
    'possible_contact_match', 'medium', 'pending', v_now, v_now
  );

  INSERT INTO public.tasks (
    id, household_id, lead_id, assessment_id, title, description, due_date, priority, status,
    source_type, workflow_type, automation_idempotency_key, created_at, updated_at
  ) VALUES (
    'd4a30005-0005-4000-8000-000000000005',
    'a4a30005-0005-4000-8000-000000000005',
    'b4a30005-0005-4000-8000-000000000005',
    'c4a30005-0005-4000-8000-000000000005',
    'Resolve possible duplicate diagnostic submission',
    'Do not initiate outreach before identity review is complete.',
    (v_now::date + 1), 'high', 'open',
    'public_family_ingest', 'resolve_possible_duplicate',
    'public_family:c4a30005-0005-4000-8000-000000000005:resolve_possible_duplicate',
    v_now, v_now
  );

  UPDATE public.leads SET follow_up_task_id = 'd4a30005-0005-4000-8000-000000000005'
  WHERE id = 'b4a30005-0005-4000-8000-000000000005';

  -- S06 repeat diagnostic (two assessments)
  INSERT INTO public.households (
    id, display_name, status, primary_email, normalized_email,
    relationship_pipeline_id, relationship_stage_id, stage_entered_at, created_at, updated_at
  ) VALUES (
    'a4a30006-0006-4000-8000-000000000006',
    '[QA4A3] Repeat Diagnostic Household',
    'lead', 'qa.repeat@example.test', 'qa.repeat@example.test',
    v_pipeline, v_stage, v_now, v_now, v_now
  );

  INSERT INTO public.leads (
    id, household_id, lead_type, status, assessment_type, source_page, submitted_at,
    overall_score, overall_grade, normalized_email, ingest_match_status, sheets_sync_status,
    consent_snapshot, public_ingest_idempotency_key, follow_up_task_automation_status,
    raw_payload, created_at, updated_at
  ) VALUES (
    'b4a30006-0006-4000-8000-000000000006',
    'a4a30006-0006-4000-8000-000000000006',
    'Family Report Card', 'unassigned', 'family', '/qa-sprint-4a3', v_now + interval '5 minutes',
    81, 'B', 'qa.repeat@example.test', 'new_prospect', 'succeeded',
    jsonb_build_object('assessmentStorageAcknowledged', true, 'contactPermission', true, 'privacyAcknowledged', true),
    'b4a30006-0001-4000-9000-000000000006'::uuid, 'task_created',
    jsonb_build_object('firstName','Riley','lastName','Repeat'),
    v_now, v_now
  );

  INSERT INTO public.assessments (
    id, household_id, lead_id, assessment_type, status, capture_channel,
    completed_at, overall_score, overall_grade, priorities, answers, derived_metrics, scoring_version, created_at, updated_at
  ) VALUES
  (
    'c4a30006-0006-4000-8000-00000000006a',
    'a4a30006-0006-4000-8000-000000000006',
    'b4a30006-0006-4000-8000-000000000006',
    'family', 'completed', 'public_self_report',
    v_now - interval '7 days', 60, 'D', '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, 1, v_now, v_now
  ),
  (
    'c4a30006-0006-4000-8000-00000000006b',
    'a4a30006-0006-4000-8000-000000000006',
    'b4a30006-0006-4000-8000-000000000006',
    'family', 'completed', 'public_self_report',
    v_now + interval '5 minutes', 81, 'B', '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, 1, v_now, v_now
  );

  -- S07 sheets failed
  INSERT INTO public.households (
    id, display_name, status, primary_email, normalized_email,
    relationship_pipeline_id, relationship_stage_id, stage_entered_at, created_at, updated_at
  ) VALUES (
    'a4a30007-0007-4000-8000-000000000007',
    '[QA4A3] Sheets Failed',
    'lead', 'qa.sheets.fail@example.test', 'qa.sheets.fail@example.test',
    v_pipeline, v_stage, v_now, v_now, v_now
  );

  INSERT INTO public.leads (
    id, household_id, lead_type, status, assessment_type, source_page, submitted_at,
    overall_score, overall_grade, normalized_email, ingest_match_status,
    sheets_sync_status, sheets_sync_error_category, consent_snapshot,
    public_ingest_idempotency_key, follow_up_task_automation_status,
    raw_payload, created_at, updated_at
  ) VALUES (
    'b4a30007-0007-4000-8000-000000000007',
    'a4a30007-0007-4000-8000-000000000007',
    'Family Report Card', 'unassigned', 'family', '/qa-sprint-4a3', v_now + interval '6 minutes',
    66, 'D', 'qa.sheets.fail@example.test', 'new_prospect',
    'failed', 'timeout',
    jsonb_build_object('assessmentStorageAcknowledged', true, 'contactPermission', false, 'privacyAcknowledged', true),
    'b4a30007-0001-4000-9000-000000000007'::uuid, 'task_created',
    jsonb_build_object('firstName','Sky','lastName','Sheets'),
    v_now, v_now
  );

  INSERT INTO public.assessments (
    id, household_id, lead_id, assessment_type, status, capture_channel,
    completed_at, overall_score, overall_grade, priorities, answers, derived_metrics, scoring_version, created_at, updated_at
  ) VALUES (
    'c4a30007-0007-4000-8000-000000000007',
    'a4a30007-0007-4000-8000-000000000007',
    'b4a30007-0007-4000-8000-000000000007',
    'family', 'completed', 'public_self_report',
    v_now + interval '6 minutes', 66, 'D', '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, 1, v_now, v_now
  );

  -- S08 task automation failed (no task)
  INSERT INTO public.households (
    id, display_name, status, primary_email, normalized_email,
    relationship_pipeline_id, relationship_stage_id, stage_entered_at, created_at, updated_at
  ) VALUES (
    'a4a30008-0008-4000-8000-000000000008',
    '[QA4A3] Task Automation Failed',
    'lead', 'qa.task.fail@example.test', 'qa.task.fail@example.test',
    v_pipeline, v_stage, v_now, v_now, v_now
  );

  INSERT INTO public.leads (
    id, household_id, lead_type, status, assessment_type, source_page, submitted_at,
    overall_score, overall_grade, normalized_email, ingest_match_status, sheets_sync_status,
    consent_snapshot, public_ingest_idempotency_key,
    follow_up_task_automation_status, follow_up_task_automation_error_category,
    follow_up_task_automation_attempted_at, raw_payload, created_at, updated_at
  ) VALUES (
    'b4a30008-0008-4000-8000-000000000008',
    'a4a30008-0008-4000-8000-000000000008',
    'Family Report Card', 'unassigned', 'family', '/qa-sprint-4a3', v_now + interval '7 minutes',
    69, 'D', 'qa.task.fail@example.test', 'new_prospect', 'succeeded',
    jsonb_build_object('assessmentStorageAcknowledged', true, 'contactPermission', true, 'privacyAcknowledged', true),
    'b4a30008-0001-4000-9000-000000000008'::uuid,
    'task_failed', 'rpc_error', v_now,
    jsonb_build_object('firstName','Terry','lastName','Taskfail'),
    v_now, v_now
  );

  INSERT INTO public.assessments (
    id, household_id, lead_id, assessment_type, status, capture_channel,
    completed_at, overall_score, overall_grade, priorities, answers, derived_metrics, scoring_version, created_at, updated_at
  ) VALUES (
    'c4a30008-0008-4000-8000-000000000008',
    'a4a30008-0008-4000-8000-000000000008',
    'b4a30008-0008-4000-8000-000000000008',
    'family', 'completed', 'public_self_report',
    v_now + interval '7 minutes', 69, 'D', '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, 1, v_now, v_now
  );

  -- S09 soft-deleted automatic task
  INSERT INTO public.households (
    id, display_name, status, primary_email, normalized_email,
    relationship_pipeline_id, relationship_stage_id, stage_entered_at, created_at, updated_at
  ) VALUES (
    'a4a30009-0009-4000-8000-000000000009',
    '[QA4A3] Soft Deleted Auto Task',
    'lead', 'qa.softdel@example.test', 'qa.softdel@example.test',
    v_pipeline, v_stage, v_now, v_now, v_now
  );

  INSERT INTO public.leads (
    id, household_id, lead_type, status, assessment_type, source_page, submitted_at,
    overall_score, overall_grade, normalized_email, ingest_match_status, sheets_sync_status,
    consent_snapshot, public_ingest_idempotency_key,
    follow_up_task_automation_status, follow_up_task_automation_error_category,
    follow_up_task_automation_attempted_at, raw_payload, created_at, updated_at
  ) VALUES (
    'b4a30009-0009-4000-8000-000000000009',
    'a4a30009-0009-4000-8000-000000000009',
    'Family Report Card', 'unassigned', 'family', '/qa-sprint-4a3', v_now + interval '8 minutes',
    74, 'C', 'qa.softdel@example.test', 'new_prospect', 'succeeded',
    jsonb_build_object('assessmentStorageAcknowledged', true, 'contactPermission', true, 'privacyAcknowledged', true),
    'b4a30009-0001-4000-9000-000000000009'::uuid,
    'task_failed', 'soft_deleted_task_exists', v_now,
    jsonb_build_object('firstName','Sam','lastName','Softdel'),
    v_now, v_now
  );

  INSERT INTO public.assessments (
    id, household_id, lead_id, assessment_type, status, capture_channel,
    completed_at, overall_score, overall_grade, priorities, answers, derived_metrics, scoring_version, created_at, updated_at
  ) VALUES (
    'c4a30009-0009-4000-8000-000000000009',
    'a4a30009-0009-4000-8000-000000000009',
    'b4a30009-0009-4000-8000-000000000009',
    'family', 'completed', 'public_self_report',
    v_now + interval '8 minutes', 74, 'C', '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, 1, v_now, v_now
  );

  INSERT INTO public.tasks (
    id, household_id, lead_id, assessment_id, title, description, due_date, priority, status,
    source_type, workflow_type, automation_idempotency_key, deleted_at, created_at, updated_at
  ) VALUES (
    'd4a30009-0009-4000-8000-000000000009',
    'a4a30009-0009-4000-8000-000000000009',
    'b4a30009-0009-4000-8000-000000000009',
    'c4a30009-0009-4000-8000-000000000009',
    'Review Initial Financial Diagnostic and follow up',
    'Soft-deleted automatic task fixture.',
    (v_now::date + 1), 'high', 'open',
    'public_family_ingest', 'review_initial_diagnostic',
    'public_family:c4a30009-0009-4000-8000-000000000009:review_initial_diagnostic',
    v_now, v_now, v_now
  );

  -- S10 unsafe provisional with dependent note
  INSERT INTO public.households (
    id, display_name, status, primary_email, normalized_email,
    relationship_pipeline_id, relationship_stage_id, stage_entered_at,
    potential_duplicate_of, duplicate_review_status, created_at, updated_at
  ) VALUES (
    'a4a30010-0010-4000-8000-0000000000c0',
    '[QA4A3] Unsafe Candidate',
    'client', 'qa.unsafe.cand@example.test', 'qa.unsafe.cand@example.test',
    v_pipeline, v_stage, v_now - interval '90 days', NULL, 'none', v_now - interval '90 days', v_now
  );

  INSERT INTO public.households (
    id, display_name, status, primary_email, normalized_email,
    relationship_pipeline_id, relationship_stage_id, stage_entered_at,
    potential_duplicate_of, duplicate_review_status, created_at, updated_at
  ) VALUES (
    'a4a30010-0010-4000-8000-000000000010',
    '[QA4A3] Unsafe Provisional With Note',
    'lead', 'qa.unsafe@example.test', 'qa.unsafe@example.test',
    v_pipeline, v_stage, v_now,
    'a4a30010-0010-4000-8000-0000000000c0', 'pending', v_now, v_now
  );

  INSERT INTO public.leads (
    id, household_id, lead_type, status, assessment_type, source_page, submitted_at,
    overall_score, overall_grade, normalized_email, ingest_match_status, duplicate_review_status,
    potential_duplicate_of_household_id, sheets_sync_status, consent_snapshot,
    public_ingest_idempotency_key, follow_up_task_automation_status, raw_payload, created_at, updated_at
  ) VALUES (
    'b4a30010-0010-4000-8000-000000000010',
    'a4a30010-0010-4000-8000-000000000010',
    'Family Report Card', 'duplicate_review', 'family', '/qa-sprint-4a3', v_now + interval '9 minutes',
    61, 'D', 'qa.unsafe@example.test', 'possible_match', 'pending',
    'a4a30010-0010-4000-8000-0000000000c0', 'succeeded',
    jsonb_build_object('assessmentStorageAcknowledged', true, 'contactPermission', false, 'privacyAcknowledged', true),
    'b4a30010-0001-4000-9000-000000000010'::uuid, 'task_created',
    jsonb_build_object('firstName','Una','lastName','Safe'),
    v_now, v_now
  );

  INSERT INTO public.household_members (
    id, household_id, first_name, last_name, relationship, is_primary_contact,
    email, normalized_email, created_at, updated_at
  ) VALUES (
    'f4a30010-0010-4000-8000-000000000010',
    'a4a30010-0010-4000-8000-000000000010',
    'Una', 'Safe', 'primary', true,
    'qa.unsafe@example.test', 'qa.unsafe@example.test', v_now, v_now
  );

  INSERT INTO public.assessments (
    id, household_id, lead_id, assessment_type, status, capture_channel,
    completed_at, overall_score, overall_grade, priorities, answers, derived_metrics, scoring_version, created_at, updated_at
  ) VALUES (
    'c4a30010-0010-4000-8000-000000000010',
    'a4a30010-0010-4000-8000-000000000010',
    'b4a30010-0010-4000-8000-000000000010',
    'family', 'completed', 'public_self_report',
    v_now + interval '9 minutes', 61, 'D', '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, 1, v_now, v_now
  ),
  (
    -- Extra assessment = unsafe dependent (blocks confirm_same_household)
    'c4a30010-0010-4000-8000-00000000001a',
    'a4a30010-0010-4000-8000-000000000010',
    'b4a30010-0010-4000-8000-000000000010',
    'family', 'completed', 'advisor_onboarding',
    v_now + interval '9 minutes' + interval '1 second', 55, 'F', '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, 1, v_now, v_now
  );

  INSERT INTO public.duplicate_reviews (
    id, incoming_lead_id, candidate_household_id, provisional_household_id,
    match_reason, match_confidence, status, created_at, updated_at
  ) VALUES (
    'e4a30010-0010-4000-8000-000000000010',
    'b4a30010-0010-4000-8000-000000000010',
    'a4a30010-0010-4000-8000-0000000000c0',
    'a4a30010-0010-4000-8000-000000000010',
    'possible_contact_match', 'medium', 'pending', v_now, v_now
  );

  -- S11 assigned (if advisor present)
  INSERT INTO public.households (
    id, display_name, status, primary_email, normalized_email,
    relationship_pipeline_id, relationship_stage_id, stage_entered_at,
    assigned_advisor_id, assigned_at, assignment_reason, created_at, updated_at
  ) VALUES (
    'a4a30011-0011-4000-8000-000000000011',
    '[QA4A3] Assigned Household',
    'lead', 'qa.assigned@example.test', 'qa.assigned@example.test',
    v_pipeline, v_stage, v_now,
    v_advisor, CASE WHEN v_advisor IS NULL THEN NULL ELSE v_now END,
    CASE WHEN v_advisor IS NULL THEN NULL ELSE 'manual'::public.assignment_reason END,
    v_now, v_now
  );

  INSERT INTO public.leads (
    id, household_id, lead_type, status, assessment_type, source_page, submitted_at,
    overall_score, overall_grade, normalized_email, ingest_match_status, sheets_sync_status,
    consent_snapshot, public_ingest_idempotency_key, follow_up_task_automation_status,
    assigned_advisor_id, raw_payload, created_at, updated_at
  ) VALUES (
    'b4a30011-0011-4000-8000-000000000011',
    'a4a30011-0011-4000-8000-000000000011',
    'Family Report Card',
    CASE WHEN v_advisor IS NULL THEN 'unassigned'::public.lead_status ELSE 'assigned'::public.lead_status END,
    'family', '/qa-sprint-4a3', v_now + interval '10 minutes',
    77, 'C+', 'qa.assigned@example.test', 'new_prospect', 'succeeded',
    jsonb_build_object('assessmentStorageAcknowledged', true, 'contactPermission', true, 'privacyAcknowledged', true),
    'b4a30011-0001-4000-9000-000000000011'::uuid, 'task_created', v_advisor,
    jsonb_build_object('firstName','Avery','lastName','Assigned'),
    v_now, v_now
  );

  INSERT INTO public.assessments (
    id, household_id, lead_id, assessment_type, status, capture_channel,
    completed_at, overall_score, overall_grade, priorities, answers, derived_metrics, scoring_version, created_at, updated_at
  ) VALUES (
    'c4a30011-0011-4000-8000-000000000011',
    'a4a30011-0011-4000-8000-000000000011',
    'b4a30011-0011-4000-8000-000000000011',
    'family', 'completed', 'public_self_report',
    v_now + interval '10 minutes', 77, 'C+', '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, 1, v_now, v_now
  );

  -- S12 unassigned
  INSERT INTO public.households (
    id, display_name, status, primary_email, normalized_email,
    relationship_pipeline_id, relationship_stage_id, stage_entered_at, created_at, updated_at
  ) VALUES (
    'a4a30012-0012-4000-8000-000000000012',
    '[QA4A3] Unassigned Household',
    'lead', 'qa.unassigned@example.test', 'qa.unassigned@example.test',
    v_pipeline, v_stage, v_now, v_now, v_now
  );

  INSERT INTO public.leads (
    id, household_id, lead_type, status, assessment_type, source_page, submitted_at,
    overall_score, overall_grade, normalized_email, ingest_match_status, sheets_sync_status,
    consent_snapshot, public_ingest_idempotency_key, follow_up_task_automation_status,
    raw_payload, created_at, updated_at
  ) VALUES (
    'b4a30012-0012-4000-8000-000000000012',
    'a4a30012-0012-4000-8000-000000000012',
    'Family Report Card', 'unassigned', 'family', '/qa-sprint-4a3', v_now + interval '11 minutes',
    71, 'C', 'qa.unassigned@example.test', 'new_prospect', 'succeeded',
    jsonb_build_object('assessmentStorageAcknowledged', true, 'contactPermission', false, 'privacyAcknowledged', true),
    'b4a30012-0001-4000-9000-000000000012'::uuid, 'task_pending',
    jsonb_build_object('firstName','Jordan','lastName','Unassigned'),
    v_now, v_now
  );

  INSERT INTO public.assessments (
    id, household_id, lead_id, assessment_type, status, capture_channel,
    completed_at, overall_score, overall_grade, priorities, answers, derived_metrics, scoring_version, created_at, updated_at
  ) VALUES (
    'c4a30012-0012-4000-8000-000000000012',
    'a4a30012-0012-4000-8000-000000000012',
    'b4a30012-0012-4000-8000-000000000012',
    'family', 'completed', 'public_self_report',
    v_now + interval '11 minutes', 71, 'C', '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, 1, v_now, v_now
  );

  RAISE NOTICE 'QA4A3 seed complete (S01–S12 CRM fixtures).';
END $$;

COMMIT;
