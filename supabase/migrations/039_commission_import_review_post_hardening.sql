-- 039_commission_import_review_post_hardening.sql
-- Function-only hardening of existing 036 review/post RPCs.
-- Prevents Override, additional commissions, ignored, and confirmed-duplicate
-- import rows from being promoted to ready_to_post or posted into 035,
-- even if an owner bypasses the Phase 3B UI.
--
-- Does not change 036 table schema, staging/classification, fingerprint
-- logic, source_row_key, carrier aliases, 034 expected, 035 ledger schema,
-- Phase 2 manual workflow, sign rules, allocation validation, or
-- review_duplicate_candidate → distinct → ready_to_post → post.

-- =============================================================================
-- SECTION A — review_commission_import_row
-- =============================================================================

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
    -- Source classification wins over inferred event type / stale resolution.
    IF lower(btrim(COALESCE(v_row.source_type, ''))) = 'override' THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    IF v_row.source_section = 'additional_commissions' THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    IF v_row.review_status IN (
      'ignored_nonwriting',
      'ignored_nonpolicy',
      'duplicate'
    ) THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
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
  'Owner-only. Updates review/resolution on an unposted import row. Source facts stay immutable. Posted rows cannot be reassigned. Override, additional_commissions, ignored_nonwriting, ignored_nonpolicy, and duplicate cannot become ready_to_post. review_duplicate_candidate may still resolve distinct with a complete application+allocation+event payload. Audited. Does not post 035 money.';

-- =============================================================================
-- SECTION B — post_commission_import_row
-- =============================================================================

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

  IF lower(btrim(COALESCE(v_row.source_type, ''))) = 'override' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;
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
  'Owner-only. Posts one ready_to_post import row through record_policy_writing_commission_event. Amount is source_income_cents. Idempotency key is 036:{batch_id}:{source_row_key}. Override source rows cannot post regardless of review_status. additional_commissions, ignored, review, invalid, and duplicate statuses cannot post. A review_duplicate_candidate that was resolved distinct to ready_to_post may post once. transaction_fingerprint is never the 035 key. Does not mutate 034 expected snapshots.';

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

-- =============================================================================
-- End Migration 039
-- =============================================================================
