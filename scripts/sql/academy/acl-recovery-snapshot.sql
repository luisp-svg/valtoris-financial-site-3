-- READ ONLY. Replace the source label with the verified project ref before export.
-- Captures only ACLs/identity for objects touched by the hardening proposal.
-- No customer rows, credentials or function bodies. Keep the result outside Git.
WITH objects AS (
  SELECT 'table'::text AS kind,c.oid::text AS object_id,0 AS sub_id,c.relname::text AS name,
    NULL::text AS column_name,pg_get_userbyid(c.relowner)::text AS owner,
    NULL::text AS return_type,c.relkind::text AS shape,COALESCE(c.relacl,acldefault('r',c.relowner)) AS acl
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
  UNION ALL
  SELECT 'column',c.oid::text,a.attnum,c.relname,a.attname,
    pg_get_userbyid(c.relowner),NULL,format_type(a.atttypid,a.atttypmod),a.attacl
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
  UNION ALL
  SELECT 'function',p.oid::text,0,p.proname,NULL,pg_get_userbyid(p.proowner),
    p.prorettype::regtype::text,md5(pg_get_functiondef(p.oid)),COALESCE(p.proacl,acldefault('f',p.proowner))
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('handle_new_auth_user','rls_auto_enable')
    AND p.pronargs=0 AND p.prokind='f'
  UNION ALL
  SELECT 'default','postgres/public/tables',0,'tables',NULL,'postgres',NULL,NULL,d.defaclacl
  FROM (SELECT 1) seed LEFT JOIN pg_default_acl d
    ON d.defaclrole='postgres'::regrole AND d.defaclnamespace='public'::regnamespace
    AND d.defaclobjtype='r'
)
SELECT jsonb_build_object(
  'formatVersion',1,'scope','academy-browser-hardening',
  'sourceLabel','REPLACE_WITH_PROJECT_REF','database',current_database(),
  'serverMajor',current_setting('server_version_num')::integer/10000,
  'objects',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'kind',o.kind,'objectId',o.object_id,'subId',o.sub_id,'name',o.name,
    'column',o.column_name,'owner',o.owner,'returnType',o.return_type,'shape',o.shape,
    'grants',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'grantor',pg_get_userbyid(a.grantor),
      'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
      'privilege',a.privilege_type,'grantable',a.is_grantable
    ) ORDER BY a.grantor,a.grantee,a.privilege_type) FROM aclexplode(o.acl) a),'[]'::jsonb)
  ) ORDER BY o.kind,o.object_id,o.sub_id) FROM objects o),'[]'::jsonb)
) AS snapshot;
