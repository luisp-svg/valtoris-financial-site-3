-- Approved insurance quote intake. Reuses CRM records, ownership and RLS.
-- No public table writes; no assessments, policies or messaging are created.
CREATE OR REPLACE FUNCTION public.ingest_insurance_quote(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_key uuid;
  v_kind text := p_payload->>'kind';
  v_label text;
  v_raw jsonb := p_payload->'raw_payload';
  v_fingerprint text := p_payload->>'fingerprint';
  v_existing public.leads;
  v_match text := p_payload->>'match_status';
  v_household uuid;
  v_member uuid;
  v_lead uuid;
  v_review uuid;
  v_candidate uuid := NULLIF(p_payload->>'candidate_household_id', '')::uuid;
  v_advisor uuid;
  v_first text := NULLIF(btrim(p_payload->>'first_name'), '');
  v_last text := NULLIF(btrim(p_payload->>'last_name'), '');
  v_email extensions.citext := lower(btrim(p_payload->>'normalized_email'))::extensions.citext;
  v_phone text := p_payload->>'normalized_phone';
  v_now timestamptz := now();
BEGIN
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR jsonb_typeof(v_raw) IS DISTINCT FROM 'object'
     OR v_kind IS NULL OR v_kind NOT IN ('auto', 'home', 'commercial')
     OR v_first IS NULL OR v_last IS NULL OR v_email IS NULL OR v_phone IS NULL
     OR v_match IS NULL OR v_match NOT IN ('new_prospect','exact_trusted_match','possible_match')
     OR v_fingerprint IS NULL OR v_fingerprint !~ '^[0-9a-f]{64}$'
     OR p_payload->'consent_snapshot'->>'contactPermission' IS DISTINCT FROM 'true'
     OR p_payload->'consent_snapshot'->>'quoteStorageAcknowledged' IS DISTINCT FROM 'true'
     OR p_payload->'consent_snapshot'->>'privacyAcknowledged' IS DISTINCT FROM 'true'
  THEN RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023'; END IF;
  v_key := (p_payload->>'idempotency_key')::uuid;
  IF v_key IS NULL THEN RAISE EXCEPTION 'invalid_idempotency_key'; END IF;
  v_label := CASE v_kind WHEN 'auto' THEN 'Auto Insurance Quote' WHEN 'home' THEN 'Home Insurance Quote' ELSE 'Commercial Insurance Quote' END;

  -- Lock before any inserts. A replay never leaves orphan households/members.
  PERFORM pg_advisory_xact_lock(hashtextextended('insurance-submission:' || v_key::text, 0));
  SELECT * INTO v_existing FROM public.leads WHERE public_ingest_idempotency_key = v_key ORDER BY created_at LIMIT 1;
  IF FOUND THEN
    IF v_existing.lead_type IS DISTINCT FROM v_label OR v_existing.raw_payload->>'fingerprint' IS DISTINCT FROM v_fingerprint
    THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = '22023'; END IF;
    RETURN jsonb_build_object('created',false,'lead_id',v_existing.id,'household_id',v_existing.household_id);
  END IF;

  -- Serialize new quote identities, then verify the application's matching snapshot.
  -- Fixed lock order prevents deadlocks across requests sharing email or phone.
  PERFORM pg_advisory_xact_lock(hashtextextended('insurance-email:' || v_email::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('insurance-phone:' || v_phone, 0));
  IF v_match = 'new_prospect' AND (
    EXISTS(SELECT 1 FROM public.households h WHERE h.deleted_at IS NULL AND h.merged_into_household_id IS NULL AND (h.normalized_email = v_email OR h.normalized_phone = v_phone))
    OR EXISTS(SELECT 1 FROM public.household_members m JOIN public.households h ON h.id=m.household_id WHERE m.deleted_at IS NULL AND h.deleted_at IS NULL AND h.merged_into_household_id IS NULL AND (m.normalized_email=v_email OR m.normalized_phone=v_phone))
  ) THEN RAISE EXCEPTION 'retry_match' USING ERRCODE='40001'; END IF;

  IF v_match = 'exact_trusted_match' THEN
    v_household := NULLIF(p_payload->>'matched_household_id','')::uuid;
    SELECT assigned_advisor_id INTO v_advisor FROM public.households WHERE id=v_household AND deleted_at IS NULL AND merged_into_household_id IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'retry_match' USING ERRCODE='40001'; END IF;
    -- Require a primary member with the submitted name and both contact identifiers.
    SELECT m.id INTO v_member FROM public.household_members m JOIN public.households h ON h.id=m.household_id
      WHERE m.household_id=v_household AND m.deleted_at IS NULL AND m.is_primary_contact=true
      AND lower(btrim(m.first_name))=lower(v_first) AND lower(btrim(m.last_name))=lower(v_last)
      AND ((m.normalized_email=v_email AND m.normalized_phone=v_phone) OR (h.normalized_email=v_email AND h.normalized_phone=v_phone)) LIMIT 1;
    IF v_member IS NULL THEN RAISE EXCEPTION 'retry_match' USING ERRCODE='40001'; END IF;
  ELSE
    IF v_match='possible_match' AND (v_candidate IS NULL OR NOT EXISTS(SELECT 1 FROM public.households WHERE id=v_candidate AND deleted_at IS NULL AND merged_into_household_id IS NULL))
    THEN RAISE EXCEPTION 'retry_match' USING ERRCODE='40001'; END IF;
    INSERT INTO public.households(display_name,status,primary_email,normalized_email,primary_phone,normalized_phone,
      relationship_pipeline_id,relationship_stage_id,stage_entered_at,lead_source,potential_duplicate_of,duplicate_review_status)
    VALUES(btrim(v_first || ' ' || v_last),'lead',v_email,v_email,v_phone,v_phone,
      '22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333001',v_now,'insurance_quote_'||v_kind,
      CASE WHEN v_match='possible_match' THEN v_candidate END,CASE WHEN v_match='possible_match' THEN 'pending'::public.duplicate_review_status ELSE 'none'::public.duplicate_review_status END)
    RETURNING id INTO v_household;
    INSERT INTO public.household_members(household_id,first_name,last_name,relationship,is_primary_contact,email,normalized_email,phone,normalized_phone)
      VALUES(v_household,v_first,v_last,'primary',true,v_email,v_email,v_phone,v_phone) RETURNING id INTO v_member;
  END IF;

  INSERT INTO public.leads(household_id,lead_type,status,source_page,submitted_at,assigned_advisor_id,assigned_at,raw_payload,
    normalized_email,normalized_phone,potential_duplicate_of_household_id,duplicate_review_status,public_ingest_idempotency_key,
    sheets_sync_status,consent_snapshot,ingest_match_status,original_source_metadata)
  VALUES(v_household,v_label,CASE WHEN v_match='possible_match' THEN 'duplicate_review'::public.lead_status WHEN v_advisor IS NOT NULL THEN 'assigned'::public.lead_status ELSE 'unassigned'::public.lead_status END,
    '/'||v_kind||'-quote',v_now,v_advisor,CASE WHEN v_advisor IS NOT NULL THEN v_now END,v_raw || jsonb_build_object('fingerprint',v_fingerprint),
    v_email,v_phone,CASE WHEN v_match='possible_match' THEN v_candidate END,
    CASE WHEN v_match='possible_match' THEN 'pending'::public.duplicate_review_status ELSE 'none'::public.duplicate_review_status END,
    v_key,'skipped',p_payload->'consent_snapshot',v_match,jsonb_build_object('quote_kind',v_kind,'quote_stage','Quote Requested','agentcrm_handoff','not_enabled')) RETURNING id INTO v_lead;
  IF v_match='possible_match' THEN
    INSERT INTO public.duplicate_reviews(incoming_lead_id,candidate_household_id,provisional_household_id,match_reason,match_confidence,status,payload_snapshot)
    VALUES(v_lead,v_candidate,v_household,COALESCE(p_payload->>'match_reason','possible_contact_match'),COALESCE(p_payload->>'match_confidence','low'),'pending',jsonb_build_object('quote_kind',v_kind,'lead_id',v_lead)) RETURNING id INTO v_review;
  END IF;
  INSERT INTO public.activities(household_id,lead_id,activity_type,title,body,metadata,occurred_at)
    VALUES(v_household,v_lead,'lead_created',v_label || ' requested','Quote information saved for private advisor review.',jsonb_build_object('event','insurance_quote.submitted','quote_kind',v_kind,'lead_id',v_lead,'match_status',v_match),v_now);
  RETURN jsonb_build_object('created',true,'lead_id',v_lead,'household_id',v_household,'member_id',v_member,'duplicate_review_id',v_review);
END;
$$;
REVOKE ALL ON FUNCTION public.ingest_insurance_quote(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_insurance_quote(jsonb) TO service_role;
ALTER FUNCTION public.ingest_insurance_quote(jsonb) OWNER TO postgres;

-- Reuse the established lead-only duplicate workflow for quotes, preserving all owner and dependency guards.
CREATE OR REPLACE FUNCTION public.resolve_digital_identity_duplicate_review(
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
  v_photo_count integer;
  v_rec_count integer;
  v_portal_count integer;
  v_assign_count integer;
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

      v_resulting_household_id := CASE
        WHEN v_action = 'confirm_same_household' THEN v_review.candidate_household_id
        ELSE COALESCE(v_review.provisional_household_id, v_lead.household_id)
      END;

      RETURN jsonb_build_object(
        'ok', true,
        'action', v_action,
        'duplicate_review_id', v_review.id,
        'lead_id', v_review.incoming_lead_id,
        'assessment_id', NULL,
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

  IF v_lead.lead_type NOT IN ('Digital Identity', 'Auto Insurance Quote', 'Home Insurance Quote', 'Commercial Insurance Quote')
     OR v_lead.ingest_match_status IS DISTINCT FROM 'possible_match' THEN
    RAISE EXCEPTION 'CRM_DUP:invalid_lead'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.assessments a
    WHERE a.lead_id = v_lead.id
      AND a.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'CRM_DUP:unexpected_assessment'
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
    WHERE id = v_lead.id
      AND lead_type IN ('Digital Identity', 'Auto Insurance Quote', 'Home Insurance Quote', 'Commercial Insurance Quote');

    UPDATE public.households
    SET
      duplicate_review_status = 'confirmed_unique',
      potential_duplicate_of = NULL,
      updated_at = v_now
    WHERE id = v_provisional.id;

    PERFORM public.crm_write_activity(
      v_provisional.id,
      'system',
      v_lead.lead_type || ' duplicate kept separate',
      'Owner confirmed the provisional public-intake household is not a duplicate of the candidate household.',
      jsonb_build_object(
        'event', CASE WHEN v_lead.lead_type = 'Digital Identity' THEN 'digital_identity.duplicate_resolved' ELSE 'insurance_quote.duplicate_resolved' END,
        'duplicate_review_id', v_review.id,
        'action', 'keep_separate',
        'provisional_household_id', v_provisional.id,
        'resulting_household_id', v_provisional.id,
        'candidate_household_id', v_review.candidate_household_id,
        'lead_id', v_lead.id,
        'resolver_user_id', v_uid,
        'resolved_at', v_now
      ),
      NULL,
      NULL,
      v_lead.id,
      NULL
    );

    UPDATE public.tasks
    SET
      status = 'done',
      completed_at = v_now,
      updated_at = v_now
    WHERE lead_id = v_lead.id
      AND workflow_type = 'resolve_digital_identity_duplicate'
      AND deleted_at IS NULL
      AND status IN ('open', 'in_progress');

    RETURN jsonb_build_object(
      'ok', true,
      'action', 'keep_separate',
      'duplicate_review_id', v_review.id,
      'lead_id', v_lead.id,
      'assessment_id', NULL,
      'resulting_household_id', v_provisional.id,
      'provisional_household_id', v_provisional.id,
      'resolved_at', v_now,
      'already_resolved', false
    );
  END IF;

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

  SELECT count(*)::integer INTO v_task_count
  FROM public.tasks
  WHERE household_id = v_provisional.id
    AND deleted_at IS NULL
    AND NOT (
      workflow_type = 'resolve_digital_identity_duplicate'
      AND lead_id = v_lead.id
      AND source_type IN ('digital_identity_ingest', 'duplicate_resolution', 'system')
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

  -- Expected: zero or one active relationship_photo for this incoming lead.
  SELECT count(*)::integer INTO v_photo_count
  FROM public.documents
  WHERE household_id = v_provisional.id
    AND deleted_at IS NULL
    AND doc_type = 'relationship_photo'
    AND lead_id = v_lead.id;

  SELECT count(*)::integer INTO v_doc_count
  FROM public.documents
  WHERE household_id = v_provisional.id
    AND deleted_at IS NULL
    AND NOT (
      doc_type = 'relationship_photo'
      AND lead_id = v_lead.id
    );

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
     OR v_assessment_count <> 0
     OR v_opp_count <> 0
     OR v_task_count <> 0
     OR v_note_count <> 0
     OR v_appt_count <> 0
     OR v_policy_count <> 0
     OR v_review_count <> 0
     OR v_doc_count <> 0
     OR v_photo_count > 1
     OR (v_lead.lead_type <> 'Digital Identity' AND v_photo_count > 0)
     OR v_rec_count <> 0
     OR v_portal_count <> 0
     OR v_assign_count <> 0 THEN
    RAISE EXCEPTION 'CRM_DUP:unsafe_dependents'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.leads
    WHERE id = v_lead.id
      AND household_id = v_provisional.id
      AND lead_type IN ('Digital Identity', 'Auto Insurance Quote', 'Home Insurance Quote', 'Commercial Insurance Quote')
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'CRM_DUP:unsafe_dependents'
      USING ERRCODE = 'P0001';
  END IF;

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
    AND deleted_at IS NULL
    AND lead_type IN ('Digital Identity', 'Auto Insurance Quote', 'Home Insurance Quote', 'Commercial Insurance Quote');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CRM_DUP:invalid_lead'
      USING ERRCODE = 'P0001';
  END IF;

  -- Reassign Relationship Photo with the lead; retain lead_id and advisor_only visibility.
  UPDATE public.documents
  SET
    household_id = v_candidate.id,
    updated_at = v_now
  WHERE lead_id = v_lead.id
    AND doc_type = 'relationship_photo'
    AND deleted_at IS NULL
    AND household_id = v_provisional.id;

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

  PERFORM public.crm_write_activity(
    v_candidate.id,
    'system',
    v_lead.lead_type || ' duplicate confirmed',
    'Owner confirmed the public-intake submission belongs to this household. Canonical contact details were not changed.',
    jsonb_build_object(
      'event', CASE WHEN v_lead.lead_type = 'Digital Identity' THEN 'digital_identity.duplicate_resolved' ELSE 'insurance_quote.duplicate_resolved' END,
      'duplicate_review_id', v_review.id,
      'action', 'confirm_same_household',
      'provisional_household_id', v_provisional.id,
      'resulting_household_id', v_candidate.id,
      'candidate_household_id', v_candidate.id,
      'lead_id', v_lead.id,
      'resolver_user_id', v_uid,
      'resolved_at', v_now
    ),
    NULL,
    NULL,
    v_lead.id,
    NULL
  );

  UPDATE public.tasks
  SET
    status = 'done',
    completed_at = v_now,
    updated_at = v_now
  WHERE lead_id = v_lead.id
    AND workflow_type = 'resolve_digital_identity_duplicate'
    AND deleted_at IS NULL
    AND status IN ('open', 'in_progress');

  UPDATE public.tasks
  SET
    household_id = v_candidate.id,
    updated_at = v_now
  WHERE lead_id = v_lead.id
    AND workflow_type = 'resolve_digital_identity_duplicate'
    AND deleted_at IS NULL
    AND household_id = v_provisional.id;

  RETURN jsonb_build_object(
    'ok', true,
    'action', 'confirm_same_household',
    'duplicate_review_id', v_review.id,
    'lead_id', v_lead.id,
    'assessment_id', NULL,
    'resulting_household_id', v_candidate.id,
    'provisional_household_id', v_provisional.id,
    'resolved_at', v_now,
    'already_resolved', false
  );
END;
$$;

COMMENT ON FUNCTION public.resolve_digital_identity_duplicate_review(uuid, text, text) IS
  'Owner-only transactional resolution for Digital Identity possible matches. Actions: confirm_same_household | keep_separate. Zero or one active relationship_photo for the incoming lead is an expected dependent and is reassigned on confirm_same. Unrelated documents still block. Never overwrites canonical contact data, never creates assessments. Family resolve RPCs are unchanged.';

REVOKE ALL ON FUNCTION public.resolve_digital_identity_duplicate_review(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_digital_identity_duplicate_review(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_digital_identity_duplicate_review(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_digital_identity_duplicate_review(uuid, text, text) TO authenticated;

ALTER FUNCTION public.resolve_digital_identity_duplicate_review(uuid, text, text) OWNER TO postgres;

-- Extend the existing archive allowlist; permission and activity-order checks are unchanged.
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
    'Digital Identity',
    'Bulk Lead Import',
    'Auto Insurance Quote',
    'Home Insurance Quote',
    'Commercial Insurance Quote'
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
  'Authenticated Intake archive. Writes one private CRM Activity while the lead is still active, completes only the linked ordinary follow-up task (review_initial_diagnostic | review_digital_identity_lead), then sets leads.deleted_at. Owner or assigned-household advisor. Rejects pending duplicate review. Never completes resolve_possible_duplicate or resolve_digital_identity_duplicate. Reasons: dismissed | not_a_fit | spam | test_or_accidental. Allowlisted types include Bulk Lead Import.';

REVOKE ALL ON FUNCTION public.archive_intake_lead(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_intake_lead(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.archive_intake_lead(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.archive_intake_lead(uuid, text) TO authenticated;
