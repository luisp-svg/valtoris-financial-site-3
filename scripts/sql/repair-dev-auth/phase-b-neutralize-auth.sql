-- =============================================================================
-- PHASE B — NEUTRALIZE PLACEHOLDER EMAILS (free originals; NO deletes)
-- Project (manual confirm required): cxgiaevervjttbuiramd
--
-- Prerequisites: Phase A COMMITTED (checkpoint phase = A_verified, new_id NULL).
-- Approved Auth state: malformed placeholder auth.users with ZERO identities.
-- Phase B must NOT insert or mutate auth.identities.
--
-- Scope: ONLY these UUIDs:
--   aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1  → owner.dev+archived-aaaaaaaaaaa1@valtoris.test
--   aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2  → advisor.a+archived-aaaaaaaaaaa2@valtoris.test
--   aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3  → advisor.b+archived-aaaaaaaaaaa3@valtoris.test
--
-- Mutates only: profiles.email/updated_at, auth.users.email/updated_at,
--               checkpoint phase/detail/updated_at.
--
-- Hardenings (before / after checkpoint advance):
--   1) Exclusive archived email ownership on auth.users and public.profiles
--      (each archived email ↔ exactly one intended UUID; abort on dup/wrong pair).
--   2) Checkpoint immutability after phase=B_neutralized: only phase/detail/
--      updated_at may change; email/old_id/new_id(NULL)/role/slug/
--      advisor_profile_id must match Phase A.
--
-- Defaults to ROLLBACK. Switch to COMMIT only after review.
-- Never prints password hashes or tokens.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- MANUAL PROJECT GUARD (does NOT auto-detect Supabase project ref)
-- Open SQL Editor / linked CLI only for project cxgiaevervjttbuiramd, then TRUE.
-- ---------------------------------------------------------------------------
do $$
declare
  -- >>> CHANGE TO true ONLY after confirming project ref is cxgiaevervjttbuiramd <<<
  v_i_confirmed_sql_editor_project_is_cxgiaevervjttbuiramd boolean := true;
  v_expected_project_ref constant text := 'cxgiaevervjttbuiramd';
begin
  if not v_i_confirmed_sql_editor_project_is_cxgiaevervjttbuiramd then
    raise exception
      'Phase B abort: manual project confirmation is false. Confirm project ref is % then set v_i_confirmed_sql_editor_project_is_cxgiaevervjttbuiramd := true',
      v_expected_project_ref;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Exact checkpoint validation (Phase A committed state)
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
begin
  select count(*)::int into n from crm_repair._dev_auth_repair_map;
  if n <> 3 then
    raise exception
      'Phase B abort: _dev_auth_repair_map must contain exactly 3 rows, found %',
      n;
  end if;

  if exists (
    select 1 from crm_repair._dev_auth_repair_map m
    where m.email not in (
      'owner.dev@valtoris.test',
      'advisor.a@valtoris.test',
      'advisor.b@valtoris.test'
    )
  ) then
    raise exception 'Phase B abort: unexpected email in _dev_auth_repair_map';
  end if;

  if exists (
    select 1 from crm_repair._dev_auth_repair_map where new_id is not null
  ) then
    raise exception 'Phase B abort: checkpoint new_id must be NULL for all rows';
  end if;

  if exists (
    select 1 from crm_repair._dev_auth_repair_map where phase is distinct from 'A_verified'
  ) then
    raise exception 'Phase B abort: all checkpoint rows must have phase = A_verified';
  end if;

  if not exists (
    select 1 from crm_repair._dev_auth_repair_map m
    where m.email = 'owner.dev@valtoris.test'
      and m.old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid
      and m.role = 'owner'::public.user_role
      and m.slug = 'dev-owner'
      and m.advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid
      and m.phase = 'A_verified'
      and m.new_id is null
  ) then
    raise exception 'Phase B abort: owner.dev checkpoint row mismatch';
  end if;

  if not exists (
    select 1 from crm_repair._dev_auth_repair_map m
    where m.email = 'advisor.a@valtoris.test'
      and m.old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid
      and m.role = 'advisor'::public.user_role
      and m.slug = 'advisor-a'
      and m.advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid
      and m.phase = 'A_verified'
      and m.new_id is null
  ) then
    raise exception 'Phase B abort: advisor.a checkpoint row mismatch';
  end if;

  if not exists (
    select 1 from crm_repair._dev_auth_repair_map m
    where m.email = 'advisor.b@valtoris.test'
      and m.old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid
      and m.role = 'advisor'::public.user_role
      and m.slug = 'advisor-b'
      and m.advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'::uuid
      and m.phase = 'A_verified'
      and m.new_id is null
  ) then
    raise exception 'Phase B abort: advisor.b checkpoint row mismatch';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Pre-mutation reports (no secrets)
-- ---------------------------------------------------------------------------
select
  'pre_auth_users' as src,
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

select
  'pre_profiles' as src,
  p.id,
  p.email,
  p.role,
  p.is_active,
  p.deleted_at
from public.profiles p
where p.id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
)
order by p.id;

select
  'pre_auth_identities' as src,
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
-- Pre-mutation source validation
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
begin
  select count(*)::int into n
  from auth.users u
  where u.id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  );
  if n <> 3 then
    raise exception 'Phase B abort: expected exactly 3 placeholder auth.users, found %', n;
  end if;

  if not exists (
    select 1 from auth.users
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
      and email = 'owner.dev@valtoris.test'
  ) then
    raise exception 'Phase B abort: auth.users aaa1 must still be owner.dev@valtoris.test';
  end if;
  if not exists (
    select 1 from auth.users
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
      and email = 'advisor.a@valtoris.test'
  ) then
    raise exception 'Phase B abort: auth.users aaa2 must still be advisor.a@valtoris.test';
  end if;
  if not exists (
    select 1 from auth.users
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
      and email = 'advisor.b@valtoris.test'
  ) then
    raise exception 'Phase B abort: auth.users aaa3 must still be advisor.b@valtoris.test';
  end if;

  select count(*)::int into n
  from auth.users u
  where u.email in (
    'owner.dev@valtoris.test',
    'advisor.a@valtoris.test',
    'advisor.b@valtoris.test'
  );
  if n <> 3 then
    raise exception
      'Phase B abort: original emails must appear on exactly 3 auth.users rows, found %',
      n;
  end if;

  select count(*)::int into n
  from public.profiles p
  where p.id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  );
  if n <> 3 then
    raise exception 'Phase B abort: expected exactly 3 placeholder profiles, found %', n;
  end if;

  if not exists (
    select 1 from public.profiles
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
      and email = 'owner.dev@valtoris.test'
      and role = 'owner'
      and is_active = true
      and deleted_at is null
  ) then
    raise exception 'Phase B abort: owner.dev profile source-state mismatch';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
      and email = 'advisor.a@valtoris.test'
      and role = 'advisor'
      and is_active = true
      and deleted_at is null
  ) then
    raise exception 'Phase B abort: advisor.a profile source-state mismatch';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
      and email = 'advisor.b@valtoris.test'
      and role = 'advisor'
      and is_active = true
      and deleted_at is null
  ) then
    raise exception 'Phase B abort: advisor.b profile source-state mismatch';
  end if;

  -- Advisor profile IDs/slugs/user_ids must still match checkpoint (unchanged by Phase B)
  if not exists (
    select 1 from public.advisor_profiles
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
      and user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
      and slug = 'dev-owner'
  ) then
    raise exception 'Phase B abort: advisor_profiles dev-owner source-state mismatch';
  end if;
  if not exists (
    select 1 from public.advisor_profiles
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'
      and user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
      and slug = 'advisor-a'
  ) then
    raise exception 'Phase B abort: advisor_profiles advisor-a source-state mismatch';
  end if;
  if not exists (
    select 1 from public.advisor_profiles
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'
      and user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
      and slug = 'advisor-b'
  ) then
    raise exception 'Phase B abort: advisor_profiles advisor-b source-state mismatch';
  end if;

  select count(*)::int into n
  from auth.identities i
  where i.user_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  );
  if n <> 0 then
    raise exception
      'Phase B abort: approved state requires exactly 0 placeholder auth.identities; found %',
      n;
  end if;

  select count(*)::int into n
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
  if n <> 0 then
    raise exception
      'Phase B abort: original emails must be free on auth.identities (all providers/users); found %',
      n;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Archived-email collision preflight
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from auth.users
    where email in (
      'owner.dev+archived-aaaaaaaaaaa1@valtoris.test',
      'advisor.a+archived-aaaaaaaaaaa2@valtoris.test',
      'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'
    )
  ) then
    raise exception 'Phase B abort: archived email already present on auth.users';
  end if;

  if exists (
    select 1 from public.profiles
    where email in (
      'owner.dev+archived-aaaaaaaaaaa1@valtoris.test',
      'advisor.a+archived-aaaaaaaaaaa2@valtoris.test',
      'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'
    )
  ) then
    raise exception 'Phase B abort: archived email already present on public.profiles';
  end if;

  if exists (
    select 1 from auth.identities
    where provider_id in (
        'owner.dev+archived-aaaaaaaaaaa1@valtoris.test',
        'advisor.a+archived-aaaaaaaaaaa2@valtoris.test',
        'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'
      )
       or identity_data ->> 'email' in (
        'owner.dev+archived-aaaaaaaaaaa1@valtoris.test',
        'advisor.a+archived-aaaaaaaaaaa2@valtoris.test',
        'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'
      )
  ) then
    raise exception
      'Phase B abort: archived email already present on auth.identities (any provider/user)';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Mutations (exact UUID + original email; count-enforced)
-- auth.identities is NOT updated (approved zero-identity state).
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
begin
  update public.profiles p
  set
    email = 'owner.dev+archived-aaaaaaaaaaa1@valtoris.test'::extensions.citext,
    updated_at = now()
  where p.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
    and p.email = 'owner.dev@valtoris.test';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Phase B abort: owner.dev profile archive updated % rows (expected 1)', n;
  end if;

  update public.profiles p
  set
    email = 'advisor.a+archived-aaaaaaaaaaa2@valtoris.test'::extensions.citext,
    updated_at = now()
  where p.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
    and p.email = 'advisor.a@valtoris.test';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Phase B abort: advisor.a profile archive updated % rows (expected 1)', n;
  end if;

  update public.profiles p
  set
    email = 'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'::extensions.citext,
    updated_at = now()
  where p.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
    and p.email = 'advisor.b@valtoris.test';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Phase B abort: advisor.b profile archive updated % rows (expected 1)', n;
  end if;

  -- Aggregate confirm: exactly 3 profile archives in this transaction path
  select count(*)::int into n
  from public.profiles
  where id in (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
    )
    and email in (
      'owner.dev+archived-aaaaaaaaaaa1@valtoris.test',
      'advisor.a+archived-aaaaaaaaaaa2@valtoris.test',
      'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'
    );
  if n <> 3 then
    raise exception 'Phase B abort: expected 3 archived profiles after mutation, found %', n;
  end if;

  update auth.users u
  set
    email = 'owner.dev+archived-aaaaaaaaaaa1@valtoris.test',
    updated_at = now()
  where u.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
    and u.email = 'owner.dev@valtoris.test';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Phase B abort: owner.dev auth.users archive updated % rows (expected 1)', n;
  end if;

  update auth.users u
  set
    email = 'advisor.a+archived-aaaaaaaaaaa2@valtoris.test',
    updated_at = now()
  where u.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
    and u.email = 'advisor.a@valtoris.test';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Phase B abort: advisor.a auth.users archive updated % rows (expected 1)', n;
  end if;

  update auth.users u
  set
    email = 'advisor.b+archived-aaaaaaaaaaa3@valtoris.test',
    updated_at = now()
  where u.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
    and u.email = 'advisor.b@valtoris.test';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Phase B abort: advisor.b auth.users archive updated % rows (expected 1)', n;
  end if;

  select count(*)::int into n
  from auth.users
  where id in (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
    )
    and email in (
      'owner.dev+archived-aaaaaaaaaaa1@valtoris.test',
      'advisor.a+archived-aaaaaaaaaaa2@valtoris.test',
      'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'
    );
  if n <> 3 then
    raise exception 'Phase B abort: expected 3 archived auth.users after mutation, found %', n;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Postconditions before checkpoint advancement
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
begin
  -- Originals free
  if exists (
    select 1 from auth.users
    where email in (
      'owner.dev@valtoris.test',
      'advisor.a@valtoris.test',
      'advisor.b@valtoris.test'
    )
  ) then
    raise exception 'Phase B abort: original emails still present on auth.users';
  end if;

  if exists (
    select 1 from public.profiles
    where email in (
      'owner.dev@valtoris.test',
      'advisor.a@valtoris.test',
      'advisor.b@valtoris.test'
    )
  ) then
    raise exception 'Phase B abort: original emails still present on public.profiles';
  end if;

  if exists (
    select 1 from auth.identities
    where provider_id in (
        'owner.dev@valtoris.test',
        'advisor.a@valtoris.test',
        'advisor.b@valtoris.test'
      )
       or identity_data ->> 'email' in (
        'owner.dev@valtoris.test',
        'advisor.a@valtoris.test',
        'advisor.b@valtoris.test'
      )
  ) then
    raise exception
      'Phase B abort: original emails still present on auth.identities (any provider/user)';
  end if;

  -- Exact archived pairings
  if not exists (
    select 1 from auth.users
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
      and email = 'owner.dev+archived-aaaaaaaaaaa1@valtoris.test'
  ) then
    raise exception 'Phase B abort: auth.users aaa1 archived email mismatch';
  end if;
  if not exists (
    select 1 from auth.users
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
      and email = 'advisor.a+archived-aaaaaaaaaaa2@valtoris.test'
  ) then
    raise exception 'Phase B abort: auth.users aaa2 archived email mismatch';
  end if;
  if not exists (
    select 1 from auth.users
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
      and email = 'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'
  ) then
    raise exception 'Phase B abort: auth.users aaa3 archived email mismatch';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
      and email = 'owner.dev+archived-aaaaaaaaaaa1@valtoris.test'
      and role = 'owner'
      and is_active = true
      and deleted_at is null
  ) then
    raise exception 'Phase B abort: profile aaa1 archived state mismatch';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
      and email = 'advisor.a+archived-aaaaaaaaaaa2@valtoris.test'
      and role = 'advisor'
      and is_active = true
      and deleted_at is null
  ) then
    raise exception 'Phase B abort: profile aaa2 archived state mismatch';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
      and email = 'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'
      and role = 'advisor'
      and is_active = true
      and deleted_at is null
  ) then
    raise exception 'Phase B abort: profile aaa3 archived state mismatch';
  end if;

  select count(*)::int into n
  from auth.users
  where email in (
    'owner.dev+archived-aaaaaaaaaaa1@valtoris.test',
    'advisor.a+archived-aaaaaaaaaaa2@valtoris.test',
    'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'
  );
  if n <> 3 then
    raise exception
      'Phase B abort: archived emails must appear on exactly 3 auth.users rows, found %',
      n;
  end if;

  select count(*)::int into n
  from public.profiles
  where email in (
    'owner.dev+archived-aaaaaaaaaaa1@valtoris.test',
    'advisor.a+archived-aaaaaaaaaaa2@valtoris.test',
    'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'
  );
  if n <> 3 then
    raise exception
      'Phase B abort: archived emails must appear on exactly 3 profiles, found %',
      n;
  end if;

  -- Exclusive archived email ownership (exactly one intended UUID each)
  if (
    select count(*)::int from auth.users
    where email = 'owner.dev+archived-aaaaaaaaaaa1@valtoris.test'
  ) <> 1
  or not exists (
    select 1 from auth.users
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
      and email = 'owner.dev+archived-aaaaaaaaaaa1@valtoris.test'
  ) then
    raise exception
      'Phase B abort: archived auth email owner.dev+archived-aaaaaaaaaaa1@valtoris.test must belong exclusively to aaa1';
  end if;
  if (
    select count(*)::int from auth.users
    where email = 'advisor.a+archived-aaaaaaaaaaa2@valtoris.test'
  ) <> 1
  or not exists (
    select 1 from auth.users
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
      and email = 'advisor.a+archived-aaaaaaaaaaa2@valtoris.test'
  ) then
    raise exception
      'Phase B abort: archived auth email advisor.a+archived-aaaaaaaaaaa2@valtoris.test must belong exclusively to aaa2';
  end if;
  if (
    select count(*)::int from auth.users
    where email = 'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'
  ) <> 1
  or not exists (
    select 1 from auth.users
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
      and email = 'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'
  ) then
    raise exception
      'Phase B abort: archived auth email advisor.b+archived-aaaaaaaaaaa3@valtoris.test must belong exclusively to aaa3';
  end if;

  if (
    select count(*)::int from public.profiles
    where email = 'owner.dev+archived-aaaaaaaaaaa1@valtoris.test'
  ) <> 1
  or not exists (
    select 1 from public.profiles
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
      and email = 'owner.dev+archived-aaaaaaaaaaa1@valtoris.test'
  ) then
    raise exception
      'Phase B abort: archived profile email owner.dev+archived-aaaaaaaaaaa1@valtoris.test must belong exclusively to aaa1';
  end if;
  if (
    select count(*)::int from public.profiles
    where email = 'advisor.a+archived-aaaaaaaaaaa2@valtoris.test'
  ) <> 1
  or not exists (
    select 1 from public.profiles
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
      and email = 'advisor.a+archived-aaaaaaaaaaa2@valtoris.test'
  ) then
    raise exception
      'Phase B abort: archived profile email advisor.a+archived-aaaaaaaaaaa2@valtoris.test must belong exclusively to aaa2';
  end if;
  if (
    select count(*)::int from public.profiles
    where email = 'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'
  ) <> 1
  or not exists (
    select 1 from public.profiles
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
      and email = 'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'
  ) then
    raise exception
      'Phase B abort: archived profile email advisor.b+archived-aaaaaaaaaaa3@valtoris.test must belong exclusively to aaa3';
  end if;

  if exists (
    select 1 from auth.identities
    where provider_id in (
        'owner.dev+archived-aaaaaaaaaaa1@valtoris.test',
        'advisor.a+archived-aaaaaaaaaaa2@valtoris.test',
        'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'
      )
       or identity_data ->> 'email' in (
        'owner.dev+archived-aaaaaaaaaaa1@valtoris.test',
        'advisor.a+archived-aaaaaaaaaaa2@valtoris.test',
        'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'
      )
  ) then
    raise exception
      'Phase B abort: archived emails must not appear on auth.identities (any provider/user)';
  end if;

  -- Placeholder identities remain zero; UUIDs / advisor mappings unchanged
  select count(*)::int into n
  from auth.identities
  where user_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  );
  if n <> 0 then
    raise exception 'Phase B abort: placeholder auth.identities count changed (found %)', n;
  end if;

  if (
    select count(*)::int from public.advisor_profiles
    where (id, user_id, slug) in (
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'dev-owner'),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'advisor-a'),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'advisor-b')
    )
  ) <> 3 then
    raise exception 'Phase B abort: advisor_profiles id/user_id/slug changed unexpectedly';
  end if;

  -- Checkpoint still A_verified / new_id null / mappings intact before advance
  if (
    select count(*)::int from crm_repair._dev_auth_repair_map
    where new_id is null
      and phase = 'A_verified'
      and (
        (email = 'owner.dev@valtoris.test'
          and old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
          and role = 'owner'
          and slug = 'dev-owner'
          and advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1')
        or (email = 'advisor.a@valtoris.test'
          and old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
          and role = 'advisor'
          and slug = 'advisor-a'
          and advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2')
        or (email = 'advisor.b@valtoris.test'
          and old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
          and role = 'advisor'
          and slug = 'advisor-b'
          and advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3')
      )
  ) <> 3 then
    raise exception
      'Phase B abort: checkpoint mappings/new_id/phase drifted before advancement';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Checkpoint advancement (exactly 3 rows)
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
  v_ts timestamptz := now();
begin
  update crm_repair._dev_auth_repair_map m
  set
    phase = 'B_neutralized',
    new_id = null,
    detail = coalesce(m.detail, '{}'::jsonb) || jsonb_build_object(
      'expected_project_ref', 'cxgiaevervjttbuiramd',
      'phase_b_completed_at', v_ts,
      'original_email', m.email,
      'archived_email', case m.email
        when 'owner.dev@valtoris.test' then 'owner.dev+archived-aaaaaaaaaaa1@valtoris.test'
        when 'advisor.a@valtoris.test' then 'advisor.a+archived-aaaaaaaaaaa2@valtoris.test'
        when 'advisor.b@valtoris.test' then 'advisor.b+archived-aaaaaaaaaaa3@valtoris.test'
      end,
      'placeholder_identity_count', 0,
      'phase_b_mode', 'zero_identity_archive_only'
    ),
    updated_at = v_ts
  where m.phase = 'A_verified'
    and m.new_id is null
    and (
      (m.email = 'owner.dev@valtoris.test'
        and m.old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
        and m.role = 'owner'
        and m.slug = 'dev-owner'
        and m.advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1')
      or (m.email = 'advisor.a@valtoris.test'
        and m.old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
        and m.role = 'advisor'
        and m.slug = 'advisor-a'
        and m.advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2')
      or (m.email = 'advisor.b@valtoris.test'
        and m.old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
        and m.role = 'advisor'
        and m.slug = 'advisor-b'
        and m.advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3')
    );

  get diagnostics n = row_count;
  if n <> 3 then
    raise exception
      'Phase B abort: checkpoint advance updated % rows (expected exactly 3)',
      n;
  end if;

  if (
    select count(*)::int from crm_repair._dev_auth_repair_map
    where phase = 'B_neutralized' and new_id is null
  ) <> 3 then
    raise exception
      'Phase B abort: expected 3 rows with phase=B_neutralized and new_id NULL';
  end if;

  -- Checkpoint immutability: only phase/detail/updated_at may change.
  -- email, old_id, new_id (NULL), role, slug, advisor_profile_id must match Phase A.
  if not exists (
    select 1 from crm_repair._dev_auth_repair_map m
    where m.email = 'owner.dev@valtoris.test'
      and m.old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid
      and m.new_id is null
      and m.role = 'owner'::public.user_role
      and m.slug = 'dev-owner'
      and m.advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid
      and m.phase = 'B_neutralized'
  ) then
    raise exception
      'Phase B abort: checkpoint immutability failed for owner.dev (mapping fields must match Phase A; only phase/detail/updated_at may change)';
  end if;

  if not exists (
    select 1 from crm_repair._dev_auth_repair_map m
    where m.email = 'advisor.a@valtoris.test'
      and m.old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid
      and m.new_id is null
      and m.role = 'advisor'::public.user_role
      and m.slug = 'advisor-a'
      and m.advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid
      and m.phase = 'B_neutralized'
  ) then
    raise exception
      'Phase B abort: checkpoint immutability failed for advisor.a (mapping fields must match Phase A; only phase/detail/updated_at may change)';
  end if;

  if not exists (
    select 1 from crm_repair._dev_auth_repair_map m
    where m.email = 'advisor.b@valtoris.test'
      and m.old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid
      and m.new_id is null
      and m.role = 'advisor'::public.user_role
      and m.slug = 'advisor-b'
      and m.advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'::uuid
      and m.phase = 'B_neutralized'
  ) then
    raise exception
      'Phase B abort: checkpoint immutability failed for advisor.b (mapping fields must match Phase A; only phase/detail/updated_at may change)';
  end if;

  if (
    select count(*)::int from crm_repair._dev_auth_repair_map
  ) <> 3 then
    raise exception 'Phase B abort: checkpoint row count changed during advance';
  end if;

  if exists (
    select 1 from crm_repair._dev_auth_repair_map m
    where m.email not in (
      'owner.dev@valtoris.test',
      'advisor.a@valtoris.test',
      'advisor.b@valtoris.test'
    )
      or m.new_id is not null
      or m.phase is distinct from 'B_neutralized'
  ) then
    raise exception
      'Phase B abort: checkpoint immutability failed (unexpected email, non-null new_id, or wrong phase)';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Review outputs
-- ---------------------------------------------------------------------------
select
  'archived_pairings' as src,
  u.id,
  u.email as archived_auth_email,
  p.email as archived_profile_email,
  p.role,
  p.is_active,
  p.deleted_at
from auth.users u
join public.profiles p on p.id = u.id
where u.id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
)
order by u.id;

select
  'checkpoint' as src,
  email,
  old_id,
  new_id,
  role,
  slug,
  advisor_profile_id,
  phase,
  detail,
  updated_at
from crm_repair._dev_auth_repair_map
order by email;

select
  'PHASE_B_REVIEW' as status,
  'cxgiaevervjttbuiramd' as expected_project_ref,
  'default_rollback' as note,
  email,
  old_id,
  new_id,
  phase
from crm_repair._dev_auth_repair_map
order by email;

-- Default: no durable changes until explicitly approved.
-- rollback;
commit;
