-- REVIEW PROPOSAL ONLY. Not an automatic migration. Do not run on hosted projects
-- without separate authorization, an ACL backup, and an environment review.
-- Scope: postgres-owned public base tables, two internal trigger helpers, and
-- postgres's schema-local future table defaults. Managed-role defaults deferred.
BEGIN;

DO $hardening$
DECLARE target record; role_name text; function_id oid; column_list text;
BEGIN
  IF current_setting('server_version_num')::integer < 170000 THEN
    RAISE EXCEPTION 'hardening_requires_postgres_17_or_newer';
  END IF;
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'hardening_requires_postgres_review_session';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      RAISE EXCEPTION 'hardening_expected_roles_missing';
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated')
    AND pg_has_role(r.oid,'pg_maintain'::regrole,'USAGE')) THEN
    RAISE EXCEPTION 'hardening_maintenance_role_review_required';
  END IF;

  -- Schema-local default revocation cannot override a global or inherited grant.
  -- Abort rather than claim future-object safety when that separate review exists.
  IF EXISTS (
    SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole=(SELECT oid FROM pg_roles WHERE rolname='postgres')
      AND d.defaclobjtype='r'
      AND (d.defaclnamespace=0 OR (
        d.defaclnamespace='public'::regnamespace
        AND a.grantee<>0
        AND a.grantee NOT IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon','authenticated'))
      ))
      AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')
      AND CASE WHEN a.grantee=0 THEN true ELSE EXISTS (
        SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated')
          AND pg_has_role(r.oid,a.grantee,'USAGE')
      ) END
  ) THEN RAISE EXCEPTION 'hardening_global_or_inherited_default_review_required'; END IF;

  FOR target IN
    SELECT c.oid,c.relname,c.relowner FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
  LOOP
    IF target.relowner <> (SELECT oid FROM pg_roles WHERE rolname='postgres') THEN
      RAISE EXCEPTION 'hardening_unexpected_table_owner';
    END IF;
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.%I FROM PUBLIC, anon, authenticated RESTRICT',target.relname);
    -- Column-level REFERENCES survives a table-level REVOKE. Preserve column DML.
    SELECT string_agg(format('%I',a.attname),', ' ORDER BY a.attnum)
      INTO column_list FROM pg_attribute a
      WHERE a.attrelid=target.oid AND a.attnum>0 AND NOT a.attisdropped;
    IF column_list IS NOT NULL THEN
      EXECUTE format('REVOKE REFERENCES (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated RESTRICT',column_list,target.relname);
    END IF;
  END LOOP;

  FOREACH role_name IN ARRAY ARRAY['handle_new_auth_user','rls_auto_enable'] LOOP
    function_id := to_regprocedure(format('public.%I()',role_name));
    IF function_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=function_id
          AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres')
          AND prorettype IN ('trigger'::regtype,'event_trigger'::regtype)) THEN
        RAISE EXCEPTION 'hardening_unexpected_helper_shape';
      END IF;
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I() FROM PUBLIC, anon, authenticated RESTRICT',role_name);
      IF has_function_privilege('anon',function_id,'EXECUTE')
        OR has_function_privilege('authenticated',function_id,'EXECUTE') THEN
        RAISE EXCEPTION 'hardening_inherited_helper_grant_review_required';
      END IF;
    END IF;
  END LOOP;

  -- Verify effective access, including grants inherited through other roles.
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN (VALUES ('anon'),('authenticated')) r(role_name)
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND (has_table_privilege(r.role_name,c.oid,'TRUNCATE')
        OR has_any_column_privilege(r.role_name,c.oid,'REFERENCES')
        OR has_table_privilege(r.role_name,c.oid,'TRIGGER')
        OR has_table_privilege(r.role_name,c.oid,'MAINTAIN'))
  ) THEN RAISE EXCEPTION 'hardening_inherited_table_grant_review_required'; END IF;
END
$hardening$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM PUBLIC, anon, authenticated;

COMMIT;
