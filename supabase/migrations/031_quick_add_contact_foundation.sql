-- 031_quick_add_contact_foundation.sql
-- Quick Add Contact Phase Q1A — hardened backend foundation.
--
-- Typed fields, purpose-bound duplicate tokens, SECURITY DEFINER RPCs, and
-- Manual Contact integrity triggers (crm.rpc_context gated).
--
-- RPCs:
--   preview_quick_add_contact_duplicates(jsonb)
--   quick_add_contact(jsonb, text, text)
--   update_manual_contact(uuid, jsonb)
--
-- Does NOT: Contacts UI, Activity expansion, campaign/event selection,
-- task-completion workflows, policy-production modules, image processing,
-- automatic messaging, or Migration 032. Does not apply remotely.

-- =============================================================================
-- SECTION A — Enum + typed columns + DB constraints
-- =============================================================================

DO $$
BEGIN
  CREATE TYPE public.contact_category AS ENUM (
    'potential_client',
    'referral_partner',
    'professional_partner',
    'vendor',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.household_members
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS website text;

ALTER TABLE public.household_members
  DROP CONSTRAINT IF EXISTS household_members_company_len_check;
ALTER TABLE public.household_members
  ADD CONSTRAINT household_members_company_len_check
  CHECK (company IS NULL OR char_length(company) <= 200);

ALTER TABLE public.household_members
  DROP CONSTRAINT IF EXISTS household_members_company_trimmed_check;
ALTER TABLE public.household_members
  ADD CONSTRAINT household_members_company_trimmed_check
  CHECK (company IS NULL OR company = btrim(company));

ALTER TABLE public.household_members
  DROP CONSTRAINT IF EXISTS household_members_job_title_len_check;
ALTER TABLE public.household_members
  ADD CONSTRAINT household_members_job_title_len_check
  CHECK (job_title IS NULL OR char_length(job_title) <= 200);

ALTER TABLE public.household_members
  DROP CONSTRAINT IF EXISTS household_members_job_title_trimmed_check;
ALTER TABLE public.household_members
  ADD CONSTRAINT household_members_job_title_trimmed_check
  CHECK (job_title IS NULL OR job_title = btrim(job_title));

ALTER TABLE public.household_members
  DROP CONSTRAINT IF EXISTS household_members_website_len_check;
ALTER TABLE public.household_members
  ADD CONSTRAINT household_members_website_len_check
  CHECK (website IS NULL OR char_length(website) <= 500);

ALTER TABLE public.household_members
  DROP CONSTRAINT IF EXISTS household_members_website_trimmed_check;
ALTER TABLE public.household_members
  ADD CONSTRAINT household_members_website_trimmed_check
  CHECK (website IS NULL OR website = btrim(website));

ALTER TABLE public.household_members
  DROP CONSTRAINT IF EXISTS household_members_website_scheme_check;
ALTER TABLE public.household_members
  ADD CONSTRAINT household_members_website_scheme_check
  CHECK (
    website IS NULL
    OR website ~* '^https?://[^\s/$.?#].[^\s]*$'
  );

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS contact_category public.contact_category,
  ADD COLUMN IF NOT EXISTS how_we_met text,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_how_we_met_len_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_how_we_met_len_check
  CHECK (how_we_met IS NULL OR char_length(how_we_met) <= 500);

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_how_we_met_trimmed_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_how_we_met_trimmed_check
  CHECK (how_we_met IS NULL OR how_we_met = btrim(how_we_met));

COMMENT ON COLUMN public.household_members.company IS
  'Employer / affiliation for the person (Quick Add). Not business_name.';
COMMENT ON COLUMN public.household_members.job_title IS
  'Job title for the person (Quick Add).';
COMMENT ON COLUMN public.household_members.website IS
  'Professional http(s) website for the person (Quick Add).';
COMMENT ON COLUMN public.leads.contact_category IS
  'Taxonomy only for Manual Contact leads. Does not drive household.status.';
COMMENT ON COLUMN public.leads.how_we_met IS
  'Free-text capture provenance for Manual Contact leads.';
COMMENT ON COLUMN public.leads.created_by_user_id IS
  'Server-set Manual Contact creator. Immutable. Does not grant access.';

-- =============================================================================
-- SECTION B — Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS leads_normalized_phone_idx
  ON public.leads (normalized_phone)
  WHERE deleted_at IS NULL AND normalized_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS household_members_company_lower_idx
  ON public.household_members (lower(company))
  WHERE deleted_at IS NULL AND company IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_manual_contact_category_idx
  ON public.leads (contact_category, submitted_at DESC)
  WHERE deleted_at IS NULL AND lead_type = 'Manual Contact';

CREATE INDEX IF NOT EXISTS leads_created_by_user_id_idx
  ON public.leads (created_by_user_id)
  WHERE deleted_at IS NULL AND created_by_user_id IS NOT NULL;

-- =============================================================================
-- SECTION C — Purpose-bound duplicate tokens
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.quick_add_duplicate_tokens (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  operation text NOT NULL,
  subject_lead_id uuid REFERENCES public.leads (id) ON DELETE CASCADE,
  subject_household_id uuid REFERENCES public.households (id) ON DELETE CASCADE,
  payload_fingerprint text NOT NULL,
  subject_fingerprint text,
  acknowledged jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quick_add_duplicate_tokens_token_hash_unique UNIQUE (token_hash),
  CONSTRAINT quick_add_duplicate_tokens_token_hash_sha256_check
    CHECK (char_length(token_hash) = 64 AND token_hash ~ '^[0-9a-f]+$'),
  CONSTRAINT quick_add_duplicate_tokens_fingerprint_len_check
    CHECK (char_length(payload_fingerprint) = 64 AND payload_fingerprint ~ '^[0-9a-f]+$'),
  CONSTRAINT quick_add_duplicate_tokens_subject_fingerprint_len_check
    CHECK (
      subject_fingerprint IS NULL
      OR (char_length(subject_fingerprint) = 64 AND subject_fingerprint ~ '^[0-9a-f]+$')
    ),
  CONSTRAINT quick_add_duplicate_tokens_acknowledged_object_check
    CHECK (jsonb_typeof(acknowledged) = 'object'),
  CONSTRAINT quick_add_duplicate_tokens_operation_check
    CHECK (operation IN ('create', 'update')),
  CONSTRAINT quick_add_duplicate_tokens_subject_check
    CHECK (
      (operation = 'create' AND subject_lead_id IS NULL AND subject_household_id IS NULL AND subject_fingerprint IS NULL)
      OR (operation = 'update' AND subject_lead_id IS NOT NULL AND subject_household_id IS NOT NULL AND subject_fingerprint IS NOT NULL)
    ),
  CONSTRAINT quick_add_duplicate_tokens_expires_after_created_check
    CHECK (expires_at > created_at),
  CONSTRAINT quick_add_duplicate_tokens_consumed_valid_check
    CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE INDEX IF NOT EXISTS quick_add_duplicate_tokens_actor_expires_idx
  ON public.quick_add_duplicate_tokens (actor_user_id, expires_at)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS quick_add_duplicate_tokens_expires_idx
  ON public.quick_add_duplicate_tokens (expires_at);

CREATE INDEX IF NOT EXISTS quick_add_duplicate_tokens_operation_subject_idx
  ON public.quick_add_duplicate_tokens (operation, subject_lead_id)
  WHERE consumed_at IS NULL;

COMMENT ON TABLE public.quick_add_duplicate_tokens IS
  'Ephemeral Quick Add create/update confirmations. token_hash only; purpose-bound; no PII.';

ALTER TABLE public.quick_add_duplicate_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_add_duplicate_tokens FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.quick_add_duplicate_tokens FROM PUBLIC;
REVOKE ALL ON TABLE public.quick_add_duplicate_tokens FROM anon;
REVOKE ALL ON TABLE public.quick_add_duplicate_tokens FROM authenticated;
GRANT ALL ON TABLE public.quick_add_duplicate_tokens TO service_role;

-- =============================================================================
-- SECTION D — Internal helpers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.crm_normalize_quick_add_email(p_value text)
RETURNS extensions.citext
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT NULLIF(lower(btrim(COALESCE(p_value, ''))), '')::extensions.citext;
$$;

CREATE OR REPLACE FUNCTION public.crm_normalize_quick_add_phone(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_trimmed text := btrim(COALESCE(p_value, ''));
  v_digits text;
BEGIN
  IF v_trimmed = '' THEN RETURN NULL; END IF;
  v_digits := regexp_replace(v_trimmed, '\D', '', 'g');
  IF v_digits = '' THEN RETURN NULL; END IF;
  IF char_length(v_digits) = 10 THEN RETURN '+1' || v_digits; END IF;
  IF char_length(v_digits) = 11 AND left(v_digits, 1) = '1' THEN RETURN '+' || v_digits; END IF;
  IF left(v_trimmed, 1) = '+' AND char_length(v_digits) >= 8 THEN RETURN '+' || v_digits; END IF;
  IF char_length(v_digits) > 11 THEN RETURN '+' || v_digits; END IF;
  RETURN v_digits;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_normalize_quick_add_company(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT NULLIF(btrim(COALESCE(p_value, '')), '');
$$;

CREATE OR REPLACE FUNCTION public.quick_add_is_safe_website(p_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    p_value IS NULL
    OR (
      char_length(p_value) <= 500
      AND p_value = btrim(p_value)
      AND p_value ~* '^https?://[^\s/$.?#].[^\s]*$'
    );
$$;

CREATE OR REPLACE FUNCTION public.quick_add_mask_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT CASE
    WHEN p_email IS NULL OR position('@' IN p_email) = 0 THEN NULL
    WHEN char_length(split_part(p_email, '@', 1)) <= 1 THEN '*@' || split_part(p_email, '@', 2)
    ELSE left(split_part(p_email, '@', 1), 1) || '***@' || split_part(p_email, '@', 2)
  END;
$$;

CREATE OR REPLACE FUNCTION public.quick_add_mask_phone(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT CASE
    WHEN p_phone IS NULL OR char_length(p_phone) < 4 THEN NULL
    ELSE '***-***-' || right(regexp_replace(p_phone, '\D', '', 'g'), 4)
  END;
$$;

CREATE OR REPLACE FUNCTION public.quick_add_payload_fingerprint(
  p_normalized_email extensions.citext,
  p_normalized_phone text,
  p_first_name text,
  p_last_name text,
  p_company text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT encode(
    extensions.digest(
      concat_ws(
        '|',
        lower(COALESCE(p_normalized_email::text, '')),
        COALESCE(p_normalized_phone, ''),
        lower(btrim(COALESCE(p_first_name, ''))),
        lower(btrim(COALESCE(p_last_name, ''))),
        lower(COALESCE(public.crm_normalize_quick_add_company(p_company), ''))
      ),
      'sha256'
    ),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION public.quick_add_assert_object_keys(
  p_obj jsonb,
  p_allowed text[]
)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_key text;
BEGIN
  IF p_obj IS NULL OR jsonb_typeof(p_obj) <> 'object' THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_payload' USING ERRCODE = '22023';
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_obj)
  LOOP
    IF NOT (v_key = ANY (p_allowed)) THEN
      RAISE EXCEPTION 'QUICK_ADD:invalid_payload' USING ERRCODE = '22023';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_add_assert_payload_size(p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_payload' USING ERRCODE = '22023';
  END IF;
  IF octet_length(p_payload::text) > 16384 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_payload' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_add_cleanup_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  -- Opportunistic retention: drop expired/consumed tokens older than 1 day.
  DELETE FROM public.quick_add_duplicate_tokens
  WHERE (expires_at < now() - interval '1 day')
     OR (consumed_at IS NOT NULL AND consumed_at < now() - interval '1 day');
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_add_acquire_identity_locks(
  p_normalized_email extensions.citext,
  p_normalized_phone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_keys text[] := ARRAY[]::text[];
  v_key text;
BEGIN
  IF p_normalized_email IS NOT NULL THEN
    v_keys := array_append(v_keys, 'quick_add_email:' || lower(p_normalized_email::text));
  END IF;
  IF p_normalized_phone IS NOT NULL THEN
    v_keys := array_append(v_keys, 'quick_add_phone:' || p_normalized_phone);
  END IF;
  IF coalesce(array_length(v_keys, 1), 0) = 0 THEN RETURN; END IF;
  v_keys := (SELECT array_agg(k ORDER BY k) FROM unnest(v_keys) AS k);
  FOREACH v_key IN ARRAY v_keys LOOP
    PERFORM pg_advisory_xact_lock(hashtext(v_key));
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_add_is_manual_household(p_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = p_household_id
      AND h.deleted_at IS NULL
      AND h.lead_source = 'manual_contact'
  );
$$;

CREATE OR REPLACE FUNCTION public.quick_add_collect_match_rows(
  p_normalized_email extensions.citext,
  p_normalized_phone text,
  p_first_name text,
  p_last_name text,
  p_company text,
  p_exclude_household_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_first text := lower(btrim(COALESCE(p_first_name, '')));
  v_last text := lower(btrim(COALESCE(p_last_name, '')));
  v_company text := lower(COALESCE(public.crm_normalize_quick_add_company(p_company), ''));
  v_rows jsonb := '[]'::jsonb;
BEGIN
  WITH household_hits AS (
    SELECT h.id AS household_id, h.display_name, h.status::text AS household_status,
           h.normalized_email::text AS household_email, h.normalized_phone AS household_phone,
           h.assigned_advisor_id,
           (p_normalized_email IS NOT NULL AND h.normalized_email = p_normalized_email) AS email_hit,
           (p_normalized_phone IS NOT NULL AND h.normalized_phone = p_normalized_phone) AS phone_hit,
           false AS name_company_hit
    FROM public.households h
    WHERE h.deleted_at IS NULL AND h.merged_into_household_id IS NULL
      AND (p_exclude_household_id IS NULL OR h.id <> p_exclude_household_id)
      AND (
        (p_normalized_email IS NOT NULL AND h.normalized_email = p_normalized_email)
        OR (p_normalized_phone IS NOT NULL AND h.normalized_phone = p_normalized_phone)
      )
  ),
  member_hits AS (
    SELECT hm.household_id, h.display_name, h.status::text AS household_status,
           hm.normalized_email::text AS household_email, hm.normalized_phone AS household_phone,
           h.assigned_advisor_id,
           (p_normalized_email IS NOT NULL AND hm.normalized_email = p_normalized_email) AS email_hit,
           (p_normalized_phone IS NOT NULL AND hm.normalized_phone = p_normalized_phone) AS phone_hit,
           (
             v_company <> '' AND hm.company IS NOT NULL
             AND lower(btrim(hm.company)) = v_company
             AND lower(btrim(hm.first_name)) = v_first
             AND lower(btrim(hm.last_name)) = v_last
           ) AS name_company_hit
    FROM public.household_members hm
    JOIN public.households h ON h.id = hm.household_id
    WHERE hm.deleted_at IS NULL AND h.deleted_at IS NULL AND h.merged_into_household_id IS NULL
      AND (p_exclude_household_id IS NULL OR h.id <> p_exclude_household_id)
      AND (
        (p_normalized_email IS NOT NULL AND hm.normalized_email = p_normalized_email)
        OR (p_normalized_phone IS NOT NULL AND hm.normalized_phone = p_normalized_phone)
        OR (
          v_company <> '' AND hm.company IS NOT NULL
          AND lower(btrim(hm.company)) = v_company
          AND lower(btrim(hm.first_name)) = v_first
          AND lower(btrim(hm.last_name)) = v_last
        )
      )
  ),
  lead_hits AS (
    SELECT l.household_id, h.display_name, h.status::text AS household_status,
           l.normalized_email::text AS household_email, l.normalized_phone AS household_phone,
           h.assigned_advisor_id,
           (p_normalized_email IS NOT NULL AND l.normalized_email = p_normalized_email) AS email_hit,
           (p_normalized_phone IS NOT NULL AND l.normalized_phone = p_normalized_phone) AS phone_hit,
           false AS name_company_hit
    FROM public.leads l
    JOIN public.households h ON h.id = l.household_id
    WHERE l.deleted_at IS NULL AND h.deleted_at IS NULL AND h.merged_into_household_id IS NULL
      AND (p_exclude_household_id IS NULL OR h.id <> p_exclude_household_id)
      AND (
        (p_normalized_email IS NOT NULL AND l.normalized_email = p_normalized_email)
        OR (p_normalized_phone IS NOT NULL AND l.normalized_phone = p_normalized_phone)
      )
  ),
  combined AS (
    SELECT * FROM household_hits
    UNION ALL SELECT * FROM member_hits
    UNION ALL SELECT * FROM lead_hits
  ),
  rolled AS (
    SELECT household_id,
      max(display_name) AS display_name,
      max(household_status) AS household_status,
      max(household_email) FILTER (WHERE household_email IS NOT NULL) AS household_email,
      max(household_phone) FILTER (WHERE household_phone IS NOT NULL) AS household_phone,
      (array_agg(assigned_advisor_id))[1] AS assigned_advisor_id,
      bool_or(email_hit) AS email_hit,
      bool_or(phone_hit) AS phone_hit,
      bool_or(name_company_hit) AS name_company_hit
    FROM combined GROUP BY household_id
  ),
  classified AS (
    SELECT r.*,
      CASE
        WHEN r.email_hit AND r.phone_hit THEN 'exact_email_and_phone'
        WHEN r.email_hit THEN 'exact_email'
        WHEN r.phone_hit THEN 'exact_phone'
        WHEN r.name_company_hit THEN 'name_company'
        ELSE 'unknown'
      END AS match_class
    FROM rolled r
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'household_id', c.household_id,
      'display_name', c.display_name,
      'household_status', c.household_status,
      'masked_email', public.quick_add_mask_email(c.household_email),
      'masked_phone', public.quick_add_mask_phone(c.household_phone),
      'email_hit', c.email_hit,
      'phone_hit', c.phone_hit,
      'name_company_hit', c.name_company_hit,
      'match_class', c.match_class
    ) ORDER BY c.household_id
  ), '[]'::jsonb)
  INTO v_rows
  FROM classified c;

  IF p_normalized_email IS NOT NULL AND p_normalized_phone IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_rows) e
      WHERE (e->>'email_hit')::boolean AND NOT (e->>'phone_hit')::boolean
    ) AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_rows) e
      WHERE (e->>'phone_hit')::boolean AND NOT (e->>'email_hit')::boolean
    ) THEN
      v_rows := (
        SELECT COALESCE(jsonb_agg(
          CASE WHEN (e->>'email_hit')::boolean OR (e->>'phone_hit')::boolean
            THEN e || jsonb_build_object('match_class', 'conflicting_identifiers')
            ELSE e END
          ORDER BY e->>'household_id'
        ), '[]'::jsonb)
        FROM jsonb_array_elements(v_rows) e
      );
    END IF;
  END IF;
  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_add_format_match_response(
  p_rows jsonb,
  p_is_owner boolean
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_out jsonb := '[]'::jsonb;
  v_el jsonb;
  v_hh uuid;
  v_has_restricted boolean := false;
BEGIN
  FOR v_el IN SELECT value FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb))
  LOOP
    v_hh := (v_el->>'household_id')::uuid;
    IF p_is_owner OR public.crm_can_access_household(v_hh) THEN
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'visibility', 'accessible',
        'household_id', v_hh,
        'display_name', v_el->>'display_name',
        'household_status', v_el->>'household_status',
        'masked_email', v_el->'masked_email',
        'masked_phone', v_el->'masked_phone',
        'match_class', v_el->>'match_class'
      ));
    ELSE
      v_has_restricted := true;
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'visibility', 'restricted',
        'match_class', v_el->>'match_class'
      ));
    END IF;
  END LOOP;
  RETURN jsonb_build_object('matches', v_out, 'has_restricted_collision', v_has_restricted);
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_add_collision_ack_from_rows(
  p_rows jsonb,
  p_is_owner boolean
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_ids uuid[] := ARRAY[]::uuid[];
  v_classes text[] := ARRAY[]::text[];
  v_el jsonb;
  v_hh uuid;
  v_restricted boolean := false;
BEGIN
  FOR v_el IN SELECT value FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb))
  LOOP
    v_hh := (v_el->>'household_id')::uuid;
    v_classes := array_append(v_classes, v_el->>'match_class');
    IF p_is_owner OR public.crm_can_access_household(v_hh) THEN
      v_ids := array_append(v_ids, v_hh);
    ELSE
      v_restricted := true;
    END IF;
  END LOOP;
  RETURN jsonb_build_object(
    'accessible_household_ids', to_jsonb(COALESCE(v_ids, ARRAY[]::uuid[])),
    'has_restricted_collision', v_restricted,
    'match_classes', to_jsonb(COALESCE(
      (SELECT array_agg(DISTINCT c) FROM unnest(v_classes) AS c),
      ARRAY[]::text[]
    ))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_add_ack_covers_current(p_ack jsonb, p_current jsonb)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_id text;
  v_ack_ids jsonb := COALESCE(p_ack->'accessible_household_ids', '[]'::jsonb);
  v_cur_ids jsonb := COALESCE(p_current->'accessible_household_ids', '[]'::jsonb);
BEGIN
  IF COALESCE((p_current->>'has_restricted_collision')::boolean, false)
     AND NOT COALESCE((p_ack->>'has_restricted_collision')::boolean, false) THEN
    RETURN false;
  END IF;
  FOR v_id IN SELECT jsonb_array_elements_text(v_cur_ids)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_ack_ids) a WHERE a = v_id
    ) THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.quick_add_parse_consent(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_src jsonb;
  v_contact boolean := false;
  v_email boolean := false;
  v_sms boolean := false;
  v_privacy boolean := false;
  v_evidence text;
BEGIN
  IF p_payload ? 'consentedAt' THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_consent' USING ERRCODE = '22023';
  END IF;
  IF p_payload ? 'consent_snapshot' THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_consent' USING ERRCODE = '22023';
  END IF;

  IF NOT (p_payload ? 'consent') THEN
    RETURN jsonb_build_object(
      'privacyAcknowledged', false,
      'contactPermission', false,
      'emailMarketingConsent', false,
      'smsMarketingConsent', false,
      'consentVersion', NULL,
      'consentedAt', NULL,
      'evidenceDescription', NULL
    );
  END IF;

  v_src := p_payload->'consent';
  PERFORM public.quick_add_assert_object_keys(
    v_src,
    ARRAY[
      'privacyAcknowledged',
      'contactPermission',
      'emailMarketingConsent',
      'smsMarketingConsent',
      'evidenceDescription'
    ]
  );

  v_contact := COALESCE((v_src->>'contactPermission')::boolean, false);
  v_email := COALESCE((v_src->>'emailMarketingConsent')::boolean, false);
  v_sms := COALESCE((v_src->>'smsMarketingConsent')::boolean, false);
  v_privacy := COALESCE((v_src->>'privacyAcknowledged')::boolean, false);

  IF NOT (v_contact OR v_email OR v_sms) THEN
    RETURN jsonb_build_object(
      'privacyAcknowledged', false,
      'contactPermission', false,
      'emailMarketingConsent', false,
      'smsMarketingConsent', false,
      'consentVersion', NULL,
      'consentedAt', NULL,
      'evidenceDescription', NULL
    );
  END IF;

  v_evidence := NULLIF(btrim(COALESCE(v_src->>'evidenceDescription', '')), '');
  IF v_evidence IS NULL OR char_length(v_evidence) > 500 OR NOT v_privacy THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_consent' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'privacyAcknowledged', true,
    'contactPermission', v_contact,
    'emailMarketingConsent', v_email,
    'smsMarketingConsent', v_sms,
    'consentVersion', 'quick-add-contact-consent-v1',
    'consentedAt', now(),
    'evidenceDescription', v_evidence
  );
END;
$$;

-- revoke helper execute from clients (static REVOKEs; no dynamic SQL)
REVOKE ALL ON FUNCTION public.crm_normalize_quick_add_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_normalize_quick_add_phone(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_normalize_quick_add_company(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_add_is_safe_website(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_add_mask_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_add_mask_phone(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_add_payload_fingerprint(extensions.citext, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_add_assert_object_keys(jsonb, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_add_assert_payload_size(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_add_cleanup_tokens() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_add_acquire_identity_locks(extensions.citext, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_add_is_manual_household(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_add_collect_match_rows(extensions.citext, text, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_add_format_match_response(jsonb, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_add_collision_ack_from_rows(jsonb, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_add_ack_covers_current(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_add_parse_consent(jsonb) FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION E — Manual Contact integrity triggers (RPC context gated)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_manual_contact_lead_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_ctx text := public.crm_rpc_context();
  v_is_manual boolean;
BEGIN
  -- Authenticated clients cannot hard-delete Manual Contact leads (archive ≠ delete).
  -- Service-role / SQL maintenance (auth.uid() NULL) remains available for fixtures.
  IF TG_OP = 'DELETE' THEN
    IF OLD.lead_type = 'Manual Contact' AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.lead_type = 'Manual Contact' AND v_ctx IS DISTINCT FROM 'quick_add_contact' THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  v_is_manual := (OLD.lead_type = 'Manual Contact' OR NEW.lead_type = 'Manual Contact');
  IF NOT v_is_manual THEN
    RETURN NEW;
  END IF;

  IF NEW.lead_type IS DISTINCT FROM OLD.lead_type THEN
    RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id THEN
    RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.household_id IS DISTINCT FROM OLD.household_id THEN
    RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.consent_snapshot IS DISTINCT FROM OLD.consent_snapshot THEN
    IF v_ctx IS DISTINCT FROM 'quick_add_contact' THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.contact_category IS DISTINCT FROM OLD.contact_category
     OR NEW.how_we_met IS DISTINCT FROM OLD.how_we_met
     OR NEW.normalized_email IS DISTINCT FROM OLD.normalized_email
     OR NEW.normalized_phone IS DISTINCT FROM OLD.normalized_phone THEN
    IF v_ctx IS DISTINCT FROM 'update_manual_contact'
       AND v_ctx IS DISTINCT FROM 'quick_add_contact' THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_manual_contact_integrity ON public.leads;
CREATE TRIGGER leads_manual_contact_integrity
  BEFORE INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_manual_contact_lead_integrity();

CREATE OR REPLACE FUNCTION public.enforce_manual_contact_member_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_ctx text := public.crm_rpc_context();
  v_hh uuid := COALESCE(NEW.household_id, OLD.household_id);
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.quick_add_is_manual_household(OLD.household_id) AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF NOT public.quick_add_is_manual_household(v_hh) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_ctx IS DISTINCT FROM 'quick_add_contact' THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.household_id IS DISTINCT FROM OLD.household_id THEN
    RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.first_name IS DISTINCT FROM OLD.first_name
     OR NEW.last_name IS DISTINCT FROM OLD.last_name
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.phone IS DISTINCT FROM OLD.phone
     OR NEW.normalized_email IS DISTINCT FROM OLD.normalized_email
     OR NEW.normalized_phone IS DISTINCT FROM OLD.normalized_phone
     OR NEW.company IS DISTINCT FROM OLD.company
     OR NEW.job_title IS DISTINCT FROM OLD.job_title
     OR NEW.website IS DISTINCT FROM OLD.website
     OR NEW.is_primary_contact IS DISTINCT FROM OLD.is_primary_contact
     OR NEW.relationship IS DISTINCT FROM OLD.relationship THEN
    IF v_ctx IS DISTINCT FROM 'update_manual_contact'
       AND v_ctx IS DISTINCT FROM 'quick_add_contact' THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS household_members_manual_contact_integrity ON public.household_members;
CREATE TRIGGER household_members_manual_contact_integrity
  BEFORE INSERT OR UPDATE OR DELETE ON public.household_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_manual_contact_member_integrity();

CREATE OR REPLACE FUNCTION public.enforce_manual_contact_household_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_ctx text := public.crm_rpc_context();
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.lead_source = 'manual_contact' AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.lead_source = 'manual_contact' AND v_ctx IS DISTINCT FROM 'quick_add_contact' THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.lead_source IS DISTINCT FROM 'manual_contact'
     AND NEW.lead_source IS DISTINCT FROM 'manual_contact' THEN
    RETURN NEW;
  END IF;

  IF NEW.lead_source IS DISTINCT FROM OLD.lead_source THEN
    RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
  END IF;

  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
  END IF;

  -- status/assignment already guarded by households_protect_columns; keep Manual Contact
  -- identity/contact fields RPC-gated here.
  IF NEW.display_name IS DISTINCT FROM OLD.display_name
     OR NEW.primary_email IS DISTINCT FROM OLD.primary_email
     OR NEW.primary_phone IS DISTINCT FROM OLD.primary_phone
     OR NEW.normalized_email IS DISTINCT FROM OLD.normalized_email
     OR NEW.normalized_phone IS DISTINCT FROM OLD.normalized_phone
     OR NEW.city IS DISTINCT FROM OLD.city
     OR NEW.state IS DISTINCT FROM OLD.state THEN
    IF v_ctx IS DISTINCT FROM 'update_manual_contact'
       AND v_ctx IS DISTINCT FROM 'quick_add_contact' THEN
      RAISE EXCEPTION 'QUICK_ADD:manual_contact_rpc_required' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS households_manual_contact_integrity ON public.households;
CREATE TRIGGER households_manual_contact_integrity
  BEFORE INSERT OR UPDATE OR DELETE ON public.households
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_manual_contact_household_integrity();

REVOKE ALL ON FUNCTION public.enforce_manual_contact_lead_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_manual_contact_member_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_manual_contact_household_integrity() FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION F — preview_quick_add_contact_duplicates
-- =============================================================================

CREATE OR REPLACE FUNCTION public.preview_quick_add_contact_duplicates(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_owner boolean;
  v_operation text;
  v_lead_id uuid;
  v_lead public.leads;
  v_member public.household_members;
  v_first text;
  v_last text;
  v_email extensions.citext;
  v_phone text;
  v_company text;
  v_exclude uuid;
  v_rows jsonb;
  v_formatted jsonb;
  v_ack jsonb;
  v_fingerprint text;
  v_subject_fingerprint text;
  v_raw_token text;
  v_token_hash text;
  v_expires timestamptz := now() + interval '10 minutes';
  v_needs_token boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'QUICK_ADD:not_authenticated' USING ERRCODE = '42501';
  END IF;
  PERFORM public.quick_add_assert_payload_size(p_payload);
  PERFORM public.quick_add_assert_object_keys(
    p_payload,
    ARRAY[
      'operation','lead_id','first_name','last_name','email','phone','company'
    ]
  );
  IF NOT (public.crm_is_owner() OR public.crm_is_advisor()) THEN
    RAISE EXCEPTION 'QUICK_ADD:not_authorized' USING ERRCODE = '42501';
  END IF;
  IF public.crm_is_advisor() AND public.crm_advisor_id() IS NULL THEN
    RAISE EXCEPTION 'QUICK_ADD:not_authorized' USING ERRCODE = '42501';
  END IF;

  v_is_owner := public.crm_is_owner();
  v_operation := lower(btrim(COALESCE(p_payload->>'operation', '')));
  IF v_operation NOT IN ('create', 'update') THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_payload' USING ERRCODE = '22023';
  END IF;

  v_first := NULLIF(btrim(COALESCE(p_payload->>'first_name', '')), '');
  v_last := NULLIF(btrim(COALESCE(p_payload->>'last_name', '')), '');
  IF v_first IS NULL OR v_last IS NULL OR char_length(v_first) > 100 OR char_length(v_last) > 100 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_name' USING ERRCODE = '22023';
  END IF;
  v_email := public.crm_normalize_quick_add_email(p_payload->>'email');
  v_phone := public.crm_normalize_quick_add_phone(p_payload->>'phone');
  IF v_email IS NULL AND v_phone IS NULL THEN
    RAISE EXCEPTION 'QUICK_ADD:contact_required' USING ERRCODE = '22023';
  END IF;
  v_company := public.crm_normalize_quick_add_company(p_payload->>'company');
  IF v_company IS NOT NULL AND char_length(v_company) > 200 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_field' USING ERRCODE = '22023';
  END IF;

  v_exclude := NULL;
  v_subject_fingerprint := NULL;
  IF v_operation = 'update' THEN
    BEGIN
      v_lead_id := NULLIF(p_payload->>'lead_id', '')::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'QUICK_ADD:invalid_payload' USING ERRCODE = '22023';
    END;
    IF v_lead_id IS NULL THEN
      RAISE EXCEPTION 'QUICK_ADD:invalid_payload' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_lead FROM public.leads
    WHERE id = v_lead_id AND deleted_at IS NULL;
    IF NOT FOUND OR v_lead.lead_type IS DISTINCT FROM 'Manual Contact' THEN
      RAISE EXCEPTION 'QUICK_ADD:not_found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT public.crm_can_access_household(v_lead.household_id) THEN
      RAISE EXCEPTION 'QUICK_ADD:not_authorized' USING ERRCODE = '42501';
    END IF;
    IF NOT public.quick_add_is_manual_household(v_lead.household_id) THEN
      RAISE EXCEPTION 'QUICK_ADD:not_found' USING ERRCODE = 'P0002';
    END IF;
    v_exclude := v_lead.household_id;
    SELECT * INTO v_member FROM public.household_members
    WHERE household_id = v_lead.household_id
      AND deleted_at IS NULL
      AND is_primary_contact = true
    ORDER BY created_at ASC
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'QUICK_ADD:not_found' USING ERRCODE = 'P0002';
    END IF;
    v_subject_fingerprint := public.quick_add_payload_fingerprint(
      public.crm_normalize_quick_add_email(v_member.email),
      public.crm_normalize_quick_add_phone(v_member.phone),
      v_member.first_name,
      v_member.last_name,
      v_member.company
    );
  ELSIF p_payload ? 'lead_id' THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_payload' USING ERRCODE = '22023';
  END IF;

  PERFORM public.quick_add_cleanup_tokens();
  v_fingerprint := public.quick_add_payload_fingerprint(v_email, v_phone, v_first, v_last, v_company);
  PERFORM public.quick_add_acquire_identity_locks(v_email, v_phone);
  v_rows := public.quick_add_collect_match_rows(v_email, v_phone, v_first, v_last, v_company, v_exclude);
  v_formatted := public.quick_add_format_match_response(v_rows, v_is_owner);
  v_ack := public.quick_add_collision_ack_from_rows(v_rows, v_is_owner);
  v_needs_token := jsonb_array_length(v_rows) > 0;

  IF v_needs_token THEN
    v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
    v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
    INSERT INTO public.quick_add_duplicate_tokens (
      actor_user_id, token_hash, operation, subject_lead_id, subject_household_id,
      payload_fingerprint, subject_fingerprint, acknowledged, expires_at
    ) VALUES (
      v_uid, v_token_hash, v_operation,
      CASE WHEN v_operation = 'update' THEN v_lead_id ELSE NULL END,
      CASE WHEN v_operation = 'update' THEN v_exclude ELSE NULL END,
      v_fingerprint, v_subject_fingerprint, v_ack, v_expires
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'operation', v_operation,
    'matches', v_formatted->'matches',
    'has_restricted_collision', v_formatted->'has_restricted_collision',
    'create_token', v_raw_token,
    'expires_at', CASE WHEN v_needs_token THEN to_jsonb(v_expires) ELSE NULL END
  );
END;
$$;

COMMENT ON FUNCTION public.preview_quick_add_contact_duplicates(jsonb) IS
  'Quick Add duplicate preview. operation=create|update; update requires accessible Manual Contact lead_id. Purpose-bound one-time token.';

-- =============================================================================
-- SECTION G — quick_add_contact
-- =============================================================================

CREATE OR REPLACE FUNCTION public.quick_add_contact(
  p_payload jsonb,
  p_mode text,
  p_create_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_owner boolean;
  v_mode text := lower(btrim(COALESCE(p_mode, '')));
  v_first text; v_last text; v_display text;
  v_email_raw text; v_phone_raw text;
  v_email extensions.citext; v_phone text;
  v_company text; v_job_title text; v_website text;
  v_city text; v_state text; v_how_we_met text;
  v_category public.contact_category;
  v_note text; v_task_title text; v_task_due date;
  v_consent jsonb;
  v_assign_advisor_id uuid; v_owner_advisor_id uuid;
  v_fingerprint text; v_rows jsonb; v_ack_current jsonb;
  v_token public.quick_add_duplicate_tokens; v_token_hash text;
  v_pipeline_id uuid := '22222222-2222-2222-2222-222222222201'::uuid;
  v_stage_id uuid := '33333333-3333-3333-3333-333333333001'::uuid;
  v_household_id uuid; v_member_id uuid; v_lead_id uuid;
  v_note_id uuid; v_task_id uuid;
  v_now timestamptz := now();
  v_assigned_user_id uuid;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'QUICK_ADD:not_authenticated' USING ERRCODE = '42501'; END IF;
  PERFORM public.quick_add_assert_payload_size(p_payload);
  PERFORM public.quick_add_assert_object_keys(
    p_payload,
    ARRAY[
      'first_name','last_name','email','phone','company','job_title','website',
      'city','state','contact_category','how_we_met','note','private_note',
      'follow_up_task_title','follow_up_due_date','assigned_advisor_id','consent'
    ]
  );
  IF v_mode NOT IN ('create', 'create_separate') THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_mode' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.crm_is_owner() OR public.crm_is_advisor()) THEN
    RAISE EXCEPTION 'QUICK_ADD:not_authorized' USING ERRCODE = '42501';
  END IF;
  v_is_owner := public.crm_is_owner();

  v_first := NULLIF(btrim(COALESCE(p_payload->>'first_name', '')), '');
  v_last := NULLIF(btrim(COALESCE(p_payload->>'last_name', '')), '');
  IF v_first IS NULL OR v_last IS NULL OR char_length(v_first) > 100 OR char_length(v_last) > 100 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_name' USING ERRCODE = '22023';
  END IF;
  v_display := btrim(v_first || ' ' || v_last);
  v_email_raw := NULLIF(btrim(COALESCE(p_payload->>'email', '')), '');
  v_phone_raw := NULLIF(btrim(COALESCE(p_payload->>'phone', '')), '');
  v_email := public.crm_normalize_quick_add_email(v_email_raw);
  v_phone := public.crm_normalize_quick_add_phone(v_phone_raw);
  IF v_email IS NULL AND v_phone IS NULL THEN
    RAISE EXCEPTION 'QUICK_ADD:contact_required' USING ERRCODE = '22023';
  END IF;
  v_company := public.crm_normalize_quick_add_company(p_payload->>'company');
  IF v_company IS NOT NULL AND char_length(v_company) > 200 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_field' USING ERRCODE = '22023';
  END IF;
  v_job_title := NULLIF(btrim(COALESCE(p_payload->>'job_title', '')), '');
  IF v_job_title IS NOT NULL AND char_length(v_job_title) > 200 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_field' USING ERRCODE = '22023';
  END IF;
  v_website := NULLIF(btrim(COALESCE(p_payload->>'website', '')), '');
  IF v_website IS NOT NULL AND NOT public.quick_add_is_safe_website(v_website) THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_website' USING ERRCODE = '22023';
  END IF;
  v_city := NULLIF(btrim(COALESCE(p_payload->>'city', '')), '');
  v_state := NULLIF(btrim(COALESCE(p_payload->>'state', '')), '');
  IF (v_city IS NOT NULL AND char_length(v_city) > 100) OR (v_state IS NOT NULL AND char_length(v_state) > 50) THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_field' USING ERRCODE = '22023';
  END IF;
  v_how_we_met := NULLIF(btrim(COALESCE(p_payload->>'how_we_met', '')), '');
  IF v_how_we_met IS NOT NULL AND char_length(v_how_we_met) > 500 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_field' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_category := (NULLIF(btrim(COALESCE(p_payload->>'contact_category', '')), ''))::public.contact_category;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_category' USING ERRCODE = '22023';
  END;
  IF v_category IS NULL THEN RAISE EXCEPTION 'QUICK_ADD:invalid_category' USING ERRCODE = '22023'; END IF;

  v_note := NULLIF(btrim(COALESCE(p_payload->>'note', p_payload->>'private_note', '')), '');
  IF v_note IS NOT NULL AND char_length(v_note) > 5000 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_field' USING ERRCODE = '22023';
  END IF;
  v_task_title := NULLIF(btrim(COALESCE(p_payload->>'follow_up_task_title', '')), '');
  IF v_task_title IS NOT NULL AND char_length(v_task_title) > 200 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_field' USING ERRCODE = '22023';
  END IF;
  IF p_payload ? 'follow_up_due_date' AND NULLIF(p_payload->>'follow_up_due_date', '') IS NOT NULL THEN
    BEGIN v_task_due := (p_payload->>'follow_up_due_date')::date;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'QUICK_ADD:invalid_due_date' USING ERRCODE = '22023'; END;
  END IF;
  IF v_task_due IS NOT NULL AND v_task_title IS NULL THEN v_task_title := 'Follow up — ' || v_display; END IF;
  IF v_task_title IS NOT NULL AND v_task_due IS NULL THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_due_date' USING ERRCODE = '22023';
  END IF;

  v_consent := public.quick_add_parse_consent(p_payload);

  SELECT ap.id INTO v_owner_advisor_id FROM public.advisor_profiles ap
  WHERE ap.user_id = v_uid AND ap.deleted_at IS NULL AND ap.is_active = true LIMIT 1;

  IF v_is_owner THEN
    IF NULLIF(p_payload->>'assigned_advisor_id', '') IS NOT NULL THEN
      BEGIN v_assign_advisor_id := (p_payload->>'assigned_advisor_id')::uuid;
      EXCEPTION WHEN others THEN RAISE EXCEPTION 'QUICK_ADD:invalid_advisor' USING ERRCODE = '22023'; END;
    ELSE
      v_assign_advisor_id := v_owner_advisor_id;
    END IF;
    IF v_assign_advisor_id IS NULL THEN RAISE EXCEPTION 'QUICK_ADD:advisor_required' USING ERRCODE = '22023'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.advisor_profiles ap
      WHERE ap.id = v_assign_advisor_id AND ap.deleted_at IS NULL AND ap.is_active = true
    ) THEN RAISE EXCEPTION 'QUICK_ADD:invalid_advisor' USING ERRCODE = '22023'; END IF;
  ELSE
    v_assign_advisor_id := public.crm_advisor_id();
    IF v_assign_advisor_id IS NULL THEN RAISE EXCEPTION 'QUICK_ADD:not_authorized' USING ERRCODE = '42501'; END IF;
    IF NULLIF(p_payload->>'assigned_advisor_id', '') IS NOT NULL
       AND (p_payload->>'assigned_advisor_id')::uuid IS DISTINCT FROM v_assign_advisor_id THEN
      RAISE EXCEPTION 'QUICK_ADD:assignment_spoof' USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM public.quick_add_cleanup_tokens();
  v_fingerprint := public.quick_add_payload_fingerprint(v_email, v_phone, v_first, v_last, v_company);
  PERFORM public.quick_add_acquire_identity_locks(v_email, v_phone);
  v_rows := public.quick_add_collect_match_rows(v_email, v_phone, v_first, v_last, v_company, NULL);
  v_ack_current := public.quick_add_collision_ack_from_rows(v_rows, v_is_owner);

  IF v_mode = 'create' THEN
    IF jsonb_array_length(v_rows) > 0 THEN
      RETURN jsonb_build_object(
        'ok', false, 'reason', 'collision',
        'matches', (public.quick_add_format_match_response(v_rows, v_is_owner))->'matches',
        'has_restricted_collision', (public.quick_add_format_match_response(v_rows, v_is_owner))->'has_restricted_collision'
      );
    END IF;
  ELSE
    IF p_create_token IS NULL OR btrim(p_create_token) = '' THEN
      RAISE EXCEPTION 'QUICK_ADD:invalid_token' USING ERRCODE = '22023';
    END IF;
    v_token_hash := encode(extensions.digest(btrim(p_create_token), 'sha256'), 'hex');
    SELECT * INTO v_token FROM public.quick_add_duplicate_tokens t
    WHERE t.token_hash = v_token_hash AND t.actor_user_id = v_uid
      AND t.operation = 'create' AND t.consumed_at IS NULL AND t.expires_at > v_now
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'QUICK_ADD:invalid_token' USING ERRCODE = '22023'; END IF;
    IF v_token.payload_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'QUICK_ADD:invalid_token' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(v_rows) > 0
       AND NOT public.quick_add_ack_covers_current(v_token.acknowledged, v_ack_current) THEN
      RAISE EXCEPTION 'QUICK_ADD:invalid_token' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM set_config('crm.rpc_context', 'quick_add_contact', true);
  BEGIN
    INSERT INTO public.households (
      display_name, status, primary_email, normalized_email, primary_phone, normalized_phone,
      city, state, relationship_pipeline_id, relationship_stage_id, stage_entered_at, lead_source,
      assigned_advisor_id, assigned_at, assigned_by_user_id, assignment_reason,
      original_advisor_id, created_by_user_id
    ) VALUES (
      v_display, 'lead', v_email_raw, v_email, v_phone_raw, v_phone, v_city, v_state,
      v_pipeline_id, v_stage_id, v_now, 'manual_contact',
      v_assign_advisor_id, v_now, v_uid, 'manual', v_assign_advisor_id, v_uid
    ) RETURNING id INTO v_household_id;

    INSERT INTO public.advisor_assignments (
      household_id, advisor_id, assignment_role, reason, is_attribution_source,
      assigned_by_user_id, effective_from
    ) VALUES (v_household_id, v_assign_advisor_id, 'primary', 'manual', false, v_uid, v_now);

    INSERT INTO public.household_members (
      household_id, first_name, last_name, relationship, is_primary_contact,
      email, normalized_email, phone, normalized_phone, company, job_title, website
    ) VALUES (
      v_household_id, v_first, v_last, 'primary', true,
      v_email_raw, v_email, v_phone_raw, v_phone, v_company, v_job_title, v_website
    ) RETURNING id INTO v_member_id;

    INSERT INTO public.leads (
      household_id, lead_type, status, source_page, submitted_at, attribution_method,
      assigned_advisor_id, assigned_at, assigned_by_user_id, assignment_reason, original_advisor_id,
      normalized_email, normalized_phone, consent_snapshot, contact_category, how_we_met,
      created_by_user_id, raw_payload, original_source_metadata, sheets_sync_status
    ) VALUES (
      v_household_id, 'Manual Contact', 'assigned', 'crm_quick_add', v_now, 'unknown',
      v_assign_advisor_id, v_now, v_uid, 'manual', v_assign_advisor_id,
      v_email, v_phone, v_consent, v_category, v_how_we_met,
      v_uid, '{}'::jsonb, '{}'::jsonb, 'skipped'
    ) RETURNING id INTO v_lead_id;

    IF v_note IS NOT NULL THEN
      INSERT INTO public.notes (household_id, author_user_id, body, visibility)
      VALUES (v_household_id, v_uid, v_note, 'internal') RETURNING id INTO v_note_id;
    END IF;

    IF v_task_title IS NOT NULL THEN
      SELECT ap.user_id INTO v_assigned_user_id FROM public.advisor_profiles ap
      WHERE ap.id = v_assign_advisor_id AND ap.deleted_at IS NULL LIMIT 1;
      INSERT INTO public.tasks (
        household_id, lead_id, title, due_date, priority, status,
        assigned_user_id, created_by_user_id, source_type
      ) VALUES (
        v_household_id, v_lead_id, v_task_title, v_task_due, 'medium', 'open',
        v_assigned_user_id, v_uid, 'manual'
      ) RETURNING id INTO v_task_id;
    END IF;

    IF v_mode = 'create_separate' THEN
      UPDATE public.quick_add_duplicate_tokens
      SET consumed_at = v_now
      WHERE id = v_token.id AND consumed_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'QUICK_ADD:invalid_token' USING ERRCODE = '22023'; END IF;
    END IF;

    v_result := jsonb_build_object(
      'ok', true, 'created', true,
      'household_id', v_household_id, 'member_id', v_member_id, 'lead_id', v_lead_id,
      'note_id', v_note_id, 'task_id', v_task_id, 'mode', v_mode
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.quick_add_contact(jsonb, text, text) IS
  'Transactional Manual Contact create. Modes create|create_separate. Sets crm.rpc_context=quick_add_contact around protected writes.';

-- =============================================================================
-- SECTION H — update_manual_contact
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_manual_contact(
  p_lead_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_owner boolean;
  v_mode text;
  v_lead public.leads;
  v_member public.household_members;
  v_household public.households;
  v_first text; v_last text;
  v_email_raw text; v_phone_raw text;
  v_email extensions.citext; v_phone text;
  v_company text; v_job_title text; v_website text;
  v_city text; v_state text; v_how_we_met text;
  v_category public.contact_category;
  v_token_raw text; v_fingerprint text;
  v_rows jsonb; v_ack_current jsonb;
  v_token public.quick_add_duplicate_tokens; v_token_hash text;
  v_identity_changed boolean;
  v_now timestamptz := now();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'QUICK_ADD:not_authenticated' USING ERRCODE = '42501'; END IF;
  IF p_lead_id IS NULL THEN RAISE EXCEPTION 'QUICK_ADD:invalid_payload' USING ERRCODE = '22023'; END IF;
  PERFORM public.quick_add_assert_payload_size(p_payload);
  PERFORM public.quick_add_assert_object_keys(
    p_payload,
    ARRAY[
      'mode','create_token','first_name','last_name','email','phone','company','job_title',
      'website','city','state','contact_category','how_we_met'
    ]
  );
  IF NOT (public.crm_is_owner() OR public.crm_is_advisor()) THEN
    RAISE EXCEPTION 'QUICK_ADD:not_authorized' USING ERRCODE = '42501';
  END IF;
  v_is_owner := public.crm_is_owner();
  v_mode := lower(btrim(COALESCE(p_payload->>'mode', 'update')));
  IF v_mode NOT IN ('update', 'update_separate') THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_mode' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_lead.lead_type IS DISTINCT FROM 'Manual Contact' THEN
    RAISE EXCEPTION 'QUICK_ADD:not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.crm_can_access_household(v_lead.household_id) THEN
    RAISE EXCEPTION 'QUICK_ADD:not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_household FROM public.households
  WHERE id = v_lead.household_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_household.lead_source IS DISTINCT FROM 'manual_contact'
     OR v_household.status IS DISTINCT FROM 'lead' THEN
    RAISE EXCEPTION 'QUICK_ADD:lifecycle_locked' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_member FROM public.household_members
  WHERE household_id = v_household.id AND deleted_at IS NULL AND is_primary_contact = true
  ORDER BY created_at ASC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'QUICK_ADD:not_found' USING ERRCODE = 'P0002'; END IF;

  v_first := COALESCE(NULLIF(btrim(COALESCE(p_payload->>'first_name', '')), ''), v_member.first_name);
  v_last := COALESCE(NULLIF(btrim(COALESCE(p_payload->>'last_name', '')), ''), v_member.last_name);
  IF char_length(v_first) > 100 OR char_length(v_last) > 100 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_name' USING ERRCODE = '22023';
  END IF;
  IF p_payload ? 'email' THEN v_email_raw := NULLIF(btrim(COALESCE(p_payload->>'email', '')), '');
  ELSE v_email_raw := v_member.email; END IF;
  IF p_payload ? 'phone' THEN v_phone_raw := NULLIF(btrim(COALESCE(p_payload->>'phone', '')), '');
  ELSE v_phone_raw := v_member.phone; END IF;
  v_email := public.crm_normalize_quick_add_email(v_email_raw);
  v_phone := public.crm_normalize_quick_add_phone(v_phone_raw);
  IF v_email IS NULL AND v_phone IS NULL THEN
    RAISE EXCEPTION 'QUICK_ADD:contact_required' USING ERRCODE = '22023';
  END IF;
  IF p_payload ? 'company' THEN v_company := public.crm_normalize_quick_add_company(p_payload->>'company');
  ELSE v_company := v_member.company; END IF;
  IF v_company IS NOT NULL AND char_length(v_company) > 200 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_field' USING ERRCODE = '22023';
  END IF;
  IF p_payload ? 'job_title' THEN v_job_title := NULLIF(btrim(COALESCE(p_payload->>'job_title', '')), '');
  ELSE v_job_title := v_member.job_title; END IF;
  IF v_job_title IS NOT NULL AND char_length(v_job_title) > 200 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_field' USING ERRCODE = '22023';
  END IF;
  IF p_payload ? 'website' THEN v_website := NULLIF(btrim(COALESCE(p_payload->>'website', '')), '');
  ELSE v_website := v_member.website; END IF;
  IF v_website IS NOT NULL AND NOT public.quick_add_is_safe_website(v_website) THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_website' USING ERRCODE = '22023';
  END IF;
  IF p_payload ? 'city' THEN v_city := NULLIF(btrim(COALESCE(p_payload->>'city', '')), '');
  ELSE v_city := v_household.city; END IF;
  IF p_payload ? 'state' THEN v_state := NULLIF(btrim(COALESCE(p_payload->>'state', '')), '');
  ELSE v_state := v_household.state; END IF;
  IF p_payload ? 'how_we_met' THEN v_how_we_met := NULLIF(btrim(COALESCE(p_payload->>'how_we_met', '')), '');
  ELSE v_how_we_met := v_lead.how_we_met; END IF;
  IF v_how_we_met IS NOT NULL AND char_length(v_how_we_met) > 500 THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_field' USING ERRCODE = '22023';
  END IF;
  IF p_payload ? 'contact_category' THEN
    BEGIN
      v_category := (NULLIF(btrim(COALESCE(p_payload->>'contact_category', '')), ''))::public.contact_category;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'QUICK_ADD:invalid_category' USING ERRCODE = '22023'; END;
    IF v_category IS NULL THEN RAISE EXCEPTION 'QUICK_ADD:invalid_category' USING ERRCODE = '22023'; END IF;
  ELSE
    v_category := v_lead.contact_category;
  END IF;

  v_identity_changed :=
    public.crm_normalize_quick_add_email(v_member.email) IS DISTINCT FROM v_email
    OR public.crm_normalize_quick_add_phone(v_member.phone) IS DISTINCT FROM v_phone
    OR lower(btrim(v_member.first_name)) IS DISTINCT FROM lower(btrim(v_first))
    OR lower(btrim(v_member.last_name)) IS DISTINCT FROM lower(btrim(v_last))
    OR lower(COALESCE(public.crm_normalize_quick_add_company(v_member.company), ''))
         IS DISTINCT FROM lower(COALESCE(v_company, ''));

  v_fingerprint := public.quick_add_payload_fingerprint(v_email, v_phone, v_first, v_last, v_company);
  PERFORM public.quick_add_cleanup_tokens();

  IF v_identity_changed THEN
    PERFORM public.quick_add_acquire_identity_locks(v_email, v_phone);
    v_rows := public.quick_add_collect_match_rows(
      v_email, v_phone, v_first, v_last, v_company, v_household.id
    );
    v_ack_current := public.quick_add_collision_ack_from_rows(v_rows, v_is_owner);
    IF v_mode = 'update' THEN
      IF jsonb_array_length(v_rows) > 0 THEN
        RETURN jsonb_build_object(
          'ok', false, 'reason', 'collision',
          'matches', (public.quick_add_format_match_response(v_rows, v_is_owner))->'matches',
          'has_restricted_collision', (public.quick_add_format_match_response(v_rows, v_is_owner))->'has_restricted_collision'
        );
      END IF;
    ELSE
      v_token_raw := NULLIF(btrim(COALESCE(p_payload->>'create_token', '')), '');
      IF v_token_raw IS NULL THEN RAISE EXCEPTION 'QUICK_ADD:invalid_token' USING ERRCODE = '22023'; END IF;
      v_token_hash := encode(extensions.digest(v_token_raw, 'sha256'), 'hex');
      SELECT * INTO v_token FROM public.quick_add_duplicate_tokens t
      WHERE t.token_hash = v_token_hash AND t.actor_user_id = v_uid
        AND t.operation = 'update'
        AND t.subject_lead_id = p_lead_id
        AND t.subject_household_id = v_household.id
        AND t.consumed_at IS NULL AND t.expires_at > v_now
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'QUICK_ADD:invalid_token' USING ERRCODE = '22023'; END IF;
      IF v_token.payload_fingerprint IS DISTINCT FROM v_fingerprint THEN
        RAISE EXCEPTION 'QUICK_ADD:invalid_token' USING ERRCODE = '22023';
      END IF;
      -- Reject if the subject contact's identity changed since preview.
      IF v_token.subject_fingerprint IS DISTINCT FROM public.quick_add_payload_fingerprint(
        public.crm_normalize_quick_add_email(v_member.email),
        public.crm_normalize_quick_add_phone(v_member.phone),
        v_member.first_name,
        v_member.last_name,
        v_member.company
      ) THEN
        RAISE EXCEPTION 'QUICK_ADD:invalid_token' USING ERRCODE = '22023';
      END IF;
      IF jsonb_array_length(v_rows) > 0
         AND NOT public.quick_add_ack_covers_current(v_token.acknowledged, v_ack_current) THEN
        RAISE EXCEPTION 'QUICK_ADD:invalid_token' USING ERRCODE = '22023';
      END IF;
    END IF;
  ELSIF v_mode = 'update_separate' THEN
    RAISE EXCEPTION 'QUICK_ADD:invalid_mode' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('crm.rpc_context', 'update_manual_contact', true);
  BEGIN
    UPDATE public.household_members SET
      first_name = v_first, last_name = v_last, email = v_email_raw, normalized_email = v_email,
      phone = v_phone_raw, normalized_phone = v_phone, company = v_company, job_title = v_job_title,
      website = v_website, updated_at = v_now
    WHERE id = v_member.id;

    UPDATE public.households SET
      display_name = btrim(v_first || ' ' || v_last),
      primary_email = v_email_raw, normalized_email = v_email,
      primary_phone = v_phone_raw, normalized_phone = v_phone,
      city = v_city, state = v_state, updated_at = v_now
    WHERE id = v_household.id;

    UPDATE public.leads SET
      normalized_email = v_email, normalized_phone = v_phone,
      contact_category = v_category, how_we_met = v_how_we_met, updated_at = v_now
    WHERE id = v_lead.id;

    IF v_mode = 'update_separate' AND v_token.id IS NOT NULL THEN
      UPDATE public.quick_add_duplicate_tokens
      SET consumed_at = v_now
      WHERE id = v_token.id AND consumed_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'QUICK_ADD:invalid_token' USING ERRCODE = '22023'; END IF;
    END IF;

    v_result := jsonb_build_object(
      'ok', true, 'updated', true,
      'lead_id', v_lead.id, 'household_id', v_household.id, 'member_id', v_member.id, 'mode', v_mode
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.update_manual_contact(uuid, jsonb) IS
  'Transactional Manual Contact correction. Modes update|update_separate. Purpose-bound update tokens. Preserves created_by/consent; no assignment/lifecycle.';

-- =============================================================================
-- SECTION I — Grants
-- =============================================================================

REVOKE ALL ON FUNCTION public.preview_quick_add_contact_duplicates(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_quick_add_contact_duplicates(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.quick_add_contact(jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_add_contact(jsonb, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.update_manual_contact(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_manual_contact(uuid, jsonb) TO authenticated;

-- =============================================================================
-- End Migration 031
-- =============================================================================
