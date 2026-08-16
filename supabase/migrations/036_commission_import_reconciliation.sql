-- 036_commission_import_reconciliation.sql
-- Writing-advisor commission IMPORT / RECONCILIATION staging.
--
-- Adds:
--   public.commission_import_batches
--   public.commission_import_rows
--   public.commission_import_carrier_aliases
--   owner RPCs: create batch, stage rows, review, post, upsert alias
--
-- 036 is NOT a financial ledger. Migration 035 remains the only place
-- actual writing-advisor money is posted. Staging rows never equal money.
-- Posting calls public.record_policy_writing_commission_event and stores
-- posted_commission_event_id. Carrier transaction ids are never fabricated.
--
-- Writing-advisor compensation only. Does NOT model upline, generational,
-- hierarchy, recruiter, manager spread, or agency override compensation.
-- Type Override is never auto-posted.
--
-- Actual writing cash (including paid-over-12 / installment) may post
-- even when Migration 034 expected is NULL. Variance stays NULL then.
-- Additional commissions (subscription debt, escrow, interest) are
-- ignored_nonpolicy and never post.
--
-- Source Income is authoritative. Advance % is never re-applied.
-- Source negatives stay signed. 035 reversal is never created from a
-- carrier report as a transaction type.
--
-- Source-row identity (source_row_key) is exact-import identity:
-- file SHA-256 + section + row ordinal. It is NOT a carrier
-- transaction id and is not a cross-report money key.
-- transaction_fingerprint is a heuristic for "looks like the same
-- financial row" and MUST NOT be globally unique. Strong paid-over-time
-- repeats become duplicate; ordinary insurance fingerprint matches
-- become review_duplicate_candidate and cannot auto-post.
--
-- Does NOT: parse source files, add a user interface, call carrier APIs,
-- workflow money states, or new 035 event types.

-- =============================================================================
-- SECTION A — Carrier source aliases (import-only; catalog names unchanged)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.commission_import_carrier_aliases (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  source_label text NOT NULL,
  source_label_normalized text NOT NULL,
  carrier_id uuid NOT NULL REFERENCES public.carriers (id) ON DELETE RESTRICT,
  created_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_import_carrier_alias_label_check
    CHECK (
      source_label = btrim(source_label)
      AND char_length(source_label) BETWEEN 1 AND 200
    ),
  CONSTRAINT commission_import_carrier_alias_norm_check
    CHECK (
      source_label_normalized = lower(source_label_normalized)
      AND source_label_normalized = btrim(source_label_normalized)
      AND char_length(source_label_normalized) BETWEEN 1 AND 200
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS commission_import_carrier_aliases_norm_uidx
  ON public.commission_import_carrier_aliases (source_label_normalized);

DROP TRIGGER IF EXISTS commission_import_carrier_aliases_set_updated_at
  ON public.commission_import_carrier_aliases;
CREATE TRIGGER commission_import_carrier_aliases_set_updated_at
  BEFORE UPDATE ON public.commission_import_carrier_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.commission_import_carrier_aliases IS
  'Import-only mapping from Experior source company labels to catalog carriers. Does not change public.carriers names.';

-- =============================================================================
-- SECTION B — Import batches
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.commission_import_batches (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  source_type text NOT NULL,
  source_file text NOT NULL,
  file_sha256 text NOT NULL,
  statement_identifier text NOT NULL,
  fs_code text,
  statement_date date,
  source_created_at timestamptz,
  payee_name text,
  uploaded_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  import_status text NOT NULL,
  duplicate_of_batch_id uuid
    REFERENCES public.commission_import_batches (id) ON DELETE RESTRICT,
  row_count integer NOT NULL DEFAULT 0,
  ready_count integer NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  ignored_count integer NOT NULL DEFAULT 0,
  posted_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT commission_import_batches_source_type_check
    CHECK (source_type IN ('experior_paid_report')),
  CONSTRAINT commission_import_batches_source_file_check
    CHECK (
      source_file = btrim(source_file)
      AND char_length(source_file) BETWEEN 1 AND 500
    ),
  CONSTRAINT commission_import_batches_sha256_check
    CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT commission_import_batches_statement_id_check
    CHECK (
      statement_identifier = btrim(statement_identifier)
      AND char_length(statement_identifier) BETWEEN 1 AND 200
    ),
  CONSTRAINT commission_import_batches_fs_code_check
    CHECK (
      fs_code IS NULL
      OR (fs_code = btrim(fs_code) AND char_length(fs_code) BETWEEN 1 AND 40)
    ),
  CONSTRAINT commission_import_batches_payee_check
    CHECK (
      payee_name IS NULL
      OR (payee_name = btrim(payee_name) AND char_length(payee_name) BETWEEN 1 AND 200)
    ),
  CONSTRAINT commission_import_batches_status_check
    CHECK (import_status IN ('open', 'duplicate_file')),
  CONSTRAINT commission_import_batches_duplicate_shape_check
    CHECK (
      (import_status = 'duplicate_file' AND duplicate_of_batch_id IS NOT NULL)
      OR (import_status = 'open' AND duplicate_of_batch_id IS NULL)
    ),
  CONSTRAINT commission_import_batches_counts_check
    CHECK (
      row_count >= 0
      AND ready_count >= 0
      AND review_count >= 0
      AND duplicate_count >= 0
      AND ignored_count >= 0
      AND posted_count >= 0
      AND failed_count >= 0
    )
);

-- One live/open batch per file bytes. Re-uploads become duplicate_file rows.
CREATE UNIQUE INDEX IF NOT EXISTS commission_import_batches_file_sha256_open_uidx
  ON public.commission_import_batches (file_sha256)
  WHERE import_status = 'open';

CREATE INDEX IF NOT EXISTS commission_import_batches_created_idx
  ON public.commission_import_batches (created_at DESC);

DROP TRIGGER IF EXISTS commission_import_batches_set_updated_at
  ON public.commission_import_batches;
CREATE TRIGGER commission_import_batches_set_updated_at
  BEFORE UPDATE ON public.commission_import_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.commission_import_batches IS
  'One uploaded commission report. Duplicate file SHA-256 is identified; it does not create a second money batch. Not a ledger.';
COMMENT ON COLUMN public.commission_import_batches.file_sha256 IS
  'Lowercase hex SHA-256 of the source file bytes. Duplicate-file detection key.';

-- =============================================================================
-- SECTION C — Import rows
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.commission_import_rows (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  batch_id uuid NOT NULL
    REFERENCES public.commission_import_batches (id) ON DELETE RESTRICT,
  source_section text NOT NULL,
  source_page integer,
  source_row_ordinal integer NOT NULL,
  source_row_key text NOT NULL,
  transaction_fingerprint text NOT NULL,
  transaction_date date,
  payment_number text,
  source_company text,
  source_product text,
  source_policy_number text,
  source_writing_associate text,
  source_client text,
  agent_entered_premium_cents bigint,
  company_calculated_premium_cents bigint,
  source_gross_rate numeric(12, 6),
  source_factor_rate numeric(12, 6),
  source_net_rate numeric(12, 6),
  source_split_rate numeric(12, 6),
  source_type text,
  source_transaction_type text,
  source_income_cents bigint NOT NULL,
  source_is_negative boolean GENERATED ALWAYS AS (source_income_cents < 0) STORED,
  source_is_chargeback_visual boolean NOT NULL DEFAULT false,
  review_status text NOT NULL,
  review_reason text,
  resolved_carrier_id uuid REFERENCES public.carriers (id) ON DELETE RESTRICT,
  resolved_application_id uuid
    REFERENCES public.policy_applications (id) ON DELETE RESTRICT,
  resolved_allocation_id uuid
    REFERENCES public.policy_agent_allocations (id) ON DELETE RESTRICT,
  resolved_advisor_id uuid
    REFERENCES public.advisor_profiles (id) ON DELETE RESTRICT,
  resolved_event_type text,
  posted_commission_event_id uuid
    REFERENCES public.policy_writing_commission_events (id) ON DELETE RESTRICT,
  reviewed_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT commission_import_rows_section_check
    CHECK (source_section IN (
      'insurance',
      'insurance_paid_over_12_months',
      'additional_commissions'
    )),
  CONSTRAINT commission_import_rows_page_check
    CHECK (source_page IS NULL OR source_page > 0),
  CONSTRAINT commission_import_rows_ordinal_check
    CHECK (source_row_ordinal > 0),
  CONSTRAINT commission_import_rows_key_check
    CHECK (source_row_key ~ '^[0-9a-f]{64}$'),
  CONSTRAINT commission_import_rows_fingerprint_check
    CHECK (transaction_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT commission_import_rows_income_nonzero_for_post_check
    CHECK (source_income_cents <> 0 OR review_status IN (
      'invalid_amount', 'ignored_nonpolicy', 'duplicate'
    )),
  CONSTRAINT commission_import_rows_status_check
    CHECK (review_status IN (
      'ready_to_post',
      'duplicate',
      'review_duplicate_candidate',
      'review_policy_match',
      'review_advisor_match',
      'review_split_attribution',
      'review_transaction_type',
      'ignored_nonwriting',
      'ignored_nonpolicy',
      'invalid_amount',
      'invalid_source_identity'
    )),
  CONSTRAINT commission_import_rows_event_type_check
    CHECK (
      resolved_event_type IS NULL
      OR resolved_event_type IN ('paid', 'adjustment', 'chargeback', 'recovery')
    ),
  CONSTRAINT commission_import_rows_reason_len_check
    CHECK (
      review_reason IS NULL
      OR char_length(btrim(review_reason)) BETWEEN 1 AND 500
    ),
  CONSTRAINT commission_import_rows_text_trim_check
    CHECK (
      (payment_number IS NULL OR payment_number = btrim(payment_number))
      AND (source_company IS NULL OR source_company = btrim(source_company))
      AND (source_product IS NULL OR source_product = btrim(source_product))
      AND (source_policy_number IS NULL OR source_policy_number = btrim(source_policy_number))
      AND (source_writing_associate IS NULL OR source_writing_associate = btrim(source_writing_associate))
      AND (source_client IS NULL OR source_client = btrim(source_client))
      AND (source_type IS NULL OR source_type = btrim(source_type))
      AND (source_transaction_type IS NULL OR source_transaction_type = btrim(source_transaction_type))
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS commission_import_rows_batch_key_uidx
  ON public.commission_import_rows (batch_id, source_row_key);

-- Exact source locator uniqueness inside one batch. Page number is not a key.
CREATE UNIQUE INDEX IF NOT EXISTS commission_import_rows_batch_locator_uidx
  ON public.commission_import_rows (batch_id, source_section, source_row_ordinal);

-- Heuristic only. Must NEVER be UNIQUE: two legitimate rows may share it.
CREATE INDEX IF NOT EXISTS commission_import_rows_fingerprint_idx
  ON public.commission_import_rows (transaction_fingerprint)
  WHERE review_status <> 'duplicate';

CREATE INDEX IF NOT EXISTS commission_import_rows_batch_status_idx
  ON public.commission_import_rows (batch_id, review_status);

CREATE INDEX IF NOT EXISTS commission_import_rows_posted_idx
  ON public.commission_import_rows (posted_commission_event_id)
  WHERE posted_commission_event_id IS NOT NULL;

DROP TRIGGER IF EXISTS commission_import_rows_set_updated_at
  ON public.commission_import_rows;
CREATE TRIGGER commission_import_rows_set_updated_at
  BEFORE UPDATE ON public.commission_import_rows
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.commission_import_rows IS
  'One parsed source report line. Source facts are immutable. Review/resolution is owner-controlled. posted_commission_event_id links to 035; posting status is derived from that FK. Not a ledger.';
COMMENT ON COLUMN public.commission_import_rows.source_row_key IS
  'Exact source-row identity: SHA-256 of file_sha256 + source_section + source_row_ordinal. Identifies this row of this imported file. Not a carrier_transaction_id.';
COMMENT ON COLUMN public.commission_import_rows.transaction_fingerprint IS
  'Cross-report heuristic of normalized financial facts. Not unique. Not a carrier_transaction_id. Never handed to Migration 035 as carrier_transaction_id.';
COMMENT ON COLUMN public.commission_import_rows.source_income_cents IS
  'Authoritative signed cents from source Income. Never recomputed from premium, rates, split, or Advance %.';
COMMENT ON COLUMN public.commission_import_rows.review_status IS
  'Import-review status only. posted is derived from posted_commission_event_id. Not a 035 event_type.';

-- =============================================================================
-- SECTION D — Immutability
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_commission_import_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_ctx text := COALESCE(public.crm_rpc_context(), '');
  v_write_contexts text[] := ARRAY[
    'create_commission_import_batch',
    'stage_commission_import_rows',
    'review_commission_import_row',
    'post_commission_import_row',
    'upsert_commission_import_carrier_alias'
  ];
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE' THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.pp_raise('delete_not_allowed');
    RETURN OLD;
  END IF;

  IF NOT (v_ctx = ANY (v_write_contexts)) THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'commission_import_batches' THEN
    IF NEW.source_type IS DISTINCT FROM OLD.source_type
       OR NEW.source_file IS DISTINCT FROM OLD.source_file
       OR NEW.file_sha256 IS DISTINCT FROM OLD.file_sha256
       OR NEW.statement_identifier IS DISTINCT FROM OLD.statement_identifier
       OR NEW.fs_code IS DISTINCT FROM OLD.fs_code
       OR NEW.statement_date IS DISTINCT FROM OLD.statement_date
       OR NEW.source_created_at IS DISTINCT FROM OLD.source_created_at
       OR NEW.payee_name IS DISTINCT FROM OLD.payee_name
       OR NEW.duplicate_of_batch_id IS DISTINCT FROM OLD.duplicate_of_batch_id
       OR NEW.import_status IS DISTINCT FROM OLD.import_status THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'commission_import_rows' THEN
    IF NEW.batch_id IS DISTINCT FROM OLD.batch_id
       OR NEW.source_section IS DISTINCT FROM OLD.source_section
       OR NEW.source_page IS DISTINCT FROM OLD.source_page
       OR NEW.source_row_ordinal IS DISTINCT FROM OLD.source_row_ordinal
       OR NEW.source_row_key IS DISTINCT FROM OLD.source_row_key
       OR NEW.transaction_fingerprint IS DISTINCT FROM OLD.transaction_fingerprint
       OR NEW.transaction_date IS DISTINCT FROM OLD.transaction_date
       OR NEW.payment_number IS DISTINCT FROM OLD.payment_number
       OR NEW.source_company IS DISTINCT FROM OLD.source_company
       OR NEW.source_product IS DISTINCT FROM OLD.source_product
       OR NEW.source_policy_number IS DISTINCT FROM OLD.source_policy_number
       OR NEW.source_writing_associate IS DISTINCT FROM OLD.source_writing_associate
       OR NEW.source_client IS DISTINCT FROM OLD.source_client
       OR NEW.agent_entered_premium_cents IS DISTINCT FROM OLD.agent_entered_premium_cents
       OR NEW.company_calculated_premium_cents IS DISTINCT FROM OLD.company_calculated_premium_cents
       OR NEW.source_gross_rate IS DISTINCT FROM OLD.source_gross_rate
       OR NEW.source_factor_rate IS DISTINCT FROM OLD.source_factor_rate
       OR NEW.source_net_rate IS DISTINCT FROM OLD.source_net_rate
       OR NEW.source_split_rate IS DISTINCT FROM OLD.source_split_rate
       OR NEW.source_type IS DISTINCT FROM OLD.source_type
       OR NEW.source_transaction_type IS DISTINCT FROM OLD.source_transaction_type
       OR NEW.source_income_cents IS DISTINCT FROM OLD.source_income_cents
       OR NEW.source_is_chargeback_visual IS DISTINCT FROM OLD.source_is_chargeback_visual THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;

    IF OLD.posted_commission_event_id IS NOT NULL THEN
      IF NEW.posted_commission_event_id IS DISTINCT FROM OLD.posted_commission_event_id
         OR NEW.resolved_application_id IS DISTINCT FROM OLD.resolved_application_id
         OR NEW.resolved_allocation_id IS DISTINCT FROM OLD.resolved_allocation_id
         OR NEW.resolved_advisor_id IS DISTINCT FROM OLD.resolved_advisor_id
         OR NEW.resolved_carrier_id IS DISTINCT FROM OLD.resolved_carrier_id
         OR NEW.resolved_event_type IS DISTINCT FROM OLD.resolved_event_type
         OR NEW.review_status IS DISTINCT FROM OLD.review_status THEN
        PERFORM public.pp_raise('not_authorized');
      END IF;
    END IF;

    IF v_ctx = 'post_commission_import_row' THEN
      IF NEW.posted_commission_event_id IS NULL THEN
        PERFORM public.pp_raise('invalid_payload');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commission_import_batches_immutability
  ON public.commission_import_batches;
CREATE TRIGGER commission_import_batches_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.commission_import_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_commission_import_immutability();

DROP TRIGGER IF EXISTS commission_import_rows_immutability
  ON public.commission_import_rows;
CREATE TRIGGER commission_import_rows_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.commission_import_rows
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_commission_import_immutability();

DROP TRIGGER IF EXISTS commission_import_carrier_aliases_immutability
  ON public.commission_import_carrier_aliases;
CREATE TRIGGER commission_import_carrier_aliases_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.commission_import_carrier_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_commission_import_immutability();

REVOKE ALL ON FUNCTION public.enforce_commission_import_immutability()
  FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION E — Helpers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pp_commission_import_sha256(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT encode(extensions.digest(convert_to(COALESCE(p_value, ''), 'UTF8'), 'sha256'), 'hex');
$$;

REVOKE ALL ON FUNCTION public.pp_commission_import_sha256(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_commission_import_household_key(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT NULLIF(
    (
      SELECT string_agg(tok, ' ' ORDER BY tok)
      FROM (
        SELECT DISTINCT lower(m[1]) AS tok
        FROM regexp_matches(
          regexp_replace(
            regexp_replace(lower(COALESCE(p_value, '')), '\yand\y', ' ', 'g'),
            '[&/,]',
            ' ',
            'g'
          ),
          '([a-z]{2,})',
          'g'
        ) AS m
      ) d
    ),
    ''
  );
$$;

REVOKE ALL ON FUNCTION public.pp_commission_import_household_key(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_commission_import_rate_text(p_value numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT COALESCE(to_char(COALESCE(p_value, 0), 'FM999999990.000000'), '0.000000');
$$;

REVOKE ALL ON FUNCTION public.pp_commission_import_rate_text(numeric)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_commission_import_source_row_key(
  p_file_sha256 text,
  p_source_section text,
  p_source_row_ordinal integer
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT public.pp_commission_import_sha256(
    concat_ws(
      chr(31),
      COALESCE(lower(btrim(COALESCE(p_file_sha256, ''))), ''),
      COALESCE(p_source_section, ''),
      COALESCE(p_source_row_ordinal::text, '')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.pp_commission_import_source_row_key(
  text, text, integer
) FROM PUBLIC, anon, authenticated;

-- Heuristic only. Excludes file SHA and statement identity.
CREATE OR REPLACE FUNCTION public.pp_commission_import_transaction_fingerprint(
  p_fs_code text,
  p_source_company text,
  p_source_policy_number text,
  p_transaction_date date,
  p_payment_number text,
  p_source_writing_associate text,
  p_source_type text,
  p_source_transaction_type text,
  p_source_income_cents bigint,
  p_source_split_rate numeric,
  p_source_gross_rate numeric
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT public.pp_commission_import_sha256(
    concat_ws(
      chr(31),
      COALESCE(public.pp_normalize_text(p_fs_code), ''),
      COALESCE(public.pp_normalize_text(p_source_company), ''),
      COALESCE(public.pp_normalize_text(p_source_policy_number), ''),
      COALESCE(p_transaction_date::text, ''),
      COALESCE(public.pp_normalize_text(p_payment_number), ''),
      COALESCE(public.pp_normalize_text(p_source_writing_associate), ''),
      COALESCE(public.pp_normalize_text(p_source_type), ''),
      COALESCE(public.pp_normalize_text(p_source_transaction_type), ''),
      COALESCE(p_source_income_cents::text, ''),
      public.pp_commission_import_rate_text(p_source_split_rate),
      public.pp_commission_import_rate_text(p_source_gross_rate)
    )
  );
$$;

REVOKE ALL ON FUNCTION public.pp_commission_import_transaction_fingerprint(
  text, text, text, date, text, text, text, text, bigint, numeric, numeric
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_commission_import_match_carrier(p_source_company text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_norm text := public.pp_normalize_text(p_source_company);
  v_id uuid;
BEGIN
  IF v_norm IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT c.id INTO v_id
  FROM public.carriers c
  WHERE c.deleted_at IS NULL
    AND c.is_active = true
    AND (
      c.name_normalized = v_norm
      OR c.code_normalized = public.pp_normalize_carrier_code(p_source_company)
    );
  IF FOUND THEN
    RETURN v_id;
  END IF;

  SELECT a.carrier_id INTO v_id
  FROM public.commission_import_carrier_aliases a
  JOIN public.carriers c ON c.id = a.carrier_id
  WHERE a.source_label_normalized = v_norm
    AND c.deleted_at IS NULL
    AND c.is_active = true;
  IF FOUND THEN
    RETURN v_id;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.pp_commission_import_match_carrier(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_commission_import_refresh_batch_counts(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  UPDATE public.commission_import_batches b
  SET
    row_count = s.n,
    ready_count = s.ready_n,
    review_count = s.review_n,
    duplicate_count = s.dup_n,
    ignored_count = s.ign_n,
    posted_count = s.posted_n,
    failed_count = s.fail_n
  FROM (
    SELECT
      count(*)::integer AS n,
      count(*) FILTER (
        WHERE r.review_status = 'ready_to_post'
          AND r.posted_commission_event_id IS NULL
      )::integer AS ready_n,
      count(*) FILTER (
        WHERE r.review_status IN (
          'review_duplicate_candidate',
          'review_policy_match',
          'review_advisor_match',
          'review_split_attribution',
          'review_transaction_type'
        )
      )::integer AS review_n,
      count(*) FILTER (WHERE r.review_status = 'duplicate')::integer AS dup_n,
      count(*) FILTER (
        WHERE r.review_status IN ('ignored_nonwriting', 'ignored_nonpolicy')
      )::integer AS ign_n,
      count(*) FILTER (
        WHERE r.posted_commission_event_id IS NOT NULL
      )::integer AS posted_n,
      count(*) FILTER (
        WHERE r.review_status IN ('invalid_amount', 'invalid_source_identity')
      )::integer AS fail_n
    FROM public.commission_import_rows r
    WHERE r.batch_id = p_batch_id
  ) s
  WHERE b.id = p_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pp_commission_import_refresh_batch_counts(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_commission_import_classify_row(
  p_batch public.commission_import_batches,
  p_section text,
  p_company text,
  p_policy_number text,
  p_writing_associate text,
  p_client text,
  p_source_type text,
  p_income_cents bigint,
  p_is_chargeback_visual boolean,
  p_split_rate numeric,
  OUT o_status text,
  OUT o_reason text,
  OUT o_carrier_id uuid,
  OUT o_application_id uuid,
  OUT o_allocation_id uuid,
  OUT o_advisor_id uuid,
  OUT o_event_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_type text := public.pp_normalize_text(p_source_type);
  v_payee text := public.pp_commission_import_household_key(p_batch.payee_name);
  v_writer text := public.pp_commission_import_household_key(p_writing_associate);
  v_is_household boolean;
  v_policy_norm text := public.pp_normalize_text(p_policy_number);
  v_app_count integer := 0;
  v_alloc_count integer := 0;
BEGIN
  o_status := 'review_transaction_type';
  o_reason := 'unclassified';
  o_carrier_id := NULL;
  o_application_id := NULL;
  o_allocation_id := NULL;
  o_advisor_id := NULL;
  o_event_type := NULL;

  IF p_section = 'additional_commissions' THEN
    o_status := 'ignored_nonpolicy';
    o_reason := 'additional_commissions';
    RETURN;
  END IF;

  IF p_income_cents IS NULL OR p_income_cents = 0 THEN
    o_status := 'invalid_amount';
    o_reason := 'income_cents_required_nonzero';
    RETURN;
  END IF;

  IF v_policy_norm IS NULL
     AND public.pp_normalize_text(p_company) IS NULL
     AND v_writer IS NULL
     AND p_income_cents IS NULL THEN
    o_status := 'invalid_source_identity';
    o_reason := 'missing_source_identity';
    RETURN;
  END IF;

  v_is_household := (
    v_payee IS NOT NULL
    AND v_writer IS NOT NULL
    AND v_payee = v_writer
  );

  o_carrier_id := public.pp_commission_import_match_carrier(p_company);

  IF v_type IS NULL OR v_type NOT IN ('commission', 'override') THEN
    o_status := 'review_transaction_type';
    o_reason := 'unsupported_source_type';
    RETURN;
  END IF;

  IF v_type = 'override' THEN
    o_event_type := NULL;
    IF NOT v_is_household THEN
      o_status := 'ignored_nonwriting';
      o_reason := 'override_nonwriting';
      RETURN;
    END IF;
    IF COALESCE(p_split_rate, 0) <> 0 THEN
      o_status := 'review_split_attribution';
      o_reason := 'household_override_split';
      RETURN;
    END IF;
    o_status := 'review_advisor_match';
    o_reason := 'household_override_ambiguous';
    RETURN;
  END IF;

  -- Type Commission: candidate writing cash. Still requires resolution.
  -- Household names may auto-resolve only when exactly one live writing
  -- allocation exists. Gross %, ED/FA/SFA rank, and name order never
  -- choose among multiple writing advisors.
  IF p_income_cents > 0 THEN
    o_event_type := 'paid';
  ELSIF p_is_chargeback_visual THEN
    o_event_type := 'chargeback';
  ELSE
    o_status := 'review_transaction_type';
    o_reason := 'negative_without_chargeback_visual';
    o_event_type := NULL;
    RETURN;
  END IF;

  IF o_carrier_id IS NULL OR v_policy_norm IS NULL THEN
    o_status := 'review_policy_match';
    o_reason := CASE
      WHEN o_carrier_id IS NULL THEN 'unknown_carrier'
      ELSE 'missing_policy_number'
    END;
    o_event_type := o_event_type;
    RETURN;
  END IF;

  -- Client name is never a posting key. Fuzzy client matching cannot
  -- produce ready_to_post.

  SELECT count(*) INTO v_app_count
  FROM public.policy_applications a
  WHERE a.deleted_at IS NULL
    AND a.carrier_id = o_carrier_id
    AND a.policy_number_normalized = v_policy_norm;

  IF v_app_count <> 1 THEN
    o_status := 'review_policy_match';
    o_reason := CASE
      WHEN v_app_count = 0 THEN 'policy_not_found'
      ELSE 'multiple_policy_matches'
    END;
    RETURN;
  END IF;

  SELECT a.id INTO o_application_id
  FROM public.policy_applications a
  WHERE a.deleted_at IS NULL
    AND a.carrier_id = o_carrier_id
    AND a.policy_number_normalized = v_policy_norm;

  IF NOT v_is_household THEN
    o_status := 'review_advisor_match';
    o_reason := CASE
      WHEN v_writer IS NULL THEN 'missing_writing_associate'
      ELSE 'unknown_writing_associate'
    END;
    RETURN;
  END IF;

  SELECT count(*) INTO v_alloc_count
  FROM public.policy_agent_allocations al
  WHERE al.application_id = o_application_id
    AND al.allocation_role = 'writing'
    AND al.recipient_type = 'advisor'
    AND al.effective_to IS NULL
    AND al.advisor_id IS NOT NULL;

  IF v_alloc_count = 0 THEN
    o_status := 'review_advisor_match';
    o_reason := 'no_writing_allocation';
    RETURN;
  END IF;

  IF v_alloc_count > 1 THEN
    o_status := 'review_split_attribution';
    o_reason := 'multiple_writing_allocations';
    o_allocation_id := NULL;
    o_advisor_id := NULL;
    RETURN;
  END IF;

  SELECT al.id, al.advisor_id
  INTO o_allocation_id, o_advisor_id
  FROM public.policy_agent_allocations al
  WHERE al.application_id = o_application_id
    AND al.allocation_role = 'writing'
    AND al.recipient_type = 'advisor'
    AND al.effective_to IS NULL
    AND al.advisor_id IS NOT NULL;

  o_status := 'ready_to_post';
  o_reason := 'exact_carrier_policy_single_writing_allocation';
END;
$$;

REVOKE ALL ON FUNCTION public.pp_commission_import_classify_row(
  public.commission_import_batches, text, text, text, text, text, text, bigint, boolean, numeric
) FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION F — Owner RPCs
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_commission_import_batch(
  p_source_type text,
  p_source_file text,
  p_file_sha256 text,
  p_statement_identifier text,
  p_fs_code text DEFAULT NULL,
  p_statement_date date DEFAULT NULL,
  p_source_created_at timestamptz DEFAULT NULL,
  p_payee_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_type text := NULLIF(btrim(COALESCE(p_source_type, '')), '');
  v_file text := public.pp_writing_commission_trim(p_source_file, 500);
  v_sha text := lower(NULLIF(btrim(COALESCE(p_file_sha256, '')), ''));
  v_stmt text := public.pp_writing_commission_trim(p_statement_identifier, 200);
  v_fs text := public.pp_writing_commission_trim(p_fs_code, 40);
  v_payee text := public.pp_writing_commission_trim(p_payee_name, 200);
  v_existing public.commission_import_batches;
  v_row public.commission_import_batches;
  v_audit uuid;
  v_is_dup boolean;
BEGIN
  PERFORM public.pp_assert_owner();

  IF v_type IS NULL OR v_file IS NULL OR v_sha IS NULL OR v_stmt IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF v_type IS DISTINCT FROM 'experior_paid_report' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF v_sha !~ '^[0-9a-f]{64}$' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  SELECT * INTO v_existing
  FROM public.commission_import_batches
  WHERE file_sha256 = v_sha
    AND import_status = 'open';
  v_is_dup := FOUND;

  PERFORM set_config('crm.rpc_context', 'create_commission_import_batch', true);
  BEGIN
    IF v_is_dup THEN
      INSERT INTO public.commission_import_batches (
        source_type, source_file, file_sha256, statement_identifier,
        fs_code, statement_date, source_created_at, payee_name,
        uploaded_by_user_id, import_status, duplicate_of_batch_id
      ) VALUES (
        v_type, v_file, v_sha, v_stmt,
        v_fs, p_statement_date, p_source_created_at, v_payee,
        auth.uid(), 'duplicate_file', v_existing.id
      )
      RETURNING * INTO v_row;

      v_audit := public.crm_write_audit(
        'create_commission_import_batch',
        'commission_import_batches',
        v_row.id,
        NULL,
        jsonb_build_object('duplicate', true, 'batch', to_jsonb(v_row))
      );
      PERFORM public.crm_clear_rpc_context();
      RETURN jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'batch', to_jsonb(v_row),
        'original_batch_id', v_existing.id,
        'audit_id', v_audit
      );
    END IF;

    INSERT INTO public.commission_import_batches (
      source_type, source_file, file_sha256, statement_identifier,
      fs_code, statement_date, source_created_at, payee_name,
      uploaded_by_user_id, import_status
    ) VALUES (
      v_type, v_file, v_sha, v_stmt,
      v_fs, p_statement_date, p_source_created_at, v_payee,
      auth.uid(), 'open'
    )
    RETURNING * INTO v_row;

    v_audit := public.crm_write_audit(
      'create_commission_import_batch',
      'commission_import_batches',
      v_row.id,
      NULL,
      jsonb_build_object('duplicate', false, 'batch', to_jsonb(v_row))
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', false,
      'batch', to_jsonb(v_row),
      'audit_id', v_audit
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.create_commission_import_batch(
  text, text, text, text, text, date, timestamptz, text
) IS
  'Owner-only. Creates an import batch for an Experior paid report. Identical file SHA-256 returns a duplicate_file batch pointing at the original open batch and does not create money.';

CREATE OR REPLACE FUNCTION public.stage_commission_import_rows(
  p_batch_id uuid,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_batch public.commission_import_batches;
  v_el jsonb;
  v_section text;
  v_page integer;
  v_ordinal integer;
  v_date date;
  v_paynum text;
  v_company text;
  v_product text;
  v_policy text;
  v_writer text;
  v_client text;
  v_aep bigint;
  v_ccp bigint;
  v_gross numeric;
  v_factor numeric;
  v_net numeric;
  v_split numeric;
  v_type text;
  v_txn text;
  v_income bigint;
  v_visual boolean;
  v_key text;
  v_fp text;
  v_class record;
  v_existing public.commission_import_rows;
  v_row public.commission_import_rows;
  v_created integer := 0;
  v_dup integer := 0;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_audit uuid;
  v_prior_fp boolean;
BEGIN
  PERFORM public.pp_assert_owner();
  IF p_batch_id IS NULL OR p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF jsonb_array_length(p_rows) = 0 OR jsonb_array_length(p_rows) > 500 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF octet_length(p_rows::text) > 262144 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  SELECT * INTO v_batch
  FROM public.commission_import_batches
  WHERE id = p_batch_id;
  IF NOT FOUND THEN
    PERFORM public.pp_raise('not_found');
  END IF;
  IF v_batch.import_status IS DISTINCT FROM 'open' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  PERFORM set_config('crm.rpc_context', 'stage_commission_import_rows', true);
  BEGIN
    FOR v_el IN SELECT value FROM jsonb_array_elements(p_rows)
    LOOP
      IF jsonb_typeof(v_el) <> 'object' THEN
        PERFORM public.pp_raise('invalid_payload');
      END IF;

      v_section := public.pp_json_text(v_el, 'source_section');
      v_page := public.pp_json_bigint(v_el, 'source_page');
      v_ordinal := public.pp_json_bigint(v_el, 'source_row_ordinal');
      v_date := public.pp_json_date(v_el, 'transaction_date');
      v_paynum := public.pp_writing_commission_trim(
        public.pp_json_text(v_el, 'payment_number'), 40
      );
      v_company := public.pp_writing_commission_trim(
        public.pp_json_text(v_el, 'source_company'), 200
      );
      v_product := public.pp_writing_commission_trim(
        public.pp_json_text(v_el, 'source_product'), 200
      );
      v_policy := public.pp_writing_commission_trim(
        public.pp_json_text(v_el, 'source_policy_number'), 60
      );
      v_writer := public.pp_writing_commission_trim(
        public.pp_json_text(v_el, 'source_writing_associate'), 200
      );
      v_client := public.pp_writing_commission_trim(
        public.pp_json_text(v_el, 'source_client'), 200
      );
      v_aep := public.pp_json_bigint(v_el, 'agent_entered_premium_cents');
      v_ccp := public.pp_json_bigint(v_el, 'company_calculated_premium_cents');
      BEGIN
        v_gross := NULLIF(btrim(COALESCE(v_el ->> 'source_gross_rate', '')), '')::numeric;
        v_factor := NULLIF(btrim(COALESCE(v_el ->> 'source_factor_rate', '')), '')::numeric;
        v_net := NULLIF(btrim(COALESCE(v_el ->> 'source_net_rate', '')), '')::numeric;
        v_split := NULLIF(btrim(COALESCE(v_el ->> 'source_split_rate', '')), '')::numeric;
      EXCEPTION WHEN others THEN
        PERFORM public.pp_raise('invalid_payload');
      END;
      v_type := public.pp_writing_commission_trim(
        public.pp_json_text(v_el, 'source_type'), 80
      );
      v_txn := public.pp_writing_commission_trim(
        public.pp_json_text(v_el, 'source_transaction_type'), 80
      );
      v_income := public.pp_json_bigint(v_el, 'source_income_cents');
      v_visual := COALESCE((v_el ->> 'source_is_chargeback_visual')::boolean, false);

      IF v_section IS NULL OR v_income IS NULL OR v_ordinal IS NULL THEN
        PERFORM public.pp_raise('missing_required_fields');
      END IF;
      IF v_ordinal <= 0 THEN
        PERFORM public.pp_raise('invalid_payload');
      END IF;

      -- Exact source identity for this file + section + ordinal.
      v_key := public.pp_commission_import_source_row_key(
        v_batch.file_sha256,
        v_section,
        v_ordinal
      );
      -- Cross-report heuristic. Excludes file SHA and statement identity.
      v_fp := public.pp_commission_import_transaction_fingerprint(
        v_batch.fs_code,
        v_company,
        v_policy,
        v_date,
        v_paynum,
        v_writer,
        v_type,
        v_txn,
        v_income,
        v_split,
        v_gross
      );

      v_existing := NULL;
      SELECT * INTO v_existing
      FROM public.commission_import_rows r
      WHERE r.batch_id = p_batch_id
        AND r.source_row_key = v_key;
      IF v_existing.id IS NOT NULL THEN
        v_dup := v_dup + 1;
        v_ids := v_ids || v_existing.id;
        CONTINUE;
      END IF;

      SELECT * INTO v_class
      FROM public.pp_commission_import_classify_row(
        v_batch, v_section, v_company, v_policy, v_writer, v_client,
        v_type, v_income, v_visual, v_split
      );

      -- Overlay cross-report fingerprint. Never UNIQUE-reject on the
      -- heuristic. Strong paid-over-time identity becomes duplicate;
      -- ordinary insurance matches become review_duplicate_candidate.
      IF v_class.o_status NOT IN (
        'ignored_nonwriting',
        'ignored_nonpolicy',
        'invalid_amount',
        'invalid_source_identity',
        'duplicate'
      ) THEN
        SELECT EXISTS (
          SELECT 1
          FROM public.commission_import_rows r
          WHERE r.transaction_fingerprint = v_fp
            AND r.review_status <> 'duplicate'
        ) INTO v_prior_fp;

        IF v_prior_fp THEN
          IF public.pp_normalize_text(v_paynum) IS NOT NULL THEN
            v_class.o_status := 'duplicate';
            v_class.o_reason := 'cross_report_payment_identity';
            v_class.o_application_id := NULL;
            v_class.o_allocation_id := NULL;
            v_class.o_advisor_id := NULL;
            v_class.o_event_type := NULL;
          ELSE
            v_class.o_status := 'review_duplicate_candidate';
            v_class.o_reason := 'cross_report_fingerprint_ambiguous';
          END IF;
        END IF;
      END IF;

      INSERT INTO public.commission_import_rows (
        batch_id, source_section, source_page, source_row_ordinal, source_row_key,
        transaction_fingerprint,
        transaction_date, payment_number, source_company, source_product,
        source_policy_number, source_writing_associate, source_client,
        agent_entered_premium_cents, company_calculated_premium_cents,
        source_gross_rate, source_factor_rate, source_net_rate, source_split_rate,
        source_type, source_transaction_type, source_income_cents,
        source_is_chargeback_visual, review_status, review_reason,
        resolved_carrier_id, resolved_application_id, resolved_allocation_id,
        resolved_advisor_id, resolved_event_type
      ) VALUES (
        p_batch_id, v_section, v_page, v_ordinal, v_key,
        v_fp,
        v_date, v_paynum, v_company, v_product,
        v_policy, v_writer, v_client,
        v_aep, v_ccp,
        v_gross, v_factor, v_net, v_split,
        v_type, v_txn, v_income,
        v_visual, v_class.o_status, v_class.o_reason,
        v_class.o_carrier_id, v_class.o_application_id, v_class.o_allocation_id,
        v_class.o_advisor_id, v_class.o_event_type
      )
      RETURNING * INTO v_row;

      v_created := v_created + 1;
      v_ids := v_ids || v_row.id;
    END LOOP;

    PERFORM public.pp_commission_import_refresh_batch_counts(p_batch_id);

    v_audit := public.crm_write_audit(
      'stage_commission_import_rows',
      'commission_import_batches',
      p_batch_id,
      NULL,
      jsonb_build_object(
        'created', v_created,
        'same_batch_existing', v_dup,
        'row_ids', to_jsonb(v_ids)
      )
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN jsonb_build_object(
      'ok', true,
      'created', v_created,
      'same_batch_existing', v_dup,
      'row_ids', to_jsonb(v_ids),
      'audit_id', v_audit
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.stage_commission_import_rows(uuid, jsonb) IS
  'Owner-only. Stages parsed source rows. source_row_key is exact file+section+ordinal identity. transaction_fingerprint is a non-unique heuristic. Same-batch locator retries return the original row. Strong payment-number repeats become duplicate; ambiguous fingerprint matches become review_duplicate_candidate. Never posts 035 money.';

CREATE OR REPLACE FUNCTION public.review_commission_import_row(
  p_row_id uuid,
  p_reason text,
  p_review_status text DEFAULT NULL,
  p_resolved_application_id uuid DEFAULT NULL,
  p_resolved_allocation_id uuid DEFAULT NULL,
  p_resolved_event_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_reason text := public.pp_writing_commission_trim(p_reason, 500);
  v_status text := NULLIF(btrim(COALESCE(p_review_status, '')), '');
  v_event text := NULLIF(btrim(COALESCE(p_resolved_event_type, '')), '');
  v_row public.commission_import_rows;
  v_before jsonb;
  v_alloc public.policy_agent_allocations;
  v_audit uuid;
BEGIN
  PERFORM public.pp_assert_owner();
  IF p_row_id IS NULL OR v_reason IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;

  SELECT * INTO v_row
  FROM public.commission_import_rows
  WHERE id = p_row_id;
  IF NOT FOUND THEN
    PERFORM public.pp_raise('not_found');
  END IF;
  IF v_row.posted_commission_event_id IS NOT NULL THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  IF v_status IS NOT NULL AND v_status NOT IN (
    'ready_to_post',
    'duplicate',
    'review_duplicate_candidate',
    'review_policy_match',
    'review_advisor_match',
    'review_split_attribution',
    'review_transaction_type',
    'ignored_nonwriting',
    'ignored_nonpolicy',
    'invalid_amount',
    'invalid_source_identity'
  ) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF v_event IS NOT NULL AND v_event NOT IN (
    'paid', 'adjustment', 'chargeback', 'recovery'
  ) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  v_before := to_jsonb(v_row);

  IF p_resolved_allocation_id IS NOT NULL THEN
    SELECT * INTO v_alloc
    FROM public.policy_agent_allocations
    WHERE id = p_resolved_allocation_id
      AND allocation_role = 'writing'
      AND recipient_type = 'advisor'
      AND effective_to IS NULL;
    IF NOT FOUND THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    IF p_resolved_application_id IS NOT NULL
       AND v_alloc.application_id IS DISTINCT FROM p_resolved_application_id THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
  END IF;

  IF COALESCE(v_status, v_row.review_status) = 'ready_to_post' THEN
    IF COALESCE(p_resolved_application_id, v_row.resolved_application_id) IS NULL
       OR COALESCE(p_resolved_allocation_id, v_row.resolved_allocation_id) IS NULL
       OR COALESCE(v_event, v_row.resolved_event_type) IS NULL THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
  END IF;

  PERFORM set_config('crm.rpc_context', 'review_commission_import_row', true);
  BEGIN
    UPDATE public.commission_import_rows
    SET
      review_status = COALESCE(v_status, review_status),
      review_reason = v_reason,
      resolved_application_id = COALESCE(
        p_resolved_application_id, resolved_application_id
      ),
      resolved_allocation_id = COALESCE(
        p_resolved_allocation_id, resolved_allocation_id
      ),
      resolved_advisor_id = COALESCE(v_alloc.advisor_id, resolved_advisor_id),
      resolved_event_type = COALESCE(v_event, resolved_event_type),
      reviewed_by_user_id = auth.uid(),
      reviewed_at = now()
    WHERE id = p_row_id
    RETURNING * INTO v_row;

    PERFORM public.pp_commission_import_refresh_batch_counts(v_row.batch_id);

    v_audit := public.crm_write_audit(
      'review_commission_import_row',
      'commission_import_rows',
      v_row.id,
      v_before,
      to_jsonb(v_row)
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN jsonb_build_object(
      'ok', true,
      'row', to_jsonb(v_row),
      'audit_id', v_audit
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.review_commission_import_row(
  uuid, text, text, uuid, uuid, text
) IS
  'Owner-only. Updates review/resolution on an unposted import row. Source facts stay immutable. Posted rows cannot be reassigned. Audited. Does not post 035 money.';

CREATE OR REPLACE FUNCTION public.post_commission_import_row(
  p_row_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_reason text := public.pp_writing_commission_trim(p_reason, 500);
  v_row public.commission_import_rows;
  v_batch public.commission_import_batches;
  v_key text;
  v_result jsonb;
  v_event jsonb;
  v_event_id uuid;
  v_audit uuid;
BEGIN
  PERFORM public.pp_assert_owner();
  IF p_row_id IS NULL OR v_reason IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;

  SELECT * INTO v_row
  FROM public.commission_import_rows
  WHERE id = p_row_id;
  IF NOT FOUND THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  SELECT * INTO v_batch
  FROM public.commission_import_batches
  WHERE id = v_row.batch_id;

  IF v_row.review_status IS DISTINCT FROM 'ready_to_post' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF v_row.resolved_application_id IS NULL
     OR v_row.resolved_allocation_id IS NULL
     OR v_row.resolved_advisor_id IS NULL
     OR v_row.resolved_event_type IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF v_row.source_section = 'additional_commissions'
     OR v_row.review_status IN (
       'ignored_nonwriting',
       'ignored_nonpolicy',
       'review_duplicate_candidate',
       'review_policy_match',
       'review_advisor_match',
       'review_split_attribution',
       'review_transaction_type',
       'invalid_amount',
       'invalid_source_identity',
       'duplicate'
     ) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  -- Income is the posting amount. Advance % is not re-applied.
  -- Exact import-row identity, never the heuristic fingerprint.
  v_key := public.pp_writing_commission_trim(
    '036:' || v_batch.id::text || ':' || v_row.source_row_key,
    200
  );

  v_result := public.record_policy_writing_commission_event(
    v_row.resolved_application_id,
    v_row.resolved_event_type,
    v_row.source_income_cents,
    v_reason,
    v_key,
    v_row.resolved_allocation_id,
    NULL,
    v_row.resolved_carrier_id,
    NULL,
    v_batch.statement_identifier,
    v_batch.statement_date,
    v_row.transaction_date,
    v_row.source_policy_number,
    v_batch.source_file,
    v_row.source_row_ordinal,
    left(
      concat_ws(
        ' ',
        v_row.source_section,
        v_row.source_type,
        v_row.source_transaction_type
      ),
      2000
    ),
    v_batch.id::text
  );

  v_event := v_result -> 'event';
  v_event_id := (v_event ->> 'id')::uuid;
  IF v_event_id IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  IF v_row.posted_commission_event_id IS NOT NULL THEN
    IF v_row.posted_commission_event_id IS DISTINCT FROM v_event_id THEN
      PERFORM public.pp_raise('idempotency_conflict');
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'row', to_jsonb(v_row),
      'event', v_event
    );
  END IF;

  PERFORM set_config('crm.rpc_context', 'post_commission_import_row', true);
  BEGIN
    UPDATE public.commission_import_rows
    SET posted_commission_event_id = v_event_id
    WHERE id = p_row_id
    RETURNING * INTO v_row;

    PERFORM public.pp_commission_import_refresh_batch_counts(v_row.batch_id);

    v_audit := public.crm_write_audit(
      'post_commission_import_row',
      'commission_import_rows',
      v_row.id,
      NULL,
      jsonb_build_object(
        'posted_commission_event_id', v_event_id,
        'event', v_event
      )
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', COALESCE((v_result ->> 'duplicate')::boolean, false),
      'row', to_jsonb(v_row),
      'event', v_event,
      'audit_id', v_audit
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.post_commission_import_row(uuid, text) IS
  'Owner-only. Posts one ready_to_post import row through record_policy_writing_commission_event. Amount is source_income_cents. Idempotency key is 036:{batch_id}:{source_row_key}. transaction_fingerprint is never used as the 035 key and is never written to carrier_transaction_id. Carrier transaction ids stay NULL unless the source provided one. Does not mutate 034 expected snapshots. Ignored/review/invalid/duplicate-candidate rows cannot post.';

CREATE OR REPLACE FUNCTION public.upsert_commission_import_carrier_alias(
  p_source_label text,
  p_carrier_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_label text := public.pp_writing_commission_trim(p_source_label, 200);
  v_norm text;
  v_row public.commission_import_carrier_aliases;
  v_audit uuid;
BEGIN
  PERFORM public.pp_assert_owner();
  IF v_label IS NULL OR p_carrier_id IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  v_norm := public.pp_normalize_text(v_label);
  IF v_norm IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.carriers c
    WHERE c.id = p_carrier_id AND c.deleted_at IS NULL
  ) THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  PERFORM set_config(
    'crm.rpc_context',
    'upsert_commission_import_carrier_alias',
    true
  );
  BEGIN
    INSERT INTO public.commission_import_carrier_aliases (
      source_label, source_label_normalized, carrier_id, created_by_user_id
    ) VALUES (
      v_label, v_norm, p_carrier_id, auth.uid()
    )
    ON CONFLICT (source_label_normalized) DO UPDATE
      SET carrier_id = EXCLUDED.carrier_id,
          source_label = EXCLUDED.source_label
    RETURNING * INTO v_row;

    v_audit := public.crm_write_audit(
      'upsert_commission_import_carrier_alias',
      'commission_import_carrier_aliases',
      v_row.id,
      NULL,
      to_jsonb(v_row)
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN jsonb_build_object(
      'ok', true,
      'alias', to_jsonb(v_row),
      'audit_id', v_audit
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.upsert_commission_import_carrier_alias(text, uuid) IS
  'Owner-only. Maps an Experior source company label to a catalog carrier without renaming the carrier.';

-- =============================================================================
-- SECTION G — RLS / grants
-- Owner-only staging. Advisors do not see raw import rows (override/downline).
-- Advisors continue to see only their finalized 035 ledger.
-- =============================================================================

ALTER TABLE public.commission_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_import_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.commission_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_import_rows FORCE ROW LEVEL SECURITY;
ALTER TABLE public.commission_import_carrier_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_import_carrier_aliases FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commission_import_batches_select
  ON public.commission_import_batches;
CREATE POLICY commission_import_batches_select
  ON public.commission_import_batches
  FOR SELECT TO authenticated
  USING (public.crm_is_owner());

DROP POLICY IF EXISTS commission_import_rows_select
  ON public.commission_import_rows;
CREATE POLICY commission_import_rows_select
  ON public.commission_import_rows
  FOR SELECT TO authenticated
  USING (public.crm_is_owner());

DROP POLICY IF EXISTS commission_import_carrier_aliases_select
  ON public.commission_import_carrier_aliases;
CREATE POLICY commission_import_carrier_aliases_select
  ON public.commission_import_carrier_aliases
  FOR SELECT TO authenticated
  USING (public.crm_is_owner());

REVOKE ALL ON TABLE public.commission_import_batches FROM PUBLIC;
REVOKE ALL ON TABLE public.commission_import_batches FROM anon;
REVOKE ALL ON TABLE public.commission_import_batches FROM authenticated;
REVOKE ALL ON TABLE public.commission_import_rows FROM PUBLIC;
REVOKE ALL ON TABLE public.commission_import_rows FROM anon;
REVOKE ALL ON TABLE public.commission_import_rows FROM authenticated;
REVOKE ALL ON TABLE public.commission_import_carrier_aliases FROM PUBLIC;
REVOKE ALL ON TABLE public.commission_import_carrier_aliases FROM anon;
REVOKE ALL ON TABLE public.commission_import_carrier_aliases FROM authenticated;

GRANT SELECT ON TABLE public.commission_import_batches TO authenticated;
GRANT SELECT ON TABLE public.commission_import_rows TO authenticated;
GRANT SELECT ON TABLE public.commission_import_carrier_aliases TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.commission_import_batches
  FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.commission_import_rows
  FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.commission_import_carrier_aliases
  FROM authenticated;

GRANT ALL ON TABLE public.commission_import_batches TO service_role;
GRANT ALL ON TABLE public.commission_import_rows TO service_role;
GRANT ALL ON TABLE public.commission_import_carrier_aliases TO service_role;

REVOKE ALL ON FUNCTION public.create_commission_import_batch(
  text, text, text, text, text, date, timestamptz, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_commission_import_batch(
  text, text, text, text, text, date, timestamptz, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.stage_commission_import_rows(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stage_commission_import_rows(uuid, jsonb)
  TO authenticated;

REVOKE ALL ON FUNCTION public.review_commission_import_row(
  uuid, text, text, uuid, uuid, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_commission_import_row(
  uuid, text, text, uuid, uuid, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.post_commission_import_row(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_commission_import_row(uuid, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_commission_import_carrier_alias(text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_commission_import_carrier_alias(text, uuid)
  TO authenticated;

-- =============================================================================
-- End Migration 036
-- =============================================================================
