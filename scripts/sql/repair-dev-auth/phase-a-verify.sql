-- =============================================================================
-- PHASE A — NON-DESTRUCTIVE VERIFICATION + CHECKPOINT SETUP
-- Project (manual confirm required): cxgiaevervjttbuiramd
--
-- INITIAL-STATE ONLY.
-- The three placeholder auth.users rows are malformed/incomplete seed users
-- (dry-run Auth rows with password metadata but NO auth.identities).
-- Approved initial state for this repair: exactly ZERO auth.identities rows for
-- those three user_ids. Phase A must NOT insert or repair identities.
-- Phase C will create correct new users + identities via Supabase Admin API.
--
-- Requires exact original placeholder emails on profiles / auth.users.
-- Do NOT re-run after Phase B (emails are archived) unless a separate
-- phase-aware resume script is written and approved.
--
-- This script:
--   - verifies malformed auth.users (exact UUID/email pairings)
--   - verifies zero placeholder identities + global email occupancy on identities
--   - verifies expected placeholder profiles / advisor_profiles / diagnose counts
--   - creates schema crm_repair (not exposed via public API by default)
--   - creates crm_repair.assert_ref_count(...) helper
--   - creates crm_repair._dev_auth_repair_map checkpoint table (RLS forced)
--   - upserts the three expected checkpoint rows with new_id IS NULL
--
-- It is NOT a no-write script. It is non-destructive relative to CRM/Auth data.
-- On any mismatch, the transaction aborts and Phase A setup is rolled back.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- MANUAL PROJECT GUARD (does NOT auto-detect Supabase project ref)
-- Open SQL Editor only for project cxgiaevervjttbuiramd, then set below to TRUE.
-- current_setting(...) is NOT used as project proof.
-- ---------------------------------------------------------------------------
do $$
declare
  -- >>> CHANGE TO true ONLY after confirming the SQL Editor project ref is cxgiaevervjttbuiramd <<<
  v_i_confirmed_sql_editor_project_is_cxgiaevervjttbuiramd boolean := true;
  v_expected_project_ref constant text := 'cxgiaevervjttbuiramd';
begin
  if not v_i_confirmed_sql_editor_project_is_cxgiaevervjttbuiramd then
    raise exception
      'Phase A abort: manual project confirmation is false. Confirm SQL Editor project ref is % then set v_i_confirmed_sql_editor_project_is_cxgiaevervjttbuiramd := true',
      v_expected_project_ref;
  end if;
end $$;

-- Private/admin repair schema (keep out of PostgREST exposed schemas)
create schema if not exists crm_repair;

do $$
declare
  v_owner text;
  -- Supabase SQL Editor / platform admin roles for this project family.
  -- A non-postgres owner alone is not treated as corruption.
  v_allowed_owners text[] := array['postgres', 'supabase_admin'];
begin
  select n.nspowner::regrole::text into v_owner
  from pg_catalog.pg_namespace n
  where n.nspname = 'crm_repair';

  if not (v_owner = any (v_allowed_owners)) then
    raise exception
      'Phase A abort: schema crm_repair owner is % (allowed: %)',
      v_owner, array_to_string(v_allowed_owners, ', ');
  end if;
end $$;

revoke all on schema crm_repair from public, anon, authenticated;
grant usage on schema crm_repair to postgres, service_role;

-- ---------------------------------------------------------------------------
-- Reuse guards for existing checkpoint table (before create-if-missing)
-- ---------------------------------------------------------------------------
do $$
declare
  v_reg regclass := to_regclass('crm_repair._dev_auth_repair_map');
  v_rel pg_catalog.pg_class%rowtype;
  v_owner text;
  v_col_count int;
  v_bad_cols int;
  v_pk int;
  v_uq_old int;
  v_uq_new int;
  v_trig int;
  v_pol int;
begin
  if v_reg is null then
    return;
  end if;

  select c.* into v_rel
  from pg_catalog.pg_class c
  where c.oid = v_reg;

  if v_rel.relkind is distinct from 'r' then
    raise exception
      'Phase A abort: crm_repair._dev_auth_repair_map exists but relkind=% (expected ordinary table r)',
      v_rel.relkind;
  end if;

  v_owner := v_rel.relowner::regrole::text;
  if not (v_owner = any (array['postgres', 'supabase_admin'])) then
    raise exception
      'Phase A abort: _dev_auth_repair_map owner is % (allowed: postgres, supabase_admin)',
      v_owner;
  end if;

  select count(*)::int into v_col_count
  from pg_catalog.pg_attribute a
  where a.attrelid = v_reg
    and a.attnum > 0
    and not a.attisdropped;

  if v_col_count <> 9 then
    raise exception
      'Phase A abort: _dev_auth_repair_map has % columns (expected exactly 9)',
      v_col_count;
  end if;

  select count(*)::int into v_bad_cols
  from (
    values
      ('email'),
      ('old_id'),
      ('new_id'),
      ('role'),
      ('slug'),
      ('advisor_profile_id'),
      ('phase'),
      ('detail'),
      ('updated_at')
  ) as expected(col)
  where not exists (
    select 1
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_type t on t.oid = a.atttypid
    join pg_catalog.pg_namespace tn on tn.oid = t.typnamespace
    where a.attrelid = v_reg
      and a.attnum > 0
      and not a.attisdropped
      and a.attname = expected.col
      and case expected.col
        when 'email' then t.typname = 'text' and a.attnotnull
        when 'old_id' then t.typname = 'uuid' and a.attnotnull
        when 'new_id' then t.typname = 'uuid' and not a.attnotnull
        when 'role' then tn.nspname = 'public' and t.typname = 'user_role' and a.attnotnull
        when 'slug' then t.typname = 'text' and a.attnotnull
        when 'advisor_profile_id' then t.typname = 'uuid' and a.attnotnull
        when 'phase' then t.typname = 'text' and a.attnotnull
        when 'detail' then t.typname = 'jsonb' and a.attnotnull
        when 'updated_at' then t.typname = 'timestamptz' and a.attnotnull
      end
  );

  if v_bad_cols <> 0 then
    raise exception
      'Phase A abort: _dev_auth_repair_map column name/type/nullability mismatch (% bad)',
      v_bad_cols;
  end if;

  select count(*)::int into v_pk
  from pg_catalog.pg_constraint c
  where c.conrelid = v_reg
    and c.contype = 'p'
    and pg_catalog.pg_get_constraintdef(c.oid) = 'PRIMARY KEY (email)';

  if v_pk <> 1 then
    raise exception 'Phase A abort: expected PRIMARY KEY (email) on _dev_auth_repair_map';
  end if;

  select count(*)::int into v_uq_old
  from pg_catalog.pg_constraint c
  where c.conrelid = v_reg
    and c.contype = 'u'
    and pg_catalog.pg_get_constraintdef(c.oid) = 'UNIQUE (old_id)';

  if v_uq_old <> 1 then
    raise exception 'Phase A abort: expected UNIQUE (old_id) on _dev_auth_repair_map';
  end if;

  select count(*)::int into v_uq_new
  from pg_catalog.pg_constraint c
  where c.conrelid = v_reg
    and c.contype = 'u'
    and pg_catalog.pg_get_constraintdef(c.oid) = 'UNIQUE (new_id)';

  if v_uq_new <> 1 then
    raise exception 'Phase A abort: expected UNIQUE (new_id) on _dev_auth_repair_map';
  end if;

  select count(*)::int into v_trig
  from pg_catalog.pg_trigger t
  where t.tgrelid = v_reg
    and not t.tgisinternal;

  if v_trig <> 0 then
    raise exception
      'Phase A abort: _dev_auth_repair_map has % unexpected non-internal trigger(s)',
      v_trig;
  end if;

  select count(*)::int into v_pol
  from pg_catalog.pg_policy p
  where p.polrelid = v_reg;

  if v_pol <> 0 then
    raise exception
      'Phase A abort: _dev_auth_repair_map has % unexpected RLS polic(ies); expected none',
      v_pol;
  end if;
end $$;

create table if not exists crm_repair._dev_auth_repair_map (
  email text primary key,
  old_id uuid not null unique,
  new_id uuid unique,
  role public.user_role not null,
  slug text not null,
  advisor_profile_id uuid not null,
  phase text not null default 'A',
  detail jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Re-assert structure after create-if-missing (covers first-run create path)
do $$
declare
  v_reg regclass := 'crm_repair._dev_auth_repair_map'::regclass;
  v_owner text;
  v_bad_cols int;
  v_pk int;
  v_uq_old int;
  v_uq_new int;
  v_trig int;
  v_pol int;
  v_relkind "char";
begin
  select c.relkind, c.relowner::regrole::text
    into v_relkind, v_owner
  from pg_catalog.pg_class c
  where c.oid = v_reg;

  if v_relkind is distinct from 'r' then
    raise exception 'Phase A abort: _dev_auth_repair_map relkind=% (expected r)', v_relkind;
  end if;
  if not (v_owner = any (array['postgres', 'supabase_admin'])) then
    raise exception
      'Phase A abort: _dev_auth_repair_map owner is % (allowed: postgres, supabase_admin)',
      v_owner;
  end if;

  select count(*)::int into v_bad_cols
  from (
    values
      ('email'),
      ('old_id'),
      ('new_id'),
      ('role'),
      ('slug'),
      ('advisor_profile_id'),
      ('phase'),
      ('detail'),
      ('updated_at')
  ) as expected(col)
  where not exists (
    select 1
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_type t on t.oid = a.atttypid
    join pg_catalog.pg_namespace tn on tn.oid = t.typnamespace
    where a.attrelid = v_reg
      and a.attnum > 0
      and not a.attisdropped
      and a.attname = expected.col
      and case expected.col
        when 'email' then t.typname = 'text' and a.attnotnull
        when 'old_id' then t.typname = 'uuid' and a.attnotnull
        when 'new_id' then t.typname = 'uuid' and not a.attnotnull
        when 'role' then tn.nspname = 'public' and t.typname = 'user_role' and a.attnotnull
        when 'slug' then t.typname = 'text' and a.attnotnull
        when 'advisor_profile_id' then t.typname = 'uuid' and a.attnotnull
        when 'phase' then t.typname = 'text' and a.attnotnull
        when 'detail' then t.typname = 'jsonb' and a.attnotnull
        when 'updated_at' then t.typname = 'timestamptz' and a.attnotnull
      end
  );
  if v_bad_cols <> 0 then
    raise exception 'Phase A abort: post-create column mismatch on _dev_auth_repair_map';
  end if;

  select count(*)::int into v_pk
  from pg_catalog.pg_constraint c
  where c.conrelid = v_reg and c.contype = 'p'
    and pg_catalog.pg_get_constraintdef(c.oid) = 'PRIMARY KEY (email)';
  select count(*)::int into v_uq_old
  from pg_catalog.pg_constraint c
  where c.conrelid = v_reg and c.contype = 'u'
    and pg_catalog.pg_get_constraintdef(c.oid) = 'UNIQUE (old_id)';
  select count(*)::int into v_uq_new
  from pg_catalog.pg_constraint c
  where c.conrelid = v_reg and c.contype = 'u'
    and pg_catalog.pg_get_constraintdef(c.oid) = 'UNIQUE (new_id)';

  if v_pk <> 1 or v_uq_old <> 1 or v_uq_new <> 1 then
    raise exception 'Phase A abort: expected PK(email) + UNIQUE(old_id) + UNIQUE(new_id)';
  end if;

  select count(*)::int into v_trig
  from pg_catalog.pg_trigger t
  where t.tgrelid = v_reg and not t.tgisinternal;
  if v_trig <> 0 then
    raise exception 'Phase A abort: unexpected triggers on _dev_auth_repair_map';
  end if;

  select count(*)::int into v_pol
  from pg_catalog.pg_policy p
  where p.polrelid = v_reg;
  if v_pol <> 0 then
    raise exception 'Phase A abort: unexpected RLS policies on _dev_auth_repair_map';
  end if;
end $$;

alter table crm_repair._dev_auth_repair_map enable row level security;
alter table crm_repair._dev_auth_repair_map force row level security;

revoke all on table crm_repair._dev_auth_repair_map from public, anon, authenticated, service_role;
-- Later phases (B/C/D/E) need read + upsert/update of checkpoint rows only.
grant select, insert, update on table crm_repair._dev_auth_repair_map to service_role;
grant all on table crm_repair._dev_auth_repair_map to postgres;

-- ---------------------------------------------------------------------------
-- Helper: exact table.column allow-list; search_path excludes public
-- ---------------------------------------------------------------------------
do $$
declare
  v_oid oid;
  v_owner text;
  v_kind "char";
begin
  select p.oid, p.proowner::regrole::text, p.prokind
    into v_oid, v_owner, v_kind
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'crm_repair'
    and p.proname = 'assert_ref_count'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'text, text, uuid, integer';

  if v_oid is null then
    return;
  end if;

  if v_kind is distinct from 'f' then
    raise exception
      'Phase A abort: crm_repair.assert_ref_count exists but prokind=% (expected f)',
      v_kind;
  end if;
  if not (v_owner = any (array['postgres', 'supabase_admin'])) then
    raise exception
      'Phase A abort: assert_ref_count owner is % (allowed: postgres, supabase_admin)',
      v_owner;
  end if;
end $$;

create or replace function crm_repair.assert_ref_count(
  p_table text,
  p_column text,
  p_old_id uuid,
  p_expected int
) returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  n int;
  pair text := p_table || '.' || p_column;
begin
  case pair
    when 'profiles.id' then
      select count(*)::int into n from public.profiles where id = p_old_id;
    when 'profiles.manager_id' then
      select count(*)::int into n from public.profiles where manager_id = p_old_id;
    when 'advisor_profiles.user_id' then
      select count(*)::int into n from public.advisor_profiles where user_id = p_old_id;
    when 'app_settings.updated_by_user_id' then
      select count(*)::int into n from public.app_settings where updated_by_user_id = p_old_id;
    when 'audit_logs.actor_user_id' then
      select count(*)::int into n from public.audit_logs where actor_user_id = p_old_id;
    when 'households.assigned_by_user_id' then
      select count(*)::int into n from public.households where assigned_by_user_id = p_old_id;
    when 'households.created_by_user_id' then
      select count(*)::int into n from public.households where created_by_user_id = p_old_id;
    when 'duplicate_reviews.resolved_by_user_id' then
      select count(*)::int into n from public.duplicate_reviews where resolved_by_user_id = p_old_id;
    when 'leads.assigned_by_user_id' then
      select count(*)::int into n from public.leads where assigned_by_user_id = p_old_id;
    when 'recommendations.reviewed_by_user_id' then
      select count(*)::int into n from public.recommendations where reviewed_by_user_id = p_old_id;
    when 'recommendations.created_by_user_id' then
      select count(*)::int into n from public.recommendations where created_by_user_id = p_old_id;
    when 'opportunities.assigned_by_user_id' then
      select count(*)::int into n from public.opportunities where assigned_by_user_id = p_old_id;
    when 'advisor_assignments.assigned_by_user_id' then
      select count(*)::int into n from public.advisor_assignments where assigned_by_user_id = p_old_id;
    when 'tasks.assigned_user_id' then
      select count(*)::int into n from public.tasks where assigned_user_id = p_old_id;
    when 'tasks.created_by_user_id' then
      select count(*)::int into n from public.tasks where created_by_user_id = p_old_id;
    when 'notes.author_user_id' then
      select count(*)::int into n from public.notes where author_user_id = p_old_id;
    when 'activities.actor_user_id' then
      select count(*)::int into n from public.activities where actor_user_id = p_old_id;
    when 'documents.uploaded_by_user_id' then
      select count(*)::int into n from public.documents where uploaded_by_user_id = p_old_id;
    when 'client_portal_accounts.user_id' then
      select count(*)::int into n from public.client_portal_accounts where user_id = p_old_id;
    else
      raise exception 'Phase A abort: table.column pair not allow-listed: %', pair;
  end case;

  if n is distinct from p_expected then
    raise exception 'Phase A abort: %.% for % expected % got %',
      p_table, p_column, p_old_id, p_expected, n;
  end if;
end;
$$;

revoke all on function crm_repair.assert_ref_count(text, text, uuid, int)
  from public, anon, authenticated, service_role;
-- Phase A only; later phases do not call this helper.
grant execute on function crm_repair.assert_ref_count(text, text, uuid, int)
  to postgres;

-- ---------------------------------------------------------------------------
-- auth.users — exact three malformed/incomplete seed rows (INITIAL STATE)
-- These are dry-run placeholder users, not GoTrue-created Auth users.
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
begin
  -- Each old UUID exists exactly once (and only those three among the set).
  select count(*)::int into n
  from auth.users u
  where u.id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  );
  if n <> 3 then
    raise exception 'Phase A abort: expected exactly 3 malformed placeholder auth.users, found %', n;
  end if;

  -- Exact UUID ↔ email pairings (no crossed pairings).
  if not exists (
    select 1 from auth.users
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
      and email = 'owner.dev@valtoris.test'
  ) then
    raise exception 'Phase A abort: auth.users aaa1 must be owner.dev@valtoris.test';
  end if;

  if not exists (
    select 1 from auth.users
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
      and email = 'advisor.a@valtoris.test'
  ) then
    raise exception 'Phase A abort: auth.users aaa2 must be advisor.a@valtoris.test';
  end if;

  if not exists (
    select 1 from auth.users
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
      and email = 'advisor.b@valtoris.test'
  ) then
    raise exception 'Phase A abort: auth.users aaa3 must be advisor.b@valtoris.test';
  end if;

  -- No other auth.users row uses any of the three placeholder emails.
  select count(*)::int into n
  from auth.users u
  where u.email in (
    'owner.dev@valtoris.test',
    'advisor.a@valtoris.test',
    'advisor.b@valtoris.test'
  );
  if n <> 3 then
    raise exception
      'Phase A abort: placeholder emails must appear on exactly 3 auth.users rows, found %',
      n;
  end if;

  -- Cross-check: no placeholder email on a non-matching UUID.
  if exists (
    select 1 from auth.users u
    where u.email = 'owner.dev@valtoris.test'
      and u.id is distinct from 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid
  ) or exists (
    select 1 from auth.users u
    where u.email = 'advisor.a@valtoris.test'
      and u.id is distinct from 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid
  ) or exists (
    select 1 from auth.users u
    where u.email = 'advisor.b@valtoris.test'
      and u.id is distinct from 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid
  ) then
    raise exception 'Phase A abort: auth.users UUID/email pairing is crossed';
  end if;
end $$;

-- Report auth.users (no secrets) for review
select
  'auth.users' as src,
  u.id,
  u.email,
  u.email_confirmed_at is not null as email_confirmed,
  u.created_at,
  u.deleted_at,
  (u.encrypted_password is not null) as has_password_hash
from auth.users u
where u.id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
)
order by u.id;

-- ---------------------------------------------------------------------------
-- auth.identities — approved INITIAL STATE for this repair (Recommendation A)
--
-- Placeholder auth.users are malformed/incomplete seed rows: they must have
-- exactly ZERO auth.identities (not three, not “zero or three”).
-- Phase A must NOT insert or repair identities.
-- Phase C creates correct new users + identities via Supabase Admin API.
-- Phase B identity UPDATEs are no-ops when zero; Phase E identity DELETEs are
-- no-ops when zero. Keep a global occupancy check so placeholder emails are
-- free across ALL identity providers and users before Phase C.
-- ---------------------------------------------------------------------------
do $$
declare
  n_placeholder int;
  n_email_occupancy int;
begin
  select count(*)::int into n_placeholder
  from auth.identities i
  where i.user_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  );
  if n_placeholder <> 0 then
    raise exception
      'Phase A abort: approved initial state requires exactly 0 auth.identities for the three malformed placeholder user_ids; found %. Phase A must not insert or repair identities.',
      n_placeholder;
  end if;

  -- Global occupancy: no identity anywhere may hold placeholder emails
  -- (any provider, any user) via provider_id or identity_data.email.
  select count(*)::int into n_email_occupancy
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
    );
  if n_email_occupancy <> 0 then
    raise exception
      'Phase A abort: placeholder emails must be free on auth.identities (all providers/users); found % occupying row(s)',
      n_email_occupancy;
  end if;
end $$;

-- Report auth.identities for the three placeholder user_ids (expected: empty)
select
  'auth.identities' as src,
  i.user_id,
  i.provider,
  i.provider_id,
  i.identity_data ->> 'email' as identity_email,
  i.created_at,
  i.updated_at
from auth.identities i
where i.user_id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
)
order by i.user_id, i.provider;

-- ---------------------------------------------------------------------------
-- public.profiles / advisor_profiles — INITIAL STATE (original emails only)
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
begin
  select count(*)::int into n
  from public.profiles
  where id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  );
  if n <> 3 then
    raise exception 'Phase A abort: expected 3 placeholder profiles, found %', n;
  end if;

  if not exists (
    select 1 from public.profiles
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
      and email = 'owner.dev@valtoris.test'
      and role = 'owner'
      and is_active = true
      and deleted_at is null
  ) then
    raise exception 'Phase A abort: owner.dev profile mismatch (initial-state original email required)';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
      and email = 'advisor.a@valtoris.test'
      and role = 'advisor'
      and is_active = true
      and deleted_at is null
  ) then
    raise exception 'Phase A abort: advisor.a profile mismatch (initial-state original email required)';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
      and email = 'advisor.b@valtoris.test'
      and role = 'advisor'
      and is_active = true
      and deleted_at is null
  ) then
    raise exception 'Phase A abort: advisor.b profile mismatch (initial-state original email required)';
  end if;

  -- Original emails must appear on exactly these three profiles (no extras).
  select count(*)::int into n
  from public.profiles
  where email in (
    'owner.dev@valtoris.test',
    'advisor.a@valtoris.test',
    'advisor.b@valtoris.test'
  );
  if n <> 3 then
    raise exception
      'Phase A abort: placeholder emails must appear on exactly 3 profiles, found %',
      n;
  end if;

  if not exists (
    select 1 from public.advisor_profiles
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
      and user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
      and slug = 'dev-owner'
      and is_active = true
  ) then
    raise exception 'Phase A abort: advisor_profiles dev-owner mismatch';
  end if;

  if not exists (
    select 1 from public.advisor_profiles
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'
      and user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
      and slug = 'advisor-a'
      and is_active = true
  ) then
    raise exception 'Phase A abort: advisor_profiles advisor-a mismatch';
  end if;

  if not exists (
    select 1 from public.advisor_profiles
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'
      and user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
      and slug = 'advisor-b'
      and is_active = true
  ) then
    raise exception 'Phase A abort: advisor_profiles advisor-b mismatch';
  end if;
end $$;

-- Diagnose reference matrix (all scanned columns; include expected zeros)
select crm_repair.assert_ref_count('profiles', 'id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 1);
select crm_repair.assert_ref_count('profiles', 'id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 1);
select crm_repair.assert_ref_count('profiles', 'id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 1);
select crm_repair.assert_ref_count('profiles', 'manager_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 0);
select crm_repair.assert_ref_count('profiles', 'manager_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 0);
select crm_repair.assert_ref_count('profiles', 'manager_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 0);
select crm_repair.assert_ref_count('advisor_profiles', 'user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 1);
select crm_repair.assert_ref_count('advisor_profiles', 'user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 1);
select crm_repair.assert_ref_count('advisor_profiles', 'user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 1);
select crm_repair.assert_ref_count('app_settings', 'updated_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 0);
select crm_repair.assert_ref_count('app_settings', 'updated_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 0);
select crm_repair.assert_ref_count('app_settings', 'updated_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 0);
select crm_repair.assert_ref_count('audit_logs', 'actor_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 5);
select crm_repair.assert_ref_count('audit_logs', 'actor_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 0);
select crm_repair.assert_ref_count('audit_logs', 'actor_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 18);
select crm_repair.assert_ref_count('households', 'assigned_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 2);
select crm_repair.assert_ref_count('households', 'assigned_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 0);
select crm_repair.assert_ref_count('households', 'assigned_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 0);
select crm_repair.assert_ref_count('households', 'created_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 0);
select crm_repair.assert_ref_count('households', 'created_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 0);
select crm_repair.assert_ref_count('households', 'created_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 0);
select crm_repair.assert_ref_count('duplicate_reviews', 'resolved_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 0);
select crm_repair.assert_ref_count('duplicate_reviews', 'resolved_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 0);
select crm_repair.assert_ref_count('duplicate_reviews', 'resolved_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 0);
select crm_repair.assert_ref_count('leads', 'assigned_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 0);
select crm_repair.assert_ref_count('leads', 'assigned_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 0);
select crm_repair.assert_ref_count('leads', 'assigned_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 0);
select crm_repair.assert_ref_count('recommendations', 'reviewed_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 0);
select crm_repair.assert_ref_count('recommendations', 'reviewed_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 0);
select crm_repair.assert_ref_count('recommendations', 'reviewed_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 1);
select crm_repair.assert_ref_count('recommendations', 'created_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 0);
select crm_repair.assert_ref_count('recommendations', 'created_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 0);
select crm_repair.assert_ref_count('recommendations', 'created_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 0);
select crm_repair.assert_ref_count('opportunities', 'assigned_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 0);
select crm_repair.assert_ref_count('opportunities', 'assigned_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 0);
select crm_repair.assert_ref_count('opportunities', 'assigned_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 1);
select crm_repair.assert_ref_count('advisor_assignments', 'assigned_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 3);
select crm_repair.assert_ref_count('advisor_assignments', 'assigned_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 0);
select crm_repair.assert_ref_count('advisor_assignments', 'assigned_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 0);
select crm_repair.assert_ref_count('tasks', 'assigned_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 0);
select crm_repair.assert_ref_count('tasks', 'assigned_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 0);
select crm_repair.assert_ref_count('tasks', 'assigned_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 0);
select crm_repair.assert_ref_count('tasks', 'created_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 0);
select crm_repair.assert_ref_count('tasks', 'created_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 0);
select crm_repair.assert_ref_count('tasks', 'created_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 0);
select crm_repair.assert_ref_count('notes', 'author_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 0);
select crm_repair.assert_ref_count('notes', 'author_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 0);
select crm_repair.assert_ref_count('notes', 'author_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 0);
select crm_repair.assert_ref_count('activities', 'actor_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 1);
select crm_repair.assert_ref_count('activities', 'actor_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 0);
select crm_repair.assert_ref_count('activities', 'actor_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 3);
select crm_repair.assert_ref_count('documents', 'uploaded_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 0);
select crm_repair.assert_ref_count('documents', 'uploaded_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 0);
select crm_repair.assert_ref_count('documents', 'uploaded_by_user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 0);
select crm_repair.assert_ref_count('client_portal_accounts', 'user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 0);
select crm_repair.assert_ref_count('client_portal_accounts', 'user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 0);
select crm_repair.assert_ref_count('client_portal_accounts', 'user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 0);

-- ---------------------------------------------------------------------------
-- Checkpoint content guards (INITIAL STATE: new_id must be null)
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
begin
  select count(*)::int into n from crm_repair._dev_auth_repair_map;
  if n > 3 then
    raise exception 'Phase A abort: _dev_auth_repair_map has % rows (expected at most 3)', n;
  end if;

  if exists (
    select 1
    from crm_repair._dev_auth_repair_map m
    where m.email not in (
      'owner.dev@valtoris.test',
      'advisor.a@valtoris.test',
      'advisor.b@valtoris.test'
    )
  ) then
    raise exception 'Phase A abort: unexpected email in _dev_auth_repair_map';
  end if;

  -- No repair writes have run yet — any non-null new_id is unsafe to keep.
  if exists (
    select 1 from crm_repair._dev_auth_repair_map m where m.new_id is not null
  ) then
    raise exception
      'Phase A abort: checkpoint new_id is non-null. Initial-state Phase A refuses to preserve or overwrite repair new_id values. Use a phase-aware resume script if resuming after Phase C+.';
  end if;

  if exists (
    select 1 from crm_repair._dev_auth_repair_map m
    where m.email = 'owner.dev@valtoris.test'
      and (
        m.old_id is distinct from 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid
        or m.role is distinct from 'owner'::public.user_role
        or m.slug is distinct from 'dev-owner'
        or m.advisor_profile_id is distinct from 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid
      )
  ) then
    raise exception 'Phase A abort: owner.dev map row inconsistent with expected checkpoint';
  end if;

  if exists (
    select 1 from crm_repair._dev_auth_repair_map m
    where m.email = 'advisor.a@valtoris.test'
      and (
        m.old_id is distinct from 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid
        or m.role is distinct from 'advisor'::public.user_role
        or m.slug is distinct from 'advisor-a'
        or m.advisor_profile_id is distinct from 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid
      )
  ) then
    raise exception 'Phase A abort: advisor.a map row inconsistent with expected checkpoint';
  end if;

  if exists (
    select 1 from crm_repair._dev_auth_repair_map m
    where m.email = 'advisor.b@valtoris.test'
      and (
        m.old_id is distinct from 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid
        or m.role is distinct from 'advisor'::public.user_role
        or m.slug is distinct from 'advisor-b'
        or m.advisor_profile_id is distinct from 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'::uuid
      )
  ) then
    raise exception 'Phase A abort: advisor.b map row inconsistent with expected checkpoint';
  end if;
end $$;

-- Upsert expected rows; new_id forced null (initial state).
insert into crm_repair._dev_auth_repair_map as m (
  email, old_id, new_id, role, slug, advisor_profile_id, phase, detail
) values
  (
    'owner.dev@valtoris.test',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    null,
    'owner',
    'dev-owner',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    'A_verified',
    jsonb_build_object(
      'expected_project_ref', 'cxgiaevervjttbuiramd',
      'manual_project_confirmation', true,
      'phase_a_mode', 'initial_state_only'
    )
  ),
  (
    'advisor.a@valtoris.test',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    null,
    'advisor',
    'advisor-a',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    'A_verified',
    jsonb_build_object(
      'expected_project_ref', 'cxgiaevervjttbuiramd',
      'manual_project_confirmation', true,
      'phase_a_mode', 'initial_state_only'
    )
  ),
  (
    'advisor.b@valtoris.test',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    null,
    'advisor',
    'advisor-b',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
    'A_verified',
    jsonb_build_object(
      'expected_project_ref', 'cxgiaevervjttbuiramd',
      'manual_project_confirmation', true,
      'phase_a_mode', 'initial_state_only'
    )
  )
on conflict (email) do update
set
  old_id = excluded.old_id,
  new_id = null,
  role = excluded.role,
  slug = excluded.slug,
  advisor_profile_id = excluded.advisor_profile_id,
  phase = 'A_verified',
  detail = excluded.detail || jsonb_build_object('phase_a_refreshed_at', now()),
  updated_at = now();

do $$
declare
  n int;
begin
  select count(*)::int into n from crm_repair._dev_auth_repair_map;
  if n <> 3 then
    raise exception 'Phase A abort: map must contain exactly 3 rows after upsert, found %', n;
  end if;

  if exists (
    select 1 from crm_repair._dev_auth_repair_map where new_id is not null
  ) then
    raise exception 'Phase A abort: new_id must be null after initial-state upsert';
  end if;
end $$;

select
  'PHASE_A_OK' as status,
  'cxgiaevervjttbuiramd' as expected_project_ref,
  'manual_confirmation_required_in_script' as project_proof,
  'initial_state_only' as phase_a_mode,
  email,
  old_id,
  new_id,
  role,
  slug,
  advisor_profile_id,
  phase
from crm_repair._dev_auth_repair_map
order by email;

commit;
