-- 012_secure_rpcs.sql
-- Column-guard triggers + secure SECURITY DEFINER RPCs.
-- Protected mutations require transaction-local crm.rpc_context set inside approved RPCs.
-- Never embed service-role keys in SQL.

-- ---------------------------------------------------------------------------
-- RPC context helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_rpc_context()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT nullif(current_setting('crm.rpc_context', true), '');
$$;

CREATE OR REPLACE FUNCTION public.crm_require_rpc_context(p_expected text)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
BEGIN
  IF public.crm_rpc_context() IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'protected column change requires rpc context % (got %)',
      p_expected, coalesce(public.crm_rpc_context(), '<none>');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_rpc_context() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_require_rpc_context(text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profile self-update guard (advisors: only full_name, phone, avatar_url)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_profile_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Owners may change any profile fields (including role promotion).
  IF public.crm_is_owner() THEN
    RETURN NEW;
  END IF;

  -- Advisors updating self: block privileged columns.
  IF TG_OP = 'UPDATE' AND NEW.id = auth.uid() THEN
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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_columns ON public.profiles;
CREATE TRIGGER profiles_protect_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_protected_columns();

REVOKE ALL ON FUNCTION public.enforce_profile_protected_columns() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Advisor profile guard: lock user_id, slug, is_active, accepts_new_leads for self-service
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_advisor_profile_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF public.crm_is_owner() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.user_id = auth.uid() THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'advisor_profiles.user_id is immutable for advisors';
    END IF;
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
      RAISE EXCEPTION 'advisor_profiles.slug cannot be changed by advisors';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'advisor_profiles.is_active cannot be changed by advisors';
    END IF;
    IF NEW.accepts_new_leads IS DISTINCT FROM OLD.accepts_new_leads THEN
      RAISE EXCEPTION 'advisor_profiles.accepts_new_leads cannot be changed by advisors';
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'advisor_profiles.deleted_at cannot be changed by advisors';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS advisor_profiles_protect_columns ON public.advisor_profiles;
CREATE TRIGGER advisor_profiles_protect_columns
  BEFORE UPDATE ON public.advisor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_advisor_profile_protected_columns();

REVOKE ALL ON FUNCTION public.enforce_advisor_profile_protected_columns() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Household protected columns (H1/H2)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_household_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_ctx text := public.crm_rpc_context();
BEGIN
  -- Assignment block → assign_household only
  IF NEW.assigned_advisor_id IS DISTINCT FROM OLD.assigned_advisor_id
     OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at
     OR NEW.assigned_by_user_id IS DISTINCT FROM OLD.assigned_by_user_id
     OR NEW.assignment_reason IS DISTINCT FROM OLD.assignment_reason THEN
    IF v_ctx IS DISTINCT FROM 'assign_household' THEN
      RAISE EXCEPTION 'household assignment fields require assign_household RPC';
    END IF;
  END IF;

  -- Stage + synchronized household.status → move_household_stage only
  -- (future admin RPC may use context admin_set_household_status)
  IF NEW.relationship_pipeline_id IS DISTINCT FROM OLD.relationship_pipeline_id
     OR NEW.relationship_stage_id IS DISTINCT FROM OLD.relationship_stage_id
     OR NEW.stage_entered_at IS DISTINCT FROM OLD.stage_entered_at THEN
    IF v_ctx IS DISTINCT FROM 'move_household_stage' THEN
      RAISE EXCEPTION 'household stage fields require move_household_stage RPC';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF v_ctx IS DISTINCT FROM 'move_household_stage'
       AND v_ctx IS DISTINCT FROM 'admin_set_household_status' THEN
      RAISE EXCEPTION 'households.status requires move_household_stage (or approved admin) RPC';
    END IF;
  END IF;

  -- Original attribution UPDATEs require set_attribution context (INSERT may set freely).
  -- Immutability trigger still blocks changes once non-null values exist.
  IF NEW.original_advisor_id IS DISTINCT FROM OLD.original_advisor_id
     OR NEW.original_advisor_slug IS DISTINCT FROM OLD.original_advisor_slug
     OR NEW.original_referral_source_id IS DISTINCT FROM OLD.original_referral_source_id
     OR NEW.original_campaign IS DISTINCT FROM OLD.original_campaign
     OR NEW.original_source_metadata IS DISTINCT FROM OLD.original_source_metadata THEN
    IF v_ctx IS DISTINCT FROM 'set_attribution' THEN
      RAISE EXCEPTION 'original attribution fields require set_attribution RPC context';
    END IF;
  END IF;

  -- Duplicate / merge fields: owner-only; never advisors
  IF NEW.potential_duplicate_of IS DISTINCT FROM OLD.potential_duplicate_of
     OR NEW.duplicate_review_status IS DISTINCT FROM OLD.duplicate_review_status
     OR NEW.merged_into_household_id IS DISTINCT FROM OLD.merged_into_household_id THEN
    IF NOT public.crm_is_owner() THEN
      RAISE EXCEPTION 'duplicate/merge fields are owner-only';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS households_protect_columns ON public.households;
CREATE TRIGGER households_protect_columns
  BEFORE UPDATE ON public.households
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_household_protected_columns();

REVOKE ALL ON FUNCTION public.enforce_household_protected_columns() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.enforce_household_protected_columns() IS
  'Blocks silent mutation of assignment/stage/status/attribution/duplicate columns unless crm.rpc_context matches.';

-- ---------------------------------------------------------------------------
-- Opportunity protected columns (H3)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_opportunity_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_ctx text := public.crm_rpc_context();
BEGIN
  IF NEW.household_id IS DISTINCT FROM OLD.household_id
     OR NEW.service_vertical_id IS DISTINCT FROM OLD.service_vertical_id
     OR NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id THEN
    RAISE EXCEPTION 'opportunity household/vertical/pipeline cannot be changed after create';
  END IF;

  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id
     OR NEW.stage_entered_at IS DISTINCT FROM OLD.stage_entered_at
     OR NEW.closed_at IS DISTINCT FROM OLD.closed_at
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    -- status/closed_at may change with stage move RPC
    IF v_ctx IS DISTINCT FROM 'move_opportunity_stage' THEN
      -- Allow status-only safe? No — force RPC for stage/status/closed_at
      IF NEW.stage_id IS DISTINCT FROM OLD.stage_id
         OR NEW.stage_entered_at IS DISTINCT FROM OLD.stage_entered_at
         OR NEW.closed_at IS DISTINCT FROM OLD.closed_at
         OR NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'opportunity stage/status/closed_at require move_opportunity_stage RPC';
      END IF;
    END IF;
  END IF;

  IF NEW.assigned_advisor_id IS DISTINCT FROM OLD.assigned_advisor_id
     OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at
     OR NEW.assigned_by_user_id IS DISTINCT FROM OLD.assigned_by_user_id
     OR NEW.assignment_reason IS DISTINCT FROM OLD.assignment_reason THEN
    -- Conversion RPC may set assignment on INSERT only; UPDATE assignment requires owner context
    IF v_ctx IS DISTINCT FROM 'assign_opportunity' AND v_ctx IS DISTINCT FROM 'convert_recommendation_to_opportunity' THEN
      RAISE EXCEPTION 'opportunity assignment fields require assign_opportunity or convert_recommendation_to_opportunity RPC';
    END IF;
    IF v_ctx = 'assign_opportunity' AND NOT public.crm_is_owner() THEN
      RAISE EXCEPTION 'opportunity reassignment is owner-only';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS opportunities_protect_columns ON public.opportunities;
CREATE TRIGGER opportunities_protect_columns
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_opportunity_protected_columns();

REVOKE ALL ON FUNCTION public.enforce_opportunity_protected_columns() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Recommendation conversion guard (H4)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_recommendation_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_ctx text := public.crm_rpc_context();
BEGIN
  IF NEW.converted_opportunity_id IS DISTINCT FROM OLD.converted_opportunity_id
     OR (NEW.status = 'converted' AND OLD.status IS DISTINCT FROM 'converted') THEN
    IF v_ctx IS DISTINCT FROM 'convert_recommendation_to_opportunity' THEN
      RAISE EXCEPTION 'recommendation conversion requires convert_recommendation_to_opportunity RPC';
    END IF;
  END IF;

  -- Advisors may set under_review / accepted / deferred / dismissed / new — not converted without RPC
  IF public.crm_is_advisor() AND NOT public.crm_is_owner() THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN (
         'new'::public.recommendation_status,
         'under_review'::public.recommendation_status,
         'accepted'::public.recommendation_status,
         'deferred'::public.recommendation_status,
         'dismissed'::public.recommendation_status
       )
       AND v_ctx IS DISTINCT FROM 'convert_recommendation_to_opportunity' THEN
      RAISE EXCEPTION 'advisors cannot set recommendation status %', NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recommendations_protect_columns ON public.recommendations;
CREATE TRIGGER recommendations_protect_columns
  BEFORE UPDATE ON public.recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_recommendation_protected_columns();

REVOKE ALL ON FUNCTION public.enforce_recommendation_protected_columns() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Task household/opportunity integrity (C2)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_task_access_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.household_id IS DISTINCT FROM OLD.household_id THEN
      IF NOT (
        public.crm_is_owner()
        OR (
          public.crm_can_access_household(OLD.household_id)
          AND public.crm_can_access_household(NEW.household_id)
        )
      ) THEN
        RAISE EXCEPTION 'cannot move task to a household outside your access';
      END IF;
    END IF;

    IF NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id AND NEW.opportunity_id IS NOT NULL THEN
      IF NOT public.crm_can_access_opportunity(NEW.opportunity_id) THEN
        RAISE EXCEPTION 'cannot link task to an inaccessible opportunity';
      END IF;
      -- Opportunity must belong to the task household
      IF NOT EXISTS (
        SELECT 1 FROM public.opportunities o
        WHERE o.id = NEW.opportunity_id
          AND o.household_id = NEW.household_id
          AND o.deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'task opportunity must belong to the task household';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.opportunity_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = NEW.opportunity_id
        AND o.household_id = NEW.household_id
        AND o.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'task opportunity must belong to the task household';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_access_integrity ON public.tasks;
CREATE TRIGGER tasks_access_integrity
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_task_access_integrity();

REVOKE ALL ON FUNCTION public.enforce_task_access_integrity() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lead assignment fields: follow household assign_household RPC context
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_lead_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_ctx text := public.crm_rpc_context();
BEGIN
  IF NEW.assigned_advisor_id IS DISTINCT FROM OLD.assigned_advisor_id
     OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at
     OR NEW.assigned_by_user_id IS DISTINCT FROM OLD.assigned_by_user_id
     OR NEW.assignment_reason IS DISTINCT FROM OLD.assignment_reason THEN
    IF v_ctx IS DISTINCT FROM 'assign_household' THEN
      RAISE EXCEPTION 'lead assignment fields require assign_household RPC';
    END IF;
  END IF;

  IF NEW.original_advisor_id IS DISTINCT FROM OLD.original_advisor_id
     OR NEW.original_advisor_slug IS DISTINCT FROM OLD.original_advisor_slug
     OR NEW.original_referral_source_id IS DISTINCT FROM OLD.original_referral_source_id
     OR NEW.original_campaign IS DISTINCT FROM OLD.original_campaign
     OR NEW.original_source_metadata IS DISTINCT FROM OLD.original_source_metadata THEN
    IF v_ctx IS DISTINCT FROM 'set_attribution' THEN
      RAISE EXCEPTION 'lead original attribution fields require set_attribution RPC context';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_protect_columns ON public.leads;
CREATE TRIGGER leads_protect_columns
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lead_protected_columns();

REVOKE ALL ON FUNCTION public.enforce_lead_protected_columns() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers for audit + activity (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_write_audit(
  p_action text,
  p_entity_table text,
  p_entity_id uuid,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.audit_logs (actor_user_id, action, entity_table, entity_id, before, after)
  VALUES (auth.uid(), p_action, p_entity_table, p_entity_id, p_before, p_after)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_write_activity(
  p_household_id uuid,
  p_activity_type public.activity_type,
  p_title text,
  p_body text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_opportunity_id uuid DEFAULT NULL,
  p_recommendation_id uuid DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL,
  p_assessment_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.activities (
    household_id,
    opportunity_id,
    lead_id,
    assessment_id,
    recommendation_id,
    actor_user_id,
    activity_type,
    title,
    body,
    metadata
  )
  VALUES (
    p_household_id,
    p_opportunity_id,
    p_lead_id,
    p_assessment_id,
    p_recommendation_id,
    auth.uid(),
    p_activity_type,
    p_title,
    p_body,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_write_audit(text, text, uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_write_activity(uuid, public.activity_type, text, text, jsonb, uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_write_audit(text, text, uuid, jsonb, jsonb) FROM authenticated, anon;
REVOKE ALL ON FUNCTION public.crm_write_activity(uuid, public.activity_type, text, text, jsonb, uuid, uuid, uuid, uuid) FROM authenticated, anon;

-- ---------------------------------------------------------------------------
-- assign_household (owner-only V1)
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

  PERFORM set_config('crm.rpc_context', 'assign_household', true);

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

  RETURN v_after;
END;
$$;

COMMENT ON FUNCTION public.assign_household(uuid, uuid, public.assignment_reason, text) IS
  'Owner-only household assignment. Sets crm.rpc_context=assign_household. Never overwrites original_*.';

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

  -- 1) Destination stage must belong to this household's relationship pipeline
  SELECT * INTO v_stage
  FROM public.pipeline_stages
  WHERE id = p_stage_id
    AND pipeline_id = v_before.relationship_pipeline_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'stage not on household relationship pipeline';
  END IF;

  -- 2) Map stable stage code → household_status (never use display names)
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

  -- 3) Approved RPC context for protected columns (stage + status)
  PERFORM set_config('crm.rpc_context', 'move_household_stage', true);

  -- 4) Atomic update of stage + synchronized status
  UPDATE public.households
  SET
    relationship_stage_id = p_stage_id,
    stage_entered_at = now(),
    status = v_new_status,
    updated_at = now()
  WHERE id = p_household_id
  RETURNING * INTO v_after;

  -- 5) Activity
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

  -- 6) Audit
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

  RETURN v_after;
END;
$$;

COMMENT ON FUNCTION public.move_household_stage(uuid, uuid) IS
  'Moves relationship stage and synchronizes households.status from stable stage codes. Audited.';

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

  PERFORM set_config('crm.rpc_context', 'move_opportunity_stage', true);

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

  RETURN v_after;
END;
$$;

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

  PERFORM set_config('crm.rpc_context', 'convert_recommendation_to_opportunity', true);

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

  RETURN v_opp;
END;
$$;

COMMENT ON FUNCTION public.convert_recommendation_to_opportunity(uuid, text, uuid) IS
  'Explicit recommendation → opportunity. Sets crm.rpc_context. Requires advisor profile for non-owners.';

-- Grants: only approved RPCs for authenticated
REVOKE ALL ON FUNCTION public.assign_household(uuid, uuid, public.assignment_reason, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.move_household_stage(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.move_opportunity_stage(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convert_recommendation_to_opportunity(uuid, text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.assign_household(uuid, uuid, public.assignment_reason, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_household_stage(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_opportunity_stage(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_recommendation_to_opportunity(uuid, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.assign_household(uuid, uuid, public.assignment_reason, text) FROM anon;
REVOKE ALL ON FUNCTION public.move_household_stage(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.move_opportunity_stage(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.convert_recommendation_to_opportunity(uuid, text, uuid) FROM anon;
