-- 041_commission_pending_review.sql
-- Function-only Pending Phase B review RPC.
-- Does not change 040 tables/columns, 034 expected, 035 ledger, or 036/039 Paid.
-- Accepting Pending is not a payment and never writes 035.

-- =============================================================================
-- SECTION A — Permit this RPC in the existing 040 immutability context
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
    'stage_commission_pending_import_rows',
    'review_commission_pending_import_row'
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

REVOKE ALL ON FUNCTION public.enforce_commission_pending_import_immutability()
  FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- SECTION B — Owner-only Pending review RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION public.review_commission_pending_import_row(
  p_row_id uuid,
  p_action text,
  p_reason text,
  p_resolved_application_id uuid DEFAULT NULL,
  p_resolved_allocation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_action text := lower(NULLIF(btrim(COALESCE(p_action, '')), ''));
  v_reason text := public.pp_writing_commission_trim(p_reason, 500);
  v_row public.commission_pending_import_rows;
  v_before jsonb;
  v_app public.policy_applications;
  v_alloc public.policy_agent_allocations;
  v_status text;
  v_audit uuid;
BEGIN
  PERFORM public.pp_assert_owner();
  IF p_row_id IS NULL OR v_action IS NULL OR v_reason IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  IF v_action NOT IN ('accept', 'confirm_duplicate', 'confirm_distinct') THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  SELECT * INTO v_row
  FROM public.commission_pending_import_rows
  WHERE id = p_row_id;
  IF NOT FOUND THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  IF v_row.pending_review_status IN (
    'ignored_nonwriting',
    'ignored_nonpolicy',
    'duplicate',
    'invalid_amount',
    'invalid_source_identity',
    'accepted_pending'
  ) THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  IF lower(btrim(COALESCE(v_row.source_type, ''))) = 'override'
     OR v_row.source_section = 'additional_commissions' THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  IF v_action = 'confirm_duplicate' THEN
    IF v_row.pending_review_status IS DISTINCT FROM 'review_duplicate_candidate' THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    v_status := 'duplicate';
  ELSE
    IF v_action = 'accept'
       AND v_row.pending_review_status NOT IN (
         'review_policy_match',
         'review_advisor_match',
         'review_split_attribution'
       ) THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    IF v_action = 'confirm_distinct'
       AND v_row.pending_review_status IS DISTINCT FROM 'review_duplicate_candidate' THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;

    IF lower(btrim(COALESCE(v_row.source_type, ''))) IS DISTINCT FROM 'commission'
       OR v_row.source_section NOT IN ('insurance', 'insurance_paid_over_12_months')
       OR v_row.source_income_cents IS NULL
       OR v_row.source_income_cents <= 0
       OR p_resolved_application_id IS NULL
       OR p_resolved_allocation_id IS NULL THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;

    SELECT * INTO v_app
    FROM public.policy_applications
    WHERE id = p_resolved_application_id
      AND deleted_at IS NULL;
    IF NOT FOUND THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;

    SELECT * INTO v_alloc
    FROM public.policy_agent_allocations
    WHERE id = p_resolved_allocation_id
      AND allocation_role = 'writing'
      AND recipient_type = 'advisor'
      AND effective_to IS NULL
      AND advisor_id IS NOT NULL;
    IF NOT FOUND THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
    IF v_alloc.application_id IS DISTINCT FROM p_resolved_application_id THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;

    v_status := 'accepted_pending';
  END IF;

  v_before := to_jsonb(v_row);
  PERFORM set_config('crm.rpc_context', 'review_commission_pending_import_row', true);
  BEGIN
    IF v_status = 'duplicate' THEN
      UPDATE public.commission_pending_import_rows
      SET
        pending_review_status = 'duplicate',
        pending_review_reason = v_reason,
        reviewed_by_user_id = auth.uid(),
        reviewed_at = now()
      WHERE id = p_row_id
      RETURNING * INTO v_row;
    ELSE
      UPDATE public.commission_pending_import_rows
      SET
        pending_review_status = 'accepted_pending',
        pending_review_reason = v_reason,
        resolved_carrier_id = v_app.carrier_id,
        resolved_application_id = p_resolved_application_id,
        resolved_allocation_id = p_resolved_allocation_id,
        resolved_advisor_id = v_alloc.advisor_id,
        reviewed_by_user_id = auth.uid(),
        reviewed_at = now()
      WHERE id = p_row_id
      RETURNING * INTO v_row;
    END IF;

    PERFORM public.pp_commission_pending_import_refresh_batch_counts(v_row.batch_id);

    v_audit := public.crm_write_audit(
      'review_commission_pending_import_row',
      'commission_pending_import_rows',
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

COMMENT ON FUNCTION public.review_commission_pending_import_row(
  uuid, text, text, uuid, uuid
) IS
  'Owner-only. Resolves a 040 Pending review row. Actions: accept, confirm_duplicate, confirm_distinct. Advisor is derived from the selected live writing allocation. Source facts stay immutable. Does not write 035.';

REVOKE ALL ON FUNCTION public.review_commission_pending_import_row(
  uuid, text, text, uuid, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_commission_pending_import_row(
  uuid, text, text, uuid, uuid
) TO authenticated;
