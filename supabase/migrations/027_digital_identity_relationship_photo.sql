-- 027_digital_identity_relationship_photo.sql
-- Sprint 5.8 — Optional Relationship Photo after Let's Connect.
--
-- Additive only. Reuses private crm-documents + public.documents.
-- No facial recognition / biometrics / OCR / public buckets / anon storage.
-- Does not modify migrations 020–026 files; updates DI resolve RPC in place via CREATE OR REPLACE.

-- =============================================================================
-- A) Extend public.documents
-- =============================================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads (id) ON DELETE SET NULL;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS source_module text;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS source_submission_id uuid;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS retention_policy text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_source_module_check'
      AND conrelid = 'public.documents'::regclass
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_source_module_check
      CHECK (
        source_module IS NULL
        OR source_module IN (
          'digital_identity',
          'households',
          'documents',
          'initial_financial_diagnostic',
          'system'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_retention_policy_check'
      AND conrelid = 'public.documents'::regclass
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_retention_policy_check
      CHECK (
        retention_policy IS NULL
        OR retention_policy IN (
          'session_only',
          'engagement',
          'seven_years',
          'permanent',
          'module_default'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_relationship_photo_required_fields_check'
      AND conrelid = 'public.documents'::regclass
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_relationship_photo_required_fields_check
      CHECK (
        doc_type IS DISTINCT FROM 'relationship_photo'
        OR (
          household_id IS NOT NULL
          AND lead_id IS NOT NULL
          AND source_module = 'digital_identity'
        )
      );
  END IF;
END $$;

-- visibility already exists as public.document_visibility with advisor_only.

CREATE UNIQUE INDEX IF NOT EXISTS documents_one_active_relationship_photo_per_lead_uidx
  ON public.documents (lead_id)
  WHERE deleted_at IS NULL
    AND doc_type = 'relationship_photo'
    AND lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS documents_lead_id_active_idx
  ON public.documents (lead_id)
  WHERE deleted_at IS NULL AND lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS documents_source_submission_id_active_idx
  ON public.documents (source_submission_id)
  WHERE deleted_at IS NULL AND source_submission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS documents_household_doc_type_active_idx
  ON public.documents (household_id, doc_type)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.documents.lead_id IS
  'Optional lead linkage. Required for relationship_photo rows.';
COMMENT ON COLUMN public.documents.source_module IS
  'Module that created the document metadata (e.g. digital_identity).';
COMMENT ON COLUMN public.documents.source_submission_id IS
  'Public ingest submission UUID when applicable (Let’s Connect).';

-- =============================================================================
-- B) Upload-grant table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.digital_identity_photo_upload_grants (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  token_hash text NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads (id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households (id) ON DELETE CASCADE,
  submission_id uuid NOT NULL,
  purpose text NOT NULL DEFAULT 'relationship_photo',
  status text NOT NULL DEFAULT 'issued',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  document_id uuid REFERENCES public.documents (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT digital_identity_photo_upload_grants_purpose_check
    CHECK (purpose = 'relationship_photo'),
  CONSTRAINT digital_identity_photo_upload_grants_status_check
    CHECK (status IN ('issued', 'processing', 'consumed', 'expired', 'revoked', 'failed')),
  CONSTRAINT digital_identity_photo_upload_grants_token_hash_format_check
    CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT digital_identity_photo_upload_grants_expires_after_created_check
    CHECK (expires_at > created_at),
  CONSTRAINT digital_identity_photo_upload_grants_token_hash_unique UNIQUE (token_hash)
);

CREATE UNIQUE INDEX IF NOT EXISTS digital_identity_photo_upload_grants_live_submission_uidx
  ON public.digital_identity_photo_upload_grants (submission_id)
  WHERE status IN ('issued', 'processing')
    AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS digital_identity_photo_upload_grants_lead_idx
  ON public.digital_identity_photo_upload_grants (lead_id);

CREATE INDEX IF NOT EXISTS digital_identity_photo_upload_grants_expires_idx
  ON public.digital_identity_photo_upload_grants (expires_at)
  WHERE status IN ('issued', 'processing');

DROP TRIGGER IF EXISTS digital_identity_photo_upload_grants_set_updated_at
  ON public.digital_identity_photo_upload_grants;
CREATE TRIGGER digital_identity_photo_upload_grants_set_updated_at
  BEFORE UPDATE ON public.digital_identity_photo_upload_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.digital_identity_photo_upload_grants IS
  'Short-lived opaque upload grants for optional Relationship Photos. Stores token_hash only — never raw tokens, contact fields, or image bytes.';

ALTER TABLE public.digital_identity_photo_upload_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_identity_photo_upload_grants FORCE ROW LEVEL SECURITY;

-- No anon/authenticated policies → denied by default. Service-role bypasses RLS.

REVOKE ALL ON TABLE public.digital_identity_photo_upload_grants FROM PUBLIC;
REVOKE ALL ON TABLE public.digital_identity_photo_upload_grants FROM anon;
REVOKE ALL ON TABLE public.digital_identity_photo_upload_grants FROM authenticated;
GRANT ALL ON TABLE public.digital_identity_photo_upload_grants TO service_role;

-- =============================================================================
-- C) RPCs — issue / consume / soft-delete
-- =============================================================================

CREATE OR REPLACE FUNCTION public.issue_digital_identity_photo_upload_grant(
  p_lead_id uuid,
  p_household_id uuid,
  p_submission_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_lead public.leads;
  v_now timestamptz := now();
  v_expires timestamptz := now() + interval '20 minutes';
  v_raw_token text;
  v_token_hash text;
  v_existing public.digital_identity_photo_upload_grants;
  v_grant_id uuid;
BEGIN
  IF p_lead_id IS NULL OR p_household_id IS NULL OR p_submission_id IS NULL THEN
    RAISE EXCEPTION 'DI_PHOTO:invalid_args'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
    AND deleted_at IS NULL
    AND lead_type = 'Digital Identity'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DI_PHOTO:lead_not_found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_lead.household_id IS DISTINCT FROM p_household_id THEN
    RAISE EXCEPTION 'DI_PHOTO:household_mismatch'
      USING ERRCODE = '22023';
  END IF;

  IF v_lead.public_ingest_idempotency_key IS DISTINCT FROM p_submission_id THEN
    RAISE EXCEPTION 'DI_PHOTO:submission_mismatch'
      USING ERRCODE = '22023';
  END IF;

  -- Reuse a still-valid unused grant for this submission (idempotent).
  SELECT *
  INTO v_existing
  FROM public.digital_identity_photo_upload_grants
  WHERE submission_id = p_submission_id
    AND status = 'issued'
    AND revoked_at IS NULL
    AND expires_at > v_now
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- Cannot return the original raw token; rotate a fresh token on the same row.
    v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
    v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

    UPDATE public.digital_identity_photo_upload_grants
    SET
      token_hash = v_token_hash,
      expires_at = v_expires,
      updated_at = v_now
    WHERE id = v_existing.id;

    RETURN jsonb_build_object(
      'ok', true,
      'upload_token', v_raw_token,
      'expires_at', v_expires,
      'rotated', true
    );
  END IF;

  -- Expire any stale live grants for this submission.
  UPDATE public.digital_identity_photo_upload_grants
  SET
    status = 'expired',
    updated_at = v_now
  WHERE submission_id = p_submission_id
    AND status IN ('issued', 'processing')
    AND expires_at <= v_now;

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

  INSERT INTO public.digital_identity_photo_upload_grants (
    token_hash,
    lead_id,
    household_id,
    submission_id,
    purpose,
    status,
    expires_at
  ) VALUES (
    v_token_hash,
    p_lead_id,
    p_household_id,
    p_submission_id,
    'relationship_photo',
    'issued',
    v_expires
  )
  RETURNING id INTO v_grant_id;

  RETURN jsonb_build_object(
    'ok', true,
    'upload_token', v_raw_token,
    'expires_at', v_expires,
    'rotated', false
  );
END;
$$;

COMMENT ON FUNCTION public.issue_digital_identity_photo_upload_grant(uuid, uuid, uuid) IS
  'Service-role only. Issues a short-lived Relationship Photo upload grant after Let’s Connect persistence. Returns opaque token once; stores SHA-256 hash only. Never returns lead/household ids.';

REVOKE ALL ON FUNCTION public.issue_digital_identity_photo_upload_grant(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_digital_identity_photo_upload_grant(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.issue_digital_identity_photo_upload_grant(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.issue_digital_identity_photo_upload_grant(uuid, uuid, uuid) TO service_role;

ALTER FUNCTION public.issue_digital_identity_photo_upload_grant(uuid, uuid, uuid) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.consume_digital_identity_photo_upload_grant(
  p_token_hash text,
  p_storage_bucket text,
  p_storage_path text,
  p_mime_type text,
  p_byte_size bigint,
  p_replaced boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_grant public.digital_identity_photo_upload_grants;
  v_now timestamptz := now();
  v_doc_id uuid;
  v_prior_ids uuid[];
  v_event text;
  v_title text;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'DI_PHOTO:invalid_token'
      USING ERRCODE = '22023';
  END IF;

  IF p_storage_bucket IS DISTINCT FROM 'crm-documents' THEN
    RAISE EXCEPTION 'DI_PHOTO:invalid_bucket'
      USING ERRCODE = '22023';
  END IF;

  IF p_storage_path IS NULL
     OR p_storage_path !~ '^digital-identity/relationship-photos/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' THEN
    RAISE EXCEPTION 'DI_PHOTO:invalid_path'
      USING ERRCODE = '22023';
  END IF;

  IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp') THEN
    RAISE EXCEPTION 'DI_PHOTO:invalid_mime'
      USING ERRCODE = '22023';
  END IF;

  IF p_byte_size IS NULL OR p_byte_size <= 0 OR p_byte_size > 5242880 THEN
    RAISE EXCEPTION 'DI_PHOTO:invalid_size'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_grant
  FROM public.digital_identity_photo_upload_grants
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DI_PHOTO:invalid_token'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_grant.revoked_at IS NOT NULL OR v_grant.status = 'revoked' THEN
    RAISE EXCEPTION 'DI_PHOTO:revoked'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_grant.status = 'consumed' THEN
    RAISE EXCEPTION 'DI_PHOTO:consumed'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_grant.status = 'failed' THEN
    RAISE EXCEPTION 'DI_PHOTO:failed'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_grant.expires_at <= v_now OR v_grant.status = 'expired' THEN
    UPDATE public.digital_identity_photo_upload_grants
    SET status = 'expired', updated_at = v_now
    WHERE id = v_grant.id
      AND status IS DISTINCT FROM 'expired';
    RAISE EXCEPTION 'DI_PHOTO:expired'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_grant.purpose IS DISTINCT FROM 'relationship_photo' THEN
    RAISE EXCEPTION 'DI_PHOTO:invalid_purpose'
      USING ERRCODE = '22023';
  END IF;

  IF v_grant.status IS DISTINCT FROM 'issued' AND v_grant.status IS DISTINCT FROM 'processing' THEN
    RAISE EXCEPTION 'DI_PHOTO:invalid_status'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.digital_identity_photo_upload_grants
  SET status = 'processing', updated_at = v_now
  WHERE id = v_grant.id;

  SELECT array_agg(id)
  INTO v_prior_ids
  FROM public.documents
  WHERE lead_id = v_grant.lead_id
    AND doc_type = 'relationship_photo'
    AND deleted_at IS NULL;

  IF v_prior_ids IS NOT NULL THEN
    UPDATE public.documents
    SET deleted_at = v_now, updated_at = v_now
    WHERE id = ANY (v_prior_ids)
      AND deleted_at IS NULL;
  END IF;

  INSERT INTO public.documents (
    household_id,
    lead_id,
    uploaded_by_user_id,
    doc_type,
    file_name,
    storage_bucket,
    storage_path,
    mime_type,
    byte_size,
    visibility,
    source_module,
    source_submission_id,
    retention_policy
  ) VALUES (
    v_grant.household_id,
    v_grant.lead_id,
    NULL,
    'relationship_photo',
    'relationship-photo.jpg',
    p_storage_bucket,
    p_storage_path,
    p_mime_type,
    p_byte_size,
    'advisor_only',
    'digital_identity',
    v_grant.submission_id,
    'engagement'
  )
  RETURNING id INTO v_doc_id;

  UPDATE public.digital_identity_photo_upload_grants
  SET
    status = 'consumed',
    consumed_at = v_now,
    document_id = v_doc_id,
    updated_at = v_now
  WHERE id = v_grant.id;

  IF COALESCE(p_replaced, false) OR (v_prior_ids IS NOT NULL AND cardinality(v_prior_ids) > 0) THEN
    v_event := 'digital_identity.relationship_photo_replaced';
    v_title := 'Relationship Photo replaced';
  ELSE
    v_event := 'digital_identity.relationship_photo_added';
    v_title := 'Relationship Photo added';
  END IF;

  PERFORM public.crm_write_activity(
    v_grant.household_id,
    'system',
    v_title,
    'An optional Relationship Photo was saved privately to help the advisor remember where they connected.',
    jsonb_build_object(
      'event', v_event,
      'documentId', v_doc_id,
      'leadId', v_grant.lead_id,
      'source', 'digital_identity_connect'
    ),
    NULL,
    NULL,
    v_grant.lead_id,
    NULL
  );

  RETURN jsonb_build_object(
    'ok', true,
    'document_id', v_doc_id,
    'lead_id', v_grant.lead_id,
    'household_id', v_grant.household_id,
    'replaced_document_ids', COALESCE(to_jsonb(v_prior_ids), '[]'::jsonb),
    'event', v_event
  );
EXCEPTION
  WHEN OTHERS THEN
    IF v_grant.id IS NOT NULL THEN
      UPDATE public.digital_identity_photo_upload_grants
      SET status = 'failed', updated_at = now()
      WHERE id = v_grant.id
        AND status = 'processing';
    END IF;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.consume_digital_identity_photo_upload_grant(text, text, text, text, bigint, boolean) IS
  'Service-role only. Validates upload grant hash and creates/replaces the single active relationship_photo document. Path must be server-shaped. Never stores image bytes.';

REVOKE ALL ON FUNCTION public.consume_digital_identity_photo_upload_grant(text, text, text, text, bigint, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_digital_identity_photo_upload_grant(text, text, text, text, bigint, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.consume_digital_identity_photo_upload_grant(text, text, text, text, bigint, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_digital_identity_photo_upload_grant(text, text, text, text, bigint, boolean) TO service_role;

ALTER FUNCTION public.consume_digital_identity_photo_upload_grant(text, text, text, text, bigint, boolean) OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.soft_delete_digital_identity_relationship_photo(
  p_document_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_doc public.documents;
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'DI_PHOTO:not_authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF p_document_id IS NULL THEN
    RAISE EXCEPTION 'DI_PHOTO:not_found'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT *
  INTO v_doc
  FROM public.documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND OR v_doc.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'DI_PHOTO:not_found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_doc.doc_type IS DISTINCT FROM 'relationship_photo' THEN
    RAISE EXCEPTION 'DI_PHOTO:invalid_type'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (
    public.crm_is_owner()
    OR public.crm_can_access_household(v_doc.household_id)
  ) THEN
    RAISE EXCEPTION 'DI_PHOTO:not_authorized'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.documents
  SET deleted_at = v_now, updated_at = v_now
  WHERE id = v_doc.id
    AND deleted_at IS NULL;

  PERFORM public.crm_write_activity(
    v_doc.household_id,
    'system',
    'Relationship Photo removed',
    'A Relationship Photo was removed from the CRM. The Let’s Connect relationship remains saved.',
    jsonb_build_object(
      'event', 'digital_identity.relationship_photo_removed',
      'documentId', v_doc.id,
      'leadId', v_doc.lead_id,
      'source', 'digital_identity_connect',
      'removedByUserId', v_uid
    ),
    NULL,
    NULL,
    v_doc.lead_id,
    NULL
  );

  RETURN jsonb_build_object(
    'ok', true,
    'document_id', v_doc.id,
    'household_id', v_doc.household_id,
    'lead_id', v_doc.lead_id,
    'storage_bucket', v_doc.storage_bucket,
    'storage_path', v_doc.storage_path
  );
END;
$$;

COMMENT ON FUNCTION public.soft_delete_digital_identity_relationship_photo(uuid) IS
  'Owner or assigned-household advisor soft-deletes a Relationship Photo. Returns storage coordinates for server cleanup. Lead/relationship history is preserved.';

REVOKE ALL ON FUNCTION public.soft_delete_digital_identity_relationship_photo(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete_digital_identity_relationship_photo(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_digital_identity_relationship_photo(uuid) TO authenticated;

ALTER FUNCTION public.soft_delete_digital_identity_relationship_photo(uuid) OWNER TO postgres;

-- =============================================================================
-- D) Digital Identity duplicate resolution — expected relationship_photo dependent
-- =============================================================================

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

  IF v_lead.lead_type IS DISTINCT FROM 'Digital Identity'
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
