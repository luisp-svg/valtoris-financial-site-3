-- 026_digital_identity_connect_ingest.sql
-- Sprint 5.7 Phase 1: Digital Identity / Let's Connect CRM relationship capture.
--
-- Mirrors Family public-ingest patterns (020/021/022/023) without assessments
-- or Cases. No selfie/OCR/analytics/NFC tables.
--
-- Adds:
--   1) Expanded tasks.source_type / tasks.workflow_type CHECKs for DI
--   2) ingest_digital_identity_connect (service_role only)
--   3) create_digital_identity_follow_up_task (lead-keyed, no assessment)
--   4) resolve_digital_identity_duplicate_review (owner-only, no assessment)
--
-- Does NOT modify Family RPCs.

-- ---------------------------------------------------------------------------
-- A) Expand task CHECKs (keep all existing values)
-- ---------------------------------------------------------------------------
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_source_type_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_source_type_check
  CHECK (
    source_type IN (
      'manual',
      'public_family_ingest',
      'duplicate_resolution',
      'system',
      'digital_identity_ingest'
    )
  );

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_workflow_type_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_workflow_type_check
  CHECK (
    workflow_type IS NULL
    OR workflow_type IN (
      'review_initial_diagnostic',
      'resolve_possible_duplicate',
      'review_digital_identity_lead',
      'resolve_digital_identity_duplicate'
    )
  );

COMMENT ON COLUMN public.tasks.source_type IS
  'manual | public_family_ingest | duplicate_resolution | system | digital_identity_ingest';
COMMENT ON COLUMN public.tasks.workflow_type IS
  'review_initial_diagnostic | resolve_possible_duplicate | review_digital_identity_lead | resolve_digital_identity_duplicate (null for legacy/manual freeform).';

-- ---------------------------------------------------------------------------
-- B) ingest_digital_identity_connect (service_role only)
-- Matching is classified in the application; this RPC persists atomically.
-- No assessment. No Case. Never overwrites trusted-match contact fields.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ingest_digital_identity_connect(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_key uuid;
  v_match_status text;
  v_matched_household_id uuid;
  v_candidate_household_id uuid;
  v_household_id uuid;
  v_member_id uuid;
  v_lead_id uuid;
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
  v_advisor_profile_id uuid;
  v_advisor_slug text;
  v_attribution public.attribution_method;
  v_card_public_key text;
  v_campaign_code text;
  v_event_code text;
  v_activity_title text;
  v_activity_event text;
  v_safe_meta jsonb;
  v_assign_advisor boolean := false;
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

  -- Idempotent replay
  SELECT l.id AS lead_id,
         l.household_id,
         l.ingest_match_status,
         (
           SELECT hm.id
           FROM public.household_members hm
           WHERE hm.household_id = l.household_id
             AND hm.deleted_at IS NULL
             AND hm.is_primary_contact = true
           ORDER BY hm.created_at ASC
           LIMIT 1
         ) AS member_id,
         (
           SELECT dr.id
           FROM public.duplicate_reviews dr
           WHERE dr.incoming_lead_id = l.id
           ORDER BY dr.created_at DESC
           LIMIT 1
         ) AS duplicate_review_id
    INTO v_existing
  FROM public.leads l
  WHERE l.public_ingest_idempotency_key = v_key
    AND l.deleted_at IS NULL
    AND l.lead_type = 'Digital Identity'
  LIMIT 1;

  IF FOUND AND v_existing.lead_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'created', false,
      'lead_id', v_existing.lead_id,
      'household_id', v_existing.household_id,
      'member_id', v_existing.member_id,
      'match_status', v_existing.ingest_match_status,
      'duplicate_review_id', v_existing.duplicate_review_id,
      'assessment_id', NULL
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
  v_card_public_key := NULLIF(trim(COALESCE(p_payload->>'card_public_key', '')), '');
  v_campaign_code := NULLIF(trim(COALESCE(p_payload->>'campaign_code', '')), '');
  v_event_code := NULLIF(trim(COALESCE(p_payload->>'event_code', '')), '');

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
      RAISE EXCEPTION 'invalid_advisor_profile' USING ERRCODE = '22023';
    END IF;

    IF v_advisor_slug IS NULL THEN
      SELECT ap.slug INTO v_advisor_slug
      FROM public.advisor_profiles ap
      WHERE ap.id = v_advisor_profile_id;
    END IF;

    v_attribution := 'advisor_link';
    v_assign_advisor := (v_match_status IN ('new_prospect', 'exact_trusted_match'));
  ELSE
    v_attribution := 'unknown';
    v_assign_advisor := false;
  END IF;

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
    -- Never create/overwrite members or contact fields on exact match.
    SELECT hm.id INTO v_member_id
    FROM public.household_members hm
    WHERE hm.household_id = v_household_id
      AND hm.deleted_at IS NULL
      AND hm.is_primary_contact = true
    ORDER BY hm.created_at ASC
    LIMIT 1;

    v_lead_status := CASE
      WHEN v_assign_advisor THEN 'assigned'::public.lead_status
      ELSE 'unassigned'::public.lead_status
    END;
  ELSE
    -- new_prospect or possible_match: create provisional household + primary member.
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
      'digital_identity',
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
      normalized_phone
    ) VALUES (
      v_household_id,
      v_first_name,
      v_last_name,
      'primary',
      true,
      v_email,
      v_normalized_email,
      v_phone,
      v_normalized_phone
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
      'Digital Identity',
      v_lead_status,
      NULL,
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
      'skipped',
      COALESCE(p_payload->'consent_snapshot', '{}'::jsonb),
      v_match_status
    )
    RETURNING id INTO v_lead_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- Concurrent duplicate: return the winner row.
      SELECT l.id AS lead_id,
             l.household_id,
             l.ingest_match_status,
             (
               SELECT hm.id
               FROM public.household_members hm
               WHERE hm.household_id = l.household_id
                 AND hm.deleted_at IS NULL
                 AND hm.is_primary_contact = true
               ORDER BY hm.created_at ASC
               LIMIT 1
             ) AS member_id,
             (
               SELECT dr.id
               FROM public.duplicate_reviews dr
               WHERE dr.incoming_lead_id = l.id
               ORDER BY dr.created_at DESC
               LIMIT 1
             ) AS duplicate_review_id
        INTO v_existing
      FROM public.leads l
      WHERE l.public_ingest_idempotency_key = v_key
        AND l.deleted_at IS NULL
        AND l.lead_type = 'Digital Identity'
      LIMIT 1;

      RETURN jsonb_build_object(
        'created', false,
        'lead_id', v_existing.lead_id,
        'household_id', v_existing.household_id,
        'member_id', v_existing.member_id,
        'match_status', v_existing.ingest_match_status,
        'duplicate_review_id', v_existing.duplicate_review_id,
        'assessment_id', NULL
      );
  END;

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

  v_activity_title := CASE v_match_status
    WHEN 'exact_trusted_match' THEN 'Digital Identity lead matched existing household'
    WHEN 'possible_match' THEN 'Digital Identity lead flagged as possible duplicate'
    ELSE 'Digital Identity lead created'
  END;
  v_activity_event := CASE v_match_status
    WHEN 'exact_trusted_match' THEN 'digital_identity.lead_matched'
    WHEN 'possible_match' THEN 'digital_identity.lead_possible_match'
    ELSE 'digital_identity.lead_created'
  END;

  v_safe_meta := jsonb_build_object(
    'event', v_activity_event,
    'lead_id', v_lead_id,
    'cardPublicKey', v_card_public_key,
    'campaignCode', v_campaign_code,
    'eventCode', v_event_code,
    'match_status', v_match_status
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
    NULL,
    NULL,
    'lead_created',
    v_activity_title,
    'Public Digital Identity / Let''s Connect capture persisted.',
    v_safe_meta,
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
    NULL,
    NULL,
    'system',
    'Relationship Connected',
    'Visitor completed Let''s Connect relationship capture.',
    jsonb_build_object(
      'event', 'digital_identity.contact_shared',
      'lead_id', v_lead_id,
      'cardPublicKey', v_card_public_key,
      'campaignCode', v_campaign_code,
      'eventCode', v_event_code,
      'match_status', v_match_status
    ),
    v_submitted_at
  );

  RETURN jsonb_build_object(
    'created', v_created,
    'lead_id', v_lead_id,
    'household_id', v_household_id,
    'member_id', v_member_id,
    'match_status', v_match_status,
    'duplicate_review_id', v_duplicate_review_id,
    'assessment_id', NULL
  );
END;
$$;

COMMENT ON FUNCTION public.ingest_digital_identity_connect(jsonb) IS
  'Atomic Digital Identity / Let''s Connect CRM ingest. Callable only with service_role. Creates household/member when needed, always creates a Digital Identity lead (no assessment, no Case), never overwrites trusted-match contact fields.';

REVOKE ALL ON FUNCTION public.ingest_digital_identity_connect(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ingest_digital_identity_connect(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.ingest_digital_identity_connect(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_digital_identity_connect(jsonb) TO service_role;

ALTER FUNCTION public.ingest_digital_identity_connect(jsonb) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- C) create_digital_identity_follow_up_task
-- Mirror Family task RPC but keyed on lead_id (no assessment).
-- Idempotency: digital_identity:{lead_id}:{workflow}
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_digital_identity_follow_up_task(
  p_lead_id uuid,
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

  IF p_lead_id IS NULL THEN
    RAISE EXCEPTION 'CRM_TASK:invalid_lead' USING ERRCODE = '22023';
  END IF;

  IF v_workflow NOT IN ('review_digital_identity_lead', 'resolve_digital_identity_duplicate') THEN
    RAISE EXCEPTION 'CRM_TASK:invalid_workflow' USING ERRCODE = '22023';
  END IF;

  IF v_source NOT IN ('manual', 'digital_identity_ingest', 'duplicate_resolution', 'system') THEN
    RAISE EXCEPTION 'CRM_TASK:invalid_source' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_lead.deleted_at IS NOT NULL
     OR v_lead.lead_type IS DISTINCT FROM 'Digital Identity' THEN
    RAISE EXCEPTION 'CRM_TASK:invalid_lead' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_household
  FROM public.households
  WHERE id = v_lead.household_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_household.deleted_at IS NOT NULL
     OR v_household.merged_into_household_id IS NOT NULL THEN
    RAISE EXCEPTION 'CRM_TASK:invalid_household' USING ERRCODE = 'P0001';
  END IF;

  v_pending_dup := (
    v_lead.ingest_match_status = 'possible_match'
    AND COALESCE(v_lead.duplicate_review_status::text, 'none') = 'pending'
  );

  IF v_workflow = 'resolve_digital_identity_duplicate' THEN
    IF v_lead.ingest_match_status IS DISTINCT FROM 'possible_match' OR NOT v_pending_dup THEN
      RAISE EXCEPTION 'CRM_TASK:workflow_not_allowed' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_workflow = 'review_digital_identity_lead' AND v_pending_dup THEN
    RAISE EXCEPTION 'CRM_TASK:workflow_not_allowed' USING ERRCODE = 'P0001';
  END IF;

  v_key := 'digital_identity:' || v_lead.id::text || ':' || v_workflow;

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
      'assessment_id', NULL,
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
      'assessment_id', NULL,
      'household_id', v_household.id
    );
  END IF;

  -- After duplicate resolution, complete open resolve tasks before creating review.
  IF v_source = 'duplicate_resolution' AND v_workflow = 'review_digital_identity_lead' THEN
    FOR v_dup_task IN
      SELECT *
      FROM public.tasks
      WHERE lead_id = v_lead.id
        AND workflow_type = 'resolve_digital_identity_duplicate'
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

  IF v_workflow = 'resolve_digital_identity_duplicate' THEN
    v_title := 'Resolve possible duplicate Digital Identity connection';
    v_description :=
      'Owner review required for a possible duplicate Digital Identity / Let''s Connect submission.'
      || E'\n' || 'Review provisional and candidate household identity in Intake.'
      || E'\n' || 'Do not initiate outreach before identity review is complete.'
      || E'\n' || 'Resolve through Confirm Same Household or Keep as Separate Household.';
    v_priority := 'high';
    v_due := (COALESCE(v_lead.submitted_at, v_now))::date + 1;
    v_assigned_user_id := NULL;
  ELSIF v_contact THEN
    IF v_lead.ingest_match_status = 'exact_trusted_match' THEN
      v_title := 'Review Digital Identity connection for existing household';
    ELSE
      v_title := 'Review Digital Identity connection and follow up';
    END IF;
    v_description :=
      'Internal CRM review task for a Digital Identity / Let''s Connect relationship capture.'
      || E'\n' || 'Contact permission was granted on this submission.'
      || E'\n' || CASE WHEN v_email_mkt
           THEN 'Email marketing consent was granted (marketing only; not general contact).'
           ELSE 'Email marketing consent was not granted.' END
      || E'\n' || CASE WHEN v_sms_mkt
           THEN 'SMS marketing consent was granted (marketing only; not general contact).'
           ELSE 'SMS marketing consent was not granted.' END
      || E'\n' || 'Review the connection before any outreach.'
      || E'\n' || 'Do not assume a communication channel without its channel consent.';
    v_priority := 'high';
    v_due := (COALESCE(v_lead.submitted_at, v_now))::date + 1;
  ELSIF (v_consent->>'contactPermission') = 'false' THEN
    IF v_lead.ingest_match_status = 'exact_trusted_match' THEN
      v_title := 'Review Digital Identity connection — verify contact authority';
    ELSE
      v_title := 'Review Digital Identity connection — no contact permission';
    END IF;
    v_description :=
      'Internal CRM review task for a Digital Identity / Let''s Connect relationship capture.'
      || E'\n' || 'Contact permission was not granted.'
      || E'\n' || 'Internal review only. Do not initiate outreach based solely on this submission.';
    v_priority := 'medium';
    v_due := (COALESCE(v_lead.submitted_at, v_now))::date + 3;
  ELSE
    v_title := 'Review Digital Identity connection — verify contact permission';
    v_description :=
      'Internal CRM review task for a Digital Identity / Let''s Connect relationship capture.'
      || E'\n' || 'Contact permission could not be determined from the consent snapshot.'
      || E'\n' || 'Verify contact authority before any outreach based on this connection.';
    v_priority := 'medium';
    v_due := (COALESCE(v_lead.submitted_at, v_now))::date + 3;
  END IF;

  -- Resolve tasks stay unassigned (owner review). Review tasks map advisor_profiles.id → profiles.id.
  IF v_workflow = 'review_digital_identity_lead' THEN
    SELECT ap.user_id INTO v_assigned_user_id
    FROM public.advisor_profiles ap
    WHERE ap.id = COALESCE(v_household.assigned_advisor_id, v_lead.assigned_advisor_id, v_lead.original_advisor_id)
      AND ap.deleted_at IS NULL
      AND ap.is_active = true
    LIMIT 1;
  ELSE
    v_assigned_user_id := NULL;
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
    NULL,
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
      'digital_identity', true,
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
    'Internal review task created for a Digital Identity / Let''s Connect relationship capture.',
    jsonb_build_object(
      'event', 'digital_identity.follow_up_task_created',
      'task_id', v_task.id,
      'lead_id', v_lead.id,
      'household_id', v_household.id,
      'workflow_type', v_workflow,
      'creation_source', v_source,
      'assignee_user_id', v_assigned_user_id
    ),
    NULL,
    NULL,
    v_lead.id,
    NULL
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_exists', false,
    'needs_manual_review', false,
    'task_id', v_task.id,
    'workflow_type', v_workflow,
    'lead_id', v_lead.id,
    'assessment_id', NULL,
    'household_id', v_household.id
  );
END;
$$;

COMMENT ON FUNCTION public.create_digital_identity_follow_up_task(uuid, text, text) IS
  'Owner or service-role idempotent creator for Digital Identity follow-up tasks. Keyed on lead_id (no assessment). Soft-deleted automatic keys require manual review (no silent recreate).';

REVOKE ALL ON FUNCTION public.create_digital_identity_follow_up_task(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_digital_identity_follow_up_task(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.create_digital_identity_follow_up_task(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_digital_identity_follow_up_task(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_digital_identity_follow_up_task(uuid, text, text) TO service_role;

ALTER FUNCTION public.create_digital_identity_follow_up_task(uuid, text, text) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- D) resolve_digital_identity_duplicate_review
-- Owner-only; Digital Identity leads only; NO assessment.
-- Dependents: 1 member, 1 lead, 0 assessments.
-- Excludes resolve_digital_identity_duplicate task from unsafe count.
-- ---------------------------------------------------------------------------
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

  -- IMPORTANT: Do NOT use chr(0) / replace(..., chr(0), ...) on PostgreSQL text.
  -- Evaluating chr(0) raises "null character not permitted" (same fix as migration 024).
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

  IF v_lead.lead_type IS DISTINCT FROM 'Digital Identity'
     OR v_lead.ingest_match_status IS DISTINCT FROM 'possible_match' THEN
    RAISE EXCEPTION 'CRM_DUP:invalid_lead'
      USING ERRCODE = 'P0001';
  END IF;

  -- Digital Identity ingest never creates assessments.
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

    -- Preserve Digital Identity attribution columns (lead_type, original_*, consent).
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
      AND lead_type = 'Digital Identity';

    UPDATE public.households
    SET
      duplicate_review_status = 'confirmed_unique',
      potential_duplicate_of = NULL,
      updated_at = v_now
    WHERE id = v_provisional.id;

    PERFORM public.crm_write_activity(
      v_provisional.id,
      'system',
      'Digital Identity duplicate kept separate',
      'Owner confirmed the provisional Digital Identity household is not a duplicate of the candidate household.',
      jsonb_build_object(
        'event', 'digital_identity.duplicate_resolved',
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

  -- Expected provisional dependents from Digital Identity ingest only:
  -- 1 primary member, 1 lead (this review), 0 assessments.
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

  -- Exclude the automatic DI resolve task expected on possible matches.
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
     OR v_assessment_count <> 0
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.leads
    WHERE id = v_lead.id
      AND household_id = v_provisional.id
      AND lead_type = 'Digital Identity'
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'CRM_DUP:unsafe_dependents'
      USING ERRCODE = 'P0001';
  END IF;

  -- Re-link lead to canonical household. Do NOT touch candidate contact fields.
  -- Preserve Digital Identity attribution (lead_type, original_*, consent, sheets skipped).
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
    AND lead_type = 'Digital Identity';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CRM_DUP:invalid_lead'
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

  PERFORM public.crm_write_activity(
    v_candidate.id,
    'system',
    'Digital Identity duplicate confirmed',
    'Owner confirmed the Digital Identity / Let''s Connect submission belongs to this household. Canonical contact details were not changed.',
    jsonb_build_object(
      'event', 'digital_identity.duplicate_resolved',
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

  -- Move completed resolve task household pointer with the lead for history continuity.
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
  'Owner-only transactional resolution for Digital Identity possible matches. Actions: confirm_same_household | keep_separate. Never overwrites canonical contact data, never creates/touches assessments, never deletes lead history. Provisional households are merged via merged_into_household_id. Abort if provisional has unexpected dependents beyond ingest-created member/lead (0 assessments). The automatic resolve_digital_identity_duplicate task is an expected dependent and is completed on successful resolution.';

REVOKE ALL ON FUNCTION public.resolve_digital_identity_duplicate_review(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_digital_identity_duplicate_review(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_digital_identity_duplicate_review(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_digital_identity_duplicate_review(uuid, text, text) TO authenticated;

ALTER FUNCTION public.resolve_digital_identity_duplicate_review(uuid, text, text) OWNER TO postgres;
