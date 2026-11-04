-- Read-only catalog snapshot. No customer rows, credentials, or function bodies.
-- Run with a trusted administrative read session for full catalog visibility.
-- Only public is inspected; this does not establish Data API exposed schemas.
SELECT jsonb_build_object(
  'formatVersion', 2,
  'schema', 'public',
  'relations', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', c.relname, 'kind', c.relkind::text, 'role', r.role,
      'rls', c.relrowsecurity,
      'select', has_table_privilege(r.role, c.oid, 'SELECT'),
      'insert', has_table_privilege(r.role, c.oid, 'INSERT'),
      'update', has_table_privilege(r.role, c.oid, 'UPDATE'),
      'delete', has_table_privilege(r.role, c.oid, 'DELETE'),
      'truncate', has_table_privilege(r.role, c.oid, 'TRUNCATE'),
      'references', has_table_privilege(r.role, c.oid, 'REFERENCES'),
      'trigger', has_table_privilege(r.role, c.oid, 'TRIGGER'),
      'maintain', has_table_privilege(r.role, c.oid, 'MAINTAIN')
    ) ORDER BY c.relname, r.role)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(role)
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
  ), '[]'::jsonb),
  'columnReferences', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table', c.relname, 'column', a.attname, 'role', r.role
    ) ORDER BY c.relname, a.attnum, r.role)
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(role)
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND a.attnum>0 AND NOT a.attisdropped
      AND NOT has_table_privilege(r.role,c.oid,'REFERENCES')
      AND has_column_privilege(r.role,c.oid,a.attnum,'REFERENCES')
  ), '[]'::jsonb),
  'definerFunctions', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'arguments', pg_get_function_identity_arguments(p.oid),
      'role', r.role,
      'execute', has_function_privilege(r.role, p.oid, 'EXECUTE'),
      'searchPathConfigured', EXISTS (
        SELECT 1 FROM unnest(p.proconfig) setting WHERE setting LIKE 'search_path=%'
      )
    ) ORDER BY p.proname, pg_get_function_identity_arguments(p.oid), r.role)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(role)
    WHERE n.nspname='public' AND p.prokind='f' AND p.prosecdef
  ), '[]'::jsonb),
  'defaultGrants', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'owner', pg_get_userbyid(d.defaclrole),
      'scope', CASE WHEN d.defaclnamespace=0 THEN 'all-schemas' ELSE n.nspname END,
      'objectType', d.defaclobjtype::text,
      'grantee', CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
      'privilege', a.privilege_type
    ) ORDER BY d.defaclrole, d.defaclnamespace, d.defaclobjtype, a.grantee, a.privilege_type)
    FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
    CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE (n.nspname='public' OR d.defaclnamespace=0)
      AND (a.grantee=0 OR pg_get_userbyid(a.grantee) IN ('anon','authenticated'))
  ), '[]'::jsonb)
) AS snapshot;
