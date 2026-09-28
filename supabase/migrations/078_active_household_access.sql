-- A retained advisor_profiles row must not grant access to an inactive login.
-- Preserve owner access, household assignment, and existing execution grants.
CREATE OR REPLACE FUNCTION public.crm_can_access_household(p_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT
    public.crm_is_owner()
    OR (
      public.crm_is_advisor()
      AND EXISTS (
        SELECT 1
        FROM public.households h
        WHERE h.id = p_household_id
          AND h.deleted_at IS NULL
          AND h.merged_into_household_id IS NULL
          AND h.assigned_advisor_id IS NOT NULL
          AND h.assigned_advisor_id = public.crm_advisor_id()
      )
    );
$$;
COMMENT ON FUNCTION public.crm_can_access_household(uuid) IS
  'Active owner or active assigned advisor login with an active advisor profile. Original attribution alone does not grant access.';
