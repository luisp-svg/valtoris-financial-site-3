-- =============================================================================
-- OPTIONAL (NOT DEFAULT) — rewrite audit_logs.actor_user_id for dry-run continuity
-- Violates append-only audit model. Use only if you explicitly accept history rewrite
-- on valtoris-crm-dev. Prefer the default Phase D path (no actor UPDATE).
-- Defaults to ROLLBACK.
-- =============================================================================

begin;

do $$
begin
  raise notice 'WARNING: mutating audit_logs.actor_user_id violates append-only audit design';
  if (
    select count(*)::int from crm_repair._dev_auth_repair_map where new_id is null
  ) <> 0 then
    raise exception 'Fill _dev_auth_repair_map.new_id first';
  end if;
end $$;

update public.audit_logs a
set actor_user_id = m.new_id
from crm_repair._dev_auth_repair_map m
where a.actor_user_id = m.old_id
  and m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  );

select 'OPTIONAL_AUDIT_REMAP_REVIEW' as status, m.old_id, m.new_id, count(*)::int as remapped_rows
from public.audit_logs a
join crm_repair._dev_auth_repair_map m on a.actor_user_id = m.new_id
group by m.old_id, m.new_id;

rollback;
-- commit;
