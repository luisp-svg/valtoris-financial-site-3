-- 046_opportunity_case_conversion.sql
-- One live policy application per opportunity, plus atomic Opportunity → draft
-- Application conversion. Reuses existing policy_applications.opportunity_id.
-- ZERO backfill. Does not modify 001–045. Does not create a second linkage column,
-- a second Case architecture, commission rows, or a new opportunity status.

-- =============================================================================
-- SECTION A — One live application per opportunity
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS policy_applications_live_opportunity_unique_idx
  ON public.policy_applications (opportunity_id)
  WHERE opportunity_id IS NOT NULL
    AND deleted_at IS NULL;

COMMENT ON INDEX public.policy_applications_live_opportunity_unique_idx IS
  'At most one live policy application may link to a given opportunity. Soft-deleted applications do not occupy the slot.';

-- =============================================================================
-- SECTION B — convert_opportunity_to_policy_application
-- =============================================================================

CREATE OR REPLACE FUNCTION public.convert_opportunity_to_policy_application(
  p_opportunity_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed_keys text[] := ARRAY[
    'household_id',
    'carrier_id',
    'product_id',
    'product_line',
    'state',
    'application_number',
    'is_replacement',
    'is_exchange_or_transfer',
    'face_amount_cents',
    'annuity_deposit_cents',
    'premium_mode',
    'submitted_premium_cents',
    'target_premium_cents',
    'total_points_scaled',
    'notes',
    'participants',
    'allocations'
  ];
  v_opp public.opportunities;
  v_vertical_code text;
  v_client_household uuid;
  v_household_id uuid;
  v_carrier_id uuid;
  v_product_id uuid;
  v_product_line public.insurance_product_line;
  v_participants jsonb;
  v_allocations jsonb;
  v_existing_id uuid;
  v_create_payload jsonb;
  v_create_result jsonb;
  v_application_id uuid;
  v_audit_id uuid;
  v_dest_stage_id uuid;
  v_current_sort integer;
  v_dest_sort integer;
BEGIN
  PERFORM public.pp_assert_authenticated();
  IF p_opportunity_id IS NULL THEN
    PERFORM public.pp_raise('missing_required_fields');
  END IF;
  PERFORM public.pp_assert_payload_size(p_payload);
  PERFORM public.pp_assert_object_keys(p_payload, v_allowed_keys);

  SELECT *
  INTO v_opp
  FROM public.opportunities o
  WHERE o.id = p_opportunity_id
    AND o.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  IF NOT public.crm_can_access_opportunity(p_opportunity_id) THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  v_household_id := v_opp.household_id;
  IF v_household_id IS NULL THEN
    PERFORM public.pp_raise('not_found');
  END IF;

  v_client_household := public.pp_json_uuid(p_payload, 'household_id');
  IF v_client_household IS NOT NULL
     AND v_client_household IS DISTINCT FROM v_household_id THEN
    PERFORM public.pp_raise('household_mismatch');
  END IF;

  SELECT a.id
  INTO v_existing_id
  FROM public.policy_applications a
  WHERE a.opportunity_id = p_opportunity_id
    AND a.deleted_at IS NULL
  FOR SHARE;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'created', false,
      'application_id', v_existing_id,
      'household_id', v_household_id,
      'opportunity_id', p_opportunity_id,
      'application', public.pp_application_snapshot(v_existing_id)
    );
  END IF;

  SELECT sv.code
  INTO v_vertical_code
  FROM public.service_verticals sv
  WHERE sv.id = v_opp.service_vertical_id;

  IF v_vertical_code IS NULL THEN
    PERFORM public.pp_raise('invalid_transition');
  END IF;

  IF v_opp.status = 'lost' THEN
    PERFORM public.pp_raise('invalid_transition');
  END IF;
  IF v_opp.status NOT IN ('open', 'on_hold', 'won') THEN
    PERFORM public.pp_raise('invalid_transition');
  END IF;

  IF v_vertical_code NOT IN ('life', 'retirement') THEN
    PERFORM public.pp_raise('invalid_transition');
  END IF;

  v_carrier_id := public.pp_json_uuid(p_payload, 'carrier_id');
  v_product_id := public.pp_json_uuid(p_payload, 'product_id');
  v_product_line := public.pp_resolve_catalog(
    v_carrier_id,
    v_product_id,
    public.pp_parse_product_line(public.pp_json_text(p_payload, 'product_line')),
    false
  );

  IF v_vertical_code = 'life' THEN
    IF v_product_line NOT IN ('life_term', 'life_permanent') THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
  ELSIF v_vertical_code = 'retirement' THEN
    IF v_product_line IS DISTINCT FROM 'fia' THEN
      PERFORM public.pp_raise('invalid_payload');
    END IF;
  END IF;

  v_participants := COALESCE(p_payload -> 'participants', '[]'::jsonb);
  IF jsonb_typeof(v_participants) <> 'array'
     OR jsonb_array_length(v_participants) < 1 THEN
    PERFORM public.pp_raise('invalid_participants');
  END IF;

  v_allocations := COALESCE(p_payload -> 'allocations', '[]'::jsonb);
  IF jsonb_typeof(v_allocations) <> 'array'
     OR jsonb_array_length(v_allocations) < 1 THEN
    PERFORM public.pp_raise('invalid_allocations');
  END IF;
  PERFORM public.pp_assert_allocations_valid(v_allocations);
  PERFORM public.pp_assert_house_rows_authorized(v_allocations);

  v_create_payload := (p_payload - 'household_id')
    || jsonb_build_object(
      'household_id', v_household_id,
      'opportunity_id', p_opportunity_id
    );

  BEGIN
    v_create_result := public.create_policy_application(v_create_payload);
  EXCEPTION WHEN unique_violation THEN
    SELECT a.id
    INTO v_existing_id
    FROM public.policy_applications a
    WHERE a.opportunity_id = p_opportunity_id
      AND a.deleted_at IS NULL;
    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'created', false,
        'application_id', v_existing_id,
        'household_id', v_household_id,
        'opportunity_id', p_opportunity_id,
        'application', public.pp_application_snapshot(v_existing_id)
      );
    END IF;
    RAISE;
  END;

  v_application_id := NULLIF(v_create_result ->> 'application_id', '')::uuid;
  IF v_application_id IS NULL THEN
    PERFORM public.pp_raise('invalid_payload');
  END IF;

  PERFORM public.pp_assert_participants_for_submit(v_application_id, v_product_line);

  -- Best-effort Life Application Started movement. Conversion success does not
  -- depend on this. Never move won/on_hold, never move backward, never invent a
  -- stage, and never reopen closed_at via move_opportunity_stage.
  IF v_vertical_code = 'life' AND v_opp.status = 'open' THEN
    SELECT dest.id, dest.sort_order, cur.sort_order
    INTO v_dest_stage_id, v_dest_sort, v_current_sort
    FROM public.pipeline_stages cur
    JOIN public.pipelines p ON p.id = v_opp.pipeline_id
    JOIN public.service_verticals sv ON sv.id = p.service_vertical_id
    JOIN public.pipeline_stages dest
      ON dest.pipeline_id = v_opp.pipeline_id
     AND dest.code = 'application_started'
    WHERE cur.id = v_opp.stage_id
      AND p.pipeline_type = 'service'
      AND p.service_vertical_id = v_opp.service_vertical_id
      AND sv.code = 'life';

    IF v_dest_stage_id IS NOT NULL
       AND v_current_sort IS NOT NULL
       AND v_dest_sort IS NOT NULL
       AND v_current_sort < v_dest_sort THEN
      BEGIN
        PERFORM public.move_opportunity_stage(p_opportunity_id, v_dest_stage_id);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  v_audit_id := public.crm_write_audit(
    'convert_opportunity_to_policy_application',
    'policy_applications',
    v_application_id,
    jsonb_build_object(
      'opportunity_id', p_opportunity_id,
      'household_id', v_household_id
    ),
    jsonb_build_object(
      'opportunity_id', p_opportunity_id,
      'application_id', v_application_id,
      'household_id', v_household_id,
      'created', true,
      'product_line', v_product_line,
      'allocations', v_allocations
    )
  );
  IF v_audit_id IS NULL THEN
    PERFORM public.pp_raise('not_authorized');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'created', true,
    'application_id', v_application_id,
    'household_id', v_household_id,
    'opportunity_id', p_opportunity_id,
    'audit_id', v_audit_id,
    'application', COALESCE(v_create_result -> 'application', 'null'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.convert_opportunity_to_policy_application(uuid, jsonb) IS
  'Authenticated conversion of an eligible Opportunity into exactly one draft policy application. Household is taken from the locked Opportunity. Reuses create_policy_application in the same transaction so participants and writing allocations are atomic. Idempotent: a live linked application returns created=false. Does not submit, catch-up, auto-Won, write commissions, or accept historical-import flags. Optional Life Application Started movement is best-effort and never moves backward.';

REVOKE ALL ON FUNCTION public.convert_opportunity_to_policy_application(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_opportunity_to_policy_application(uuid, jsonb)
  TO authenticated;
