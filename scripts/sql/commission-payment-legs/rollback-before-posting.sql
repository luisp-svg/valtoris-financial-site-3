-- Emergency rollback ONLY before any account, financial, or workflow facts exist.
-- Stop Phase 3 entry points first. After any facts exist, use forward repair.
-- Migration history and application deployment must be coordinated separately.
BEGIN;
LOCK TABLE public.policy_writing_commission_accounts,public.policy_writing_commission_events,public.writing_commission_workflow_events IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.policy_writing_commission_accounts) OR EXISTS(SELECT 1 FROM public.policy_writing_commission_events) OR EXISTS(SELECT 1 FROM public.writing_commission_workflow_events) THEN RAISE EXCEPTION 'Rollback refused: retain commission facts and use forward repair'; END IF; END $$;
DROP FUNCTION public.record_commission_fact(text,uuid,uuid,jsonb);
DROP TABLE public.writing_commission_workflow_events;
DROP TRIGGER commission_account_source_guard ON public.policy_writing_commission_accounts;
DROP TRIGGER commission_event_source_guard ON public.policy_writing_commission_events;
DROP FUNCTION public.commission_source_guard();
ALTER TABLE public.policy_writing_commission_events DROP CONSTRAINT commission_event_attribution,DROP CONSTRAINT commission_event_source,
 DROP COLUMN service_record_id,DROP COLUMN service_allocation_id,DROP COLUMN payment_leg,DROP COLUMN provider_reference,DROP COLUMN provider_transaction_id,
 ALTER COLUMN application_id SET NOT NULL,
 ADD CONSTRAINT policy_writing_comm_evt_attribution_shape_check CHECK ((attribution_status='attributed' AND account_id IS NOT NULL AND allocation_id IS NOT NULL AND advisor_id IS NOT NULL) OR (attribution_status='review_required' AND account_id IS NULL AND allocation_id IS NULL AND advisor_id IS NULL));
ALTER TABLE public.policy_writing_commission_accounts DROP CONSTRAINT commission_account_source,DROP COLUMN service_record_id,DROP COLUMN service_allocation_id,
 ALTER COLUMN application_id SET NOT NULL,ALTER COLUMN allocation_id SET NOT NULL,
 ADD CONSTRAINT policy_writing_comm_acct_pin_shape_check CHECK (expected_compensation_id IS NOT NULL OR expected_cents_pinned IS NULL);
CREATE UNIQUE INDEX policy_writing_comm_evt_carrier_stmt_txn_uidx ON public.policy_writing_commission_events(carrier_id,statement_identifier,carrier_transaction_id) WHERE carrier_id IS NOT NULL AND statement_identifier IS NOT NULL AND carrier_transaction_id IS NOT NULL AND attributed_from_event_id IS NULL;
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
-- Keep the stricter active-advisor read policies.
COMMIT;
