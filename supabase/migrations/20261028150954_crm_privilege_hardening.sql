-- Local release candidate. No DML, policies, memberships or integration gates change.
BEGIN;

-- Trigger calls do not require callers to have direct EXECUTE on trigger functions.
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.sp_history_immutable() SET search_path = pg_catalog, public;

-- Browser roles have no legitimate need to truncate data, create triggers or
-- establish foreign keys. Preserve SELECT/INSERT/UPDATE/DELETE and service_role.
DO $block$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT n.nspname, c.relname FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE %I.%I FROM PUBLIC, anon, authenticated', target.nspname, target.relname);
  END LOOP;
END;
$block$;

COMMIT;
