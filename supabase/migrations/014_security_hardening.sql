-- 014_security_hardening.sql
-- Forward-only hardening for the already-applied 001–013 schema on valtoris-crm-dev.
-- 1) Clear crm.rpc_context at the end of each secure RPC (transaction-local).
-- 2) Strengthen enforce_profile_protected_columns for all non-owner callers.
-- Never embed credentials. Do not re-run 001–013.

-- ---------------------------------------------------------------------------
-- Helper: clear RPC context
-- Why: set_config(..., true) is transaction-local. Without clearing, later
-- statements in the same multi-statement transaction would inherit the
-- elevated context and could bypass column guards. Clients must never be
-- responsible for clearing. Exceptions still abort the whole transaction
-- (no partial clear on failure — rollback restores prior state).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_clear_rpc_context()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Empty string → crm_rpc_context() returns NULL via nullif(..., '').
  PERFORM set_config('crm.rpc_context', '', true);
END;
$$;

REVOKE ALL ON FUNCTION public.crm_clear_rpc_context() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.crm_clear_rpc_context() IS
  'Clears transaction-local crm.rpc_context after approved RPC writes so later statements in the same transaction cannot inherit guard bypass.';

-- ---------------------------------------------------------------------------
-- Profile protection: non-owners cannot change protected fields on ANY row;
-- non-owners may only update their own full_name / phone / avatar_url.
-- Owners retain admin ability. auth.uid() IS NULL (service-role / admin SQL)
-- remains operational by design — RLS still binds authenticated clients.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_profile_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Auth identity linkage is immutable for everyone (including owners).
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'profiles.id (auth identity linkage) is immutable';
  END IF;

  -- Owners may change administrative fields on any profile.
  IF public.crm_is_owner() THEN
    RETURN NEW;
  END IF;

  -- Privileged DB sessions without a JWT (service role / SQL Editor as
  -- postgres) remain operational. Authenticated clients always have auth.uid().
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Non-owner authenticated callers may only touch their own row.
  IF NEW.id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'non-owners may only update their own profile';
  END IF;

  -- V1 self-service is advisor-only. Reserved roles (manager, operations,
  -- client) remain default-deny even if an RLS policy is later broadened.
  IF NOT public.crm_is_advisor() THEN
    RAISE EXCEPTION 'only advisors may self-update profile fields';
  END IF;

  -- Protected fields: blocked on any row for non-owners (defense in depth
  -- even if an RLS policy is later broadened).
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'profiles.role cannot be changed by non-owners';
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'profiles.is_active cannot be changed by non-owners';
  END IF;
  IF NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
    RAISE EXCEPTION 'profiles.manager_id cannot be changed by non-owners';
  END IF;
  IF NEW.settings IS DISTINCT FROM OLD.settings THEN
    RAISE EXCEPTION 'profiles.settings cannot be changed by non-owners';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'profiles.email cannot be changed by non-owners';
  END IF;
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'profiles.deleted_at cannot be changed by non-owners';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'profiles.created_at cannot be changed by non-owners';
  END IF;
  IF NEW.last_login_at IS DISTINCT FROM OLD.last_login_at THEN
    RAISE EXCEPTION 'profiles.last_login_at cannot be changed by non-owners';
  END IF;

  -- Permitted self-service fields: full_name, phone, avatar_url.
  -- updated_at may change via set_updated_at trigger.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_profile_protected_columns() IS
  'Non-owners: own row only; may change full_name/phone/avatar_url. Protected: role, is_active, manager_id, settings, email, deleted_at, created_at, last_login_at, id. Owners and auth.uid() IS NULL admin sessions exempt for admin fields.';

-- Trigger already exists from 012; recreate to ensure binding.
DROP TRIGGER IF EXISTS profiles_protect_columns ON public.profiles;
CREATE TRIGGER profiles_protect_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_protected_columns();

REVOKE ALL ON FUNCTION public.enforce_profile_protected_columns() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- assign_household — set context only before protected writes; clear before return
-- (assign_opportunity RPC does not exist yet; context name remains reserved.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_household(
  p_household_id uuid,
  p_advisor_id uuid,
  p_reason public.assignment_reason DEFAULT 'manual',
  p_notes text DEFAULT NULL
)
RETURNS public.households
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_before public.households;
  v_after public.households;
  v_advisor public.advisor_profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT public.crm_is_owner() THEN
    RAISE EXCEPTION 'only owners can assign households in V1';
  END IF;

  SELECT * INTO v_before
  FROM public.households
  WHERE id = p_household_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'household not found';
  END IF;

  SELECT * INTO v_advisor
  FROM public.advisor_profiles
  WHERE id = p_advisor_id
    AND deleted_at IS NULL
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'advisor not found or inactive';
  END IF;

  UPDATE public.advisor_assignments
  SET effective_to = now()
  WHERE household_id = p_household_id
    AND opportunity_id IS NULL
    AND assignment_role = 'primary'
    AND effective_to IS NULL;

  INSERT INTO public.advisor_assignments (
    household_id,
    advisor_id,
    assignment_role,
    reason,
    is_attribution_source,
    assigned_by_user_id,
    effective_from,
    notes
  )
  VALUES (
    p_household_id,
    p_advisor_id,
    'primary',
    p_reason,
    false,
    auth.uid(),
    now(),
    p_notes
  );

  -- Context only for protected household assignment columns.
  PERFORM set_config('crm.rpc_context', 'assign_household', true);

  UPDATE public.households
  SET
    assigned_advisor_id = p_advisor_id,
    assigned_at = now(),
    assigned_by_user_id = auth.uid(),
    assignment_reason = p_reason,
    updated_at = now()
  WHERE id = p_household_id
  RETURNING * INTO v_after;

  UPDATE public.leads
  SET
    assigned_advisor_id = p_advisor_id,
    assigned_at = now(),
    assigned_by_user_id = auth.uid(),
    assignment_reason = p_reason,
    status = CASE WHEN status IN ('unassigned', 'new') THEN 'assigned'::public.lead_status ELSE status END,
    updated_at = now()
  WHERE household_id = p_household_id
    AND deleted_at IS NULL
    AND status NOT IN ('converted', 'closed_lost');

  PERFORM public.crm_write_activity(
    p_household_id,
    'assignment_changed',
    'Household assigned',
    COALESCE(p_notes, 'Advisor assignment updated'),
    jsonb_build_object(
      'from_advisor_id', v_before.assigned_advisor_id,
      'to_advisor_id', p_advisor_id,
      'reason', p_reason
    )
  );

  PERFORM public.crm_write_audit(
    'assignment.changed',
    'households',
    p_household_id,
    to_jsonb(v_before),
    to_jsonb(v_after)
  );

  PERFORM public.crm_clear_rpc_context();
  RETURN v_after;
END;
$$;

COMMENT ON FUNCTION public.assign_household(uuid, uuid, public.assignment_reason, text) IS
  'Owner-only household assignment. Sets crm.rpc_context only around protected writes, then clears it. Never overwrites original_*.';

-- ---------------------------------------------------------------------------
-- move_household_stage
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.move_household_stage(
  p_household_id uuid,
  p_stage_id uuid
)
RETURNS public.households
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_before public.households;
  v_after public.households;
  v_stage public.pipeline_stages;
  v_new_status public.household_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT (public.crm_is_owner() OR public.crm_can_access_household(p_household_id)) THEN
    RAISE EXCEPTION 'not authorized to move this household stage';
  END IF;

  SELECT * INTO v_before
  FROM public.households
  WHERE id = p_household_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'household not found';
  END IF;

  SELECT * INTO v_stage
  FROM public.pipeline_stages
  WHERE id = p_stage_id
    AND pipeline_id = v_before.relationship_pipeline_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'stage not on household relationship pipeline';
  END IF;

  v_new_status := CASE v_stage.code
    WHEN 'new_lead' THEN 'lead'::public.household_status
    WHEN 'attempting_contact' THEN 'lead'::public.household_status
    WHEN 'contacted' THEN 'prospect'::public.household_status
    WHEN 'assessment_completed' THEN 'prospect'::public.household_status
    WHEN 'strategy_session_scheduled' THEN 'prospect'::public.household_status
    WHEN 'strategy_session_completed' THEN 'prospect'::public.household_status
    WHEN 'active_prospect' THEN 'prospect'::public.household_status
    WHEN 'client' THEN 'client'::public.household_status
    WHEN 'annual_review' THEN 'client'::public.household_status
    WHEN 'inactive' THEN 'inactive'::public.household_status
    WHEN 'lost' THEN 'lost'::public.household_status
    ELSE NULL
  END;

  IF v_new_status IS NULL THEN
    RAISE EXCEPTION 'unmapped relationship stage code: %', v_stage.code;
  END IF;

  PERFORM set_config('crm.rpc_context', 'move_household_stage', true);

  UPDATE public.households
  SET
    relationship_stage_id = p_stage_id,
    stage_entered_at = now(),
    status = v_new_status,
    updated_at = now()
  WHERE id = p_household_id
  RETURNING * INTO v_after;

  PERFORM public.crm_write_activity(
    p_household_id,
    'stage_changed',
    'Relationship stage updated',
    v_stage.name,
    jsonb_build_object(
      'from_stage_id', v_before.relationship_stage_id,
      'to_stage_id', p_stage_id,
      'pipeline_id', v_before.relationship_pipeline_id,
      'stage_code', v_stage.code,
      'from_status', v_before.status,
      'to_status', v_new_status
    )
  );

  PERFORM public.crm_write_audit(
    'stage.changed',
    'households',
    p_household_id,
    jsonb_build_object(
      'relationship_stage_id', v_before.relationship_stage_id,
      'status', v_before.status
    ),
    jsonb_build_object(
      'relationship_stage_id', p_stage_id,
      'status', v_new_status,
      'stage_code', v_stage.code
    )
  );

  PERFORM public.crm_clear_rpc_context();
  RETURN v_after;
END;
$$;

COMMENT ON FUNCTION public.move_household_stage(uuid, uuid) IS
  'Moves relationship stage and synchronizes households.status. Sets/clears crm.rpc_context around protected writes. Audited.';

-- ---------------------------------------------------------------------------
-- move_opportunity_stage
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.move_opportunity_stage(
  p_opportunity_id uuid,
  p_stage_id uuid
)
RETURNS public.opportunities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_before public.opportunities;
  v_after public.opportunities;
  v_stage public.pipeline_stages;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT public.crm_can_access_opportunity(p_opportunity_id) THEN
    RAISE EXCEPTION 'not authorized to move this opportunity stage';
  END IF;

  SELECT * INTO v_before
  FROM public.opportunities
  WHERE id = p_opportunity_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'opportunity not found';
  END IF;

  SELECT * INTO v_stage
  FROM public.pipeline_stages
  WHERE id = p_stage_id
    AND pipeline_id = v_before.pipeline_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'stage not on opportunity pipeline';
  END IF;

  PERFORM set_config('crm.rpc_context', 'move_opportunity_stage', true);

  UPDATE public.opportunities
  SET
    stage_id = p_stage_id,
    stage_entered_at = now(),
    status = CASE
      WHEN v_stage.is_won THEN 'won'::public.opportunity_status
      WHEN v_stage.is_lost THEN 'lost'::public.opportunity_status
      ELSE 'open'::public.opportunity_status
    END,
    closed_at = CASE
      WHEN v_stage.is_won OR v_stage.is_lost OR v_stage.is_terminal THEN now()
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = p_opportunity_id
  RETURNING * INTO v_after;

  PERFORM public.crm_write_activity(
    v_before.household_id,
    'stage_changed',
    'Opportunity stage updated',
    v_stage.name,
    jsonb_build_object(
      'from_stage_id', v_before.stage_id,
      'to_stage_id', p_stage_id,
      'opportunity_id', p_opportunity_id,
      'pipeline_id', v_before.pipeline_id
    ),
    p_opportunity_id
  );

  PERFORM public.crm_write_audit(
    'stage.changed',
    'opportunities',
    p_opportunity_id,
    jsonb_build_object('stage_id', v_before.stage_id, 'status', v_before.status),
    jsonb_build_object('stage_id', p_stage_id, 'status', v_after.status)
  );

  PERFORM public.crm_clear_rpc_context();
  RETURN v_after;
END;
$$;

COMMENT ON FUNCTION public.move_opportunity_stage(uuid, uuid) IS
  'Moves opportunity stage/status/closed_at. Sets/clears crm.rpc_context around protected writes. Audited.';

-- ---------------------------------------------------------------------------
-- convert_recommendation_to_opportunity
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_recommendation_to_opportunity(
  p_recommendation_id uuid,
  p_title text DEFAULT NULL,
  p_assigned_advisor_id uuid DEFAULT NULL
)
RETURNS public.opportunities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rec public.recommendations;
  v_pipeline public.pipelines;
  v_stage public.pipeline_stages;
  v_opp public.opportunities;
  v_advisor_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_rec
  FROM public.recommendations
  WHERE id = p_recommendation_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'recommendation not found';
  END IF;

  IF NOT (public.crm_is_owner() OR public.crm_can_access_household(v_rec.household_id)) THEN
    RAISE EXCEPTION 'not authorized to convert this recommendation';
  END IF;

  IF NOT public.crm_is_owner() AND public.crm_advisor_id() IS NULL THEN
    RAISE EXCEPTION 'advisor profile required to convert recommendations';
  END IF;

  IF v_rec.status = 'converted' OR v_rec.converted_opportunity_id IS NOT NULL THEN
    RAISE EXCEPTION 'recommendation already converted';
  END IF;

  IF v_rec.status = 'dismissed' THEN
    RAISE EXCEPTION 'cannot convert a dismissed recommendation';
  END IF;

  IF v_rec.service_vertical_id IS NULL THEN
    RAISE EXCEPTION 'recommendation must have a service_vertical_id before conversion';
  END IF;

  SELECT * INTO v_pipeline
  FROM public.pipelines
  WHERE service_vertical_id = v_rec.service_vertical_id
    AND pipeline_type = 'service'
    AND is_default = true
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no default service pipeline for vertical';
  END IF;

  SELECT * INTO v_stage
  FROM public.pipeline_stages
  WHERE pipeline_id = v_pipeline.id
    AND code = 'opportunity_identified'
  ORDER BY sort_order
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO v_stage
    FROM public.pipeline_stages
    WHERE pipeline_id = v_pipeline.id
    ORDER BY sort_order
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pipeline has no stages';
  END IF;

  v_advisor_id := COALESCE(
    p_assigned_advisor_id,
    v_rec.assigned_advisor_id,
    (SELECT assigned_advisor_id FROM public.households WHERE id = v_rec.household_id),
    public.crm_advisor_id()
  );

  IF NOT public.crm_is_owner() THEN
    IF v_advisor_id IS DISTINCT FROM public.crm_advisor_id() THEN
      RAISE EXCEPTION 'advisors may only assign converted opportunities to themselves';
    END IF;
  END IF;

  -- Context covers recommendation conversion columns (and future opportunity
  -- assignment UPDATE path that shares this context name).
  PERFORM set_config('crm.rpc_context', 'convert_recommendation_to_opportunity', true);

  INSERT INTO public.opportunities (
    household_id,
    service_vertical_id,
    pipeline_id,
    stage_id,
    title,
    status,
    need_identified,
    source_assessment_id,
    source_recommendation_id,
    assigned_advisor_id,
    assigned_at,
    assigned_by_user_id,
    assignment_reason,
    stage_entered_at,
    metadata
  )
  VALUES (
    v_rec.household_id,
    v_rec.service_vertical_id,
    v_pipeline.id,
    v_stage.id,
    COALESCE(p_title, v_rec.title),
    'open',
    true,
    v_rec.assessment_id,
    v_rec.id,
    v_advisor_id,
    CASE WHEN v_advisor_id IS NOT NULL THEN now() ELSE NULL END,
    auth.uid(),
    'manual',
    now(),
    jsonb_build_object(
      'converted_from_recommendation_id', v_rec.id,
      'source_rule_code', v_rec.source_rule_code
    )
  )
  RETURNING * INTO v_opp;

  UPDATE public.recommendations
  SET
    status = 'converted',
    converted_opportunity_id = v_opp.id,
    reviewed_by_user_id = COALESCE(reviewed_by_user_id, auth.uid()),
    reviewed_at = COALESCE(reviewed_at, now()),
    updated_at = now()
  WHERE id = v_rec.id;

  PERFORM public.crm_write_activity(
    v_rec.household_id,
    'recommendation_converted',
    'Recommendation converted to opportunity',
    v_opp.title,
    jsonb_build_object(
      'recommendation_id', v_rec.id,
      'opportunity_id', v_opp.id,
      'service_vertical_id', v_rec.service_vertical_id
    ),
    v_opp.id,
    v_rec.id,
    NULL,
    v_rec.assessment_id
  );

  PERFORM public.crm_write_audit(
    'recommendation.converted',
    'recommendations',
    v_rec.id,
    to_jsonb(v_rec),
    jsonb_build_object(
      'status', 'converted',
      'converted_opportunity_id', v_opp.id
    )
  );

  PERFORM public.crm_clear_rpc_context();
  RETURN v_opp;
END;
$$;

COMMENT ON FUNCTION public.convert_recommendation_to_opportunity(uuid, text, uuid) IS
  'Explicit recommendation → opportunity. Sets/clears crm.rpc_context around protected writes. Requires advisor profile for non-owners.';

-- Reaffirm grants (CREATE OR REPLACE preserves privileges, but be explicit)
GRANT EXECUTE ON FUNCTION public.assign_household(uuid, uuid, public.assignment_reason, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_household_stage(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_opportunity_stage(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_recommendation_to_opportunity(uuid, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.assign_household(uuid, uuid, public.assignment_reason, text) FROM anon;
REVOKE ALL ON FUNCTION public.move_household_stage(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.move_opportunity_stage(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.convert_recommendation_to_opportunity(uuid, text, uuid) FROM anon;
