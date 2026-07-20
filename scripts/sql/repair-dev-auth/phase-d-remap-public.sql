-- =============================================================================
-- PHASE D — PUBLIC CRM REMAP (single transaction)
-- Prerequisites: Phase B committed, Phase C committed (phase = C_created,
--                new_id filled for all three placeholder old_id rows).
-- Preserves advisor_profiles.id values.
-- Does NOT mutate audit_logs.actor_user_id (append-only audit model).
-- Household/lead/opportunity assignment actor columns are remapped via
-- crm_repair.phase_d_remap_protected_actor_refs() (sets crm.rpc_context
-- briefly; does not disable triggers; does not call assign_household).
-- Defaults to ROLLBACK.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Checkpoint / Auth / schema gates (scoped to the three placeholder old_ids)
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
  v_placeholders uuid[] := array[
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid
  ];
  -- Approved operational FK columns that Phase D remaps.
  -- audit_logs.actor_user_id is intentionally excluded (non-remap exception).
  v_handled text[] := array[
    'advisor_profiles.user_id',
    'notes.author_user_id',
    'profiles.manager_id',
    'app_settings.updated_by_user_id',
    'households.assigned_by_user_id',
    'households.created_by_user_id',
    'duplicate_reviews.resolved_by_user_id',
    'leads.assigned_by_user_id',
    'recommendations.reviewed_by_user_id',
    'recommendations.created_by_user_id',
    'opportunities.assigned_by_user_id',
    'advisor_assignments.assigned_by_user_id',
    'tasks.assigned_user_id',
    'tasks.created_by_user_id',
    'activities.actor_user_id',
    'documents.uploaded_by_user_id',
    'client_portal_accounts.user_id'
  ];
  v_exception text := 'audit_logs.actor_user_id';
  v_drift text;
begin
  -- Exactly three map rows for the three placeholder old_ids
  select count(*)::int into n
  from crm_repair._dev_auth_repair_map m
  where m.old_id = any (v_placeholders);
  if n <> 3 then
    raise exception
      'Phase D abort: expected exactly 3 map rows for placeholder old_ids, found %',
      n;
  end if;

  -- No unexpected old_ids in the map
  if exists (
    select 1
    from crm_repair._dev_auth_repair_map m
    where not (m.old_id = any (v_placeholders))
  ) then
    raise exception 'Phase D abort: map contains unexpected old_id outside the three placeholders';
  end if;

  -- Require C_created + non-null non-placeholder new_id on all three
  select count(*)::int into n
  from crm_repair._dev_auth_repair_map m
  where m.old_id = any (v_placeholders)
    and m.phase = 'C_created'
    and m.new_id is not null
    and not (m.new_id = any (v_placeholders));
  if n <> 3 then
    raise exception
      'Phase D abort: need exactly 3 rows with phase=C_created and non-null non-placeholder new_id, found %',
      n;
  end if;

  -- Exact approved mappings
  if not exists (
    select 1 from crm_repair._dev_auth_repair_map m
    where m.email = 'owner.dev@valtoris.test'
      and m.old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
      and m.role = 'owner'
      and m.slug = 'dev-owner'
      and m.advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
      and m.phase = 'C_created'
      and m.new_id is not null
      and not (m.new_id = any (v_placeholders))
  ) then
    raise exception 'Phase D abort: owner.dev map row mismatch';
  end if;
  if not exists (
    select 1 from crm_repair._dev_auth_repair_map m
    where m.email = 'advisor.a@valtoris.test'
      and m.old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
      and m.role = 'advisor'
      and m.slug = 'advisor-a'
      and m.advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'
      and m.phase = 'C_created'
      and m.new_id is not null
      and not (m.new_id = any (v_placeholders))
  ) then
    raise exception 'Phase D abort: advisor.a map row mismatch';
  end if;
  if not exists (
    select 1 from crm_repair._dev_auth_repair_map m
    where m.email = 'advisor.b@valtoris.test'
      and m.old_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
      and m.role = 'advisor'
      and m.slug = 'advisor-b'
      and m.advisor_profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'
      and m.phase = 'C_created'
      and m.new_id is not null
      and not (m.new_id = any (v_placeholders))
  ) then
    raise exception 'Phase D abort: advisor.b map row mismatch';
  end if;

  -- Uniqueness of old_id, new_id, email across the three rows
  if (
    select count(distinct m.old_id)::int
    from crm_repair._dev_auth_repair_map m
    where m.old_id = any (v_placeholders) and m.phase = 'C_created'
  ) <> 3 then
    raise exception 'Phase D abort: old_id values are not unique across the three map rows';
  end if;
  if (
    select count(distinct m.new_id)::int
    from crm_repair._dev_auth_repair_map m
    where m.old_id = any (v_placeholders) and m.phase = 'C_created'
  ) <> 3 then
    raise exception 'Phase D abort: new_id values are not unique across the three map rows';
  end if;
  if (
    select count(distinct m.email)::int
    from crm_repair._dev_auth_repair_map m
    where m.old_id = any (v_placeholders) and m.phase = 'C_created'
  ) <> 3 then
    raise exception 'Phase D abort: email values are not unique across the three map rows';
  end if;

  -- Each new_id exists in auth.users with matching email
  if (
    select count(*)::int
    from crm_repair._dev_auth_repair_map m
    join auth.users u on u.id = m.new_id and u.email = m.email
    where m.old_id = any (v_placeholders)
      and m.phase = 'C_created'
  ) <> 3 then
    raise exception
      'Phase D abort: each new_id must exist in auth.users with email matching the map row';
  end if;

  -- Before remapping: exactly three public.profiles rows at new_id
  if (
    select count(*)::int
    from crm_repair._dev_auth_repair_map m
    join public.profiles p on p.id = m.new_id
    where m.old_id = any (v_placeholders)
      and m.phase = 'C_created'
  ) <> 3 then
    raise exception
      'Phase D abort: expected exactly 3 public.profiles rows at new_id before remap';
  end if;

  -- Before advisor_profiles update: all three exact relationships
  if (
    select count(*)::int
    from crm_repair._dev_auth_repair_map m
    join public.advisor_profiles ap
      on ap.id = m.advisor_profile_id
     and ap.user_id = m.old_id
    where m.old_id = any (v_placeholders)
      and m.phase = 'C_created'
  ) <> 3 then
    raise exception
      'Phase D abort: expected 3 advisor_profiles with ap.id=advisor_profile_id and ap.user_id=old_id';
  end if;

  -- audit_logs.actor_user_id must be ON DELETE SET NULL before old profile delete
  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class rel on rel.oid = c.conrelid
    join pg_catalog.pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_catalog.pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any (c.conkey)
     and not a.attisdropped
    join pg_catalog.pg_class ref on ref.oid = c.confrelid
    join pg_catalog.pg_namespace refnsp on refnsp.oid = ref.relnamespace
    where c.contype = 'f'
      and nsp.nspname = 'public'
      and rel.relname = 'audit_logs'
      and a.attname = 'actor_user_id'
      and refnsp.nspname = 'public'
      and ref.relname = 'profiles'
      and c.confdeltype = 'n' -- 'n' = SET NULL
  ) then
    raise exception
      'Phase D abort: audit_logs.actor_user_id must reference public.profiles(id) ON DELETE SET NULL';
  end if;

  -- Schema-drift guard: every public FK to public.profiles(id) must be handled or the known exception
  select string_agg(x.col, ', ' order by x.col)
  into v_drift
  from (
    select distinct (rel.relname || '.' || a.attname) as col
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class rel on rel.oid = c.conrelid
    join pg_catalog.pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_catalog.pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any (c.conkey)
     and not a.attisdropped
    join pg_catalog.pg_class ref on ref.oid = c.confrelid
    join pg_catalog.pg_namespace refnsp on refnsp.oid = ref.relnamespace
    where c.contype = 'f'
      and nsp.nspname = 'public'
      and refnsp.nspname = 'public'
      and ref.relname = 'profiles'
      and exists (
        select 1
        from pg_catalog.pg_attribute ra
        where ra.attrelid = c.confrelid
          and ra.attnum = any (c.confkey)
          and not ra.attisdropped
          and ra.attname = 'id'
      )
      and (rel.relname || '.' || a.attname) <> all (v_handled)
      and (rel.relname || '.' || a.attname) is distinct from v_exception
  ) x;

  if v_drift is not null then
    raise exception
      'Phase D abort: unhandled public FK(s) to profiles(id): %. Add remap handling or approve an exception.',
      v_drift;
  end if;
end $$;

-- Ensure new profiles have correct role / email / active
update public.profiles p
set
  email = m.email,
  role = m.role,
  full_name = coalesce(nullif(p.full_name, ''), m.slug),
  is_active = true,
  deleted_at = null,
  updated_at = now()
from crm_repair._dev_auth_repair_map m
where p.id = m.new_id
  and m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
  and m.phase = 'C_created';

-- Preserve advisor_profiles.id — only re-point user_id (exact old relationship required)
update public.advisor_profiles ap
set
  user_id = m.new_id,
  email = m.email,
  slug = m.slug,
  is_active = true,
  deleted_at = null,
  updated_at = now()
from crm_repair._dev_auth_repair_map m
where ap.id = m.advisor_profile_id
  and ap.user_id = m.old_id
  and m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
  and m.phase = 'C_created';

-- RESTRICT first (notes.author_user_id)
update public.notes n
set author_user_id = m.new_id
from crm_repair._dev_auth_repair_map m
where n.author_user_id = m.old_id
  and m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
  and m.phase = 'C_created';

update public.profiles p
set manager_id = m.new_id
from crm_repair._dev_auth_repair_map m
where p.manager_id = m.old_id
  and m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
  and m.phase = 'C_created';

update public.app_settings s
set updated_by_user_id = m.new_id
from crm_repair._dev_auth_repair_map m
where s.updated_by_user_id = m.old_id
  and m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
  and m.phase = 'C_created';

-- audit_logs.actor_user_id intentionally NOT updated (append-only).
-- Append remap documentation rows instead:
insert into public.audit_logs (actor_user_id, action, entity_table, entity_id, before, after)
select
  m.new_id,
  'dev_auth_repair_identity_remap',
  'profiles',
  m.new_id,
  jsonb_build_object('old_profile_id', m.old_id, 'email', m.email),
  jsonb_build_object(
    'new_profile_id', m.new_id,
    'note', 'dry-run placeholder identity repair; historical audit actors left unchanged and will null on old profile delete'
  )
from crm_repair._dev_auth_repair_map m
where m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
  and m.phase = 'C_created';

-- ---------------------------------------------------------------------------
-- Repair-only helper for trigger-guarded actor columns.
-- households.assigned_by_user_id / leads.assigned_by_user_id require
-- crm.rpc_context = 'assign_household' (see enforce_*_protected_columns).
-- public.assign_household() cannot perform identity remap: it requires an
-- authenticated owner, sets assigned_by_user_id = auth.uid(), and mutates
-- assigned_advisor_id / advisor_assignments / leads status.
-- opportunities.assigned_by_user_id requires an assignment-context allowlist;
-- convert_recommendation_to_opportunity is used only as the existing guard
-- bypass token (no conversion RPC is invoked).
-- created_by_user_id is not assignment-protected; remapped here for one path.
-- Does NOT disable triggers. Clears crm.rpc_context before return.
-- ---------------------------------------------------------------------------
create or replace function crm_repair.phase_d_remap_protected_actor_refs()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, crm_repair
as $fn$
declare
  n int;
  v_placeholders uuid[] := array[
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid
  ];
begin
  select count(*)::int into n
  from crm_repair._dev_auth_repair_map m
  where m.old_id = any (v_placeholders)
    and m.phase = 'C_created'
    and m.new_id is not null
    and not (m.new_id = any (v_placeholders));
  if n <> 3 then
    raise exception
      'Phase D repair helper abort: need exactly 3 C_created non-placeholder map rows, found %',
      n;
  end if;

  -- Households + leads: existing assign_household guard token only.
  begin
    perform set_config('crm.rpc_context', 'assign_household', true);

    update public.households h
    set assigned_by_user_id = m.new_id
    from crm_repair._dev_auth_repair_map m
    where h.assigned_by_user_id = m.old_id
      and m.old_id = any (v_placeholders)
      and m.phase = 'C_created'
      and m.new_id is not null
      and not (m.new_id = any (v_placeholders));

    -- Not assignment-protected; still only allow the three map pairs.
    update public.households h
    set created_by_user_id = m.new_id
    from crm_repair._dev_auth_repair_map m
    where h.created_by_user_id = m.old_id
      and m.old_id = any (v_placeholders)
      and m.phase = 'C_created'
      and m.new_id is not null
      and not (m.new_id = any (v_placeholders));

    update public.leads l
    set assigned_by_user_id = m.new_id
    from crm_repair._dev_auth_repair_map m
    where l.assigned_by_user_id = m.old_id
      and m.old_id = any (v_placeholders)
      and m.phase = 'C_created'
      and m.new_id is not null
      and not (m.new_id = any (v_placeholders));

    perform set_config('crm.rpc_context', '', true);
  exception
    when others then
      perform set_config('crm.rpc_context', '', true);
      raise;
  end;

  -- Opportunities: existing convert_recommendation_to_opportunity allowlist
  -- (assign_opportunity also requires crm_is_owner(), which fails when auth.uid() is null).
  begin
    perform set_config(
      'crm.rpc_context',
      'convert_recommendation_to_opportunity',
      true
    );

    update public.opportunities o
    set assigned_by_user_id = m.new_id
    from crm_repair._dev_auth_repair_map m
    where o.assigned_by_user_id = m.old_id
      and m.old_id = any (v_placeholders)
      and m.phase = 'C_created'
      and m.new_id is not null
      and not (m.new_id = any (v_placeholders));

    perform set_config('crm.rpc_context', '', true);
  exception
    when others then
      perform set_config('crm.rpc_context', '', true);
      raise;
  end;
end;
$fn$;

revoke all on function crm_repair.phase_d_remap_protected_actor_refs()
  from public, anon, authenticated;
grant execute on function crm_repair.phase_d_remap_protected_actor_refs()
  to postgres, service_role;

comment on function crm_repair.phase_d_remap_protected_actor_refs() is
  'Phase D only: remaps household/lead/opportunity actor profile FKs for the three checkpoint old_id→new_id pairs using existing crm.rpc_context guard tokens. Does not call assign_household. Clears context on exit.';

select crm_repair.phase_d_remap_protected_actor_refs();

update public.duplicate_reviews d
set resolved_by_user_id = m.new_id
from crm_repair._dev_auth_repair_map m
where d.resolved_by_user_id = m.old_id
  and m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
  and m.phase = 'C_created';

update public.recommendations r
set reviewed_by_user_id = m.new_id
from crm_repair._dev_auth_repair_map m
where r.reviewed_by_user_id = m.old_id
  and m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
  and m.phase = 'C_created';

update public.recommendations r
set created_by_user_id = m.new_id
from crm_repair._dev_auth_repair_map m
where r.created_by_user_id = m.old_id
  and m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
  and m.phase = 'C_created';

update public.advisor_assignments a
set assigned_by_user_id = m.new_id
from crm_repair._dev_auth_repair_map m
where a.assigned_by_user_id = m.old_id
  and m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
  and m.phase = 'C_created';

update public.tasks t
set assigned_user_id = m.new_id
from crm_repair._dev_auth_repair_map m
where t.assigned_user_id = m.old_id
  and m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
  and m.phase = 'C_created';

update public.tasks t
set created_by_user_id = m.new_id
from crm_repair._dev_auth_repair_map m
where t.created_by_user_id = m.old_id
  and m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
  and m.phase = 'C_created';

update public.activities a
set actor_user_id = m.new_id
from crm_repair._dev_auth_repair_map m
where a.actor_user_id = m.old_id
  and m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
  and m.phase = 'C_created';

update public.documents d
set uploaded_by_user_id = m.new_id
from crm_repair._dev_auth_repair_map m
where d.uploaded_by_user_id = m.old_id
  and m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
  and m.phase = 'C_created';

update public.client_portal_accounts c
set user_id = m.new_id
from crm_repair._dev_auth_repair_map m
where c.user_id = m.old_id
  and m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
  and m.phase = 'C_created';

-- ---------------------------------------------------------------------------
-- Deterministic post-update assertions (zero remaining old_id refs per column)
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
  v_placeholders uuid[] := array[
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid
  ];
begin
  select count(*)::int into n from public.advisor_profiles
  where user_id = any (v_placeholders);
  if n <> 0 then
    raise exception 'Phase D abort: advisor_profiles.user_id still on old ids (%)', n;
  end if;

  select count(*)::int into n from public.notes
  where author_user_id = any (v_placeholders);
  if n <> 0 then
    raise exception 'Phase D abort: notes.author_user_id still on old ids (%)', n;
  end if;

  select count(*)::int into n from public.profiles
  where manager_id = any (v_placeholders);
  if n <> 0 then
    raise exception 'Phase D abort: profiles.manager_id still on old ids (%)', n;
  end if;

  select count(*)::int into n from public.app_settings
  where updated_by_user_id = any (v_placeholders);
  if n <> 0 then
    raise exception 'Phase D abort: app_settings.updated_by_user_id still on old ids (%)', n;
  end if;

  select count(*)::int into n from public.households
  where assigned_by_user_id = any (v_placeholders);
  if n <> 0 then
    raise exception 'Phase D abort: households.assigned_by_user_id still on old ids (%)', n;
  end if;

  select count(*)::int into n from public.households
  where created_by_user_id = any (v_placeholders);
  if n <> 0 then
    raise exception 'Phase D abort: households.created_by_user_id still on old ids (%)', n;
  end if;

  select count(*)::int into n from public.duplicate_reviews
  where resolved_by_user_id = any (v_placeholders);
  if n <> 0 then
    raise exception 'Phase D abort: duplicate_reviews.resolved_by_user_id still on old ids (%)', n;
  end if;

  select count(*)::int into n from public.leads
  where assigned_by_user_id = any (v_placeholders);
  if n <> 0 then
    raise exception 'Phase D abort: leads.assigned_by_user_id still on old ids (%)', n;
  end if;

  select count(*)::int into n from public.recommendations
  where reviewed_by_user_id = any (v_placeholders);
  if n <> 0 then
    raise exception 'Phase D abort: recommendations.reviewed_by_user_id still on old ids (%)', n;
  end if;

  select count(*)::int into n from public.recommendations
  where created_by_user_id = any (v_placeholders);
  if n <> 0 then
    raise exception 'Phase D abort: recommendations.created_by_user_id still on old ids (%)', n;
  end if;

  select count(*)::int into n from public.opportunities
  where assigned_by_user_id = any (v_placeholders);
  if n <> 0 then
    raise exception 'Phase D abort: opportunities.assigned_by_user_id still on old ids (%)', n;
  end if;

  select count(*)::int into n from public.advisor_assignments
  where assigned_by_user_id = any (v_placeholders);
  if n <> 0 then
    raise exception 'Phase D abort: advisor_assignments.assigned_by_user_id still on old ids (%)', n;
  end if;

  select count(*)::int into n from public.tasks
  where assigned_user_id = any (v_placeholders);
  if n <> 0 then
    raise exception 'Phase D abort: tasks.assigned_user_id still on old ids (%)', n;
  end if;

  select count(*)::int into n from public.tasks
  where created_by_user_id = any (v_placeholders);
  if n <> 0 then
    raise exception 'Phase D abort: tasks.created_by_user_id still on old ids (%)', n;
  end if;

  select count(*)::int into n from public.activities
  where actor_user_id = any (v_placeholders);
  if n <> 0 then
    raise exception 'Phase D abort: activities.actor_user_id still on old ids (%)', n;
  end if;

  select count(*)::int into n from public.documents
  where uploaded_by_user_id = any (v_placeholders);
  if n <> 0 then
    raise exception 'Phase D abort: documents.uploaded_by_user_id still on old ids (%)', n;
  end if;

  select count(*)::int into n from public.client_portal_accounts
  where user_id = any (v_placeholders);
  if n <> 0 then
    raise exception 'Phase D abort: client_portal_accounts.user_id still on old ids (%)', n;
  end if;

  -- New profiles / advisor_profiles shape
  if (
    select count(*)::int
    from crm_repair._dev_auth_repair_map m
    join public.profiles p on p.id = m.new_id
    where m.old_id = any (v_placeholders)
      and m.phase = 'C_created'
      and p.email = m.email
      and p.role = m.role
      and p.is_active = true
      and p.deleted_at is null
  ) <> 3 then
    raise exception 'Phase D abort: new profiles role/email/active mismatch';
  end if;

  if (
    select count(*)::int
    from crm_repair._dev_auth_repair_map m
    join public.advisor_profiles ap on ap.id = m.advisor_profile_id
    where m.old_id = any (v_placeholders)
      and m.phase = 'C_created'
      and ap.user_id = m.new_id
      and ap.slug = m.slug
      and ap.is_active = true
  ) <> 3 then
    raise exception 'Phase D abort: advisor_profiles id/slug/user_id mismatch after remap';
  end if;
end $$;

-- Hard-delete old placeholder profiles (operational FKs cleared; audit actors SET NULL).
do $$
declare
  n int;
  v_placeholders uuid[] := array[
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid
  ];
begin
  select count(*)::int into n
  from public.profiles p
  where p.id = any (v_placeholders);
  if n <> 3 then
    raise exception
      'Phase D abort: expected exactly 3 old placeholder profiles before delete, found %',
      n;
  end if;
end $$;

delete from public.profiles p
using crm_repair._dev_auth_repair_map m
where p.id = m.old_id
  and m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
  and m.phase = 'C_created';

do $$
declare
  n int;
  v_placeholders uuid[] := array[
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'::uuid
  ];
begin
  select count(*)::int into n
  from public.profiles p
  where p.id = any (v_placeholders);
  if n <> 0 then
    raise exception
      'Phase D abort: old placeholder profiles remain after delete (%)',
      n;
  end if;

  -- After profile delete, audit_logs.actor_user_id for old ids should be NULL (SET NULL)
  select count(*)::int into n
  from public.audit_logs a
  where a.actor_user_id = any (v_placeholders);
  if n <> 0 then
    raise exception
      'Phase D abort: audit_logs still reference deleted old profile ids (%)',
      n;
  end if;
end $$;

-- Advance checkpoint only for the three C_created placeholder rows
do $$
declare
  n int;
begin
  update crm_repair._dev_auth_repair_map m
  set
    phase = 'D_remapped',
    updated_at = now()
  where m.old_id in (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
    )
    and m.phase = 'C_created';

  get diagnostics n = row_count;
  if n <> 3 then
    raise exception
      'Phase D abort: checkpoint advance updated % rows (expected exactly 3 C_created → D_remapped)',
      n;
  end if;

  if (
    select count(*)::int
    from crm_repair._dev_auth_repair_map m
    where m.old_id in (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
      )
      and m.phase = 'D_remapped'
      and m.new_id is not null
  ) <> 3 then
    raise exception 'Phase D abort: expected 3 rows with phase=D_remapped after advance';
  end if;
end $$;

-- Remove repair-only helper so it does not linger after a successful COMMIT.
drop function if exists crm_repair.phase_d_remap_protected_actor_refs();

select
  'PHASE_D_REVIEW' as status,
  m.email,
  m.old_id,
  m.new_id,
  m.phase,
  p.role,
  p.is_active,
  ap.id as advisor_profile_id,
  ap.slug
from crm_repair._dev_auth_repair_map m
join public.profiles p on p.id = m.new_id
join public.advisor_profiles ap on ap.id = m.advisor_profile_id
where m.old_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3'
  )
order by m.email;

-- Default: no durable changes until explicitly approved.
--rollback;
commit;
