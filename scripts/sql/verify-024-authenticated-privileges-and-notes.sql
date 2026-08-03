-- Verify migration 024 privileges + notes fix (NOT a migration).
-- Run after: npx supabase db reset
-- Optional: seed scripts/sql/qa-sprint-4a3/seed-crm-scenarios.sql + local Auth users
-- for JWT/PostgREST checks (see scripts/qa for interactive/API verification).

\pset pager off

\echo '=== 024 table privileges (authenticated) ==='
SELECT tablename,
  has_table_privilege('authenticated', format('public.%I', tablename), 'SELECT') AS sel,
  has_table_privilege('authenticated', format('public.%I', tablename), 'INSERT') AS ins,
  has_table_privilege('authenticated', format('public.%I', tablename), 'UPDATE') AS upd,
  has_table_privilege('authenticated', format('public.%I', tablename), 'DELETE') AS del
FROM unnest(ARRAY[
  'profiles','advisor_profiles','app_settings','audit_logs','service_verticals',
  'pipelines','pipeline_stages','referral_sources','households','household_members',
  'leads','assessments','recommendations','opportunities','advisor_assignments',
  'tasks','notes','activities','policies','appointments','annual_reviews',
  'documents','duplicate_reviews','client_portal_accounts'
]) AS tablename
ORDER BY 1;

\echo '=== anon CRM SELECT must be false ==='
SELECT tablename,
  has_table_privilege('anon', format('public.%I', tablename), 'SELECT') AS sel,
  has_table_privilege('anon', format('public.%I', tablename), 'INSERT') AS ins
FROM unnest(ARRAY[
  'households','leads','assessments','tasks','duplicate_reviews','notes','activities'
]) AS tablename
ORDER BY 1;

\echo '=== service_role SELECT sample ==='
SELECT has_table_privilege('service_role', 'public.households', 'SELECT') AS sr_hh_sel,
       has_table_privilege('service_role', 'public.leads', 'SELECT') AS sr_leads_sel,
       has_table_privilege('service_role', 'public.tasks', 'SELECT') AS sr_tasks_sel;

\echo '=== notes fix: no chr(0) executable path ==='
SELECT prosrc NOT LIKE '%replace(v_notes, chr(0)%'
       AND prosrc LIKE '%char_length(v_notes) > 2000%'
       AND prosrc LIKE '%Do NOT use chr(0)%'
       AND prosrc LIKE '%NULLIF(btrim(COALESCE(p_resolution_notes%'
       AS notes_fix_present
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'resolve_public_family_duplicate_review';

\echo '=== SECURITY DEFINER + search_path ==='
SELECT p.proname,
       p.prosecdef AS security_definer,
       p.proconfig AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'resolve_public_family_duplicate_review';

\echo '=== function EXECUTE grants ==='
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'resolve_public_family_duplicate_review'
ORDER BY grantee, privilege_type;

\echo '=== RLS enabled / forced sample ==='
SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('households','leads','assessments','tasks','duplicate_reviews','notes')
ORDER BY 1;

\echo '=== soft-delete tables: authenticated DELETE should be false ==='
SELECT
  has_table_privilege('authenticated', 'public.notes', 'DELETE') AS notes_del,
  has_table_privilege('authenticated', 'public.household_members', 'DELETE') AS members_del;
