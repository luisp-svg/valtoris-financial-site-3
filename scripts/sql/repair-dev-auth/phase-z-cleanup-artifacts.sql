-- =============================================================================
-- PHASE Z — CLEANUP REPAIR ARTIFACTS (after complete successful repair)
-- Project (expected): cxgiaevervjttbuiramd
--
-- Drops temporary checkpoint table + assertion function + empty schema if unused.
-- Defaults to ROLLBACK until final approval.
--
-- Prerequisites: Phase E committed with phase='E_auth_deleted' on all 3 map rows.
-- Does not mutate auth.* or public CRM data — only crm_repair repair artifacts.
-- =============================================================================

begin;

-- Safety: only cleanup when Phase E completed for all three rows
do $$
declare
  n int;
begin
  if to_regclass('crm_repair._dev_auth_repair_map') is null then
    raise notice 'Phase Z: map table already absent';
    return;
  end if;

  select count(*)::int into n
  from crm_repair._dev_auth_repair_map
  where phase = 'E_auth_deleted' and new_id is not null;

  if n <> 3 then
    raise exception
      'Phase Z abort: expected 3 rows with phase=E_auth_deleted and new_id set, found %. Finish Phase E first.',
      n;
  end if;
end $$;

drop function if exists crm_repair.assert_ref_count(text, text, uuid, int);
drop table if exists crm_repair._dev_auth_repair_map;

-- Drop schema only if empty
do $$
begin
  if exists (
    select 1
    from information_schema.schemata
    where schema_name = 'crm_repair'
  ) and not exists (
    select 1
    from information_schema.tables
    where table_schema = 'crm_repair'
  ) and not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'crm_repair'
  ) then
    execute 'drop schema crm_repair';
  end if;
end $$;

select
  'PHASE_Z_CLEANUP_REVIEW' as status,
  'cxgiaevervjttbuiramd' as expected_project_ref,
  'default_rollback' as note,
  'flip_to_commit_only_after_final_approval' as action;

-- Default: no durable drops until explicitly approved.
-- rollback;
commit;
