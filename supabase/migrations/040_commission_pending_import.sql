-- 040_commission_pending_import.sql
-- Source-confirmed Experior PENDING commission staging.
--
-- Adds:
--   public.commission_pending_import_batches
--   public.commission_pending_import_rows
--   owner RPCs: create_commission_pending_import_batch,
--               stage_commission_pending_import_rows
--
-- 040 is NOT a financial ledger. It does NOT write 035. There is no
-- Pending event_type. There is no posting RPC. 034 expected is unchanged.
-- 036 paid-report batches remain a separate source.
--
-- Writing-advisor compensation only. Type Override is ignored_nonwriting
-- and cannot become accepted_pending. additional_commissions is
-- ignored_nonpolicy. Statement amount and escrow are batch metadata only.
-- Source Income is the Pending amount. Rates/premium/split never compute it.
--
-- Current Pending for a later dashboard is derived from the latest
-- accepted_pending row per application + writing allocation. This
-- migration does not add a mutable current_pending column.
--
-- Reuses 036 helpers: source_row_key, transaction_fingerprint,
-- carrier match, household key. Does not reuse 036 tables.

-- =============================================================================
-- SECTION A — Pending batches
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.commission_pending_import_batches (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  source_type text NOT NULL,
  source_file text NOT NULL,
  file_sha256 text NOT NULL,
  statement_identifier text NOT NULL,
  fs_code text,
  statement_date date,
  source_created_at timestamptz,
  payee_name text,
  statement_amount_cents bigint,
  escrow_cents bigint,
  uploaded_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  import_status text NOT NULL DEFAULT 'open',
  duplicate_of_batch_id uuid
    REFERENCES public.commission_pending_import_batches (id) ON DELETE RESTRICT,
  row_count integer NOT NULL DEFAULT 0,
  accepted_count integer NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  ignored_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT commission_pending_batches_source_type_check
    CHECK (source_type IN ('experior_pending_report')),
  CONSTRAINT commission_pending_batches_source_file_check
    CHECK (
      source_file = btrim(source_file)
      AND char_length(source_file) BETWEEN 1 AND 500
    ),
  CONSTRAINT commission_pending_batches_sha256_check
    CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT commission_pending_batches_statement_id_check
    CHECK (
      statement_identifier = btrim(statement_identifier)
      AND char_length(statement_identifier) BETWEEN 1 AND 200
    ),
  CONSTRAINT commission_pending_batches_fs_code_check
    CHECK (
      fs_code IS NULL
      OR (fs_code = btrim(fs_code) AND char_length(fs_code) BETWEEN 1 AND 40)
    ),
  CONSTRAINT commission_pending_batches_payee_check
    CHECK (
      payee_name IS NULL
      OR (payee_name = btrim(payee_name) AND char_length(payee_name) BETWEEN 1 AND 200)
    ),
  CONSTRAINT commission_pending_batches_metadata_cents_check
    CHECK (
      (statement_amount_cents IS NULL OR statement_amount_cents >= 0)
      AND (escrow_cents IS NULL OR escrow_cents >= 0)
    ),
  CONSTRAINT commission_pending_batches_status_check
    CHECK (import_status IN ('open', 'duplicate_file')),
  CONSTRAINT commission_pending_batches_duplicate_shape_check
    CHECK (
      (import_status = 'duplicate_file' AND duplicate_of_batch_id IS NOT NULL)
      OR (import_status = 'open' AND duplicate_of_batch_id IS NULL)
    ),
  CONSTRAINT commission_pending_batches_counts_check
    CHECK (
      row_count >= 0
      AND accepted_count >= 0
      AND review_count >= 0
      AND duplicate_count >= 0
      AND ignored_count >= 0
      AND failed_count >= 0
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS commission_pending_batches_file_sha256_open_uidx
  ON public.commission_pending_import_batches (file_sha256)
  WHERE import_status = 'open';

CREATE INDEX IF NOT EXISTS commission_pending_batches_created_idx
  ON public.commission_pending_import_batches (created_at DESC);

DROP TRIGGER IF EXISTS commission_pending_import_batches_set_updated_at
  ON public.commission_pending_import_batches;
CREATE TRIGGER commission_pending_import_batches_set_updated_at
  BEFORE UPDATE ON public.commission_pending_import_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.commission_pending_import_batches IS
  'One uploaded Experior Pending Report. Duplicate file SHA-256 is identified. statement_amount_cents and escrow_cents are statement metadata only, never writing-advisor Pending. Not a ledger. Never posts 035.';
COMMENT ON COLUMN public.commission_pending_import_batches.statement_amount_cents IS
  'Header statement total. Metadata only. Not writing-advisor Pending.';
COMMENT ON COLUMN public.commission_pending_import_batches.escrow_cents IS
  'Header escrow. Metadata only. Not writing-advisor Pending.';

-- =============================================================================
-- SECTION B — Pending rows
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.commission_pending_import_rows (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  batch_id uuid NOT NULL
    REFERENCES public.commission_pending_import_batches (id) ON DELETE RESTRICT,
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
  source_agent_entered_premium_cents bigint,
  source_company_calculated_premium_cents bigint,
  source_gross_rate numeric(12, 6),
  source_factor_rate numeric(12, 6),
  source_net_rate numeric(12, 6),
  source_split_rate numeric(12, 6),
  source_type text,
  source_transaction_type text,
  source_income_cents bigint NOT NULL,
  source_is_negative boolean GENERATED ALWAYS AS (source_income_cents < 0) STORED,
  source_is_chargeback_visual boolean NOT NULL DEFAULT false,
  pending_review_status text NOT NULL,
  pending_review_reason text,
  resolved_carrier_id uuid REFERENCES public.carriers (id) ON DELETE RESTRICT,
  resolved_application_id uuid
    REFERENCES public.policy_applications (id) ON DELETE RESTRICT,
  resolved_allocation_id uuid
    REFERENCES public.policy_agent_allocations (id) ON DELETE RESTRICT,
  resolved_advisor_id uuid
    REFERENCES public.advisor_profiles (id) ON DELETE RESTRICT,
  reviewed_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT commission_pending_rows_section_check
    CHECK (source_section IN (
      'insurance',
      'insurance_paid_over_12_months',
      'additional_commissions'
    )),
  CONSTRAINT commission_pending_rows_page_check
    CHECK (source_page IS NULL OR source_page > 0),
  CONSTRAINT commission_pending_rows_ordinal_check
    CHECK (source_row_ordinal > 0),
  CONSTRAINT commission_pending_rows_key_check
    CHECK (source_row_key ~ '^[0-9a-f]{64}$'),
  CONSTRAINT commission_pending_rows_fingerprint_check
    CHECK (transaction_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT commission_pending_rows_status_check
    CHECK (pending_review_status IN (
      'accepted_pending',
      'duplicate',
      'review_duplicate_candidate',
      'review_policy_match',
      'review_advisor_match',
      'review_split_attribution',
      'ignored_nonwriting',
      'ignored_nonpolicy',
      'invalid_amount',
      'invalid_source_identity'
    )),
  CONSTRAINT commission_pending_rows_accepted_safety_check
    CHECK (
      pending_review_status IS DISTINCT FROM 'accepted_pending'
      OR (
        lower(btrim(COALESCE(source_type, ''))) = 'commission'
        AND source_section IN ('insurance', 'insurance_paid_over_12_months')
        AND source_income_cents > 0
        AND resolved_application_id IS NOT NULL
        AND resolved_allocation_id IS NOT NULL
        AND resolved_advisor_id IS NOT NULL
        AND resolved_carrier_id IS NOT NULL
      )
    ),
  CONSTRAINT commission_pending_rows_reason_len_check
    CHECK (
      pending_review_reason IS NULL
      OR char_length(btrim(pending_review_reason)) BETWEEN 1 AND 500
    ),
  CONSTRAINT commission_pending_rows_text_trim_check
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

CREATE UNIQUE INDEX IF NOT EXISTS commission_pending_rows_batch_key_uidx
  ON public.commission_pending_import_rows (batch_id, source_row_key);

CREATE UNIQUE INDEX IF NOT EXISTS commission_pending_rows_batch_locator_uidx
  ON public.commission_pending_import_rows (batch_id, source_section, source_row_ordinal);

CREATE INDEX IF NOT EXISTS commission_pending_rows_fingerprint_idx
  ON public.commission_pending_import_rows (transaction_fingerprint)
  WHERE pending_review_status <> 'duplicate';

CREATE INDEX IF NOT EXISTS commission_pending_rows_batch_status_idx
  ON public.commission_pending_import_rows (batch_id, pending_review_status);

CREATE INDEX IF NOT EXISTS commission_pending_rows_current_alloc_idx
  ON public.commission_pending_import_rows (
    resolved_application_id,
    resolved_allocation_id,
    created_at DESC
  )
  WHERE pending_review_status = 'accepted_pending';

DROP TRIGGER IF EXISTS commission_pending_import_rows_set_updated_at
  ON public.commission_pending_import_rows;
CREATE TRIGGER commission_pending_import_rows_set_updated_at
  BEFORE UPDATE ON public.commission_pending_import_rows
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.commission_pending_import_rows IS
  'One Experior Pending Report line. Source facts are immutable. accepted_pending is source-confirmed writing Pending after unique resolution. Never posts 035. No ledger event foreign key.';
COMMENT ON COLUMN public.commission_pending_import_rows.source_income_cents IS
  'Authoritative Pending amount from source Income. Never recomputed from premium, rates, split, statement_amount_cents, or escrow_cents.';
COMMENT ON COLUMN public.commission_pending_import_rows.pending_review_status IS
  'Pending-review status only. Not a 035 event_type. ready_to_post / posted / paid / eligible / released are not used.';

-- =============================================================================
-- SECTION C — Accepted-pending allocation safety
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_commission_pending_accepted_safety()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_alloc public.policy_agent_allocations;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.pending_review_status IN (
       'ignored_nonwriting',
       'ignored_nonpolicy',
       'duplicate'
     )
     AND NEW.pending_review_status = 'accepted_pending' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  IF lower(btrim(COALESCE(NEW.source_type, ''))) = 'override'
     AND NEW.pending_review_status = 'accepted_pending' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF NEW.source_section = 'additional_commissions'
     AND NEW.pending_review_status = 'accepted_pending' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  IF NEW.pending_review_status = 'accepted_pending' THEN
    IF NEW.resolved_allocation_id IS NULL
       OR NEW.resolved_application_id IS NULL
       OR NEW.resolved_advisor_id IS NULL THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    SELECT * INTO v_alloc
    FROM public.policy_agent_allocations
    WHERE id = NEW.resolved_allocation_id
      AND allocation_role = 'writing'
      AND recipient_type = 'advisor'
      AND effective_to IS NULL
      AND advisor_id IS NOT NULL;
    IF NOT FOUND THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    IF v_alloc.application_id IS DISTINCT FROM NEW.resolved_application_id
       OR v_alloc.advisor_id IS DISTINCT FROM NEW.resolved_advisor_id THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commission_pending_rows_accepted_safety
  ON public.commission_pending_import_rows;
CREATE TRIGGER commission_pending_rows_accepted_safety
  BEFORE INSERT OR UPDATE ON public.commission_pending_import_rows
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_commission_pending_accepted_safety();

REVOKE ALL ON FUNCTION public.enforce_commission_pending_accepted_safety()
  FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION D — Immutability
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_commission_pending_import_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_ctx text := COALESCE(public.crm_rpc_context(), '');
  v_write_contexts text[] := ARRAY[
    'create_commission_pending_import_batch',
    'stage_commission_pending_import_rows'
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

  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'commission_pending_import_batches' THEN
    IF NEW.source_type IS DISTINCT FROM OLD.source_type
       OR NEW.source_file IS DISTINCT FROM OLD.source_file
       OR NEW.file_sha256 IS DISTINCT FROM OLD.file_sha256
       OR NEW.statement_identifier IS DISTINCT FROM OLD.statement_identifier
       OR NEW.fs_code IS DISTINCT FROM OLD.fs_code
       OR NEW.statement_date IS DISTINCT FROM OLD.statement_date
       OR NEW.source_created_at IS DISTINCT FROM OLD.source_created_at
       OR NEW.payee_name IS DISTINCT FROM OLD.payee_name
       OR NEW.statement_amount_cents IS DISTINCT FROM OLD.statement_amount_cents
       OR NEW.escrow_cents IS DISTINCT FROM OLD.escrow_cents
       OR NEW.duplicate_of_batch_id IS DISTINCT FROM OLD.duplicate_of_batch_id
       OR NEW.import_status IS DISTINCT FROM OLD.import_status THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'commission_pending_import_rows' THEN
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
       OR NEW.source_agent_entered_premium_cents IS DISTINCT FROM OLD.source_agent_entered_premium_cents
       OR NEW.source_company_calculated_premium_cents IS DISTINCT FROM OLD.source_company_calculated_premium_cents
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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commission_pending_import_batches_immutability
  ON public.commission_pending_import_batches;
CREATE TRIGGER commission_pending_import_batches_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.commission_pending_import_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_commission_pending_import_immutability();

DROP TRIGGER IF EXISTS commission_pending_import_rows_immutability
  ON public.commission_pending_import_rows;
CREATE TRIGGER commission_pending_import_rows_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.commission_pending_import_rows
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_commission_pending_import_immutability();

REVOKE ALL ON FUNCTION public.enforce_commission_pending_import_immutability()
  FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION E — Classify + batch counts
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pp_commission_pending_import_refresh_batch_counts(
  p_batch_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
BEGIN
  UPDATE public.commission_pending_import_batches b
  SET
    row_count = s.n,
    accepted_count = s.accepted_n,
    review_count = s.review_n,
    duplicate_count = s.dup_n,
    ignored_count = s.ign_n,
    failed_count = s.fail_n
  FROM (
    SELECT
      count(*)::integer AS n,
      count(*) FILTER (
        WHERE r.pending_review_status = 'accepted_pending'
      )::integer AS accepted_n,
      count(*) FILTER (
        WHERE r.pending_review_status IN (
          'review_duplicate_candidate',
          'review_policy_match',
          'review_advisor_match',
          'review_split_attribution'
        )
      )::integer AS review_n,
      count(*) FILTER (WHERE r.pending_review_status = 'duplicate')::integer AS dup_n,
      count(*) FILTER (
        WHERE r.pending_review_status IN ('ignored_nonwriting', 'ignored_nonpolicy')
      )::integer AS ign_n,
      count(*) FILTER (
        WHERE r.pending_review_status IN ('invalid_amount', 'invalid_source_identity')
      )::integer AS fail_n
    FROM public.commission_pending_import_rows r
    WHERE r.batch_id = p_batch_id
  ) s
  WHERE b.id = p_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pp_commission_pending_import_refresh_batch_counts(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_commission_pending_import_classify_row(
  p_batch public.commission_pending_import_batches,
  p_section text,
  p_company text,
  p_policy_number text,
  p_writing_associate text,
  p_client text,
  p_source_type text,
  p_income_cents bigint,
  p_split_rate numeric,
  OUT o_status text,
  OUT o_reason text,
  OUT o_carrier_id uuid,
  OUT o_application_id uuid,
  OUT o_allocation_id uuid,
  OUT o_advisor_id uuid
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
  o_status := 'ignored_nonwriting';
  o_reason := 'unclassified';
  o_carrier_id := NULL;
  o_application_id := NULL;
  o_allocation_id := NULL;
  o_advisor_id := NULL;

  IF p_section = 'additional_commissions' THEN
    o_status := 'ignored_nonpolicy';
    o_reason := 'additional_commissions';
    RETURN;
  END IF;

  IF p_income_cents IS NULL OR p_income_cents <= 0 THEN
    o_status := 'invalid_amount';
    o_reason := 'income_cents_required_positive';
    RETURN;
  END IF;

  IF v_policy_norm IS NULL
     AND public.pp_normalize_text(p_company) IS NULL
     AND v_writer IS NULL THEN
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

  IF v_type IS NULL OR v_type IS DISTINCT FROM 'commission' THEN
    IF v_type = 'override' THEN
      o_status := 'ignored_nonwriting';
      o_reason := 'override_nonwriting';
      RETURN;
    END IF;
    o_status := 'ignored_nonwriting';
    o_reason := 'unsupported_source_type';
    RETURN;
  END IF;

  -- Type Commission: source-confirmed writing Pending. Gross %, split,
  -- premium, statement amount, and escrow never compute the amount.
  IF o_carrier_id IS NULL OR v_policy_norm IS NULL THEN
    o_status := 'review_policy_match';
    o_reason := CASE
      WHEN o_carrier_id IS NULL THEN 'unknown_carrier'
      ELSE 'missing_policy_number'
    END;
    RETURN;
  END IF;

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

  o_status := 'accepted_pending';
  o_reason := 'exact_carrier_policy_single_writing_allocation';
END;
$$;

REVOKE ALL ON FUNCTION public.pp_commission_pending_import_classify_row(
  public.commission_pending_import_batches, text, text, text, text, text, text, bigint, numeric
) FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION F — Owner RPCs
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_commission_pending_import_batch(
  p_source_type text,
  p_source_file text,
  p_file_sha256 text,
  p_statement_identifier text,
  p_fs_code text DEFAULT NULL,
  p_statement_date date DEFAULT NULL,
  p_source_created_at timestamptz DEFAULT NULL,
  p_payee_name text DEFAULT NULL,
  p_statement_amount_cents bigint DEFAULT NULL,
  p_escrow_cents bigint DEFAULT NULL
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
  v_existing public.commission_pending_import_batches;
  v_row public.commission_pending_import_batches;
  v_audit uuid;
  v_is_dup boolean;
BEGIN
  PERFORM public.pp_assert_owner();

  IF v_type IS NULL OR v_file IS NULL OR v_sha IS NULL OR v_stmt IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF v_type IS DISTINCT FROM 'experior_pending_report' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF v_sha !~ '^[0-9a-f]{64}$' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF p_statement_amount_cents IS NOT NULL AND p_statement_amount_cents < 0 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF p_escrow_cents IS NOT NULL AND p_escrow_cents < 0 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  SELECT * INTO v_existing
  FROM public.commission_pending_import_batches
  WHERE file_sha256 = v_sha
    AND import_status = 'open';
  v_is_dup := FOUND;

  PERFORM set_config('crm.rpc_context', 'create_commission_pending_import_batch', true);
  BEGIN
    IF v_is_dup THEN
      INSERT INTO public.commission_pending_import_batches (
        source_type, source_file, file_sha256, statement_identifier,
        fs_code, statement_date, source_created_at, payee_name,
        statement_amount_cents, escrow_cents,
        uploaded_by_user_id, import_status, duplicate_of_batch_id
      ) VALUES (
        v_type, v_file, v_sha, v_stmt,
        v_fs, p_statement_date, p_source_created_at, v_payee,
        p_statement_amount_cents, p_escrow_cents,
        auth.uid(), 'duplicate_file', v_existing.id
      )
      RETURNING * INTO v_row;

      v_audit := public.crm_write_audit(
        'create_commission_pending_import_batch',
        'commission_pending_import_batches',
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

    INSERT INTO public.commission_pending_import_batches (
      source_type, source_file, file_sha256, statement_identifier,
      fs_code, statement_date, source_created_at, payee_name,
      statement_amount_cents, escrow_cents,
      uploaded_by_user_id, import_status
    ) VALUES (
      v_type, v_file, v_sha, v_stmt,
      v_fs, p_statement_date, p_source_created_at, v_payee,
      p_statement_amount_cents, p_escrow_cents,
      auth.uid(), 'open'
    )
    RETURNING * INTO v_row;

    v_audit := public.crm_write_audit(
      'create_commission_pending_import_batch',
      'commission_pending_import_batches',
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

COMMENT ON FUNCTION public.create_commission_pending_import_batch(
  text, text, text, text, text, date, timestamptz, text, bigint, bigint
) IS
  'Owner-only. Creates an Experior Pending Report batch. Identical file SHA-256 returns duplicate_file. statement_amount_cents and escrow_cents are metadata only. Does not write 035.';

CREATE OR REPLACE FUNCTION public.stage_commission_pending_import_rows(
  p_batch_id uuid,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_batch public.commission_pending_import_batches;
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
  v_existing public.commission_pending_import_rows;
  v_row public.commission_pending_import_rows;
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
  FROM public.commission_pending_import_batches
  WHERE id = p_batch_id;
  IF NOT FOUND THEN
    PERFORM public.pp_raise('not_found');
  END IF;
  IF v_batch.import_status IS DISTINCT FROM 'open' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  PERFORM set_config('crm.rpc_context', 'stage_commission_pending_import_rows', true);
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
      IF v_aep IS NULL THEN
        v_aep := public.pp_json_bigint(v_el, 'source_agent_entered_premium_cents');
      END IF;
      v_ccp := public.pp_json_bigint(v_el, 'company_calculated_premium_cents');
      IF v_ccp IS NULL THEN
        v_ccp := public.pp_json_bigint(v_el, 'source_company_calculated_premium_cents');
      END IF;
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

      v_key := public.pp_commission_import_source_row_key(
        v_batch.file_sha256,
        v_section,
        v_ordinal
      );
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
      FROM public.commission_pending_import_rows r
      WHERE r.batch_id = p_batch_id
        AND r.source_row_key = v_key;
      IF v_existing.id IS NOT NULL THEN
        v_dup := v_dup + 1;
        v_ids := v_ids || v_existing.id;
        CONTINUE;
      END IF;

      SELECT * INTO v_class
      FROM public.pp_commission_pending_import_classify_row(
        v_batch, v_section, v_company, v_policy, v_writer, v_client,
        v_type, v_income, v_split
      );

      IF v_class.o_status NOT IN (
        'ignored_nonwriting',
        'ignored_nonpolicy',
        'invalid_amount',
        'invalid_source_identity',
        'duplicate'
      ) THEN
        SELECT EXISTS (
          SELECT 1
          FROM public.commission_pending_import_rows r
          WHERE r.transaction_fingerprint = v_fp
            AND r.pending_review_status <> 'duplicate'
        ) INTO v_prior_fp;

        IF v_prior_fp THEN
          IF public.pp_normalize_text(v_paynum) IS NOT NULL THEN
            v_class.o_status := 'duplicate';
            v_class.o_reason := 'cross_report_payment_identity';
            v_class.o_application_id := NULL;
            v_class.o_allocation_id := NULL;
            v_class.o_advisor_id := NULL;
          ELSE
            v_class.o_status := 'review_duplicate_candidate';
            v_class.o_reason := 'cross_report_fingerprint_ambiguous';
          END IF;
        END IF;
      END IF;

      INSERT INTO public.commission_pending_import_rows (
        batch_id, source_section, source_page, source_row_ordinal, source_row_key,
        transaction_fingerprint,
        transaction_date, payment_number, source_company, source_product,
        source_policy_number, source_writing_associate, source_client,
        source_agent_entered_premium_cents, source_company_calculated_premium_cents,
        source_gross_rate, source_factor_rate, source_net_rate, source_split_rate,
        source_type, source_transaction_type, source_income_cents,
        source_is_chargeback_visual, pending_review_status, pending_review_reason,
        resolved_carrier_id, resolved_application_id, resolved_allocation_id,
        resolved_advisor_id
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
        v_class.o_advisor_id
      )
      RETURNING * INTO v_row;

      v_created := v_created + 1;
      v_ids := v_ids || v_row.id;
    END LOOP;

    PERFORM public.pp_commission_pending_import_refresh_batch_counts(p_batch_id);

    v_audit := public.crm_write_audit(
      'stage_commission_pending_import_rows',
      'commission_pending_import_batches',
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

COMMENT ON FUNCTION public.stage_commission_pending_import_rows(uuid, jsonb) IS
  'Owner-only. Stages Experior Pending Report rows. Source Income is the Pending amount. Override and additional_commissions cannot become accepted_pending. Does not write 035.';

-- =============================================================================
-- SECTION G — RLS
-- =============================================================================

ALTER TABLE public.commission_pending_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_pending_import_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.commission_pending_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_pending_import_rows FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commission_pending_import_batches_select
  ON public.commission_pending_import_batches;
CREATE POLICY commission_pending_import_batches_select
  ON public.commission_pending_import_batches
  FOR SELECT TO authenticated
  USING (public.crm_is_owner());

DROP POLICY IF EXISTS commission_pending_import_rows_select
  ON public.commission_pending_import_rows;
CREATE POLICY commission_pending_import_rows_select
  ON public.commission_pending_import_rows
  FOR SELECT TO authenticated
  USING (public.crm_is_owner());

REVOKE ALL ON TABLE public.commission_pending_import_batches FROM PUBLIC;
REVOKE ALL ON TABLE public.commission_pending_import_batches FROM anon;
REVOKE ALL ON TABLE public.commission_pending_import_batches FROM authenticated;
REVOKE ALL ON TABLE public.commission_pending_import_rows FROM PUBLIC;
REVOKE ALL ON TABLE public.commission_pending_import_rows FROM anon;
REVOKE ALL ON TABLE public.commission_pending_import_rows FROM authenticated;

GRANT SELECT ON TABLE public.commission_pending_import_batches TO authenticated;
GRANT SELECT ON TABLE public.commission_pending_import_rows TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.commission_pending_import_batches
  FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.commission_pending_import_rows
  FROM authenticated;

GRANT ALL ON TABLE public.commission_pending_import_batches TO service_role;
GRANT ALL ON TABLE public.commission_pending_import_rows TO service_role;

REVOKE ALL ON FUNCTION public.create_commission_pending_import_batch(
  text, text, text, text, text, date, timestamptz, text, bigint, bigint
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_commission_pending_import_batch(
  text, text, text, text, text, date, timestamptz, text, bigint, bigint
) TO authenticated;

REVOKE ALL ON FUNCTION public.stage_commission_pending_import_rows(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stage_commission_pending_import_rows(uuid, jsonb)
  TO authenticated;

-- =============================================================================
-- End Migration 040
-- =============================================================================
