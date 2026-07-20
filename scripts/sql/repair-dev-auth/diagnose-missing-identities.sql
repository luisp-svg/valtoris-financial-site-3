-- =============================================================================
-- READ-ONLY DIAGNOSTIC — missing auth.identities for placeholder UUIDs
-- Project: cxgiaevervjttbuiramd only
-- SELECT only. No INSERT/UPDATE/DELETE/ALTER/CREATE/DROP/GRANT/REVOKE.
-- Does not modify CRM/Auth data or repair artifacts.
-- =============================================================================

-- 1) Placeholder auth.users rows (no encrypted_password value)
select
  u.id,
  u.email,
  u.instance_id,
  u.aud,
  u.role,
  u.email_confirmed_at,
  u.confirmation_sent_at,
  u.confirmed_at,
  u.last_sign_in_at,
  u.created_at,
  u.updated_at,
  u.deleted_at,
  u.is_sso_user,
  u.is_anonymous,
  u.raw_app_meta_data,
  u.raw_user_meta_data,
  (u.encrypted_password is not null) as has_password_hash
from auth.users u
where u.id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
)
order by u.id;

-- 2) All auth.identities for the three placeholder user_ids
select
  i.id,
  i.user_id,
  i.provider,
  i.provider_id,
  i.identity_data,
  i.created_at,
  i.updated_at,
  i.last_sign_in_at
from auth.identities i
where i.user_id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
)
order by i.user_id, i.provider, i.id;

-- 3) Any identities matching the three placeholder emails (any user)
select
  i.id,
  i.user_id,
  i.provider,
  i.provider_id,
  i.identity_data,
  i.created_at,
  i.updated_at,
  i.last_sign_in_at,
  coalesce(i.identity_data ->> 'email', i.provider_id) as matched_email
from auth.identities i
where i.provider_id in (
    'owner.dev@valtoris.test',
    'advisor.a@valtoris.test',
    'advisor.b@valtoris.test'
  )
   or i.identity_data ->> 'email' in (
    'owner.dev@valtoris.test',
    'advisor.a@valtoris.test',
    'advisor.b@valtoris.test'
  )
order by
  coalesce(i.identity_data ->> 'email', i.provider_id),
  i.user_id,
  i.provider;

-- 4) Per-placeholder UUID identity counts by provider (zero-safe)
with placeholders as (
  select *
  from (
    values
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid),
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid),
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid)
  ) as v(user_id)
),
providers_present as (
  select distinct i.provider
  from auth.identities i
  where i.user_id in (select p.user_id from placeholders p)
),
provider_grid as (
  select p.user_id, pr.provider
  from placeholders p
  cross join providers_present pr
)
select
  p.user_id,
  coalesce(g.provider, '(none)') as provider,
  coalesce(c.identity_count, 0) as identity_count
from placeholders p
left join provider_grid g on g.user_id = p.user_id
left join lateral (
  select count(*)::int as identity_count
  from auth.identities i
  where i.user_id = p.user_id
    and i.provider = g.provider
) c on true
union all
select
  p.user_id,
  '(total)' as provider,
  (
    select count(*)::int
    from auth.identities i
    where i.user_id = p.user_id
  ) as identity_count
from placeholders p
order by user_id, provider;

-- 5) Other auth.users rows using placeholder emails (unexpected)
select
  u.id,
  u.email,
  u.created_at,
  u.deleted_at,
  case
    when u.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
      and u.email = 'owner.dev@valtoris.test' then 'expected_pairing'
    when u.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
      and u.email = 'advisor.a@valtoris.test' then 'expected_pairing'
    when u.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
      and u.email = 'advisor.b@valtoris.test' then 'expected_pairing'
    else 'UNEXPECTED_other_user_with_placeholder_email'
  end as pairing_status
from auth.users u
where u.email in (
  'owner.dev@valtoris.test',
  'advisor.a@valtoris.test',
  'advisor.b@valtoris.test'
)
  and u.id not in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
order by u.email, u.id;

-- 6) public.profiles expected placeholder state
select
  p.id,
  p.email,
  p.role,
  p.is_active,
  p.deleted_at,
  case
    when p.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
      and p.email = 'owner.dev@valtoris.test'
      and p.role = 'owner'
      and p.is_active = true
      and p.deleted_at is null then 'MATCH'
    when p.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
      and p.email = 'advisor.a@valtoris.test'
      and p.role = 'advisor'
      and p.is_active = true
      and p.deleted_at is null then 'MATCH'
    when p.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
      and p.email = 'advisor.b@valtoris.test'
      and p.role = 'advisor'
      and p.is_active = true
      and p.deleted_at is null then 'MATCH'
    else 'MISMATCH'
  end as expected_state
from public.profiles p
where p.id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
)
order by p.id;

-- 7) FK definitions involving auth.identities.user_id, auth.users.id, public.profiles.id
select
  nsp_src.nspname as source_schema,
  cls_src.relname as source_table,
  att_src.attname as source_column,
  con.conname as constraint_name,
  nsp_tgt.nspname as target_schema,
  cls_tgt.relname as target_table,
  att_tgt.attname as target_column,
  case con.confdeltype
    when 'a' then 'NO ACTION'
    when 'r' then 'RESTRICT'
    when 'c' then 'CASCADE'
    when 'n' then 'SET NULL'
    when 'd' then 'SET DEFAULT'
    else con.confdeltype::text
  end as delete_action,
  case con.confupdtype
    when 'a' then 'NO ACTION'
    when 'r' then 'RESTRICT'
    when 'c' then 'CASCADE'
    when 'n' then 'SET NULL'
    when 'd' then 'SET DEFAULT'
    else con.confupdtype::text
  end as update_action
from pg_catalog.pg_constraint con
join pg_catalog.pg_class cls_src on cls_src.oid = con.conrelid
join pg_catalog.pg_namespace nsp_src on nsp_src.oid = cls_src.relnamespace
join pg_catalog.pg_class cls_tgt on cls_tgt.oid = con.confrelid
join pg_catalog.pg_namespace nsp_tgt on nsp_tgt.oid = cls_tgt.relnamespace
join lateral unnest(con.conkey) with ordinality as src_cols(attnum, ord) on true
join lateral unnest(con.confkey) with ordinality as tgt_cols(attnum, ord) on tgt_cols.ord = src_cols.ord
join pg_catalog.pg_attribute att_src
  on att_src.attrelid = con.conrelid and att_src.attnum = src_cols.attnum
join pg_catalog.pg_attribute att_tgt
  on att_tgt.attrelid = con.confrelid and att_tgt.attnum = tgt_cols.attnum
where con.contype = 'f'
  and (
    (nsp_src.nspname = 'auth' and cls_src.relname = 'identities' and att_src.attname = 'user_id')
    or (nsp_tgt.nspname = 'auth' and cls_tgt.relname = 'identities' and att_tgt.attname = 'user_id')
    or (nsp_src.nspname = 'auth' and cls_src.relname = 'users' and att_src.attname = 'id')
    or (nsp_tgt.nspname = 'auth' and cls_tgt.relname = 'users' and att_tgt.attname = 'id')
    or (nsp_src.nspname = 'public' and cls_src.relname = 'profiles' and att_src.attname = 'id')
    or (nsp_tgt.nspname = 'public' and cls_tgt.relname = 'profiles' and att_tgt.attname = 'id')
  )
order by
  source_schema,
  source_table,
  source_column,
  constraint_name,
  target_schema,
  target_table,
  target_column;
