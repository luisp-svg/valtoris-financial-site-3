-- 053_bulk_lead_import_writer.sql
-- Owner-only transactional import of ONE canonical consumer identity.
-- CRM-dev writer for batch bulk_lead_import_2026_leads_crm_v1.
--
-- Also replaces archive_intake_lead so lead_type = 'Bulk Lead Import' uses the
-- existing Intake archive workflow. Every 052 security, grant, and
-- activity-before-deleted_at ordering protection is preserved. The only
-- semantic change is adding Bulk Lead Import to the Intake lead-type allowlist.
--
-- Creates ZERO tables, columns, indexes, triggers, and RLS policies.
-- Does not alter Recruiting, Policy Production, Opportunities, or Commissions.
-- Does not weaken RLS. Does not grant anon execute.
-- Does not write Opportunities, Policies, Cases, Commissions, assessments,
-- tasks, or Activities on import. Does not assign advisors. Does not set consent facts.
--
-- Authorization: authenticated caller + pp_assert_owner() inside the RPC.
-- Identity locks reuse public.quick_add_acquire_identity_locks.
-- Matching re-runs the Family Report Card classifyMatch semantics in SQL.

CREATE OR REPLACE FUNCTION public.bulk_lead_import_collect_candidates(
  p_email extensions.citext,
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_map jsonb := '{}'::jsonb;
  v_hh record;
  v_mem record;
  v_id text;
  v_existing jsonb;
  v_display text;
BEGIN
  IF p_email IS NULL AND p_phone IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR v_hh IN
    SELECT h.id, h.display_name, h.normalized_email, h.normalized_phone
    FROM public.households h
    WHERE h.deleted_at IS NULL
      AND h.merged_into_household_id IS NULL
      AND (
        (p_email IS NOT NULL AND h.normalized_email IS NOT DISTINCT FROM p_email)
        OR (p_phone IS NOT NULL AND h.normalized_phone IS NOT DISTINCT FROM p_phone)
      )
    ORDER BY h.id
  LOOP
    v_map := v_map || jsonb_build_object(
      v_hh.id::text,
      jsonb_build_object(
        'household_id', v_hh.id,
        'display_name', v_hh.display_name,
        'normalized_email', v_hh.normalized_email,
        'normalized_phone', v_hh.normalized_phone,
        'first_name', NULL,
        'last_name', NULL,
        'source', 'household',
        'member_id', NULL
      )
    );
  END LOOP;

  FOR v_mem IN
    SELECT
      m.id,
      m.household_id,
      m.first_name,
      m.last_name,
      m.normalized_email,
      m.normalized_phone,
      m.is_primary_contact
    FROM public.household_members m
    JOIN public.households h ON h.id = m.household_id
    WHERE m.deleted_at IS NULL
      AND h.deleted_at IS NULL
      AND h.merged_into_household_id IS NULL
      AND (
        (p_email IS NOT NULL AND m.normalized_email IS NOT DISTINCT FROM p_email)
        OR (p_phone IS NOT NULL AND m.normalized_phone IS NOT DISTINCT FROM p_phone)
      )
    ORDER BY m.household_id, m.is_primary_contact DESC NULLS LAST, m.id
  LOOP
    v_id := v_mem.household_id::text;
    IF NOT (v_map ? v_id) THEN
      v_display := NULLIF(btrim(COALESCE(v_mem.first_name, '') || ' ' || COALESCE(v_mem.last_name, '')), '');
      v_map := v_map || jsonb_build_object(
        v_id,
        jsonb_build_object(
          'household_id', v_mem.household_id,
          'display_name', v_display,
          'normalized_email', v_mem.normalized_email,
          'normalized_phone', v_mem.normalized_phone,
          'first_name', v_mem.first_name,
          'last_name', v_mem.last_name,
          'source', 'member',
          'member_id', v_mem.id
        )
      );
    ELSE
      v_existing := v_map -> v_id;
      IF (v_existing ->> 'first_name') IS NULL OR COALESCE(v_mem.is_primary_contact, false) THEN
        v_existing := v_existing || jsonb_build_object(
          'first_name', COALESCE(v_mem.first_name, v_existing ->> 'first_name'),
          'last_name', COALESCE(v_mem.last_name, v_existing ->> 'last_name'),
          'member_id', v_mem.id
        );
        v_map := v_map || jsonb_build_object(v_id, v_existing);
      END IF;
    END IF;
  END LOOP;

  FOR v_mem IN
    SELECT m.household_id, m.first_name, m.last_name
    FROM public.household_members m
    WHERE m.deleted_at IS NULL
      AND m.is_primary_contact = true
      AND m.household_id IN (
        SELECT key::uuid FROM jsonb_object_keys(v_map) AS key
      )
  LOOP
    v_id := v_mem.household_id::text;
    v_existing := v_map -> v_id;
    IF v_existing ->> 'source' = 'household' AND (v_existing ->> 'first_name') IS NULL THEN
      v_existing := v_existing || jsonb_build_object(
        'first_name', v_mem.first_name,
        'last_name', v_mem.last_name
      );
      v_map := v_map || jsonb_build_object(v_id, v_existing);
    END IF;
  END LOOP;

  RETURN COALESCE((
    SELECT jsonb_agg(value ORDER BY value ->> 'household_id')
    FROM jsonb_each(v_map)
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_lead_import_classify_match(
  p_email extensions.citext,
  p_phone text,
  p_first_name text,
  p_last_name text,
  p_candidates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_active jsonb := '[]'::jsonb;
  v_exact jsonb := '[]'::jsonb;
  v_email_matches jsonb := '[]'::jsonb;
  v_phone_matches jsonb := '[]'::jsonb;
  v_candidate jsonb;
  v_first text := lower(btrim(COALESCE(p_first_name, '')));
  v_last text := lower(btrim(COALESCE(p_last_name, '')));
  v_c_first text;
  v_c_last text;
  v_name_conflict boolean;
  v_households text[];
  v_reason text;
  v_primary jsonb;
BEGIN
  IF p_candidates IS NULL OR jsonb_typeof(p_candidates) <> 'array' THEN
    p_candidates := '[]'::jsonb;
  END IF;

  FOR v_candidate IN SELECT value FROM jsonb_array_elements(p_candidates)
  LOOP
    v_active := v_active || jsonb_build_array(v_candidate);
  END LOOP;

  IF jsonb_array_length(v_active) = 0 THEN
    RETURN jsonb_build_object(
      'status', 'new_prospect',
      'match_reason', 'no_candidates_found',
      'match_confidence', 'high',
      'candidates_considered', 0,
      'household_id', NULL
    );
  END IF;

  FOR v_candidate IN SELECT value FROM jsonb_array_elements(v_active)
  LOOP
    IF p_email IS NOT NULL
       AND p_phone IS NOT NULL
       AND lower(btrim(COALESCE(v_candidate ->> 'normalized_email', ''))) = lower(p_email::text)
       AND btrim(COALESCE(v_candidate ->> 'normalized_phone', '')) = p_phone THEN
      v_exact := v_exact || jsonb_build_array(v_candidate);
    END IF;
  END LOOP;

  IF jsonb_array_length(v_exact) > 0 THEN
    SELECT array_agg(DISTINCT value ->> 'household_id')
      INTO v_households
    FROM jsonb_array_elements(v_exact);

    IF coalesce(array_length(v_households, 1), 0) > 1 THEN
      RETURN jsonb_build_object(
        'status', 'possible_match',
        'match_reason', 'multiple_exact_contact_matches',
        'match_confidence', 'medium',
        'candidates_considered', jsonb_array_length(v_active),
        'household_id', (v_exact -> 0 ->> 'household_id')::uuid
      );
    END IF;

    v_candidate := v_exact -> 0;
    v_c_first := lower(btrim(COALESCE(v_candidate ->> 'first_name', '')));
    v_c_last := lower(btrim(COALESCE(v_candidate ->> 'last_name', '')));
    v_name_conflict := (
      v_c_first <> ''
      AND v_c_last <> ''
      AND v_c_first IS DISTINCT FROM v_first
      AND v_c_last IS DISTINCT FROM v_last
    );
    IF v_name_conflict THEN
      RETURN jsonb_build_object(
        'status', 'possible_match',
        'match_reason', 'exact_contact_name_conflict',
        'match_confidence', 'medium',
        'candidates_considered', jsonb_array_length(v_active),
        'household_id', (v_candidate ->> 'household_id')::uuid
      );
    END IF;

    RETURN jsonb_build_object(
      'status', 'exact_trusted_match',
      'match_reason', 'email_and_phone_match',
      'match_confidence', 'high',
      'candidates_considered', jsonb_array_length(v_active),
      'household_id', (v_candidate ->> 'household_id')::uuid
    );
  END IF;

  FOR v_candidate IN SELECT value FROM jsonb_array_elements(v_active)
  LOOP
    IF p_email IS NOT NULL
       AND lower(btrim(COALESCE(v_candidate ->> 'normalized_email', ''))) = lower(p_email::text) THEN
      v_email_matches := v_email_matches || jsonb_build_array(v_candidate);
    END IF;
    IF p_phone IS NOT NULL
       AND btrim(COALESCE(v_candidate ->> 'normalized_phone', '')) = p_phone THEN
      v_phone_matches := v_phone_matches || jsonb_build_array(v_candidate);
    END IF;
  END LOOP;

  IF jsonb_array_length(v_email_matches) > 0 OR jsonb_array_length(v_phone_matches) > 0 THEN
    SELECT array_agg(DISTINCT hid)
      INTO v_households
    FROM (
      SELECT value ->> 'household_id' AS hid FROM jsonb_array_elements(v_email_matches)
      UNION
      SELECT value ->> 'household_id' FROM jsonb_array_elements(v_phone_matches)
    ) s;

    v_primary := CASE
      WHEN jsonb_array_length(v_email_matches) > 0 THEN v_email_matches -> 0
      ELSE v_phone_matches -> 0
    END;

    IF coalesce(array_length(v_households, 1), 0) > 1 THEN
      v_reason := 'multiple_partial_contact_matches';
    ELSIF jsonb_array_length(v_email_matches) > 0 AND jsonb_array_length(v_phone_matches) > 0 THEN
      v_reason := 'email_and_phone_partial_match';
    ELSIF jsonb_array_length(v_email_matches) > 0 THEN
      v_reason := 'email_only_match';
    ELSE
      v_reason := 'phone_only_match';
    END IF;

    RETURN jsonb_build_object(
      'status', 'possible_match',
      'match_reason', v_reason,
      'match_confidence', 'low',
      'candidates_considered', jsonb_array_length(v_active),
      'household_id', (v_primary ->> 'household_id')::uuid
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'possible_match',
    'match_reason', 'unclassified_candidate_overlap',
    'match_confidence', 'low',
    'candidates_considered', jsonb_array_length(v_active),
    'household_id', (v_active -> 0 ->> 'household_id')::uuid
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.import_bulk_lead_consumer(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed_keys text[] := ARRAY[
    'import_batch_id',
    'source_workbook',
    'source_sheet',
    'canonical_source_row',
    'all_source_rows',
    'first_name',
    'last_name',
    'middle_name',
    'raw_phone',
    'raw_email',
    'city',
    'state',
    'source_tag',
    'duplicate_type',
    'duplicate_group',
    'ruleset_version',
    'raw_payload'
  ];
  v_forbidden_keys text[] := ARRAY[
    'assigned_advisor_id',
    'original_advisor_id',
    'consent_snapshot',
    'contact_permission',
    'email_marketing_consent',
    'sms_marketing_consent',
    'consent_version',
    'consented_at',
    'pipeline_id',
    'relationship_pipeline_id',
    'stage_id',
    'relationship_stage_id',
    'lead_type',
    'lead_source',
    'status',
    'household_id',
    'household_status',
    'matched_household_id',
    'candidate_household_id'
  ];
  v_batch_id text := 'bulk_lead_import_2026_leads_crm_v1';
  v_workbook text := '2026 leads crm';
  v_sheet text := 'Leads';
  v_lead_type text := 'Bulk Lead Import';
  v_lead_source text := 'bulk_lead_import_2026_leads_crm';
  v_source_page text := 'bulk_import:2026_leads_crm:Leads';
  v_pipeline_id uuid := '22222222-2222-2222-2222-222222222201'::uuid;
  v_stage_id uuid := '33333333-3333-3333-3333-333333333001'::uuid;
  v_now timestamptz := now();
  v_first text;
  v_last text;
  v_middle text;
  v_email_raw text;
  v_phone_raw text;
  v_email extensions.citext;
  v_phone text;
  v_city text;
  v_state text;
  v_tag text;
  v_canonical integer;
  v_all_rows jsonb;
  v_row_ref text;
  v_lock_key text;
  v_existing public.leads;
  v_candidates jsonb;
  v_class jsonb;
  v_match_status text;
  v_match_reason text;
  v_match_confidence text;
  v_matched_household_id uuid;
  v_household_id uuid;
  v_member_id uuid;
  v_lead_id uuid;
  v_duplicate_review_id uuid;
  v_lead_status public.lead_status;
  v_metadata jsonb;
  v_raw jsonb;
  v_display text;
  v_created boolean := false;
BEGIN
  PERFORM public.pp_assert_owner();
  PERFORM public.pp_assert_payload_size(p_payload);

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_payload) AS k
    WHERE k = ANY (v_forbidden_keys)
  ) THEN
    RAISE EXCEPTION 'BULK_IMPORT:protected_field' USING ERRCODE = '22023';
  END IF;

  PERFORM public.pp_assert_object_keys(p_payload, v_allowed_keys, 'invalid_payload');

  IF NULLIF(btrim(COALESCE(p_payload ->> 'import_batch_id', '')), '') IS DISTINCT FROM v_batch_id
     OR NULLIF(btrim(COALESCE(p_payload ->> 'source_workbook', '')), '') IS DISTINCT FROM v_workbook
     OR NULLIF(btrim(COALESCE(p_payload ->> 'source_sheet', '')), '') IS DISTINCT FROM v_sheet THEN
    RAISE EXCEPTION 'BULK_IMPORT:unsupported_batch' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_canonical := (p_payload ->> 'canonical_source_row')::integer;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'BULK_IMPORT:invalid_payload' USING ERRCODE = '22023';
  END;
  IF v_canonical IS NULL OR v_canonical < 1 THEN
    RAISE EXCEPTION 'BULK_IMPORT:invalid_payload' USING ERRCODE = '22023';
  END IF;

  v_all_rows := p_payload -> 'all_source_rows';
  IF v_all_rows IS NULL OR jsonb_typeof(v_all_rows) <> 'array' OR jsonb_array_length(v_all_rows) < 1 THEN
    RAISE EXCEPTION 'BULK_IMPORT:invalid_payload' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_all_rows) AS elem
    WHERE elem::text = v_canonical::text
       OR elem::text = ('"' || v_canonical::text || '"')
  ) THEN
    -- Accept numeric or string encodings of the canonical row.
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_all_rows) AS elem
      WHERE elem = v_canonical::text
    ) THEN
      RAISE EXCEPTION 'BULK_IMPORT:invalid_payload' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_first := NULLIF(btrim(COALESCE(p_payload ->> 'first_name', '')), '');
  v_last := NULLIF(btrim(COALESCE(p_payload ->> 'last_name', '')), '');
  IF v_last IS NULL THEN
    RAISE EXCEPTION 'BULK_IMPORT:missing_last_name' USING ERRCODE = '22023';
  END IF;
  IF v_first IS NULL
     OR char_length(v_first) > 100
     OR char_length(v_last) > 100 THEN
    RAISE EXCEPTION 'BULK_IMPORT:invalid_name' USING ERRCODE = '22023';
  END IF;
  v_middle := NULLIF(btrim(COALESCE(p_payload ->> 'middle_name', '')), '');
  IF v_middle IS NOT NULL AND char_length(v_middle) > 100 THEN
    RAISE EXCEPTION 'BULK_IMPORT:invalid_payload' USING ERRCODE = '22023';
  END IF;

  v_email_raw := NULLIF(btrim(COALESCE(p_payload ->> 'raw_email', '')), '');
  v_phone_raw := NULLIF(btrim(COALESCE(p_payload ->> 'raw_phone', '')), '');
  IF v_email_raw IS NOT NULL AND v_email_raw !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'BULK_IMPORT:malformed_contact' USING ERRCODE = '22023';
  END IF;
  v_email := public.crm_normalize_quick_add_email(v_email_raw);
  v_phone := public.crm_normalize_quick_add_phone(v_phone_raw);
  IF v_email IS NULL AND v_phone IS NULL THEN
    RAISE EXCEPTION 'BULK_IMPORT:malformed_contact' USING ERRCODE = '22023';
  END IF;

  v_city := NULLIF(btrim(COALESCE(p_payload ->> 'city', '')), '');
  v_state := NULLIF(btrim(COALESCE(p_payload ->> 'state', '')), '');
  IF v_state IS NOT NULL THEN
    v_state := upper(v_state);
    IF v_state !~ '^[A-Z]{2}$' THEN
      RAISE EXCEPTION 'BULK_IMPORT:invalid_state' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF (v_city IS NOT NULL AND char_length(v_city) > 100)
     OR (v_state IS NOT NULL AND char_length(v_state) > 50) THEN
    RAISE EXCEPTION 'BULK_IMPORT:invalid_payload' USING ERRCODE = '22023';
  END IF;

  v_tag := NULLIF(btrim(COALESCE(p_payload ->> 'source_tag', '')), '');
  v_row_ref := '2026_leads_crm:Leads:' || v_canonical::text;
  v_lock_key := 'bulk_import_row:' || v_batch_id || ':' || v_row_ref;

  PERFORM pg_advisory_xact_lock(hashtext(v_lock_key));
  PERFORM public.quick_add_acquire_identity_locks(v_email, v_phone);

  SELECT *
    INTO v_existing
  FROM public.leads l
  WHERE l.deleted_at IS NULL
    AND l.external_sheet_row_ref = v_row_ref
    AND l.original_source_metadata ->> 'import_batch_id' = v_batch_id
  ORDER BY l.created_at ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'created', false,
      'outcome', 'already_exists',
      'match_status', COALESCE(v_existing.ingest_match_status, 'new_prospect'),
      'household_id', v_existing.household_id,
      'member_id', NULL,
      'lead_id', v_existing.id,
      'duplicate_review_id', NULL,
      'external_sheet_row_ref', v_row_ref,
      'import_batch_id', v_batch_id
    );
  END IF;

  v_candidates := public.bulk_lead_import_collect_candidates(v_email, v_phone);
  v_class := public.bulk_lead_import_classify_match(v_email, v_phone, v_first, v_last, v_candidates);
  v_match_status := v_class ->> 'status';
  v_match_reason := v_class ->> 'match_reason';
  v_match_confidence := v_class ->> 'match_confidence';
  v_matched_household_id := NULLIF(v_class ->> 'household_id', '')::uuid;

  v_metadata := jsonb_build_object(
    'import_batch_id', v_batch_id,
    'import_version', 'v1',
    'source_workbook', v_workbook,
    'source_sheet', v_sheet,
    'canonical_source_row', v_canonical,
    'all_source_rows', v_all_rows,
    'source_duplicate_type', NULLIF(btrim(COALESCE(p_payload ->> 'duplicate_type', '')), ''),
    'source_duplicate_group', NULLIF(btrim(COALESCE(p_payload ->> 'duplicate_group', '')), ''),
    'source_tag', v_tag,
    'imported_at', v_now,
    'ruleset', COALESCE(NULLIF(btrim(COALESCE(p_payload ->> 'ruleset_version', '')), ''), 'phase_c_consumer_v1')
  );

  v_raw := COALESCE(p_payload -> 'raw_payload', '{}'::jsonb);
  IF jsonb_typeof(v_raw) <> 'object' THEN
    RAISE EXCEPTION 'BULK_IMPORT:invalid_payload' USING ERRCODE = '22023';
  END IF;
  v_raw := v_raw || jsonb_build_object(
    'first_name', v_first,
    'middle_name', v_middle,
    'last_name', v_last,
    'raw_email', v_email_raw,
    'raw_phone', v_phone_raw,
    'city', v_city,
    'state', v_state,
    'source_tag', v_tag,
    'canonical_source_row', v_canonical,
    'all_source_rows', v_all_rows
  );

  IF v_match_status = 'exact_trusted_match' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'created', false,
      'outcome', 'already_exists',
      'match_status', 'exact_trusted_match',
      'match_reason', v_match_reason,
      'household_id', v_matched_household_id,
      'member_id', NULL,
      'lead_id', NULL,
      'duplicate_review_id', NULL,
      'external_sheet_row_ref', v_row_ref,
      'import_batch_id', v_batch_id
    );
  END IF;

  v_display := btrim(v_first || ' ' || v_last);
  v_lead_status := CASE
    WHEN v_match_status = 'possible_match' THEN 'duplicate_review'::public.lead_status
    ELSE 'unassigned'::public.lead_status
  END;

  INSERT INTO public.households (
    display_name,
    status,
    primary_email,
    normalized_email,
    primary_phone,
    normalized_phone,
    city,
    state,
    relationship_pipeline_id,
    relationship_stage_id,
    stage_entered_at,
    lead_source,
    original_source_metadata,
    external_sheet_row_ref,
    potential_duplicate_of,
    duplicate_review_status,
    created_by_user_id
  ) VALUES (
    v_display,
    'lead',
    v_email_raw,
    v_email,
    v_phone_raw,
    v_phone,
    v_city,
    v_state,
    v_pipeline_id,
    v_stage_id,
    v_now,
    v_lead_source,
    v_metadata,
    v_row_ref,
    CASE WHEN v_match_status = 'possible_match' THEN v_matched_household_id ELSE NULL END,
    CASE
      WHEN v_match_status = 'possible_match' THEN 'pending'::public.duplicate_review_status
      ELSE 'none'::public.duplicate_review_status
    END,
    v_uid
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
    v_first,
    v_last,
    'primary',
    true,
    v_email_raw,
    v_email,
    v_phone_raw,
    v_phone
  )
  RETURNING id INTO v_member_id;

  INSERT INTO public.leads (
    household_id,
    lead_type,
    status,
    assessment_type,
    source_page,
    submitted_at,
    attribution_method,
    original_source_metadata,
    raw_payload,
    normalized_email,
    normalized_phone,
    potential_duplicate_of_household_id,
    duplicate_review_status,
    external_sheet_row_ref,
    public_ingest_idempotency_key,
    sheets_sync_status,
    consent_snapshot,
    ingest_match_status,
    created_by_user_id
  ) VALUES (
    v_household_id,
    v_lead_type,
    v_lead_status,
    NULL,
    v_source_page,
    v_now,
    'unknown',
    v_metadata,
    v_raw,
    v_email,
    v_phone,
    CASE WHEN v_match_status = 'possible_match' THEN v_matched_household_id ELSE NULL END,
    CASE
      WHEN v_match_status = 'possible_match' THEN 'pending'::public.duplicate_review_status
      ELSE 'none'::public.duplicate_review_status
    END,
    v_row_ref,
    NULL,
    'skipped',
    '{}'::jsonb,
    v_match_status,
    v_uid
  )
  RETURNING id INTO v_lead_id;

  IF v_match_status = 'possible_match' AND v_matched_household_id IS NOT NULL THEN
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
      v_matched_household_id,
      v_household_id,
      COALESCE(v_match_reason, 'possible_contact_match'),
      COALESCE(v_match_confidence, 'medium'),
      'pending',
      v_raw
    )
    RETURNING id INTO v_duplicate_review_id;
  END IF;

  v_created := true;

  RETURN jsonb_build_object(
    'ok', true,
    'created', v_created,
    'outcome', CASE
      WHEN v_match_status = 'possible_match' THEN 'review_required'
      ELSE 'created'
    END,
    'match_status', v_match_status,
    'match_reason', v_match_reason,
    'household_id', v_household_id,
    'member_id', v_member_id,
    'lead_id', v_lead_id,
    'duplicate_review_id', v_duplicate_review_id,
    'external_sheet_row_ref', v_row_ref,
    'import_batch_id', v_batch_id
  );
END;
$$;

ALTER FUNCTION public.bulk_lead_import_collect_candidates(extensions.citext, text) OWNER TO postgres;
ALTER FUNCTION public.bulk_lead_import_classify_match(extensions.citext, text, text, text, jsonb) OWNER TO postgres;
ALTER FUNCTION public.import_bulk_lead_consumer(jsonb) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.bulk_lead_import_collect_candidates(extensions.citext, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bulk_lead_import_classify_match(extensions.citext, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.import_bulk_lead_consumer(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_bulk_lead_consumer(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.import_bulk_lead_consumer(jsonb) TO authenticated;

COMMENT ON FUNCTION public.import_bulk_lead_consumer(jsonb) IS
  'Owner-only transactional import of one bulk-lead consumer identity. No advisor assignment, consent facts, Opportunities, or Activities.';

-- =============================================================================
-- Intake archive allowlist: add Bulk Lead Import only
-- Preserves Migration 052 activity-before-deleted_at ordering and grants.
-- =============================================================================

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
    'Bulk Lead Import'
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
