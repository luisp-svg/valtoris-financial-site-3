-- 010_rls_policies.sql
-- Row-Level Security helpers and policies (security-hardened).
-- V1 active roles: owner, advisor.
-- Reserved roles (manager, operations, client): default deny until future migrations expand.

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER, locked search_path)
-- Authorization must use auth.uid() — never trust client-supplied advisor IDs.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.crm_current_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT p.*
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.deleted_at IS NULL
    AND p.is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.crm_is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.deleted_at IS NULL
      AND p.is_active = true
      AND p.role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.crm_is_advisor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.deleted_at IS NULL
      AND p.is_active = true
      AND p.role = 'advisor'
  );
$$;

CREATE OR REPLACE FUNCTION public.crm_advisor_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT ap.id
  FROM public.advisor_profiles ap
  WHERE ap.user_id = auth.uid()
    AND ap.deleted_at IS NULL
    AND ap.is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.crm_advisors_can_view_unassigned()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(
    (SELECT (value ->> 'enabled')::boolean
     FROM public.app_settings
     WHERE key = 'advisors_can_view_unassigned_pool'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.crm_can_access_household(p_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    public.crm_is_owner()
    OR EXISTS (
      SELECT 1
      FROM public.households h
      WHERE h.id = p_household_id
        AND h.deleted_at IS NULL
        AND h.merged_into_household_id IS NULL
        AND h.assigned_advisor_id IS NOT NULL
        AND h.assigned_advisor_id = public.crm_advisor_id()
    );
$$;

CREATE OR REPLACE FUNCTION public.crm_can_access_opportunity(p_opportunity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    public.crm_is_owner()
    OR EXISTS (
      SELECT 1
      FROM public.opportunities o
      WHERE o.id = p_opportunity_id
        AND o.deleted_at IS NULL
        AND (
          o.assigned_advisor_id = public.crm_advisor_id()
          OR public.crm_can_access_household(o.household_id)
        )
    );
$$;

COMMENT ON FUNCTION public.crm_advisor_id() IS
  'Resolves advisor_profiles.id from auth.uid(). Never accept advisor id from the client for authorization.';
COMMENT ON FUNCTION public.crm_can_access_household(uuid) IS
  'Owner or currently assigned advisor. Original attribution alone does not grant access.';

-- Helpers used by RLS policies: callable by authenticated (needed for policy expressions).
-- Not a privilege escalation path: they only read auth.uid()-scoped data as DEFINER.
REVOKE ALL ON FUNCTION public.crm_current_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_is_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_is_advisor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_advisor_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_advisors_can_view_unassigned() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_can_access_household(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_can_access_opportunity(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.crm_current_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_is_advisor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_advisor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_advisors_can_view_unassigned() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_can_access_household(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_can_access_opportunity(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.crm_current_profile() FROM anon;
REVOKE ALL ON FUNCTION public.crm_is_owner() FROM anon;
REVOKE ALL ON FUNCTION public.crm_is_advisor() FROM anon;
REVOKE ALL ON FUNCTION public.crm_advisor_id() FROM anon;
REVOKE ALL ON FUNCTION public.crm_advisors_can_view_unassigned() FROM anon;
REVOKE ALL ON FUNCTION public.crm_can_access_household(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.crm_can_access_opportunity(uuid) FROM anon;

-- ---------------------------------------------------------------------------
-- Enable + FORCE RLS on all CRM tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duplicate_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annual_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_accounts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.service_verticals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.referral_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.households FORCE ROW LEVEL SECURITY;
ALTER TABLE public.household_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.duplicate_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.assessments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.policies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.appointments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.annual_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_accounts FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (public.crm_is_owner() OR id = auth.uid())
  );

-- Advisors: UPDATE own row only; role/is_active/manager_id/settings/email guarded by trigger in 012.
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() AND deleted_at IS NULL AND public.crm_is_advisor())
  WITH CHECK (id = auth.uid() AND deleted_at IS NULL AND public.crm_is_advisor());

DROP POLICY IF EXISTS profiles_owner_all ON public.profiles;
CREATE POLICY profiles_owner_select ON public.profiles
  FOR SELECT TO authenticated
  USING (public.crm_is_owner());

CREATE POLICY profiles_owner_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_is_owner());

CREATE POLICY profiles_owner_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.crm_is_owner())
  WITH CHECK (public.crm_is_owner());

CREATE POLICY profiles_owner_delete ON public.profiles
  FOR DELETE TO authenticated
  USING (public.crm_is_owner());

-- ---------------------------------------------------------------------------
-- advisor_profiles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS advisor_profiles_select ON public.advisor_profiles;
CREATE POLICY advisor_profiles_select ON public.advisor_profiles
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND is_active = true
    AND (public.crm_is_owner() OR public.crm_is_advisor())
  );

DROP POLICY IF EXISTS advisor_profiles_update_self ON public.advisor_profiles;
CREATE POLICY advisor_profiles_update_self ON public.advisor_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL AND public.crm_is_advisor())
  WITH CHECK (user_id = auth.uid() AND deleted_at IS NULL AND public.crm_is_advisor());

DROP POLICY IF EXISTS advisor_profiles_owner_insert ON public.advisor_profiles;
-- Owner-only INSERT (H5): no self-service advisor_profiles creation
CREATE POLICY advisor_profiles_owner_insert ON public.advisor_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_is_owner());

CREATE POLICY advisor_profiles_owner_update ON public.advisor_profiles
  FOR UPDATE TO authenticated
  USING (public.crm_is_owner())
  WITH CHECK (public.crm_is_owner());

CREATE POLICY advisor_profiles_owner_delete ON public.advisor_profiles
  FOR DELETE TO authenticated
  USING (public.crm_is_owner());

-- ---------------------------------------------------------------------------
-- app_settings
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS app_settings_owner_all ON public.app_settings;
CREATE POLICY app_settings_owner_all ON public.app_settings
  FOR ALL TO authenticated
  USING (public.crm_is_owner())
  WITH CHECK (public.crm_is_owner());

DROP POLICY IF EXISTS app_settings_advisor_select_flags ON public.app_settings;
CREATE POLICY app_settings_advisor_select_flags ON public.app_settings
  FOR SELECT TO authenticated
  USING (
    public.crm_is_advisor()
    AND key IN ('advisors_can_view_unassigned_pool')
  );

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_logs_owner_select ON public.audit_logs;
CREATE POLICY audit_logs_owner_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.crm_is_owner());

-- ---------------------------------------------------------------------------
-- Catalog tables
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS service_verticals_select ON public.service_verticals;
CREATE POLICY service_verticals_select ON public.service_verticals
  FOR SELECT TO authenticated
  USING (public.crm_is_owner() OR (is_active = true AND public.crm_is_advisor()));

DROP POLICY IF EXISTS service_verticals_owner_all ON public.service_verticals;
CREATE POLICY service_verticals_owner_write ON public.service_verticals
  FOR ALL TO authenticated
  USING (public.crm_is_owner())
  WITH CHECK (public.crm_is_owner());

DROP POLICY IF EXISTS pipelines_select ON public.pipelines;
CREATE POLICY pipelines_select ON public.pipelines
  FOR SELECT TO authenticated
  USING (public.crm_is_owner() OR (is_active = true AND public.crm_is_advisor()));

DROP POLICY IF EXISTS pipelines_owner_all ON public.pipelines;
CREATE POLICY pipelines_owner_write ON public.pipelines
  FOR ALL TO authenticated
  USING (public.crm_is_owner())
  WITH CHECK (public.crm_is_owner());

DROP POLICY IF EXISTS pipeline_stages_select ON public.pipeline_stages;
CREATE POLICY pipeline_stages_select ON public.pipeline_stages
  FOR SELECT TO authenticated
  USING (
    public.crm_is_owner()
    OR EXISTS (
      SELECT 1 FROM public.pipelines p
      WHERE p.id = pipeline_id AND p.is_active = true AND public.crm_is_advisor()
    )
  );

DROP POLICY IF EXISTS pipeline_stages_owner_all ON public.pipeline_stages;
CREATE POLICY pipeline_stages_owner_write ON public.pipeline_stages
  FOR ALL TO authenticated
  USING (public.crm_is_owner())
  WITH CHECK (public.crm_is_owner());

DROP POLICY IF EXISTS referral_sources_select ON public.referral_sources;
CREATE POLICY referral_sources_select ON public.referral_sources
  FOR SELECT TO authenticated
  USING (public.crm_is_owner() OR (is_active = true AND public.crm_is_advisor()));

DROP POLICY IF EXISTS referral_sources_owner_all ON public.referral_sources;
CREATE POLICY referral_sources_owner_write ON public.referral_sources
  FOR ALL TO authenticated
  USING (public.crm_is_owner())
  WITH CHECK (public.crm_is_owner());

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS households_select ON public.households;
CREATE POLICY households_select ON public.households
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND merged_into_household_id IS NULL
    AND (
      public.crm_is_owner()
      OR (
        public.crm_is_advisor()
        AND assigned_advisor_id IS NOT NULL
        AND assigned_advisor_id = public.crm_advisor_id()
      )
      OR (
        public.crm_is_advisor()
        AND assigned_advisor_id IS NULL
        AND public.crm_advisors_can_view_unassigned()
      )
    )
  );

DROP POLICY IF EXISTS households_update ON public.households;
CREATE POLICY households_update ON public.households
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.crm_is_owner()
      OR (
        public.crm_is_advisor()
        AND assigned_advisor_id = public.crm_advisor_id()
      )
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND (
      public.crm_is_owner()
      OR (
        public.crm_is_advisor()
        AND assigned_advisor_id = public.crm_advisor_id()
      )
    )
  );

DROP POLICY IF EXISTS households_owner_insert ON public.households;
CREATE POLICY households_owner_insert ON public.households
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_is_owner());

DROP POLICY IF EXISTS households_owner_delete ON public.households;
CREATE POLICY households_owner_delete ON public.households
  FOR DELETE TO authenticated
  USING (public.crm_is_owner());

-- ---------------------------------------------------------------------------
-- household_members
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS household_members_select ON public.household_members;
CREATE POLICY household_members_select ON public.household_members
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.crm_can_access_household(household_id));

DROP POLICY IF EXISTS household_members_write ON public.household_members;
CREATE POLICY household_members_insert ON public.household_members
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_is_owner() OR public.crm_can_access_household(household_id));

CREATE POLICY household_members_update ON public.household_members
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND (public.crm_is_owner() OR public.crm_can_access_household(household_id)))
  WITH CHECK (public.crm_is_owner() OR public.crm_can_access_household(household_id));

CREATE POLICY household_members_owner_delete ON public.household_members
  FOR DELETE TO authenticated
  USING (public.crm_is_owner());

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS leads_select ON public.leads;
CREATE POLICY leads_select ON public.leads
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.crm_is_owner()
      OR public.crm_can_access_household(household_id)
      OR (
        public.crm_is_advisor()
        AND status = 'unassigned'
        AND assigned_advisor_id IS NULL
        AND public.crm_advisors_can_view_unassigned()
      )
    )
  );

DROP POLICY IF EXISTS leads_write ON public.leads;
CREATE POLICY leads_insert ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_is_owner() OR public.crm_can_access_household(household_id));

CREATE POLICY leads_update ON public.leads
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND (public.crm_is_owner() OR public.crm_can_access_household(household_id)))
  WITH CHECK (public.crm_is_owner() OR public.crm_can_access_household(household_id));

CREATE POLICY leads_owner_delete ON public.leads
  FOR DELETE TO authenticated
  USING (public.crm_is_owner());

-- ---------------------------------------------------------------------------
-- assessments
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS assessments_select ON public.assessments;
CREATE POLICY assessments_select ON public.assessments
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (public.crm_can_access_household(household_id) OR public.crm_is_owner()));

DROP POLICY IF EXISTS assessments_write ON public.assessments;
CREATE POLICY assessments_insert ON public.assessments
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_is_owner() OR public.crm_can_access_household(household_id));

CREATE POLICY assessments_update ON public.assessments
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND (public.crm_is_owner() OR public.crm_can_access_household(household_id)))
  WITH CHECK (public.crm_is_owner() OR public.crm_can_access_household(household_id));

CREATE POLICY assessments_owner_delete ON public.assessments
  FOR DELETE TO authenticated
  USING (public.crm_is_owner());

-- ---------------------------------------------------------------------------
-- recommendations
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS recommendations_select ON public.recommendations;
CREATE POLICY recommendations_select ON public.recommendations
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (public.crm_is_owner() OR public.crm_can_access_household(household_id)));

DROP POLICY IF EXISTS recommendations_write ON public.recommendations;
CREATE POLICY recommendations_insert ON public.recommendations
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_is_owner() OR public.crm_can_access_household(household_id));

CREATE POLICY recommendations_update ON public.recommendations
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND (public.crm_is_owner() OR public.crm_can_access_household(household_id)))
  WITH CHECK (public.crm_is_owner() OR public.crm_can_access_household(household_id));

CREATE POLICY recommendations_owner_delete ON public.recommendations
  FOR DELETE TO authenticated
  USING (public.crm_is_owner());

-- ---------------------------------------------------------------------------
-- opportunities
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS opportunities_select ON public.opportunities;
CREATE POLICY opportunities_select ON public.opportunities
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.crm_is_owner()
      OR assigned_advisor_id = public.crm_advisor_id()
      OR public.crm_can_access_household(household_id)
    )
  );

DROP POLICY IF EXISTS opportunities_write ON public.opportunities;
CREATE POLICY opportunities_insert ON public.opportunities
  FOR INSERT TO authenticated
  WITH CHECK (
    public.crm_is_owner()
    OR public.crm_can_access_household(household_id)
  );

CREATE POLICY opportunities_update ON public.opportunities
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.crm_is_owner()
      OR assigned_advisor_id = public.crm_advisor_id()
      OR public.crm_can_access_household(household_id)
    )
  )
  WITH CHECK (
    public.crm_is_owner()
    OR assigned_advisor_id = public.crm_advisor_id()
    OR public.crm_can_access_household(household_id)
  );

CREATE POLICY opportunities_owner_delete ON public.opportunities
  FOR DELETE TO authenticated
  USING (public.crm_is_owner());

-- ---------------------------------------------------------------------------
-- advisor_assignments
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS advisor_assignments_select ON public.advisor_assignments;
CREATE POLICY advisor_assignments_select ON public.advisor_assignments
  FOR SELECT TO authenticated
  USING (
    public.crm_is_owner()
    OR public.crm_can_access_household(household_id)
  );

DROP POLICY IF EXISTS advisor_assignments_owner_write ON public.advisor_assignments;
CREATE POLICY advisor_assignments_owner_write ON public.advisor_assignments
  FOR ALL TO authenticated
  USING (public.crm_is_owner())
  WITH CHECK (public.crm_is_owner());

-- ---------------------------------------------------------------------------
-- tasks (C2): household access required; assignee is never sole access grant
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.crm_is_owner()
      OR public.crm_can_access_household(household_id)
    )
  );

DROP POLICY IF EXISTS tasks_write ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.crm_is_owner()
    OR public.crm_can_access_household(household_id)
  );

CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND (public.crm_is_owner() OR public.crm_can_access_household(household_id))
  )
  WITH CHECK (
    public.crm_is_owner()
    OR public.crm_can_access_household(household_id)
  );

CREATE POLICY tasks_owner_delete ON public.tasks
  FOR DELETE TO authenticated
  USING (public.crm_is_owner());

-- ---------------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS notes_select ON public.notes;
CREATE POLICY notes_select ON public.notes
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (public.crm_is_owner() OR public.crm_can_access_household(household_id)));

DROP POLICY IF EXISTS notes_write ON public.notes;
CREATE POLICY notes_insert ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_is_owner() OR public.crm_can_access_household(household_id));

CREATE POLICY notes_update ON public.notes
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND (public.crm_is_owner() OR public.crm_can_access_household(household_id)))
  WITH CHECK (public.crm_is_owner() OR public.crm_can_access_household(household_id));

CREATE POLICY notes_owner_delete ON public.notes
  FOR DELETE TO authenticated
  USING (public.crm_is_owner());

-- ---------------------------------------------------------------------------
-- activities (append-oriented; soft-delete filter on select)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS activities_select ON public.activities;
CREATE POLICY activities_select ON public.activities
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (public.crm_is_owner() OR public.crm_can_access_household(household_id))
  );

DROP POLICY IF EXISTS activities_insert ON public.activities;
CREATE POLICY activities_insert ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_is_owner() OR public.crm_can_access_household(household_id));

-- ---------------------------------------------------------------------------
-- policies (insurance)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS policies_select ON public.policies;
CREATE POLICY policies_select ON public.policies
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (public.crm_is_owner() OR public.crm_can_access_household(household_id)));

DROP POLICY IF EXISTS policies_write ON public.policies;
CREATE POLICY policies_insert ON public.policies
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_is_owner() OR public.crm_can_access_household(household_id));

CREATE POLICY policies_update ON public.policies
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND (public.crm_is_owner() OR public.crm_can_access_household(household_id)))
  WITH CHECK (public.crm_is_owner() OR public.crm_can_access_household(household_id));

CREATE POLICY policies_owner_delete ON public.policies
  FOR DELETE TO authenticated
  USING (public.crm_is_owner());

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS appointments_select ON public.appointments;
CREATE POLICY appointments_select ON public.appointments
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (public.crm_is_owner() OR public.crm_can_access_household(household_id)));

DROP POLICY IF EXISTS appointments_write ON public.appointments;
CREATE POLICY appointments_insert ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_is_owner() OR public.crm_can_access_household(household_id));

CREATE POLICY appointments_update ON public.appointments
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND (public.crm_is_owner() OR public.crm_can_access_household(household_id)))
  WITH CHECK (public.crm_is_owner() OR public.crm_can_access_household(household_id));

CREATE POLICY appointments_owner_delete ON public.appointments
  FOR DELETE TO authenticated
  USING (public.crm_is_owner());

-- ---------------------------------------------------------------------------
-- annual_reviews
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS annual_reviews_select ON public.annual_reviews;
CREATE POLICY annual_reviews_select ON public.annual_reviews
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (public.crm_is_owner() OR public.crm_can_access_household(household_id)));

DROP POLICY IF EXISTS annual_reviews_write ON public.annual_reviews;
CREATE POLICY annual_reviews_insert ON public.annual_reviews
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_is_owner() OR public.crm_can_access_household(household_id));

CREATE POLICY annual_reviews_update ON public.annual_reviews
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND (public.crm_is_owner() OR public.crm_can_access_household(household_id)))
  WITH CHECK (public.crm_is_owner() OR public.crm_can_access_household(household_id));

CREATE POLICY annual_reviews_owner_delete ON public.annual_reviews
  FOR DELETE TO authenticated
  USING (public.crm_is_owner());

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.crm_is_owner()
      OR (
        public.crm_can_access_household(household_id)
        AND visibility IN ('advisor_only', 'client_visible')
      )
    )
  );

DROP POLICY IF EXISTS documents_write ON public.documents;
CREATE POLICY documents_insert ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.crm_is_owner() OR public.crm_can_access_household(household_id))
    AND (
      public.crm_is_owner()
      OR visibility IN ('advisor_only', 'client_visible')
    )
  );

CREATE POLICY documents_update ON public.documents
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND (public.crm_is_owner() OR public.crm_can_access_household(household_id)))
  WITH CHECK (
    (public.crm_is_owner() OR public.crm_can_access_household(household_id))
    AND (
      public.crm_is_owner()
      OR visibility IN ('advisor_only', 'client_visible')
    )
  );

CREATE POLICY documents_owner_delete ON public.documents
  FOR DELETE TO authenticated
  USING (public.crm_is_owner());

-- ---------------------------------------------------------------------------
-- duplicate_reviews / client_portal_accounts: owner only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS duplicate_reviews_owner_all ON public.duplicate_reviews;
CREATE POLICY duplicate_reviews_owner_all ON public.duplicate_reviews
  FOR ALL TO authenticated
  USING (public.crm_is_owner())
  WITH CHECK (public.crm_is_owner());

DROP POLICY IF EXISTS client_portal_accounts_owner_all ON public.client_portal_accounts;
CREATE POLICY client_portal_accounts_owner_all ON public.client_portal_accounts
  FOR ALL TO authenticated
  USING (public.crm_is_owner())
  WITH CHECK (public.crm_is_owner());

-- Reserved roles: no policies grant CRM access based on manager/operations/client.
