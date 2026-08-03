-- 021_public_family_duplicate_resolution.sql
-- Sprint 4A.3 Phase 4.5: owner-only transactional duplicate resolution for
-- public Family Report Card possible matches.
--
-- Invariants:
--   - Never overwrite canonical household/member contact fields
--   - Never delete historical leads or assessments
--   - Never change assessment provenance away from public_self_report
--   - Never hard-delete provisional households
--   - Never silently merge weak matches (explicit owner action only)
--   - No automatic advisor reassignment or task creation
--
-- Status semantics (existing duplicate_review_status enum):
--   pending            → awaiting owner decision
--   merged             → confirm_same_household
--   confirmed_unique   → keep_separate
--
-- Provisional household lifecycle on confirm:
--   set merged_into_household_id = candidate (existing column)
--   set duplicate_review_status = 'merged'
--   clear potential_duplicate_of
--   leave deleted_at NULL (merged_into already excludes from active listings/RLS)

-- Prevent self-merge targets (additive safety; does not change existing rows that
-- already satisfy the predicate).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'households_merged_into_not_self'
      AND conrelid = 'public.households'::regclass
  ) THEN
    ALTER TABLE public.households
      ADD CONSTRAINT households_merged_into_not_self
      CHECK (
        merged_into_household_id IS NULL
        OR merged_into_household_id <> id
      );
  END IF;
END
$$;

COMMENT ON CONSTRAINT households_merged_into_not_self ON public.households IS
  'A household cannot be marked as merged into itself.';

CREATE INDEX IF NOT EXISTS households_merged_into_idx
  ON public.households (merged_into_household_id)
  WHERE merged_into_household_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- resolve_public_family_duplicate_review
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

  -- Sanitize notes (trim; reject oversized; strip NULs). Notes are optional.
  v_notes := NULLIF(btrim(COALESCE(p_resolution_notes, '')), '');
  IF v_notes IS NOT NULL THEN
    v_notes := replace(v_notes, chr(0), '');
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
        AND assessment_type = 'family'
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
     AND v_lead.lead_type IS DISTINCT FROM 'Family Report Card' THEN
    RAISE EXCEPTION 'CRM_DUP:invalid_assessment'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_assessment
  FROM public.assessments
  WHERE lead_id = v_lead.id
    AND assessment_type = 'family'
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
     OR v_assessment.assessment_type IS DISTINCT FROM 'family' THEN
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

  SELECT count(*)::integer INTO v_task_count
  FROM public.tasks
  WHERE household_id = v_provisional.id
    AND deleted_at IS NULL;

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
    -- Explicitly preserve provenance columns (no promotion)
    assessment_type = 'family',
    capture_channel = 'public_self_report',
    updated_at = v_now
  WHERE id = v_assessment.id
    AND deleted_at IS NULL
    AND lead_id = v_lead.id
    AND capture_channel = 'public_self_report'
    AND assessment_type = 'family';

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
  'Owner-only transactional resolution for public Family Report Card possible matches. Actions: confirm_same_household | keep_separate. Never overwrites canonical contact data, never deletes lead/assessment history, never promotes public_self_report assessments. Provisional households are merged via merged_into_household_id (no hard delete). Abort if provisional has unexpected dependents beyond ingest-created member/lead/assessment.';

REVOKE ALL ON FUNCTION public.resolve_public_family_duplicate_review(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_public_family_duplicate_review(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_public_family_duplicate_review(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_public_family_duplicate_review(uuid, text, text) TO authenticated;

ALTER FUNCTION public.resolve_public_family_duplicate_review(uuid, text, text) OWNER TO postgres;
