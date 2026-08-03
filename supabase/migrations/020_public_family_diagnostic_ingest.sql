-- 020_public_family_diagnostic_ingest.sql
-- Public Family Report Card → CRM ingest foundation.
-- Adds assessment provenance, lead idempotency, Sheets sync metadata,
-- consent snapshot, ingest match classification, and a service-role-only
-- transactional ingest RPC.
--
-- Known product note (not changed here): public Family scoring uses six
-- categories while some marketing copy describes eight.

-- ---------------------------------------------------------------------------
-- assessment_capture_channel
-- Distinguishes public self-reports from advisor-trusted evidence.
-- Financial Progress must exclude public_self_report (app-layer filter).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE public.assessment_capture_channel AS ENUM (
    'public_self_report',
    'advisor_onboarding',
    'advisor_reviewed',
    'imported',
    'unknown'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE public.assessment_capture_channel IS
  'Provenance of an assessment row. public_self_report = Initial Financial Diagnostic; advisor_reviewed = trusted FP evidence; advisor_onboarding = household onboarding capture; unknown = legacy/unclassified.';

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS capture_channel public.assessment_capture_channel NOT NULL DEFAULT 'unknown';

-- Safe backfill: onboarding → advisor_onboarding; other historical rows stay unknown
-- (must NOT become advisor_reviewed by accident).
UPDATE public.assessments
SET capture_channel = 'advisor_onboarding'
WHERE assessment_type = 'household_onboarding'
  AND capture_channel = 'unknown';

COMMENT ON COLUMN public.assessments.capture_channel IS
  'Provenance/trust channel. New public Family Report Card rows use public_self_report. Exclude public_self_report from Household Financial Progress evidence selection.';

CREATE INDEX IF NOT EXISTS assessments_household_type_channel_completed_idx
  ON public.assessments (household_id, assessment_type, capture_channel, completed_at DESC)
  WHERE deleted_at IS NULL AND status = 'completed';

-- ---------------------------------------------------------------------------
-- sheets_sync_status (leads)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE public.sheets_sync_status AS ENUM (
    'pending',
    'succeeded',
    'failed',
    'skipped'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE public.sheets_sync_status IS
  'Google Sheets secondary-write status for public ingest leads during dual-write transition.';

-- ---------------------------------------------------------------------------
-- Lead ingest columns
-- Idempotency is canonical on leads (one public submission = one lead).
-- Assessment history attaches via lead_id; do not duplicate unique keys there.
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS public_ingest_idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS sheets_sync_status public.sheets_sync_status,
  ADD COLUMN IF NOT EXISTS sheets_sync_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sheets_sync_error_category text,
  ADD COLUMN IF NOT EXISTS consent_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ingest_match_status text;

-- Unique among active public-ingest leads (retries share one row).
CREATE UNIQUE INDEX IF NOT EXISTS leads_public_ingest_idempotency_key_uidx
  ON public.leads (public_ingest_idempotency_key)
  WHERE public_ingest_idempotency_key IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_ingest_match_status_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_ingest_match_status_check
  CHECK (
    ingest_match_status IS NULL
    OR ingest_match_status IN (
      'exact_trusted_match',
      'possible_match',
      'new_prospect'
    )
  );

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_sheets_sync_error_category_len;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_sheets_sync_error_category_len
  CHECK (
    sheets_sync_error_category IS NULL
    OR char_length(sheets_sync_error_category) <= 64
  );

COMMENT ON COLUMN public.leads.public_ingest_idempotency_key IS
  'Client-generated UUID for public ingest retries. Not email/phone. Unique among non-deleted leads.';
COMMENT ON COLUMN public.leads.sheets_sync_status IS
  'Secondary Sheets write status. Null for non-ingest / pre-dual-write leads.';
COMMENT ON COLUMN public.leads.sheets_sync_attempted_at IS
  'Last Sheets sync attempt timestamp.';
COMMENT ON COLUMN public.leads.sheets_sync_error_category IS
  'Safe short error category (e.g. timeout, http_error). Never store raw payloads or secrets.';
COMMENT ON COLUMN public.leads.external_sheet_row_ref IS
  'Optional external Sheets row/reference id when available from the secondary writer.';
COMMENT ON COLUMN public.leads.consent_snapshot IS
  'Explicit consent state snapshot. Missing keys mean not_provided/false — never infer true from contact fields.';
COMMENT ON COLUMN public.leads.ingest_match_status IS
  'Public ingest identity classification at capture time. Null for non-ingest leads.';

-- ---------------------------------------------------------------------------
-- Transactional ingest RPC (service_role only)
-- Matching is classified in the application; this RPC persists atomically.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ingest_public_family_report_card(p_payload jsonb)
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
         l.sheets_sync_status,
         a.id AS assessment_id
    INTO v_existing
  FROM public.leads l
  LEFT JOIN public.assessments a
    ON a.lead_id = l.id
   AND a.deleted_at IS NULL
   AND a.assessment_type = 'family'
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

  IF v_first_name IS NULL OR v_last_name IS NULL THEN
    RAISE EXCEPTION 'invalid_name' USING ERRCODE = '22023';
  END IF;

  IF v_display_name IS NULL THEN
    v_display_name := trim(v_first_name || ' ' || v_last_name);
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
    v_lead_status := 'unassigned';
  ELSE
    -- new_prospect or possible_match: create provisional household + primary member.
    -- Do not overwrite any existing canonical contact data.
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
      original_source_metadata,
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
      'family_report_card',
      COALESCE(p_payload->'original_source_metadata', '{}'::jsonb),
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
      original_source_metadata,
      attribution_method,
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
      'Family Report Card',
      v_lead_status,
      'family',
      NULLIF(p_payload->>'source_page', ''),
      v_submitted_at,
      COALESCE(p_payload->'original_source_metadata', '{}'::jsonb),
      'unknown',
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
      -- Concurrent duplicate: return the winner row.
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
       AND a.assessment_type = 'family'
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
    capture_channel
  ) VALUES (
    v_household_id,
    v_lead_id,
    'family',
    'completed',
    v_submitted_at,
    NULLIF(p_payload->>'overall_score', '')::numeric,
    NULLIF(p_payload->>'overall_grade', ''),
    COALESCE(p_payload->'top_priorities', '[]'::jsonb),
    COALESCE(p_payload->'answers', '{}'::jsonb),
    COALESCE(p_payload->'derived_metrics', '{}'::jsonb),
    COALESCE(NULLIF(p_payload->>'scoring_version', '')::integer, 1),
    'public_self_report'
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
    'Initial Financial Diagnostic submitted',
    'Public Family Report Card captured as Initial Financial Diagnostic.',
    jsonb_build_object(
      'source', 'public_family_report_card',
      'match_status', v_match_status,
      'idempotency_key', v_key
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
    'Family Report Card assessment completed',
    'Public self-report assessment stored. Not advisor-reviewed Financial Progress.',
    jsonb_build_object(
      'capture_channel', 'public_self_report',
      'assessment_type', 'family'
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

COMMENT ON FUNCTION public.ingest_public_family_report_card(jsonb) IS
  'Atomic public Family Report Card CRM ingest. Callable only with service_role. Creates household/member when needed, always creates new lead+assessment history, never overwrites trusted matches.';

REVOKE ALL ON FUNCTION public.ingest_public_family_report_card(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ingest_public_family_report_card(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.ingest_public_family_report_card(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_public_family_report_card(jsonb) TO service_role;

-- Sheets sync update helper (service_role only)
CREATE OR REPLACE FUNCTION public.update_lead_sheets_sync(
  p_lead_id uuid,
  p_status public.sheets_sync_status,
  p_error_category text DEFAULT NULL,
  p_external_ref text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_lead_id IS NULL OR p_status IS NULL THEN
    RAISE EXCEPTION 'invalid_sheets_sync_args' USING ERRCODE = '22023';
  END IF;

  UPDATE public.leads
  SET
    sheets_sync_status = p_status,
    sheets_sync_attempted_at = now(),
    sheets_sync_error_category = CASE
      WHEN p_status = 'failed' THEN left(COALESCE(p_error_category, 'unknown'), 64)
      ELSE NULL
    END,
    external_sheet_row_ref = COALESCE(p_external_ref, external_sheet_row_ref),
    updated_at = now()
  WHERE id = p_lead_id
    AND deleted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION public.update_lead_sheets_sync(uuid, public.sheets_sync_status, text, text) IS
  'Updates Sheets secondary-write metadata on a lead. service_role only.';

REVOKE ALL ON FUNCTION public.update_lead_sheets_sync(uuid, public.sheets_sync_status, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_lead_sheets_sync(uuid, public.sheets_sync_status, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.update_lead_sheets_sync(uuid, public.sheets_sync_status, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_lead_sheets_sync(uuid, public.sheets_sync_status, text, text) TO service_role;
