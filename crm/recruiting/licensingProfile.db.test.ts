import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'

const db = new PGlite()
const userId = '11111111-1111-4111-8111-111111111111'
async function command(id: string | null, revision: number | null, action: string, payload: Record<string, unknown>) {
  const result = await db.query<{ id: string }>('select public.recruit_command($1,$2,$3,$4,$5) as id', [id, revision, action, JSON.stringify(payload), 'Isolated test'])
  return result.rows[0].id
}
let count = 0
const create = (extra: Record<string, unknown> = {}) => command(null, null, 'create', { full_name: 'Test agent', email: `agent${count++}@example.invalid`, ...extra })
async function record(id: string) { return (await db.query<Record<string, unknown>>('select * from recruit_records where id=$1', [id])).rows[0] }
async function edit(id: string, patch: Record<string, unknown>) {
  const row = await record(id)
  return command(id, row.revision as number, 'edit', { full_name: row.full_name, email: row.email, stage: row.stage, is_archived: false, ...patch })
}
beforeAll(async () => {
  const original = readFileSync('supabase/migrations/079_recruiting_readiness.sql', 'utf8')
  const recordDDL = original.slice(original.indexOf('CREATE TABLE public.recruit_records'), original.indexOf('CREATE UNIQUE INDEX recruit_email_unique')).replace('extensions.citext', 'text')
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema extensions;
    create function auth.uid() returns uuid language sql as $$ select '${userId}'::uuid $$;
    create function extensions.gen_random_uuid() returns uuid language sql as $$ select pg_catalog.gen_random_uuid() $$;
    create table profiles(id uuid primary key, role text, is_active boolean, deleted_at timestamptz, email text);
    create table advisor_profiles(id uuid primary key, user_id uuid, is_active boolean, deleted_at timestamptz);
    insert into profiles values ('${userId}','owner',true,null,'owner@example.invalid');
    ${recordDDL}
    create table recruit_history(id serial, recruit_id uuid, actor_id uuid, action text, reason text, before_data jsonb, after_data jsonb);
    create table audit_logs(actor_user_id uuid,action text,entity_table text,entity_id uuid);
    create table recruit_carrier_readiness(id uuid,recruit_id uuid);
    create function recruit_scope_ready(uuid) returns boolean language sql as $$select false$$;
    create function crm_can_manage_recruiting() returns boolean language sql as $$select current_setting('test.manager',true)='yes'$$;
    create function pp_assert_object_keys(payload jsonb, allowed text[]) returns void language plpgsql as $$begin if exists(select 1 from jsonb_object_keys(payload) k where not k=any(allowed)) then raise exception 'Unexpected key'; end if; end$$;
    set test.manager='yes';
  `)
  const migration = readdirSync('supabase/migrations').find(f => f.endsWith('_agent_licensing_profile.sql'))!
  await db.exec(readFileSync(`supabase/migrations/${migration}`, 'utf8'))
}, 30000)
afterAll(() => db.close())

describe('agent license profile persistence', () => {
  it('saves multiple types, organization, and exact contract level on create', async () => {
    const id = await create({ license_types: ['life_health', 'property_casualty'], appointing_organization: 'empower', contract_level: '  Level A  ' })
    expect(await record(id)).toMatchObject({ license_types: ['life_health', 'property_casualty'], appointing_organization: 'empower', contract_level: 'Level A', stage: 'recruit' })
    const history = await db.query<{after_data: Record<string, unknown>}>('select after_data from recruit_history where recruit_id=$1', [id])
    expect(history.rows[0].after_data.contract_level).toBe('Level A')
  })
  it('edits, preserves omitted fields from older clients, and supports clearing', async () => {
    const id = await create({ license_types: ['life_only'], appointing_organization: 'empower', contract_level: 'Original' })
    await edit(id, { appointing_organization: 'experior', contract_level: 'Revised' })
    expect(await record(id)).toMatchObject({ license_types: ['life_only'], appointing_organization: 'experior', contract_level: 'Revised' })
    await edit(id, { next_action: 'Follow up' })
    expect(await record(id)).toMatchObject({ license_types: ['life_only'], appointing_organization: 'experior', contract_level: 'Revised' })
    await edit(id, { license_types: [], appointing_organization: '', contract_level: '' })
    expect(await record(id)).toMatchObject({ license_types: [], appointing_organization: null, contract_level: null })
  })
  it('keeps license and contract details separate between agents', async () => {
    const first = await create({ license_types: ['life_only'], appointing_organization: 'empower', contract_level: 'First' })
    const second = await create({ license_types: ['property_casualty'], appointing_organization: 'experior', contract_level: 'Second' })
    await edit(first, { contract_level: 'First revised' })
    expect(await record(second)).toMatchObject({ license_types: ['property_casualty'], appointing_organization: 'experior', contract_level: 'Second' })
  })
  it('leaves unknown profile details unspecified', async () => {
    expect(await record(await create())).toMatchObject({ license_types: [], appointing_organization: null, contract_level: null })
  })
  it('rejects invalid types, organizations, oversized levels, and non-array license types', async () => {
    for (const payload of [{ license_types: ['unrecognized'] }, { license_types: [null] }, { license_types: 'life_only' }, { appointing_organization: 'unknown' }, { contract_level: 'x'.repeat(121) }]) {
      await expect(create(payload)).rejects.toThrow()
    }
  })
  it('retains manager authorization and stale revision protection', async () => {
    const id = await create()
    await edit(id, { contract_level: 'Updated' })
    await expect(command(id, 1, 'edit', {})).rejects.toThrow('Refresh before saving')
    await db.exec("set test.manager='no'")
    try { await expect(create({ appointing_organization: 'empower' })).rejects.toThrow('management access required') }
    finally { await db.exec("set test.manager='yes'") }
  })
})
