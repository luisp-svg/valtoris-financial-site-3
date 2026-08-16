-- 035_writing_advisor_actual_commission_ledger.sql
-- Writing-advisor ACTUAL commission ledger.
--
-- Adds:
--   public.policy_writing_commission_accounts
--   public.policy_writing_commission_events
--   owner RPCs: record / reverse / attribute / pre-issue exception
--   advisor-safe snapshot: pp_writing_commission_snapshot
--
-- This is writing-advisor actual compensation only. It does NOT model
-- upline, generational, hierarchy, recruiter, manager spread, agency
-- spread, or override compensation. House and servicing allocations
-- never receive a writing commission account.
--
-- Expected compensation remains in
-- public.policy_application_expected_compensations. Actual events never
-- overwrite expected snapshots. Unresolved expected stays NULL cents;
-- variance and remaining_expected stay NULL. Never fabricate $0.
--
-- Hybrid architecture:
--   Account = one row per writing-advisor allocation (identity + pinned
--     expected snapshot). Created lazily on first attributed posting.
--   Event  = append-only signed integer-cent financial fact.
--
-- Event types (TEXT + CHECK, not a Postgres enum):
--   paid, adjustment, chargeback, recovery, reversal
-- Pending / eligible / released are workflow facts for a later
-- migration. They are not event_type values and do not post dollars.
--
-- Money: one signed amount_cents bigint. No running balance column.
-- Zero-value financial events are rejected.
--
-- Idempotency (two layers; they solve different problems):
--   1. API/request idempotency = UNIQUE (idempotency_key).
--      Caller MUST supply a nonblank key for every standalone money
--      posting. The server never generates a random UUID as a retry
--      identity. Identical payload + same key returns the original
--      event. Same key + different canonical payload fails closed.
--   2. Carrier statement provenance uniqueness =
--      UNIQUE (carrier_id, statement_identifier, carrier_transaction_id)
--      where all three are present and attributed_from_event_id IS NULL.
--      Protects duplicate source transactions under a different request
--      key. Carrier transaction ids may be reused across statements, so
--      (carrier_id, carrier_transaction_id) alone is NOT a 035 unique
--      key. Future imports MUST supply a statement_identifier.
--
-- Does NOT: apply UI, carrier statement import, import_batches table,
-- pending/eligible/released money, rate-card changes, or Policy
-- Production stage-machine changes.

-- =============================================================================
-- SECTION A — Accounts
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.policy_writing_commission_accounts (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  allocation_id uuid NOT NULL
    REFERENCES public.policy_agent_allocations (id) ON DELETE RESTRICT,
  application_id uuid NOT NULL
    REFERENCES public.policy_applications (id) ON DELETE RESTRICT,
  advisor_id uuid NOT NULL
    REFERENCES public.advisor_profiles (id) ON DELETE RESTRICT,
  policy_id uuid
    REFERENCES public.policies (id) ON DELETE RESTRICT,
  expected_compensation_id uuid
    REFERENCES public.policy_application_expected_compensations (id) ON DELETE RESTRICT,
  expected_cents_pinned bigint,
  created_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT policy_writing_comm_acct_pinned_cents_check
    CHECK (expected_cents_pinned IS NULL OR expected_cents_pinned >= 0),
  CONSTRAINT policy_writing_comm_acct_pin_shape_check
    CHECK (
      expected_compensation_id IS NOT NULL
      OR expected_cents_pinned IS NULL
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS policy_writing_comm_acct_allocation_uidx
  ON public.policy_writing_commission_accounts (allocation_id);

CREATE INDEX IF NOT EXISTS policy_writing_comm_acct_application_idx
  ON public.policy_writing_commission_accounts (application_id);

CREATE INDEX IF NOT EXISTS policy_writing_comm_acct_advisor_idx
  ON public.policy_writing_commission_accounts (advisor_id);

COMMENT ON TABLE public.policy_writing_commission_accounts IS
  'One writing-advisor actual-commission account per writing allocation. Identity and pinned expected snapshot only. No running balance. House and servicing allocations are excluded. Not an expected-compensation table.';
COMMENT ON COLUMN public.policy_writing_commission_accounts.expected_cents_pinned IS
  'Server-copied expected_compensation_cents from the pinned snapshot. NULL when that snapshot is unresolved. Never client-supplied. Never follows later 034 supersessions.';
COMMENT ON COLUMN public.policy_writing_commission_accounts.expected_compensation_id IS
  'Pinned 034 snapshot used for reconciliation. May be a historical issued row. NULL if no expected row existed at bind.';

ALTER TABLE public.policy_writing_commission_accounts
  DROP COLUMN IF EXISTS attribution_status;

DROP TRIGGER IF EXISTS policy_writing_comm_acct_set_updated_at
  ON public.policy_writing_commission_accounts;
CREATE TRIGGER policy_writing_comm_acct_set_updated_at
  BEFORE UPDATE ON public.policy_writing_commission_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- SECTION B — Events
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.policy_writing_commission_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  account_id uuid
    REFERENCES public.policy_writing_commission_accounts (id) ON DELETE RESTRICT,
  application_id uuid NOT NULL
    REFERENCES public.policy_applications (id) ON DELETE RESTRICT,
  allocation_id uuid
    REFERENCES public.policy_agent_allocations (id) ON DELETE RESTRICT,
  advisor_id uuid
    REFERENCES public.advisor_profiles (id) ON DELETE RESTRICT,
  policy_id uuid
    REFERENCES public.policies (id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  amount_cents bigint NOT NULL,
  reversed_event_id uuid
    REFERENCES public.policy_writing_commission_events (id) ON DELETE RESTRICT,
  attributed_from_event_id uuid
    REFERENCES public.policy_writing_commission_events (id) ON DELETE RESTRICT,
  attribution_status text NOT NULL,
  idempotency_key text NOT NULL,
  carrier_id uuid
    REFERENCES public.carriers (id) ON DELETE RESTRICT,
  carrier_transaction_id text,
  statement_identifier text,
  statement_date date,
  transaction_date date,
  policy_reference text,
  source_file text,
  source_row integer,
  raw_description text,
  import_batch_identifier text,
  reason text NOT NULL,
  created_by_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT policy_writing_comm_evt_type_check
    CHECK (event_type IN ('paid', 'adjustment', 'chargeback', 'recovery', 'reversal')),
  CONSTRAINT policy_writing_comm_evt_nonzero_check
    CHECK (amount_cents <> 0),
  CONSTRAINT policy_writing_comm_evt_sign_check
    CHECK (
      (event_type = 'paid' AND amount_cents > 0)
      OR (event_type = 'chargeback' AND amount_cents < 0)
      OR (event_type = 'recovery' AND amount_cents > 0)
      OR (event_type = 'adjustment' AND amount_cents <> 0)
      OR (event_type = 'reversal' AND amount_cents <> 0)
    ),
  CONSTRAINT policy_writing_comm_evt_attribution_shape_check
    CHECK (
      (
        attribution_status = 'attributed'
        AND account_id IS NOT NULL
        AND allocation_id IS NOT NULL
        AND advisor_id IS NOT NULL
      )
      OR (
        attribution_status = 'review_required'
        AND account_id IS NULL
        AND allocation_id IS NULL
        AND advisor_id IS NULL
      )
    ),
  CONSTRAINT policy_writing_comm_evt_reversal_shape_check
    CHECK (
      (event_type = 'reversal' AND reversed_event_id IS NOT NULL)
      OR (event_type <> 'reversal' AND reversed_event_id IS NULL)
    ),
  CONSTRAINT policy_writing_comm_evt_reason_len_check
    CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  CONSTRAINT policy_writing_comm_evt_idempotency_len_check
    CHECK (char_length(btrim(idempotency_key)) BETWEEN 1 AND 200),
  CONSTRAINT policy_writing_comm_evt_source_file_check
    CHECK (
      source_file IS NULL
      OR (source_file = btrim(source_file)
          AND char_length(source_file) BETWEEN 1 AND 500)
    ),
  CONSTRAINT policy_writing_comm_evt_source_row_check
    CHECK (source_row IS NULL OR source_row > 0),
  CONSTRAINT policy_writing_comm_evt_txn_id_len_check
    CHECK (
      carrier_transaction_id IS NULL
      OR char_length(btrim(carrier_transaction_id)) BETWEEN 1 AND 200
    ),
  CONSTRAINT policy_writing_comm_evt_statement_id_len_check
    CHECK (
      statement_identifier IS NULL
      OR char_length(btrim(statement_identifier)) BETWEEN 1 AND 200
    ),
  CONSTRAINT policy_writing_comm_evt_policy_ref_len_check
    CHECK (
      policy_reference IS NULL
      OR char_length(btrim(policy_reference)) BETWEEN 1 AND 200
    ),
  CONSTRAINT policy_writing_comm_evt_raw_desc_len_check
    CHECK (
      raw_description IS NULL
      OR char_length(raw_description) BETWEEN 1 AND 2000
    ),
  CONSTRAINT policy_writing_comm_evt_import_batch_len_check
    CHECK (
      import_batch_identifier IS NULL
      OR char_length(btrim(import_batch_identifier)) BETWEEN 1 AND 200
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS policy_writing_comm_evt_idempotency_uidx
  ON public.policy_writing_commission_events (idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS policy_writing_comm_evt_reversal_once_uidx
  ON public.policy_writing_commission_events (reversed_event_id)
  WHERE event_type = 'reversal';

-- Carrier txn ids may repeat across statements. Scope uniqueness to the
-- statement when the import-shaped triple is present. Attributed split
-- children copy provenance but set attributed_from_event_id; they must
-- not collide with the source row. Future imports MUST populate
-- statement_identifier and must not assume global txn uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS policy_writing_comm_evt_carrier_stmt_txn_uidx
  ON public.policy_writing_commission_events (
    carrier_id,
    statement_identifier,
    carrier_transaction_id
  )
  WHERE carrier_id IS NOT NULL
    AND statement_identifier IS NOT NULL
    AND carrier_transaction_id IS NOT NULL
    AND attributed_from_event_id IS NULL;

CREATE INDEX IF NOT EXISTS policy_writing_comm_evt_application_idx
  ON public.policy_writing_commission_events (application_id, created_at);

CREATE INDEX IF NOT EXISTS policy_writing_comm_evt_account_idx
  ON public.policy_writing_commission_events (account_id, created_at)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS policy_writing_comm_evt_advisor_idx
  ON public.policy_writing_commission_events (advisor_id, created_at)
  WHERE advisor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS policy_writing_comm_evt_attributed_from_idx
  ON public.policy_writing_commission_events (attributed_from_event_id)
  WHERE attributed_from_event_id IS NOT NULL;

COMMENT ON TABLE public.policy_writing_commission_events IS
  'Append-only writing-advisor actual commission events. Signed integer cents. Reversal cancels a prior event by excluding it from effective sums; the original row is never updated or deleted. Chargeback is a carrier event, not a reversal. Unattributed rows have account_id/allocation_id/advisor_id NULL.';
COMMENT ON COLUMN public.policy_writing_commission_events.amount_cents IS
  'Signed integer cents. paid/recovery > 0; chargeback < 0; adjustment <> 0; reversal = exact negative of reversed_event_id.';
COMMENT ON COLUMN public.policy_writing_commission_events.idempotency_key IS
  'Caller-supplied request idempotency key. Unique. NOT NULL. Never randomly generated by the server for a standalone money posting. Identical canonical payload retries return the original row; conflicting reuse fails closed. Internally created reversal/attribution children use deterministic keys derived from the operation key.';
COMMENT ON COLUMN public.policy_writing_commission_events.statement_identifier IS
  'Statement-scoped provenance. Required together with carrier_id and carrier_transaction_id for the 035 carrier uniqueness index. Future imports must always set this; do not unique (carrier_id, carrier_transaction_id) alone.';

-- =============================================================================
-- SECTION C — Immutability
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_policy_writing_commission_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_ctx text := COALESCE(public.crm_rpc_context(), '');
  v_write_contexts text[] := ARRAY[
    'record_policy_writing_commission_event',
    'record_policy_writing_commission_event_pre_issue',
    'reverse_policy_writing_commission_event',
    'attribute_unattributed_commission_event'
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

  IF TG_OP = 'UPDATE' THEN
    PERFORM public.pp_raise('not_authorized');
    RETURN NEW;
  END IF;

  IF NOT (v_ctx = ANY (v_write_contexts)) THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS policy_writing_comm_acct_immutability
  ON public.policy_writing_commission_accounts;
CREATE TRIGGER policy_writing_comm_acct_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.policy_writing_commission_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_policy_writing_commission_immutability();

DROP TRIGGER IF EXISTS policy_writing_comm_evt_immutability
  ON public.policy_writing_commission_events;
CREATE TRIGGER policy_writing_comm_evt_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.policy_writing_commission_events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_policy_writing_commission_immutability();

REVOKE ALL ON FUNCTION public.enforce_policy_writing_commission_immutability()
  FROM PUBLIC, anon, authenticated;

-- Reversal amount must be the exact negative of the referenced event.
-- Chargebacks never use reversed_event_id (table CHECK). Cannot reverse a
-- reversal: referenced event_type cannot be reversal.
CREATE OR REPLACE FUNCTION public.enforce_policy_writing_commission_reversal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_src public.policy_writing_commission_events;
BEGIN
  IF NEW.event_type IS DISTINCT FROM 'reversal' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_src
  FROM public.policy_writing_commission_events
  WHERE id = NEW.reversed_event_id;
  IF NOT FOUND THEN
    PERFORM public.pp_raise('not_found');
  END IF;
  IF v_src.event_type = 'reversal' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF v_src.application_id IS DISTINCT FROM NEW.application_id THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF NEW.amount_cents IS DISTINCT FROM (- v_src.amount_cents) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF v_src.attribution_status = 'attributed' THEN
    IF NEW.account_id IS DISTINCT FROM v_src.account_id
       OR NEW.allocation_id IS DISTINCT FROM v_src.allocation_id
       OR NEW.advisor_id IS DISTINCT FROM v_src.advisor_id THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
  ELSE
    IF NEW.account_id IS NOT NULL
       OR NEW.allocation_id IS NOT NULL
       OR NEW.advisor_id IS NOT NULL THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS policy_writing_comm_evt_reversal_guard
  ON public.policy_writing_commission_events;
CREATE TRIGGER policy_writing_comm_evt_reversal_guard
  BEFORE INSERT ON public.policy_writing_commission_events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_policy_writing_commission_reversal();

REVOKE ALL ON FUNCTION public.enforce_policy_writing_commission_reversal()
  FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION D — Internal helpers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pp_writing_commission_event_is_effective(
  p_event_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.policy_writing_commission_events e
    WHERE e.id = p_event_id
      AND e.event_type <> 'reversal'
      AND NOT EXISTS (
        SELECT 1
        FROM public.policy_writing_commission_events r
        WHERE r.event_type = 'reversal'
          AND r.reversed_event_id = e.id
      )
  );
$$;

REVOKE ALL ON FUNCTION public.pp_writing_commission_event_is_effective(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_writing_commission_assert_posting_stage(
  p_application_id uuid,
  p_allow_pre_issue boolean
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_app public.policy_applications;
  v_has_policy boolean;
BEGIN
  SELECT * INTO v_app
  FROM public.policy_applications
  WHERE id = p_application_id;
  IF NOT FOUND OR v_app.deleted_at IS NOT NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  IF p_allow_pre_issue THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.policies p
    WHERE p.source_application_id = p_application_id
  ) INTO v_has_policy;

  IF v_app.production_stage IN ('issued', 'in_force') OR v_has_policy THEN
    RETURN;
  END IF;

  PERFORM public.pp_raise('invalid_transition');
END;
$$;

REVOKE ALL ON FUNCTION public.pp_writing_commission_assert_posting_stage(uuid, boolean)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_writing_commission_validate_allocation(
  p_allocation_id uuid,
  p_application_id uuid
)
RETURNS public.policy_agent_allocations
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_alloc public.policy_agent_allocations;
BEGIN
  IF p_allocation_id IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;

  SELECT * INTO v_alloc
  FROM public.policy_agent_allocations
  WHERE id = p_allocation_id;
  IF NOT FOUND THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  IF v_alloc.application_id IS DISTINCT FROM p_application_id THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF v_alloc.allocation_role IS DISTINCT FROM 'writing'
     OR v_alloc.recipient_type IS DISTINCT FROM 'advisor'
     OR v_alloc.advisor_id IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  RETURN v_alloc;
END;
$$;

REVOKE ALL ON FUNCTION public.pp_writing_commission_validate_allocation(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_ensure_writing_commission_account(
  p_allocation_id uuid,
  p_application_id uuid,
  p_expected_compensation_id uuid
)
RETURNS public.policy_writing_commission_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_alloc public.policy_agent_allocations;
  v_acct public.policy_writing_commission_accounts;
  v_expected public.policy_application_expected_compensations;
  v_policy_id uuid;
  v_expected_id uuid;
  v_pinned bigint;
BEGIN
  v_alloc := public.pp_writing_commission_validate_allocation(
    p_allocation_id, p_application_id
  );

  SELECT id INTO v_policy_id
  FROM public.policies
  WHERE source_application_id = p_application_id
  LIMIT 1;

  SELECT * INTO v_acct
  FROM public.policy_writing_commission_accounts
  WHERE allocation_id = v_alloc.id;
  IF FOUND THEN
    RETURN v_acct;
  END IF;

  v_expected_id := NULL;
  v_pinned := NULL;

  IF p_expected_compensation_id IS NOT NULL THEN
    SELECT * INTO v_expected
    FROM public.policy_application_expected_compensations
    WHERE id = p_expected_compensation_id;
    IF NOT FOUND THEN
      PERFORM public.pp_raise('not_found');
    END IF;
    IF v_expected.allocation_id IS DISTINCT FROM v_alloc.id
       OR v_expected.application_id IS DISTINCT FROM p_application_id
       OR v_expected.advisor_id IS DISTINCT FROM v_alloc.advisor_id THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    v_expected_id := v_expected.id;
    v_pinned := v_expected.expected_compensation_cents;
  ELSE
    SELECT * INTO v_expected
    FROM public.policy_application_expected_compensations
    WHERE allocation_id = v_alloc.id
      AND superseded_at IS NULL
    LIMIT 1;
    IF FOUND THEN
      v_expected_id := v_expected.id;
      v_pinned := v_expected.expected_compensation_cents;
    END IF;
  END IF;

  INSERT INTO public.policy_writing_commission_accounts (
    allocation_id,
    application_id,
    advisor_id,
    policy_id,
    expected_compensation_id,
    expected_cents_pinned,
    created_by_user_id
  ) VALUES (
    v_alloc.id,
    p_application_id,
    v_alloc.advisor_id,
    v_policy_id,
    v_expected_id,
    v_pinned,
    auth.uid()
  )
  RETURNING * INTO v_acct;

  RETURN v_acct;
END;
$$;

REVOKE ALL ON FUNCTION public.pp_ensure_writing_commission_account(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_writing_commission_reconcile_sums(
  p_application_id uuid,
  p_account_id uuid,
  p_advisor_id uuid,
  p_include_unattributed boolean
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_gross bigint := 0;
  v_adj bigint := 0;
  v_charge bigint := 0;
  v_recov bigint := 0;
  v_net bigint := 0;
  v_expected bigint;
BEGIN
  SELECT
    COALESCE(sum(e.amount_cents) FILTER (WHERE e.event_type = 'paid'), 0),
    COALESCE(sum(e.amount_cents) FILTER (WHERE e.event_type = 'adjustment'), 0),
    COALESCE(sum(e.amount_cents) FILTER (WHERE e.event_type = 'chargeback'), 0),
    COALESCE(sum(e.amount_cents) FILTER (WHERE e.event_type = 'recovery'), 0),
    COALESCE(sum(e.amount_cents), 0)
  INTO v_gross, v_adj, v_charge, v_recov, v_net
  FROM public.policy_writing_commission_events e
  WHERE e.application_id = p_application_id
    AND e.event_type <> 'reversal'
    AND NOT EXISTS (
      SELECT 1
      FROM public.policy_writing_commission_events r
      WHERE r.event_type = 'reversal'
        AND r.reversed_event_id = e.id
    )
    AND (
      (p_account_id IS NOT NULL AND e.account_id = p_account_id)
      OR (
        p_account_id IS NULL
        AND (
          (p_advisor_id IS NOT NULL AND e.advisor_id = p_advisor_id)
          OR (
            p_advisor_id IS NULL
            AND (
              e.advisor_id IS NOT NULL
              OR (p_include_unattributed AND e.advisor_id IS NULL)
            )
          )
        )
      )
    );

  IF p_account_id IS NOT NULL THEN
    SELECT a.expected_cents_pinned INTO v_expected
    FROM public.policy_writing_commission_accounts a
    WHERE a.id = p_account_id;
  ELSIF p_advisor_id IS NOT NULL THEN
    SELECT
      CASE
        WHEN count(*) = 0 THEN NULL
        WHEN count(*) FILTER (WHERE a.expected_cents_pinned IS NULL) > 0 THEN NULL
        ELSE sum(a.expected_cents_pinned)
      END
    INTO v_expected
    FROM public.policy_writing_commission_accounts a
    WHERE a.application_id = p_application_id
      AND a.advisor_id = p_advisor_id;
  ELSE
    SELECT
      CASE
        WHEN count(*) = 0 THEN NULL
        WHEN count(*) FILTER (WHERE a.expected_cents_pinned IS NULL) > 0 THEN NULL
        ELSE sum(a.expected_cents_pinned)
      END
    INTO v_expected
    FROM public.policy_writing_commission_accounts a
    WHERE a.application_id = p_application_id;
  END IF;

  RETURN jsonb_build_object(
    'expected_cents', v_expected,
    'gross_paid_cents', v_gross,
    'adjustment_cents', v_adj,
    'chargeback_cents', v_charge,
    'recovery_cents', v_recov,
    'net_actual_cents', v_net,
    'remaining_expected_cents',
      CASE WHEN v_expected IS NULL THEN NULL ELSE v_expected - v_net END,
    'variance_cents',
      CASE WHEN v_expected IS NULL THEN NULL ELSE v_net - v_expected END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pp_writing_commission_reconcile_sums(uuid, uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_writing_commission_trim(
  p_value text,
  p_max integer
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_text text := NULLIF(btrim(COALESCE(p_value, '')), '');
BEGIN
  IF v_text IS NULL THEN
    RETURN NULL;
  END IF;
  IF char_length(v_text) > p_max THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  RETURN v_text;
END;
$$;

REVOKE ALL ON FUNCTION public.pp_writing_commission_trim(text, integer)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_writing_commission_event_payload_matches(
  p_existing public.policy_writing_commission_events,
  p_application_id uuid,
  p_event_type text,
  p_amount_cents bigint,
  p_allocation_id uuid,
  p_carrier_id uuid,
  p_carrier_transaction_id text,
  p_statement_identifier text,
  p_statement_date date,
  p_transaction_date date,
  p_policy_reference text,
  p_source_file text,
  p_source_row integer,
  p_raw_description text,
  p_import_batch_identifier text,
  p_attributed_from_event_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    p_existing.application_id IS NOT DISTINCT FROM p_application_id
    AND p_existing.event_type IS NOT DISTINCT FROM p_event_type
    AND p_existing.amount_cents IS NOT DISTINCT FROM p_amount_cents
    AND p_existing.allocation_id IS NOT DISTINCT FROM p_allocation_id
    AND p_existing.reversed_event_id IS NULL
    AND p_existing.attributed_from_event_id IS NOT DISTINCT FROM p_attributed_from_event_id
    AND p_existing.attribution_status IS NOT DISTINCT FROM (
      CASE WHEN p_allocation_id IS NULL THEN 'review_required' ELSE 'attributed' END
    )
    AND p_existing.carrier_id IS NOT DISTINCT FROM p_carrier_id
    AND p_existing.carrier_transaction_id IS NOT DISTINCT FROM p_carrier_transaction_id
    AND p_existing.statement_identifier IS NOT DISTINCT FROM p_statement_identifier
    AND p_existing.statement_date IS NOT DISTINCT FROM p_statement_date
    AND p_existing.transaction_date IS NOT DISTINCT FROM p_transaction_date
    AND p_existing.policy_reference IS NOT DISTINCT FROM p_policy_reference
    AND p_existing.source_file IS NOT DISTINCT FROM p_source_file
    AND p_existing.source_row IS NOT DISTINCT FROM p_source_row
    AND p_existing.raw_description IS NOT DISTINCT FROM p_raw_description
    AND p_existing.import_batch_identifier IS NOT DISTINCT FROM p_import_batch_identifier;
$$;

REVOKE ALL ON FUNCTION public.pp_writing_commission_event_payload_matches(
  public.policy_writing_commission_events, uuid, text, bigint, uuid, uuid, text, text, date, date, text, text, integer, text, text, uuid
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pp_writing_commission_attributions_canonical(
  p_attributions jsonb
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'allocation_id', x.allocation_id,
        'amount_cents', x.amount_cents
      )
      ORDER BY x.allocation_id, x.amount_cents
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT
      public.pp_json_uuid(el.value, 'allocation_id') AS allocation_id,
      public.pp_json_bigint(el.value, 'amount_cents') AS amount_cents
    FROM jsonb_array_elements(p_attributions) AS el(value)
  ) x;
$$;

REVOKE ALL ON FUNCTION public.pp_writing_commission_attributions_canonical(jsonb)
  FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION E — Mutation RPCs
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pp_record_writing_commission_event_internal(
  p_application_id uuid,
  p_event_type text,
  p_amount_cents bigint,
  p_reason text,
  p_allocation_id uuid,
  p_expected_compensation_id uuid,
  p_idempotency_key text,
  p_carrier_id uuid,
  p_carrier_transaction_id text,
  p_statement_identifier text,
  p_statement_date date,
  p_transaction_date date,
  p_policy_reference text,
  p_source_file text,
  p_source_row integer,
  p_raw_description text,
  p_import_batch_identifier text,
  p_allow_pre_issue boolean,
  p_attributed_from_event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_reason text := public.pp_writing_commission_trim(p_reason, 500);
  v_type text := NULLIF(btrim(COALESCE(p_event_type, '')), '');
  v_key text := public.pp_writing_commission_trim(p_idempotency_key, 200);
  v_txn text := public.pp_writing_commission_trim(p_carrier_transaction_id, 200);
  v_stmt text := public.pp_writing_commission_trim(p_statement_identifier, 200);
  v_pref text := public.pp_writing_commission_trim(p_policy_reference, 200);
  v_file text := public.pp_writing_commission_trim(p_source_file, 500);
  v_raw text := public.pp_writing_commission_trim(p_raw_description, 2000);
  v_batch text := public.pp_writing_commission_trim(p_import_batch_identifier, 200);
  v_existing public.policy_writing_commission_events;
  v_alloc public.policy_agent_allocations;
  v_acct public.policy_writing_commission_accounts;
  v_row public.policy_writing_commission_events;
  v_policy_id uuid;
  v_audit uuid;
  v_unattributed boolean;
BEGIN
  PERFORM public.pp_assert_owner();

  IF p_application_id IS NULL
     OR v_type IS NULL
     OR p_amount_cents IS NULL
     OR v_reason IS NULL
     OR v_key IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;

  IF v_type NOT IN ('paid', 'adjustment', 'chargeback', 'recovery') THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF p_amount_cents = 0 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF (v_type = 'paid' AND p_amount_cents <= 0)
     OR (v_type = 'chargeback' AND p_amount_cents >= 0)
     OR (v_type = 'recovery' AND p_amount_cents <= 0) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
  IF p_source_row IS NOT NULL AND p_source_row <= 0 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  SELECT * INTO v_existing
  FROM public.policy_writing_commission_events
  WHERE idempotency_key = v_key;
  IF FOUND THEN
    IF NOT public.pp_writing_commission_event_payload_matches(
      v_existing,
      p_application_id,
      v_type,
      p_amount_cents,
      p_allocation_id,
      p_carrier_id,
      v_txn,
      v_stmt,
      p_statement_date,
      p_transaction_date,
      v_pref,
      v_file,
      p_source_row,
      v_raw,
      v_batch,
      p_attributed_from_event_id
    ) THEN
      PERFORM public.pp_raise('idempotency_conflict');
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'event', to_jsonb(v_existing)
    );
  END IF;

  IF p_attributed_from_event_id IS NULL
     AND p_carrier_id IS NOT NULL AND v_stmt IS NOT NULL AND v_txn IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.policy_writing_commission_events
    WHERE carrier_id = p_carrier_id
      AND statement_identifier = v_stmt
      AND carrier_transaction_id = v_txn
      AND attributed_from_event_id IS NULL;
    IF FOUND THEN
      PERFORM public.pp_raise('idempotency_conflict');
    END IF;
  END IF;

  PERFORM public.pp_writing_commission_assert_posting_stage(
    p_application_id, p_allow_pre_issue
  );

  SELECT id INTO v_policy_id
  FROM public.policies
  WHERE source_application_id = p_application_id
  LIMIT 1;

  v_unattributed := (p_allocation_id IS NULL);

  IF v_unattributed THEN
    IF v_txn IS NULL AND v_stmt IS NULL AND v_pref IS NULL AND v_raw IS NULL
       AND p_carrier_id IS NULL THEN
      PERFORM public.pp_raise('missing_required_fields');
    END IF;

    INSERT INTO public.policy_writing_commission_events (
      account_id, application_id, allocation_id, advisor_id, policy_id,
      event_type, amount_cents, reversed_event_id, attributed_from_event_id,
      attribution_status, idempotency_key,
      carrier_id, carrier_transaction_id, statement_identifier,
      statement_date, transaction_date, policy_reference,
      source_file, source_row, raw_description, import_batch_identifier,
      reason, created_by_user_id
    ) VALUES (
      NULL, p_application_id, NULL, NULL, v_policy_id,
      v_type, p_amount_cents, NULL, p_attributed_from_event_id,
      'review_required', v_key,
      p_carrier_id, v_txn, v_stmt,
      p_statement_date, p_transaction_date, v_pref,
      v_file, p_source_row, v_raw, v_batch,
      v_reason, auth.uid()
    )
    RETURNING * INTO v_row;
  ELSE
    v_alloc := public.pp_writing_commission_validate_allocation(
      p_allocation_id, p_application_id
    );
    v_acct := public.pp_ensure_writing_commission_account(
      v_alloc.id, p_application_id, p_expected_compensation_id
    );

    INSERT INTO public.policy_writing_commission_events (
      account_id, application_id, allocation_id, advisor_id, policy_id,
      event_type, amount_cents, reversed_event_id, attributed_from_event_id,
      attribution_status, idempotency_key,
      carrier_id, carrier_transaction_id, statement_identifier,
      statement_date, transaction_date, policy_reference,
      source_file, source_row, raw_description, import_batch_identifier,
      reason, created_by_user_id
    ) VALUES (
      v_acct.id, p_application_id, v_alloc.id, v_alloc.advisor_id, v_policy_id,
      v_type, p_amount_cents, NULL, p_attributed_from_event_id,
      'attributed', v_key,
      p_carrier_id, v_txn, v_stmt,
      p_statement_date, p_transaction_date, v_pref,
      v_file, p_source_row, v_raw, v_batch,
      v_reason, auth.uid()
    )
    RETURNING * INTO v_row;
  END IF;

  v_audit := public.crm_write_audit(
    CASE WHEN p_allow_pre_issue
      THEN 'record_policy_writing_commission_event_pre_issue'
      ELSE 'record_policy_writing_commission_event'
    END,
    'policy_writing_commission_events',
    v_row.id,
    NULL,
    jsonb_build_object(
      'reason', v_reason,
      'allow_pre_issue', p_allow_pre_issue,
      'event', to_jsonb(v_row)
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'event', to_jsonb(v_row),
    'account_id', v_row.account_id,
    'audit_id', v_audit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pp_record_writing_commission_event_internal(
  uuid, text, bigint, text, uuid, uuid, text, uuid, text, text, date, date, text, text, integer, text, text, boolean, uuid
) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.record_policy_writing_commission_event(
  uuid, text, bigint, text, uuid, uuid, text, uuid, text, text, date, date, text, text, integer, text, text
);
DROP FUNCTION IF EXISTS public.record_policy_writing_commission_event_pre_issue(
  uuid, text, bigint, text, uuid, uuid, text, uuid, text, text, date, date, text, text, integer, text, text
);

CREATE OR REPLACE FUNCTION public.record_policy_writing_commission_event(
  p_application_id uuid,
  p_event_type text,
  p_amount_cents bigint,
  p_reason text,
  p_idempotency_key text,
  p_allocation_id uuid DEFAULT NULL,
  p_expected_compensation_id uuid DEFAULT NULL,
  p_carrier_id uuid DEFAULT NULL,
  p_carrier_transaction_id text DEFAULT NULL,
  p_statement_identifier text DEFAULT NULL,
  p_statement_date date DEFAULT NULL,
  p_transaction_date date DEFAULT NULL,
  p_policy_reference text DEFAULT NULL,
  p_source_file text DEFAULT NULL,
  p_source_row integer DEFAULT NULL,
  p_raw_description text DEFAULT NULL,
  p_import_batch_identifier text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM set_config(
    'crm.rpc_context',
    'record_policy_writing_commission_event',
    true
  );
  BEGIN
    v_result := public.pp_record_writing_commission_event_internal(
      p_application_id, p_event_type, p_amount_cents, p_reason,
      p_allocation_id, p_expected_compensation_id, p_idempotency_key,
      p_carrier_id, p_carrier_transaction_id, p_statement_identifier,
      p_statement_date, p_transaction_date, p_policy_reference,
      p_source_file, p_source_row, p_raw_description, p_import_batch_identifier,
      false, NULL
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.record_policy_writing_commission_event(
  uuid, text, bigint, text, text, uuid, uuid, uuid, text, text, date, date, text, text, integer, text, text
) IS
  'Owner-only. Records one signed actual commission event. p_idempotency_key is required and never server-generated. Identical canonical retries return the original event; conflicting reuse fails closed. Attributed when p_allocation_id is set (writing advisor only). Unattributed when allocation is NULL. Normal path requires issued/in_force or a linked policy. Does not post pending/eligible/released. Does not mutate expected compensation.';

CREATE OR REPLACE FUNCTION public.record_policy_writing_commission_event_pre_issue(
  p_application_id uuid,
  p_event_type text,
  p_amount_cents bigint,
  p_reason text,
  p_idempotency_key text,
  p_allocation_id uuid DEFAULT NULL,
  p_expected_compensation_id uuid DEFAULT NULL,
  p_carrier_id uuid DEFAULT NULL,
  p_carrier_transaction_id text DEFAULT NULL,
  p_statement_identifier text DEFAULT NULL,
  p_statement_date date DEFAULT NULL,
  p_transaction_date date DEFAULT NULL,
  p_policy_reference text DEFAULT NULL,
  p_source_file text DEFAULT NULL,
  p_source_row integer DEFAULT NULL,
  p_raw_description text DEFAULT NULL,
  p_import_batch_identifier text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_result jsonb;
  v_reason text := public.pp_writing_commission_trim(p_reason, 500);
BEGIN
  PERFORM public.pp_assert_owner();
  IF v_reason IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;

  PERFORM set_config(
    'crm.rpc_context',
    'record_policy_writing_commission_event_pre_issue',
    true
  );
  BEGIN
    v_result := public.pp_record_writing_commission_event_internal(
      p_application_id, p_event_type, p_amount_cents, p_reason,
      p_allocation_id, p_expected_compensation_id, p_idempotency_key,
      p_carrier_id, p_carrier_transaction_id, p_statement_identifier,
      p_statement_date, p_transaction_date, p_policy_reference,
      p_source_file, p_source_row, p_raw_description, p_import_batch_identifier,
      true, NULL
    );
    PERFORM public.crm_clear_rpc_context();
    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.record_policy_writing_commission_event_pre_issue(
  uuid, text, bigint, text, text, uuid, uuid, uuid, text, text, date, date, text, text, integer, text, text
) IS
  'Owner-only exception path for pre-issue actual commission. Required reason and required p_idempotency_key. Identical retries return the original event. Conflicting reuse fails closed. Audited. Does not weaken the normal issued/in_force gate on record_policy_writing_commission_event.';

CREATE OR REPLACE FUNCTION public.reverse_policy_writing_commission_event(
  p_event_id uuid,
  p_reason text,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_reason text := public.pp_writing_commission_trim(p_reason, 500);
  v_key text := public.pp_writing_commission_trim(p_idempotency_key, 200);
  v_src public.policy_writing_commission_events;
  v_existing public.policy_writing_commission_events;
  v_row public.policy_writing_commission_events;
  v_audit uuid;
BEGIN
  PERFORM public.pp_assert_owner();
  IF p_event_id IS NULL OR v_reason IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;

  SELECT * INTO v_src
  FROM public.policy_writing_commission_events
  WHERE id = p_event_id;
  IF NOT FOUND THEN
    PERFORM public.pp_raise('not_found');
  END IF;
  IF v_src.event_type = 'reversal' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  SELECT * INTO v_existing
  FROM public.policy_writing_commission_events
  WHERE event_type = 'reversal'
    AND reversed_event_id = p_event_id;
  IF FOUND THEN
    IF v_key IS NOT NULL
       AND v_existing.idempotency_key IS DISTINCT FROM v_key THEN
      SELECT * INTO v_row
      FROM public.policy_writing_commission_events
      WHERE idempotency_key = v_key;
      IF FOUND AND v_row.id IS DISTINCT FROM v_existing.id THEN
        PERFORM public.pp_raise('idempotency_conflict');
      END IF;
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'event', to_jsonb(v_existing)
    );
  END IF;

  IF v_key IS NULL THEN
    v_key := 'reverse:' || p_event_id::text;
  END IF;

  SELECT * INTO v_existing
  FROM public.policy_writing_commission_events
  WHERE idempotency_key = v_key;
  IF FOUND THEN
    IF v_existing.event_type = 'reversal'
       AND v_existing.reversed_event_id IS NOT DISTINCT FROM p_event_id THEN
      RETURN jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'event', to_jsonb(v_existing)
      );
    END IF;
    PERFORM public.pp_raise('idempotency_conflict');
  END IF;

  PERFORM set_config(
    'crm.rpc_context',
    'reverse_policy_writing_commission_event',
    true
  );
  BEGIN
    INSERT INTO public.policy_writing_commission_events (
      account_id, application_id, allocation_id, advisor_id, policy_id,
      event_type, amount_cents, reversed_event_id, attributed_from_event_id,
      attribution_status, idempotency_key, reason, created_by_user_id
    ) VALUES (
      v_src.account_id, v_src.application_id, v_src.allocation_id, v_src.advisor_id, v_src.policy_id,
      'reversal', (- v_src.amount_cents), v_src.id, NULL,
      v_src.attribution_status, v_key, v_reason, auth.uid()
    )
    RETURNING * INTO v_row;

    v_audit := public.crm_write_audit(
      'reverse_policy_writing_commission_event',
      'policy_writing_commission_events',
      v_row.id,
      to_jsonb(v_src),
      jsonb_build_object('reason', v_reason, 'event', to_jsonb(v_row))
    );

    PERFORM public.crm_clear_rpc_context();
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', false,
      'event', to_jsonb(v_row),
      'audit_id', v_audit
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.reverse_policy_writing_commission_event(uuid, text, text) IS
  'Owner-only. Appends a reversal whose amount is the exact negative of the source event. Source row is untouched. Cannot reverse a reversal. Chargeback is not a reversal. At most one reversal per original. Retry returns the existing reversal. Optional p_idempotency_key; if omitted a deterministic reverse:{event_id} key is used. Never randomly generated.';

DROP FUNCTION IF EXISTS public.attribute_unattributed_commission_event(uuid, jsonb, text, text);

CREATE OR REPLACE FUNCTION public.attribute_unattributed_commission_event(
  p_event_id uuid,
  p_attributions jsonb,
  p_reason text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_reason text := public.pp_writing_commission_trim(p_reason, 500);
  v_key text := public.pp_writing_commission_trim(p_idempotency_key, 100);
  v_src public.policy_writing_commission_events;
  v_existing public.policy_writing_commission_events;
  v_el jsonb;
  v_alloc_id uuid;
  v_amount bigint;
  v_sum bigint := 0;
  v_reversal jsonb;
  v_created jsonb := '[]'::jsonb;
  v_one jsonb;
  v_rev_row public.policy_writing_commission_events;
  v_audit uuid;
  v_canonical jsonb;
  v_existing_canonical jsonb;
  v_rev_key text;
  v_child_key text;
  v_alloc_count integer := 0;
  v_distinct_allocs integer := 0;
BEGIN
  PERFORM public.pp_assert_owner();
  IF p_event_id IS NULL OR v_reason IS NULL OR p_attributions IS NULL OR v_key IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF jsonb_typeof(p_attributions) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_attributions) < 1 THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  SELECT * INTO v_src
  FROM public.policy_writing_commission_events
  WHERE id = p_event_id;
  IF NOT FOUND THEN
    PERFORM public.pp_raise('not_found');
  END IF;
  IF v_src.attribution_status IS DISTINCT FROM 'review_required'
     OR v_src.event_type = 'reversal' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  FOR v_el IN SELECT value FROM jsonb_array_elements(p_attributions)
  LOOP
    v_alloc_id := public.pp_json_uuid(v_el, 'allocation_id');
    v_amount := public.pp_json_bigint(v_el, 'amount_cents');
    IF v_alloc_id IS NULL OR v_amount IS NULL THEN
      PERFORM public.pp_raise('missing_required_fields');
    END IF;
    PERFORM public.pp_writing_commission_validate_allocation(
      v_alloc_id, v_src.application_id
    );
    v_sum := v_sum + v_amount;
    v_alloc_count := v_alloc_count + 1;
  END LOOP;
  IF v_sum IS DISTINCT FROM v_src.amount_cents THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  v_canonical := public.pp_writing_commission_attributions_canonical(p_attributions);
  SELECT count(DISTINCT (elem ->> 'allocation_id'))
  INTO v_distinct_allocs
  FROM jsonb_array_elements(v_canonical) AS elem;
  IF v_distinct_allocs IS DISTINCT FROM v_alloc_count THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  v_rev_key := v_key || ':' || p_event_id::text || ':reversal';

  SELECT * INTO v_existing
  FROM public.policy_writing_commission_events
  WHERE idempotency_key = v_rev_key;
  IF FOUND THEN
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'allocation_id', e.allocation_id,
          'amount_cents', e.amount_cents
        )
        ORDER BY e.allocation_id, e.amount_cents
      ),
      '[]'::jsonb
    )
    INTO v_existing_canonical
    FROM public.policy_writing_commission_events e
    WHERE e.attributed_from_event_id = p_event_id
      AND e.event_type <> 'reversal';
    IF v_existing_canonical IS DISTINCT FROM v_canonical THEN
      PERFORM public.pp_raise('idempotency_conflict');
    END IF;
    SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at, e.id), '[]'::jsonb)
    INTO v_created
    FROM public.policy_writing_commission_events e
    WHERE e.attributed_from_event_id = p_event_id;
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'reversal', to_jsonb(v_existing),
      'events', v_created
    );
  END IF;

  SELECT * INTO v_existing
  FROM public.policy_writing_commission_events
  WHERE attributed_from_event_id = p_event_id
  LIMIT 1;
  IF FOUND THEN
    PERFORM public.pp_raise('idempotency_conflict');
  END IF;

  SELECT * INTO v_existing
  FROM public.policy_writing_commission_events
  WHERE event_type = 'reversal'
    AND reversed_event_id = p_event_id;
  IF FOUND THEN
    PERFORM public.pp_raise('idempotency_conflict');
  END IF;

  PERFORM set_config(
    'crm.rpc_context',
    'attribute_unattributed_commission_event',
    true
  );
  BEGIN
    INSERT INTO public.policy_writing_commission_events (
      account_id, application_id, allocation_id, advisor_id, policy_id,
      event_type, amount_cents, reversed_event_id, attributed_from_event_id,
      attribution_status, idempotency_key, reason, created_by_user_id
    ) VALUES (
      NULL, v_src.application_id, NULL, NULL, v_src.policy_id,
      'reversal', (- v_src.amount_cents), v_src.id, NULL,
      'review_required', v_rev_key, v_reason, auth.uid()
    )
    RETURNING * INTO v_rev_row;
    v_reversal := to_jsonb(v_rev_row);

    FOR v_el IN SELECT value FROM jsonb_array_elements(p_attributions)
    LOOP
      v_alloc_id := public.pp_json_uuid(v_el, 'allocation_id');
      v_amount := public.pp_json_bigint(v_el, 'amount_cents');
      v_child_key := v_key || ':' || p_event_id::text || ':alloc:' || v_alloc_id::text;
      v_one := public.pp_record_writing_commission_event_internal(
        v_src.application_id,
        v_src.event_type,
        v_amount,
        v_reason,
        v_alloc_id,
        NULL,
        v_child_key,
        v_src.carrier_id,
        v_src.carrier_transaction_id,
        v_src.statement_identifier,
        v_src.statement_date,
        v_src.transaction_date,
        v_src.policy_reference,
        v_src.source_file,
        v_src.source_row,
        v_src.raw_description,
        v_src.import_batch_identifier,
        true,
        p_event_id
      );
      v_created := v_created || jsonb_build_array(v_one -> 'event');
    END LOOP;

    v_audit := public.crm_write_audit(
      'attribute_unattributed_commission_event',
      'policy_writing_commission_events',
      p_event_id,
      to_jsonb(v_src),
      jsonb_build_object(
        'reason', v_reason,
        'reversal', v_reversal,
        'events', v_created
      )
    );

    PERFORM public.crm_clear_rpc_context();
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', false,
      'reversal', v_reversal,
      'events', v_created,
      'audit_id', v_audit
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.crm_clear_rpc_context();
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.attribute_unattributed_commission_event(uuid, jsonb, text, text) IS
  'Owner-only. Requires p_idempotency_key. Reverses an unattributed event and inserts attributed writing-advisor events whose amounts sum to the original. Child keys are derived from the operation key, source event id, and allocation id. Identical retries return the original result. Conflicting reuse fails closed. Does not split from commission_bps or production_credit_bps. Does not UPDATE the original ownership.';

-- =============================================================================
-- SECTION F — Advisor-safe snapshot
-- Enforces authorization internally. Does not return household, application,
-- policy, or rate-card rows. Unattributed events are owner-only.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pp_writing_commission_snapshot(
  p_application_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_is_owner boolean;
  v_advisor uuid;
  v_accounts jsonb;
  v_events jsonb;
  v_unattributed jsonb;
  v_totals jsonb;
  v_acct public.policy_writing_commission_accounts;
  v_acct_list jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.pp_assert_authenticated();
  IF p_application_id IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  v_is_owner := public.crm_is_owner();
  v_advisor := public.crm_advisor_id();

  IF NOT v_is_owner THEN
    IF v_advisor IS NULL THEN
      PERFORM public.pp_raise('not_authorized');
    END IF;
  END IF;

  IF v_is_owner THEN
    FOR v_acct IN
      SELECT *
      FROM public.policy_writing_commission_accounts a
      WHERE a.application_id = p_application_id
      ORDER BY a.created_at, a.id
    LOOP
      SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at, e.id), '[]'::jsonb)
      INTO v_events
      FROM public.policy_writing_commission_events e
      WHERE e.account_id = v_acct.id;
      v_acct_list := v_acct_list || jsonb_build_array(
        jsonb_build_object(
          'account', to_jsonb(v_acct),
          'events', v_events,
          'reconciliation', public.pp_writing_commission_reconcile_sums(
            p_application_id, v_acct.id, NULL, false
          )
        )
      );
    END LOOP;

    SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at, e.id), '[]'::jsonb)
    INTO v_unattributed
    FROM public.policy_writing_commission_events e
    WHERE e.application_id = p_application_id
      AND e.attribution_status = 'review_required';

    v_totals := public.pp_writing_commission_reconcile_sums(
      p_application_id, NULL, NULL, true
    );

    RETURN jsonb_build_object(
      'viewer', 'owner',
      'application_id', p_application_id,
      'accounts', v_acct_list,
      'unattributed_events', v_unattributed,
      'totals', v_totals
    );
  END IF;

  FOR v_acct IN
    SELECT *
    FROM public.policy_writing_commission_accounts a
    WHERE a.application_id = p_application_id
      AND a.advisor_id = v_advisor
    ORDER BY a.created_at, a.id
  LOOP
    SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at, e.id), '[]'::jsonb)
    INTO v_events
    FROM public.policy_writing_commission_events e
    WHERE e.account_id = v_acct.id
      AND e.advisor_id = v_advisor;
    v_acct_list := v_acct_list || jsonb_build_array(
      jsonb_build_object(
        'account', to_jsonb(v_acct),
        'events', v_events,
        'reconciliation', public.pp_writing_commission_reconcile_sums(
          p_application_id, v_acct.id, v_advisor, false
        )
      )
    );
  END LOOP;

  v_totals := public.pp_writing_commission_reconcile_sums(
    p_application_id, NULL, v_advisor, false
  );

  RETURN jsonb_build_object(
    'viewer', 'advisor',
    'application_id', p_application_id,
    'accounts', v_acct_list,
    'unattributed_events', '[]'::jsonb,
    'totals', v_totals
  );
END;
$$;

COMMENT ON FUNCTION public.pp_writing_commission_snapshot(uuid) IS
  'Role-filtered actual-commission snapshot. Owner sees all accounts, unattributed events, and totals. Advisors see only their writing-advisor account and events. Unattributed money is always empty for advisors. Does not return household, application, policy, or rate-card rows. Authorization is enforced inside the function.';

-- =============================================================================
-- SECTION G — RLS / grants
-- =============================================================================

ALTER TABLE public.policy_writing_commission_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_writing_commission_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.policy_writing_commission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_writing_commission_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_writing_comm_acct_select
  ON public.policy_writing_commission_accounts;
CREATE POLICY policy_writing_comm_acct_select
  ON public.policy_writing_commission_accounts
  FOR SELECT TO authenticated
  USING (
    public.crm_is_owner()
    OR advisor_id = public.crm_advisor_id()
  );

DROP POLICY IF EXISTS policy_writing_comm_evt_select
  ON public.policy_writing_commission_events;
CREATE POLICY policy_writing_comm_evt_select
  ON public.policy_writing_commission_events
  FOR SELECT TO authenticated
  USING (
    public.crm_is_owner()
    OR (
      advisor_id IS NOT NULL
      AND advisor_id = public.crm_advisor_id()
    )
  );

REVOKE ALL ON TABLE public.policy_writing_commission_accounts FROM PUBLIC;
REVOKE ALL ON TABLE public.policy_writing_commission_accounts FROM anon;
REVOKE ALL ON TABLE public.policy_writing_commission_accounts FROM authenticated;
REVOKE ALL ON TABLE public.policy_writing_commission_events FROM PUBLIC;
REVOKE ALL ON TABLE public.policy_writing_commission_events FROM anon;
REVOKE ALL ON TABLE public.policy_writing_commission_events FROM authenticated;

GRANT SELECT ON TABLE public.policy_writing_commission_accounts TO authenticated;
GRANT SELECT ON TABLE public.policy_writing_commission_events TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.policy_writing_commission_accounts
  FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.policy_writing_commission_events
  FROM authenticated;

GRANT ALL ON TABLE public.policy_writing_commission_accounts TO service_role;
GRANT ALL ON TABLE public.policy_writing_commission_events TO service_role;

REVOKE ALL ON FUNCTION public.record_policy_writing_commission_event(
  uuid, text, bigint, text, text, uuid, uuid, uuid, text, text, date, date, text, text, integer, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_policy_writing_commission_event(
  uuid, text, bigint, text, text, uuid, uuid, uuid, text, text, date, date, text, text, integer, text, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.record_policy_writing_commission_event_pre_issue(
  uuid, text, bigint, text, text, uuid, uuid, uuid, text, text, date, date, text, text, integer, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_policy_writing_commission_event_pre_issue(
  uuid, text, bigint, text, text, uuid, uuid, uuid, text, text, date, date, text, text, integer, text, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.reverse_policy_writing_commission_event(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_policy_writing_commission_event(uuid, text, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.attribute_unattributed_commission_event(uuid, jsonb, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attribute_unattributed_commission_event(uuid, jsonb, text, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.pp_writing_commission_snapshot(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pp_writing_commission_snapshot(uuid)
  TO authenticated;

-- =============================================================================
-- End Migration 035
-- =============================================================================
