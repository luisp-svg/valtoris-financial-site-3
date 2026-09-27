-- Phase 3: one ledger, two independently evidenced payment legs.
BEGIN;
-- Deployment must recheck this; never infer the meaning of historical payments.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.policy_writing_commission_events) THEN
  RAISE EXCEPTION 'Phase 3 requires evidence review of existing commission events before migration';
 END IF;
END $$;
ALTER TABLE public.policy_writing_commission_accounts
 ALTER COLUMN application_id DROP NOT NULL, ALTER COLUMN allocation_id DROP NOT NULL,
 ADD COLUMN service_record_id uuid REFERENCES public.service_production_records(id) ON DELETE RESTRICT,
 ADD COLUMN service_allocation_id uuid REFERENCES public.service_production_allocations(id) ON DELETE RESTRICT,
 DROP CONSTRAINT policy_writing_comm_acct_pin_shape_check,
 ADD CONSTRAINT commission_account_source CHECK (
 (application_id IS NOT NULL AND allocation_id IS NOT NULL AND service_record_id IS NULL AND service_allocation_id IS NULL AND (expected_compensation_id IS NOT NULL OR expected_cents_pinned IS NULL)) OR
 (application_id IS NULL AND allocation_id IS NULL AND service_record_id IS NOT NULL AND service_allocation_id IS NOT NULL AND policy_id IS NULL AND expected_compensation_id IS NULL));
CREATE UNIQUE INDEX commission_service_account_unique ON public.policy_writing_commission_accounts(service_allocation_id);
ALTER TABLE public.policy_writing_commission_events
 ALTER COLUMN application_id DROP NOT NULL,
 ADD COLUMN service_record_id uuid REFERENCES public.service_production_records(id) ON DELETE RESTRICT,
 ADD COLUMN service_allocation_id uuid REFERENCES public.service_production_allocations(id) ON DELETE RESTRICT,
 ADD COLUMN payment_leg text NOT NULL DEFAULT 'carrier_to_imo' CHECK(payment_leg IN ('carrier_to_imo','imo_to_agent')),
 ADD COLUMN provider_reference text CHECK(length(btrim(provider_reference)) BETWEEN 1 AND 200),
 ADD COLUMN provider_transaction_id text CHECK(length(btrim(provider_transaction_id)) BETWEEN 1 AND 200),
 DROP CONSTRAINT policy_writing_comm_evt_attribution_shape_check,
 ADD CONSTRAINT commission_event_attribution CHECK (
 (attribution_status='attributed' AND account_id IS NOT NULL AND advisor_id IS NOT NULL AND ((allocation_id IS NOT NULL AND service_allocation_id IS NULL) OR (allocation_id IS NULL AND service_allocation_id IS NOT NULL))) OR
 (attribution_status='review_required' AND account_id IS NULL AND allocation_id IS NULL AND service_allocation_id IS NULL AND advisor_id IS NULL AND payment_leg='carrier_to_imo' AND service_record_id IS NULL)),
 ADD CONSTRAINT commission_event_source CHECK (
 (application_id IS NOT NULL AND service_record_id IS NULL AND service_allocation_id IS NULL) OR
 (application_id IS NULL AND allocation_id IS NULL AND service_record_id IS NOT NULL AND service_allocation_id IS NOT NULL AND policy_id IS NULL AND carrier_id IS NULL));
DROP INDEX public.policy_writing_comm_evt_carrier_stmt_txn_uidx;
CREATE UNIQUE INDEX policy_writing_comm_evt_carrier_stmt_txn_uidx ON public.policy_writing_commission_events(carrier_id,statement_identifier,carrier_transaction_id,payment_leg)
 WHERE carrier_id IS NOT NULL AND statement_identifier IS NOT NULL AND carrier_transaction_id IS NOT NULL AND attributed_from_event_id IS NULL;
CREATE UNIQUE INDEX commission_provider_transaction_unique ON public.policy_writing_commission_events(lower(btrim(provider_reference)),statement_identifier,provider_transaction_id,payment_leg,advisor_id)
 WHERE provider_reference IS NOT NULL AND statement_identifier IS NOT NULL AND provider_transaction_id IS NOT NULL AND attributed_from_event_id IS NULL;
CREATE INDEX commission_service_events ON public.policy_writing_commission_events(service_record_id);

CREATE TABLE public.writing_commission_workflow_events (
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
 account_id uuid NOT NULL REFERENCES public.policy_writing_commission_accounts(id) ON DELETE RESTRICT,
 action text NOT NULL CHECK(action IN ('pending_confirmed','pending_cleared','eligible','eligibility_revoked')),
 effective_date date NOT NULL,
 pending_amount_cents bigint CHECK(pending_amount_cents BETWEEN 0 AND 999999999999),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 500),
 evidence_reference text NOT NULL CHECK(length(btrim(evidence_reference)) BETWEEN 1 AND 200),
 idempotency_key text NOT NULL UNIQUE CHECK(length(btrim(idempotency_key)) BETWEEN 1 AND 200),
 actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((action='pending_confirmed' AND pending_amount_cents IS NOT NULL) OR (action<>'pending_confirmed' AND pending_amount_cents IS NULL))
);
ALTER TABLE public.writing_commission_workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.writing_commission_workflow_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.writing_commission_workflow_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.writing_commission_workflow_events TO authenticated;
CREATE POLICY commission_workflow_read ON public.writing_commission_workflow_events FOR SELECT TO authenticated USING (
 public.crm_is_owner() OR (public.crm_is_advisor() AND EXISTS(SELECT 1 FROM public.policy_writing_commission_accounts a WHERE a.id=account_id AND a.advisor_id=public.crm_advisor_id())));
CREATE OR REPLACE FUNCTION public.enforce_policy_writing_commission_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_ctx text := COALESCE(public.crm_rpc_context(), '');
  v_write_contexts text[] := ARRAY[
    'record_commission_fact',
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
CREATE TRIGGER commission_workflow_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.writing_commission_workflow_events FOR EACH ROW EXECUTE FUNCTION public.enforce_policy_writing_commission_immutability();
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
  IF v_src.payment_leg IS DISTINCT FROM NEW.payment_leg
     OR v_src.service_record_id IS DISTINCT FROM NEW.service_record_id
     OR v_src.service_allocation_id IS DISTINCT FROM NEW.service_allocation_id
     OR v_src.application_id IS DISTINCT FROM NEW.application_id THEN
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
      payment_leg, service_record_id, service_allocation_id, account_id, application_id, allocation_id, advisor_id, policy_id,
      event_type, amount_cents, reversed_event_id, attributed_from_event_id,
      attribution_status, idempotency_key, reason, created_by_user_id
    ) VALUES (
      v_src.payment_leg, v_src.service_record_id, v_src.service_allocation_id, v_src.account_id, v_src.application_id, v_src.allocation_id, v_src.advisor_id, v_src.policy_id,
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
  WHERE e.payment_leg = 'carrier_to_imo' AND e.application_id = p_application_id
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
      WHERE e.payment_leg = 'carrier_to_imo' AND e.account_id = v_acct.id;
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
    WHERE e.payment_leg = 'carrier_to_imo' AND e.account_id = v_acct.id
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
    p_existing.payment_leg = 'carrier_to_imo' AND p_existing.service_record_id IS NULL AND
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

-- Fail closed even for alternate internal write paths.
CREATE FUNCTION public.commission_source_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE a public.policy_writing_commission_accounts; s public.service_production_allocations; p public.policy_agent_allocations;
BEGIN
 IF NEW.service_allocation_id IS NOT NULL THEN
  SELECT * INTO s FROM public.service_production_allocations WHERE id=NEW.service_allocation_id;
  IF NOT FOUND OR s.record_id IS DISTINCT FROM NEW.service_record_id OR s.advisor_id IS DISTINCT FROM NEW.advisor_id THEN RAISE EXCEPTION 'CRM_PP:invalid_allocation'; END IF;
 ELSIF NEW.allocation_id IS NOT NULL THEN
  p:=public.pp_writing_commission_validate_allocation(NEW.allocation_id,NEW.application_id);
  IF p.advisor_id IS DISTINCT FROM NEW.advisor_id THEN RAISE EXCEPTION 'CRM_PP:invalid_allocation'; END IF;
 END IF;
 IF TG_TABLE_NAME='policy_writing_commission_events' THEN
 IF NEW.account_id IS NOT NULL THEN
  SELECT * INTO a FROM public.policy_writing_commission_accounts WHERE id=NEW.account_id;
  IF NOT FOUND OR a.application_id IS DISTINCT FROM NEW.application_id OR a.service_record_id IS DISTINCT FROM NEW.service_record_id OR a.allocation_id IS DISTINCT FROM NEW.allocation_id OR a.service_allocation_id IS DISTINCT FROM NEW.service_allocation_id OR a.advisor_id IS DISTINCT FROM NEW.advisor_id THEN RAISE EXCEPTION 'CRM_PP:invalid_account'; END IF;
 END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER commission_account_source_guard BEFORE INSERT ON public.policy_writing_commission_accounts FOR EACH ROW EXECUTE FUNCTION public.commission_source_guard();
CREATE TRIGGER commission_event_source_guard BEFORE INSERT ON public.policy_writing_commission_events FOR EACH ROW EXECUTE FUNCTION public.commission_source_guard();
REVOKE ALL ON FUNCTION public.commission_source_guard() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.record_commission_fact(p_source_kind text,p_source_id uuid,p_allocation_id uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE
 a public.policy_writing_commission_accounts; s public.service_production_allocations; sr public.service_production_records;
 e public.policy_writing_commission_events; w public.writing_commission_workflow_events;
 k text:=nullif(btrim(p_payload->>'idempotency_key'),''); r text:=nullif(btrim(p_payload->>'reason'),'');
 action text:=p_payload->>'action'; leg text:=p_payload->>'payment_leg'; amt bigint:=(p_payload->>'amount_cents')::bigint;
 d date:=(p_payload->>'effective_date')::date; evidence text:=nullif(btrim(p_payload->>'evidence_reference'),'');
 provider text:=nullif(btrim(p_payload->>'provider_reference'),''); txn text:=nullif(btrim(p_payload->>'transaction_reference'),'');
 statement text:=nullif(btrim(p_payload->>'statement_identifier'),''); result uuid;
BEGIN
 PERFORM public.pp_assert_owner();
 IF p_source_kind IS NULL OR p_source_kind NOT IN ('policy','service') OR p_source_id IS NULL OR p_allocation_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
 OR k IS NULL OR length(k)>200 OR r IS NULL OR length(r)>500 OR d IS NULL OR d>current_date OR evidence IS NULL OR length(evidence)>200
 OR action IS NULL OR action NOT IN ('paid','adjustment','chargeback','recovery','pending_confirmed','pending_cleared','eligible','eligibility_revoked')
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) x WHERE x NOT IN ('idempotency_key','reason','action','payment_leg','amount_cents','effective_date','evidence_reference','provider_reference','transaction_reference','statement_identifier')) THEN RAISE EXCEPTION 'CRM_PP:invalid_payload'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('commission-key:'||k,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('commission-allocation:'||p_allocation_id::text,0));
 PERFORM set_config('crm.rpc_context','record_commission_fact',true);
 IF p_source_kind='policy' THEN
  PERFORM 1 FROM public.policy_applications WHERE id=p_source_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CRM_PP:not_found'; END IF;
  a:=public.pp_ensure_writing_commission_account(p_allocation_id,p_source_id,NULL);
 ELSE
  SELECT * INTO sr FROM public.service_production_records WHERE id=p_source_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CRM_PP:not_found'; END IF;
  SELECT * INTO s FROM public.service_production_allocations WHERE id=p_allocation_id AND record_id=p_source_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CRM_PP:invalid_allocation'; END IF;
  SELECT * INTO a FROM public.policy_writing_commission_accounts WHERE service_allocation_id=s.id;
  IF NOT FOUND THEN
   INSERT INTO public.policy_writing_commission_accounts(service_record_id,service_allocation_id,advisor_id,expected_cents_pinned,created_by_user_id)
   VALUES(sr.id,s.id,s.advisor_id,CASE WHEN s.review_status='reviewed' THEN s.expected_cents END,auth.uid()) RETURNING * INTO a;
  END IF;
 END IF;
 IF action IN ('paid','adjustment','chargeback','recovery') THEN
  IF p_source_kind='policy' AND leg='carrier_to_imo' THEN RAISE EXCEPTION 'CRM_PP:use_carrier_ledger'; END IF;
  IF leg IS NULL OR leg NOT IN ('carrier_to_imo','imo_to_agent') OR amt IS NULL OR amt=0 OR abs(amt::numeric)>999999999999 OR provider IS NULL OR length(provider)>200 OR txn IS NULL OR length(txn)>200 OR statement IS NULL OR length(statement)>200
  OR (action IN ('paid','recovery') AND amt<0) OR (action='chargeback' AND amt>0) THEN RAISE EXCEPTION 'CRM_PP:invalid_payload'; END IF;
  IF EXISTS(SELECT 1 FROM public.writing_commission_workflow_events WHERE idempotency_key=k) THEN RAISE EXCEPTION 'CRM_PP:idempotency_conflict'; END IF;
  SELECT * INTO e FROM public.policy_writing_commission_events WHERE idempotency_key=k;
  IF FOUND THEN
   IF e.account_id IS DISTINCT FROM a.id OR e.event_type IS DISTINCT FROM action OR e.payment_leg IS DISTINCT FROM leg OR e.amount_cents IS DISTINCT FROM amt OR e.transaction_date IS DISTINCT FROM d OR e.reason IS DISTINCT FROM r OR e.raw_description IS DISTINCT FROM evidence OR e.provider_reference IS DISTINCT FROM provider OR e.provider_transaction_id IS DISTINCT FROM txn OR e.statement_identifier IS DISTINCT FROM statement THEN RAISE EXCEPTION 'CRM_PP:idempotency_conflict'; END IF;
   result:=e.id;
  ELSE
   INSERT INTO public.policy_writing_commission_events(account_id,application_id,allocation_id,service_record_id,service_allocation_id,advisor_id,policy_id,event_type,amount_cents,payment_leg,attribution_status,idempotency_key,reason,transaction_date,raw_description,provider_reference,provider_transaction_id,statement_identifier,created_by_user_id)
   VALUES(a.id,a.application_id,a.allocation_id,a.service_record_id,a.service_allocation_id,a.advisor_id,a.policy_id,action,amt,leg,'attributed',k,r,d,evidence,provider,txn,statement,auth.uid()) RETURNING id INTO result;
   PERFORM public.crm_write_audit('record_commission_fact','policy_writing_commission_events',result,NULL,jsonb_build_object('account_id',a.id,'payment_leg',leg,'event_type',action));
  END IF;
 ELSE
  IF leg IS NOT NULL OR provider IS NOT NULL OR txn IS NOT NULL OR statement IS NOT NULL OR (action='pending_confirmed' AND (amt IS NULL OR amt<0 OR amt>999999999999)) OR (action<>'pending_confirmed' AND amt IS NOT NULL) THEN RAISE EXCEPTION 'CRM_PP:invalid_payload'; END IF;
  -- Policy pending already has a source-reviewed import system. Do not duplicate it.
  IF p_source_kind='policy' AND action IN ('pending_confirmed','pending_cleared') THEN RAISE EXCEPTION 'CRM_PP:use_pending_import'; END IF;
  IF EXISTS(SELECT 1 FROM public.policy_writing_commission_events WHERE idempotency_key=k) THEN RAISE EXCEPTION 'CRM_PP:idempotency_conflict'; END IF;
  SELECT * INTO w FROM public.writing_commission_workflow_events WHERE idempotency_key=k;
  IF FOUND THEN
   IF w.account_id IS DISTINCT FROM a.id OR w.action IS DISTINCT FROM action OR w.effective_date IS DISTINCT FROM d OR w.reason IS DISTINCT FROM r OR w.evidence_reference IS DISTINCT FROM evidence OR w.pending_amount_cents IS DISTINCT FROM amt THEN RAISE EXCEPTION 'CRM_PP:idempotency_conflict'; END IF;
   result:=w.id;
  ELSE
   INSERT INTO public.writing_commission_workflow_events(account_id,action,effective_date,pending_amount_cents,reason,evidence_reference,idempotency_key,actor_id)
   VALUES(a.id,action,d,amt,r,evidence,k,auth.uid()) RETURNING id INTO result;
   PERFORM public.crm_write_audit('record_commission_fact','writing_commission_workflow_events',result,NULL,jsonb_build_object('account_id',a.id,'action',action));
  END IF;
 END IF;
 PERFORM public.crm_clear_rpc_context();
 RETURN jsonb_build_object('ok',true,'id',result,'account_id',a.id);
EXCEPTION WHEN OTHERS THEN PERFORM public.crm_clear_rpc_context(); RAISE;
END $$;
REVOKE ALL ON FUNCTION public.record_commission_fact(text,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_commission_fact(text,uuid,uuid,jsonb) TO authenticated;

-- Immutable provider identity for evidence: name changes cannot shift old source facts.
COMMENT ON COLUMN public.policy_writing_commission_events.payment_leg IS 'carrier_to_imo = Released to Experior; imo_to_agent = Paid received by the agent. Never sum the two legs as earnings.';
DROP POLICY policy_writing_comm_acct_select ON public.policy_writing_commission_accounts;
CREATE POLICY policy_writing_comm_acct_select ON public.policy_writing_commission_accounts FOR SELECT TO authenticated USING(public.crm_is_owner() OR (public.crm_is_advisor() AND advisor_id=public.crm_advisor_id()));
DROP POLICY policy_writing_comm_evt_select ON public.policy_writing_commission_events;
CREATE POLICY policy_writing_comm_evt_select ON public.policy_writing_commission_events FOR SELECT TO authenticated USING(public.crm_is_owner() OR (public.crm_is_advisor() AND advisor_id=public.crm_advisor_id()));
COMMIT;
