-- =============================================================================
-- PHASE E — REMOVE MALFORMED AUTH IDENTITIES (exact three UUIDs only)
-- Prerequisites: Phase D COMMITTED; zero public CRM refs to old UUIDs;
--                Admin deleteUser likely unusable (getUserById 500).
-- Defaults to ROLLBACK.
-- Never matches by email broadly — only exact placeholder UUIDs.
-- Does not SELECT/print password hashes or tokens.
-- =============================================================================

begin;

do $$
declare
  n int;
begin
  if (
    select count(*)::int from crm_repair._dev_auth_repair_map
    where phase = 'D_remapped' and new_id is not null
  ) < 3 then
    raise exception 'Phase E abort: Phase D not marked complete on _dev_auth_repair_map';
  end if;

  -- Public profiles for old ids must be gone
  select count(*)::int into n from public.profiles
  where id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  );
  if n <> 0 then
    raise exception 'Phase E abort: old public.profiles rows still exist (%)', n;
  end if;

  -- Operational public refs must be zero
  select count(*)::int into n from public.advisor_profiles
  where user_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  );
  if n <> 0 then raise exception 'Phase E abort: advisor_profiles still reference old ids'; end if;

  select count(*)::int into n from public.notes
  where author_user_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  );
  if n <> 0 then raise exception 'Phase E abort: notes still reference old ids'; end if;

  select count(*)::int into n from public.households
  where assigned_by_user_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  ) or created_by_user_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  );
  if n <> 0 then raise exception 'Phase E abort: households still reference old ids'; end if;
end $$;

-- Report auth.users / identities for the three UUIDs (no secrets)
select 'auth.users' as tbl, id, email, created_at, deleted_at
from auth.users
where id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
)
order by id;

select 'auth.identities' as tbl, user_id, provider, provider_id, created_at
from auth.identities
where user_id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
)
order by user_id;

-- Delete order: optional children → identities → users (exact UUIDs only)
do $$
begin
  -- Best-effort child cleanup; ignore missing tables/columns on older/newer Auth schemas.
  begin
    delete from auth.refresh_tokens
    where user_id in (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
    );
  exception when undefined_table or undefined_column then
    null;
  end;

  begin
    delete from auth.sessions
    where user_id in (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
    );
  exception when undefined_table or undefined_column then
    null;
  end;

  begin
    delete from auth.mfa_factors
    where user_id in (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
    );
  exception when undefined_table or undefined_column then
    null;
  end;
end $$;

delete from auth.identities
where user_id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
);

delete from auth.users
where id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
);

do $$
declare
  n int;
begin
  select count(*)::int into n from auth.users
  where id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  );
  if n <> 0 then
    raise exception 'Phase E abort: auth.users placeholders still present (%)', n;
  end if;
end $$;

update crm_repair._dev_auth_repair_map
set phase = 'E_auth_deleted', updated_at = now()
where old_id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
);

select 'PHASE_E_REVIEW' as status, email, old_id, new_id, phase
from crm_repair._dev_auth_repair_map
order by email;

-- Default: no durable changes until explicitly approved.
-- rollback;
commit;

-- After COMMIT: run phase-z-cleanup-artifacts.sql (default ROLLBACK) to drop
-- crm_repair.assert_ref_count and crm_repair._dev_auth_repair_map.
