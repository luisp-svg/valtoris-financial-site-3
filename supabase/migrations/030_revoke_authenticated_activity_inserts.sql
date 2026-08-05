-- 030_revoke_authenticated_activity_inserts.sql
-- Close H3 residual: authenticated clients may no longer write public.activities
-- via PostgREST. Browser Activity publish uses record_crm_activity (Migration 029).
--
-- Does NOT: alter record_crm_activity event allowlist/metadata, revoke SELECT,
-- change opportunities/tasks/Cases, or touch application UI / Vercel functions.
--
-- Writers that continue to work after this migration:
--   - authenticated → record_crm_activity (SECURITY DEFINER INSERT)
--   - SECURITY DEFINER RPCs → crm_write_activity / direct INSERT as definer
--   - service_role → direct table INSERT (Digital Identity server ingest, admin QA)

-- =============================================================================
-- SECTION A — Drop obsolete authenticated INSERT policy (defense in depth)
-- =============================================================================
-- Policy activities_insert (010_rls_policies.sql) allowed authenticated INSERT
-- when owner or crm_can_access_household. With INSERT privilege revoked, the
-- policy is unreachable through remove so the catalog does not imply a live write path.
DROP POLICY IF EXISTS activities_insert ON public.activities;

-- activities_select remains (owner OR household access).

-- =============================================================================
-- SECTION B — Deterministic final Activity table privileges
-- =============================================================================
-- Explicit rewrite so hosted and local environments converge regardless of
-- prior default grants or Migration 024/029 history.

REVOKE ALL ON TABLE public.activities FROM PUBLIC;
REVOKE ALL ON TABLE public.activities FROM anon;
REVOKE ALL ON TABLE public.activities FROM authenticated;

GRANT SELECT ON TABLE public.activities TO authenticated;
GRANT ALL ON TABLE public.activities TO service_role;

-- =============================================================================
-- SECTION C — Reassert record_crm_activity execution grants
-- =============================================================================
REVOKE ALL ON FUNCTION public.record_crm_activity(uuid, text, jsonb, uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_crm_activity(uuid, text, jsonb, uuid, uuid, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.record_crm_activity(uuid, text, jsonb, uuid, uuid, uuid) IS
  'Authenticated browser Activity writer for tasks.manual.created and onboarding.completed only (Migration 029). After Migration 030, authenticated has no direct table INSERT; this RPC is the sole authenticated write path.';

-- =============================================================================
-- End Migration 030
-- =============================================================================
