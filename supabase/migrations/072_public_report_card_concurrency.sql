-- 072_public_report_card_concurrency.sql
-- Approved Phase 0 correction. Production writer body verified against 054.
-- Serialize same-submission retries and recheck new-contact snapshots before
-- writes. No tables, columns, policies, scoring, or attribution rules change.
-- No backfill or cleanup; existing migration files remain immutable.
-- Deploy the server retry handling with this function. Old servers fail safely
-- on retry_match rather than creating an accidental duplicate.

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
    'family', 'business', 'retirement', 'protection', 'student_loan', 'credit', 'home_buyer'
  ) THEN
    RAISE EXCEPTION 'invalid_assessment_type' USING ERRCODE = '22023';
  END IF;

  v_lead_type := CASE v_assessment_type
    WHEN 'family' THEN 'Family Report Card'
    WHEN 'business' THEN 'Business Report Card'
    WHEN 'retirement' THEN 'Retirement Report Card'
    WHEN 'protection' THEN 'Protection Gap'
    WHEN 'student_loan' THEN 'Student Loan Report Card'
    WHEN 'credit' THEN 'Credit Report Card'
    WHEN 'home_buyer' THEN 'Home Buyer Report Card'
  END;
  v_lead_source := CASE v_assessment_type
    WHEN 'family' THEN 'family_report_card'
    WHEN 'business' THEN 'business_report_card'
    WHEN 'retirement' THEN 'retirement_report_card'
    WHEN 'protection' THEN 'protection_gap'
    WHEN 'student_loan' THEN 'student_loan_report_card'
    WHEN 'credit' THEN 'credit_report_card'
    WHEN 'home_buyer' THEN 'home_buyer_report_card'
  END;

  v_payload_lead_type := NULLIF(trim(COALESCE(p_payload->>'lead_type', '')), '');
  IF v_payload_lead_type IS NOT NULL AND v_payload_lead_type IS DISTINCT FROM v_lead_type THEN
    RAISE EXCEPTION 'invalid_lead_type' USING ERRCODE = '22023';
  END IF;

  -- Serialize retries before any household/member side effect.
  PERFORM pg_advisory_xact_lock(hashtextextended('report-card-submission:' || v_key::text, 0));

  -- Idempotent replay (any of the seven public types for this UUID).
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
   AND a.assessment_type IN ('family', 'business', 'retirement', 'protection', 'student_loan', 'credit', 'home_buyer')
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

  -- Reuse the existing ingestion retry protocol: matching stays in the
  -- application, while the database rejects a stale new-prospect snapshot.
  -- All Report Card requests take contact locks in the same order.
  IF v_normalized_email IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('report-card-email:' || v_normalized_email::text, 0));
  END IF;
  IF v_normalized_phone IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('report-card-phone:' || v_normalized_phone, 0));
  END IF;

  IF v_match_status = 'new_prospect' AND (
    EXISTS (
      SELECT 1 FROM public.households h
      WHERE h.deleted_at IS NULL AND h.merged_into_household_id IS NULL
        AND (h.normalized_email = v_normalized_email OR h.normalized_phone = v_normalized_phone)
    ) OR EXISTS (
      SELECT 1 FROM public.household_members m
      JOIN public.households h ON h.id = m.household_id
      WHERE m.deleted_at IS NULL AND h.deleted_at IS NULL AND h.merged_into_household_id IS NULL
        AND (m.normalized_email = v_normalized_email OR m.normalized_phone = v_normalized_phone)
    )
  ) THEN
    RAISE EXCEPTION 'retry_match' USING ERRCODE = '40001';
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
    WHEN 'credit' THEN 'Credit Report Card submitted'
    WHEN 'home_buyer' THEN 'Home Buyer Report Card submitted'
  END;
  v_activity_lead_body := CASE v_assessment_type
    WHEN 'family' THEN 'Public Family Report Card captured as Initial Financial Diagnostic.'
    WHEN 'business' THEN 'Public Business Report Card captured.'
    WHEN 'retirement' THEN 'Public Retirement Report Card captured.'
    WHEN 'protection' THEN 'Public Protection Gap captured.'
    WHEN 'student_loan' THEN 'Public Student Loan Report Card captured.'
    WHEN 'credit' THEN 'Public Credit Report Card captured.'
    WHEN 'home_buyer' THEN 'Public Home Buyer Report Card captured.'
  END;
  v_activity_assess_title := CASE v_assessment_type
    WHEN 'family' THEN 'Family Report Card assessment completed'
    WHEN 'business' THEN 'Business Report Card assessment completed'
    WHEN 'retirement' THEN 'Retirement Report Card assessment completed'
    WHEN 'protection' THEN 'Protection Gap assessment completed'
    WHEN 'student_loan' THEN 'Student Loan Report Card assessment completed'
    WHEN 'credit' THEN 'Credit Report Card assessment completed'
    WHEN 'home_buyer' THEN 'Home Buyer Report Card assessment completed'
  END;
  v_activity_assess_body :=
    'Public self-report assessment stored. Not advisor-reviewed Financial Progress.';
  v_activity_source := CASE v_assessment_type
    WHEN 'family' THEN 'public_family_report_card'
    WHEN 'business' THEN 'public_business_report_card'
    WHEN 'retirement' THEN 'public_retirement_report_card'
    WHEN 'protection' THEN 'public_protection_gap'
    WHEN 'student_loan' THEN 'public_student_loan_report_card'
    WHEN 'credit' THEN 'public_credit_report_card'
    WHEN 'home_buyer' THEN 'public_home_buyer_report_card'
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

  -- Do not swallow unique violations after household/member creation.
  -- Any unexpected conflict must roll back the entire RPC.
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
  'Atomic public Report Card CRM ingest for family/business/retirement/protection/student_loan/credit/home_buyer. Callable only with service_role. Validates allowlisted assessment_type ↔ lead_type pairs. Creates household/member when needed, always creates new lead+assessment history, never overwrites trusted matches or invents arbitrary types.';

REVOKE ALL ON FUNCTION public.ingest_public_report_card(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ingest_public_report_card(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.ingest_public_report_card(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_public_report_card(jsonb) TO service_role;
