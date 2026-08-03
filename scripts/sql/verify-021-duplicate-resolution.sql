-- SQL smoke checks for migration 021 (run after `npx supabase db reset`).
-- Not an applied migration — keep outside supabase/migrations.

-- RPC exists
SELECT proname
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname = 'resolve_public_family_duplicate_review';

-- Self-merge constraint exists
SELECT conname
FROM pg_constraint
WHERE conname = 'households_merged_into_not_self';

-- Execute privileges: authenticated yes; anon/public no
SELECT
  has_function_privilege('anon', 'public.resolve_public_family_duplicate_review(uuid, text, text)', 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', 'public.resolve_public_family_duplicate_review(uuid, text, text)', 'EXECUTE') AS authenticated_execute;

-- Expected: anon_execute = false, authenticated_execute = true
-- Owner authorization is enforced inside the function via crm_is_owner().
