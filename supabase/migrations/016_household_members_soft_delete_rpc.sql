-- 016_household_members_soft_delete_rpc.sql
-- CRM-6: restore DB-level invisibility of soft-deleted household members, and
-- provide a narrowly scoped SECURITY DEFINER RPC for authenticated soft-delete.
--
-- Why SECURITY DEFINER is required:
--   Direct UPDATE … SET deleted_at fails when SELECT requires deleted_at IS NULL,
--   because PostgreSQL also checks SELECT policies against the NEW row on UPDATE.
--   Weakening SELECT to allow soft-delete is rejected for production security.
--   postgres-owned SECURITY DEFINER functions bypass RLS (postgres has BYPASSRLS),
--   matching assign_household / convert_recommendation_to_opportunity conventions.
--   Authorization is enforced inside the function via crm_is_owner /
--   crm_can_access_household on the member's actual household_id.
--
-- Repository cleanup note:
--   Earlier local files 016_household_members_soft_delete_rls.sql and
--   017_household_members_select_soft_delete_rls.sql were applied ad-hoc on
--   valtoris-crm-dev (weakening SELECT) but were NEVER recorded in
--   supabase_migrations.schema_migrations. Those files are replaced by this
--   migration (016) so remote history and repository stay aligned from 015→016.

-- ---------------------------------------------------------------------------
-- Restore secure SELECT (deleted rows invisible to authenticated clients)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS household_members_select ON public.household_members;

CREATE POLICY household_members_select ON public.household_members
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.crm_can_access_household(household_id)
  );

COMMENT ON POLICY household_members_select ON public.household_members IS
  'Active members only. Soft-deleted rows are invisible to authenticated clients. Access via crm_can_access_household (includes owners). Soft-delete via soft_delete_household_member RPC.';

-- ---------------------------------------------------------------------------
-- Narrow soft-delete RPC (no arbitrary field updates; no caller household_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_household_member(p_member_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_member public.household_members;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_member_id IS NULL THEN
    RAISE EXCEPTION 'cannot soft-delete household member';
  END IF;

  SELECT *
  INTO v_member
  FROM public.household_members
  WHERE id = p_member_id
  FOR UPDATE;

  -- Uniform controlled result: missing, already deleted, or unauthorized.
  -- Do not leak whether the id exists, is deleted, or belongs to another household.
  IF NOT FOUND
     OR v_member.deleted_at IS NOT NULL
     OR NOT (
       public.crm_is_owner()
       OR public.crm_can_access_household(v_member.household_id)
     ) THEN
    RAISE EXCEPTION 'cannot soft-delete household member';
  END IF;

  UPDATE public.household_members
  SET deleted_at = now()
  WHERE id = v_member.id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cannot soft-delete household member';
  END IF;

  RETURN v_member.id;
END;
$$;

COMMENT ON FUNCTION public.soft_delete_household_member(uuid) IS
  'Authenticated soft-delete for an accessible household member. Sets deleted_at only. Authorization uses crm_is_owner/crm_can_access_household on the member row household_id. Does not accept caller-supplied household_id. Owner hard DELETE policy remains separate.';

REVOKE ALL ON FUNCTION public.soft_delete_household_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete_household_member(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.soft_delete_household_member(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_household_member(uuid) TO authenticated;
