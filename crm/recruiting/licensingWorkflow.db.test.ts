import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { RECRUIT_STAGES } from './types'
const db = new PGlite()
const owner = '11111111-1111-4111-8111-111111111111'
const carrier = '22222222-2222-4222-8222-222222222222'
let recruit: string
async function run(action: string, payload: Record<string, unknown>, id: string | null = recruit) {
  const row = id ? (await db.query<{revision:number}>('select revision from recruit_records where id=$1',[id])).rows[0] : null
  return (await db.query<{id:string}>('select recruit_command($1,$2,$3,$4,$5) id',[id,row?.revision ?? null,action,JSON.stringify(payload),'Test change'])).rows[0].id
}
const profile = { npn:'12345678',ssn_last_four:'0123',dob:'1990-01-01',drivers_license_number:'SAMPLE-DL',drivers_license_state:'TX' }
async function move(stage: string) { return run('edit',{full_name:'Workflow test',email:'workflow@example.invalid',stage}) }
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema extensions;
    create function auth.uid() returns uuid language sql as $$select '${owner}'::uuid$$;
    create function extensions.gen_random_uuid() returns uuid language sql as $$select pg_catalog.gen_random_uuid()$$;
    create table profiles(id uuid primary key, role text, email text, is_active boolean, deleted_at timestamptz);
    create table advisor_profiles(id uuid primary key,user_id uuid,is_active boolean,deleted_at timestamptz);
    create table carriers(id uuid primary key,name text,is_active boolean,deleted_at timestamptz);
    create table app_settings(key text primary key,value jsonb);
    create table audit_logs(actor_user_id uuid,action text,entity_table text,entity_id uuid);
    create function crm_is_owner() returns boolean language sql as $$select current_setting('test.manager',true)='yes'$$;
    create function crm_is_advisor() returns boolean language sql as $$select true$$;
    create function crm_advisor_id() returns uuid language sql as $$select null::uuid$$;
    create function pp_assert_object_keys(payload jsonb,allowed text[]) returns void language plpgsql as $$begin if exists(select 1 from jsonb_object_keys(payload) k where not k=any(allowed)) then raise exception 'Unexpected key'; end if; end$$;
    insert into profiles values('${owner}','owner','owner@example.invalid',true,null);
    insert into carriers values('${carrier}','Sample carrier',true,null); set test.manager='yes';`)
  await db.exec(readFileSync('supabase/migrations/079_recruiting_readiness.sql','utf8').replace(/extensions\.citext/g,'text'))
  for (const suffix of ['_agent_licensing_profile.sql','_licensing_workflow_private_profile.sql','_licensing_revoked_contract_code_guard.sql','_licensing_multiple_appointing_organizations.sql','_licensing_driver_state.sql']) {
    const name = readdirSync('supabase/migrations').find(f => f.endsWith(suffix))!
    await db.exec(readFileSync(`supabase/migrations/${name}`,'utf8'))
  }
  recruit = await run('create',{full_name:'Workflow test',email:'workflow@example.invalid'},null)
},30000)
afterAll(() => db.close())
describe('licensing workflow and manager-only identity', () => {
  it('orders all approved workflow stages', () => {
    expect(RECRUIT_STAGES.slice(1,13)).toEqual(['licensing','test_booked','fingerprints','state_fee','pending_state_approval','licensed','contracting','eo','carrier_appointments','ready_to_write','active_agent','paused'])
  })
  it('allows prelicense stages but requires complete information once licensed', async () => {
    for (const stage of ['licensing','test_booked','fingerprints','state_fee','pending_state_approval']) await move(stage)
    await expect(move('licensed')).rejects.toThrow(/Record license number/)
    await expect(run('license_private',{...profile,ssn_last_four:'123456789'})).rejects.toThrow()
    await expect(run('license_private',{...profile,dob:'2999-01-01'})).rejects.toThrow(/future/)
    await expect(run('license_private',{...profile,drivers_license_state:''})).rejects.toThrow(/issuing state/);
    await expect(run('license_private',{...profile,drivers_license_state:'ZZ'})).rejects.toThrow();
    await run('license_private',profile)
    await run('credential',{kind:'license',state:'TX',authority_scope:'life',provider_reference:'TEST-LICENSE',effective_on:'2026-01-01',expires_on:'2028-01-01',status:'reported'})
    await move('licensed')
  })
  it('requires first carrier code and first submitted policy for the respective stages', async () => {
    await expect(move('ready_to_write')).rejects.toThrow(/writing code/)
    const payload = {carrier_id:carrier,state:'TX',authority_scope:'life',contract_status:'pending',appointment_status:'pending',contract_progress:'code_issued'}
    await expect(run('carrier',payload)).rejects.toThrow()
    await run('carrier',{...payload,writing_code:'TEST-CODE'})
    await move('ready_to_write')
    await expect(move('active_agent')).rejects.toThrow(/first submitted policy/)
    await run('license_private',{...profile,first_policy_reference:'TEST-POLICY',first_policy_submitted_on:'2026-01-02'})
    await move('active_agent')
    const rows = await db.query<{after_data:Record<string,unknown>}>('select after_data from recruit_history where recruit_id=$1 and action=$2',[recruit,'license_private'])
    expect(rows.rows.every(row => JSON.stringify(row.after_data)==='{"licensing_identity_updated":true}')).toBe(true)
  })
  it('rejects retained writing codes on revoked contracts for both ready stages', async () => {
    await move('licensed')
    const primary = (await db.query<{id:string}>('select id from recruit_carrier_readiness where recruit_id=$1 and carrier_id=$2',[recruit,carrier])).rows[0]
    const revoked = {id:primary.id,carrier_id:carrier,state:'TX',authority_scope:'life',contract_status:'revoked',appointment_status:'pending',contract_progress:'code_issued',writing_code:'TEST-CODE'}
    await run('carrier',revoked)
    await expect(move('ready_to_write')).rejects.toThrow(/writing code/)
    await expect(move('active_agent')).rejects.toThrow(/writing code/)
    expect((await db.query<{stage:string}>('select stage from recruit_records where id=$1',[recruit])).rows[0].stage).toBe('licensed')
  })
  it('accepts a valid second carrier even when another carrier contract is revoked', async () => {
    const second = '33333333-3333-4333-8333-333333333333'
    await db.query('insert into carriers values($1,$2,true,null)',[second,'Second sample carrier'])
    await run('carrier',{carrier_id:second,state:'TX',authority_scope:'life',contract_status:'pending',appointment_status:'pending',contract_progress:'code_issued',writing_code:'SECOND-VALID-CODE'})
    await move('ready_to_write')
    await move('active_agent')
    expect((await db.query<{stage:string}>('select stage from recruit_records where id=$1',[recruit])).rows[0].stage).toBe('active_agent')
  })
  it('saves multiple appointing organizations and rejects invalid values', async () => {
    const id = await run('create',{full_name:'Multi test',email:'multi@example.invalid',appointing_organizations:['empower','experior']},null)
    expect((await db.query<{appointing_organizations:string[]}>('select appointing_organizations from recruit_records where id=$1',[id])).rows[0].appointing_organizations).toEqual(['empower','experior'])
    await expect(run('edit',{full_name:'Multi test',email:'multi@example.invalid',stage:'recruit',appointing_organizations:['other']},id)).rejects.toThrow(/valid appointing/)
    for (const invalid of ['empower',null,[null],['empower',2]]) await expect(run('edit',{full_name:'Multi test',email:'multi@example.invalid',stage:'recruit',appointing_organizations:invalid},id)).rejects.toThrow(/valid appointing/)
    await run('edit',{full_name:'Multi test',email:'multi@example.invalid',stage:'recruit',appointing_organizations:[]},id)
    expect((await db.query<{appointing_organizations:string[]}>('select appointing_organizations from recruit_records where id=$1',[id])).rows[0].appointing_organizations).toEqual([])
  })
  it('requires an issuing state on legacy identity rows before a new licensed-stage transition', async()=>{
    await db.query('update recruit_license_private set drivers_license_state=null where recruit_id=$1',[recruit])
    await expect(move('licensed')).rejects.toThrow(/driver license state/)
    await run('license_private',{...profile,first_policy_reference:'TEST-POLICY',first_policy_submitted_on:'2026-01-02'})
    await move('licensed')
  })
  it('denies nonmanager API writes and direct identity/license reads', async () => {
    await db.exec(`set test.manager='no'; set role authenticated;`)
    expect((await db.query('select * from recruit_license_private')).rows).toHaveLength(0)
    expect((await db.query("select * from recruit_credentials where kind='license'")).rows).toHaveLength(0)
    await expect(run('license_private',profile)).rejects.toThrow(/management access/)
    await expect(db.exec("update recruit_license_private set npn='2'")).rejects.toThrow(/permission denied/)
    await db.exec('reset role;')
  })
})
