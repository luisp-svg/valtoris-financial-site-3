/** Real PostgreSQL regression test. Loopback-only, fresh disposable database.
 * PGHOST=127.0.0.1 PGPORT=... PGUSER=postgres PGPASSWORD=... node scripts/qa/report-card-concurrency.mjs
 * Uses actual migrations with minimal auth/storage scaffolding, not a Supabase API emulator.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import pg from 'pg'

assert.equal(process.env.PGHOST, '127.0.0.1', 'Only explicit IPv4 loopback is allowed')
assert.ok(process.env.PGPORT, 'Explicit local PostgreSQL port required')
const name = `phase0_concurrency_${randomUUID().replaceAll('-', '')}`
const control = new pg.Client({ database: 'postgres' })
await control.connect()
const clients = []
async function connect(application_name = 'phase0_control') {
  const c = new pg.Client({ database: name, application_name })
  await c.connect()
  clients.push(c)
  return c
}
let created = false
try {
  await control.query(`CREATE DATABASE ${name}`)
  created = true
  const db = await connect()
  // Minimal local substitutes for managed Supabase Auth and Storage schemas.
  await db.query(`
    DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
  `)
  for (const file of readdirSync('supabase/migrations').filter(f => /^\d{3}_.*\.sql$/.test(f) && Number(f.slice(0, 3)) <= 71).sort()) {
    try { await db.query(readFileSync(`supabase/migrations/${file}`, 'utf8')) }
    catch (e) { throw new Error(`Baseline migration ${file}: ${e.message}`) }
  }
  console.log('PASS: migrations 001–071 applied to disposable PostgreSQL database')
  const a = await connect('phase0_a'), b = await connect('phase0_b')
  const types = {family:'Family Report Card',business:'Business Report Card',retirement:'Retirement Report Card',protection:'Protection Gap',student_loan:'Student Loan Report Card',credit:'Credit Report Card',home_buyer:'Home Buyer Report Card'}
  const payload = (overrides={}) => ({idempotency_key:randomUUID(),assessment_type:'family',lead_type:types.family,match_status:'new_prospect',first_name:'Synthetic',last_name:'Concurrency',display_name:'Synthetic Concurrency',normalized_email:`${randomUUID()}@example.invalid`,normalized_phone:`+1555${Math.floor(Math.random()*1e7).toString().padStart(7,'0')}`,answers:{fixture:true},overall_score:50,overall_grade:'F',scoring_version:1,...overrides})
  const call = async (c,p) => (await c.query('SELECT public.ingest_public_report_card($1::jsonb) AS result',[JSON.stringify(p)])).rows[0].result
  const counts = async email => (await db.query(`SELECT
    (SELECT count(*)::int FROM households WHERE normalized_email=$1) AS households,
    (SELECT count(*)::int FROM household_members WHERE normalized_email=$1) AS members,
    (SELECT count(*)::int FROM leads WHERE normalized_email=$1) AS leads,
    (SELECT count(*)::int FROM assessments WHERE lead_id IN (SELECT id FROM leads WHERE normalized_email=$1)) AS assessments`,[email])).rows[0]
  await db.query(`CREATE FUNCTION public.phase0_barrier() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(720072); RETURN NEW; END $$;
    CREATE TRIGGER phase0_barrier BEFORE INSERT ON households FOR EACH ROW EXECUTE FUNCTION public.phase0_barrier();`)
  async function race(p,q) {
    await db.query('SELECT pg_advisory_lock(720072)')
    const pending = [call(a,p).then(value=>({value}),error=>({error})),call(b,q).then(value=>({value}),error=>({error}))]
    try {
      let ready=false
      for(let n=0;n<500;n++) {
        const r=await db.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND application_name IN ('phase0_a','phase0_b') AND wait_event='advisory'")
        if(r.rows[0].n===2){ready=true;break}
        await delay(10)
      }
      assert.ok(ready,'Both transactions must reach the controlled overlap')
    } finally { await db.query('SELECT pg_advisory_unlock(720072)') }
    return Promise.all(pending)
  }
  let p=payload()
  let results=await race(p,p)
  assert.ok(results.every(r=>!r.error))
  assert.deepEqual(await counts(p.normalized_email),{households:2,members:2,leads:1,assessments:1})
  console.log('REPRODUCED: baseline same-UUID race leaves an extra household/member')
  p=payload();results=await race(p,{...p,idempotency_key:randomUUID()})
  assert.ok(results.every(r=>!r.error))
  assert.deepEqual(await counts(p.normalized_email),{households:2,members:2,leads:2,assessments:2})
  console.log('REPRODUCED: baseline distinct-UUID/same-contact race duplicates households')
  const policies = async()=> (await db.query("SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname")).rows
  const grants = async()=> (await db.query("SELECT proacl::text AS grants,prosecdef,proconfig FROM pg_proc WHERE oid='public.ingest_public_report_card(jsonb)'::regprocedure")).rows
  const beforePolicies=await policies(), beforeGrants=await grants()
  const priorDefinition=(await db.query("SELECT pg_get_functiondef('public.ingest_public_report_card(jsonb)'::regprocedure) AS definition")).rows[0].definition
  await db.query(readFileSync('supabase/migrations/072_public_report_card_concurrency.sql','utf8'))
  assert.deepEqual(await policies(),beforePolicies)
  assert.deepEqual(await grants(),beforeGrants)
  console.log('PASS: migration preserves RLS policies and function grants/security settings')
  for(const [type,label] of Object.entries(types)) {
    p=payload({assessment_type:type,lead_type:label})
    results=await race(p,p)
    assert.ok(results.every(r=>!r.error))
    assert.equal(results.filter(r=>r.value.created).length,1)
    assert.equal(results[0].value.household_id,results[1].value.household_id)
    assert.deepEqual(await counts(p.normalized_email),{households:1,members:1,leads:1,assessments:1})
  }
  console.log('PASS: same-UUID race for all seven Report Card types')
  p=payload();const q={...p,idempotency_key:randomUUID(),assessment_type:'business',lead_type:types.business}
  results=await race(p,q)
  const winner=results.find(r=>r.value).value
  const loser=results.find(r=>r.error).error
  assert.equal(loser.code,'40001');assert.match(loser.message,/retry_match/)
  assert.deepEqual(await counts(p.normalized_email),{households:1,members:1,leads:1,assessments:1})
  const retryPayload=results[0].error?p:q
  const retried=await call(a,{...retryPayload,match_status:'exact_trusted_match',matched_household_id:winner.household_id})
  assert.equal(retried.household_id,winner.household_id)
  assert.deepEqual(await counts(p.normalized_email),{households:1,members:1,leads:2,assessments:2})
  console.log('PASS: concurrent assessment types reject stale matching; fresh retry shares household')
  // A partial contact match must retry, never silently attach to the first household.
  p=payload();const saved=await call(a,p)
  const partial={...p,idempotency_key:randomUUID(),normalized_phone:'+15550000001'}
  await assert.rejects(call(b,partial),e=>e.code==='40001')
  await call(b,{...partial,match_status:'possible_match',candidate_household_id:saved.household_id})
  assert.deepEqual(await counts(p.normalized_email),{households:2,members:2,leads:2,assessments:2})
  const reviews=await db.query('SELECT count(*)::int AS n FROM duplicate_reviews WHERE candidate_household_id=$1',[saved.household_id])
  assert.equal(reviews.rows[0].n,1)
  console.log('PASS: partial match retains provisional-household duplicate review')
  await db.query(`CREATE FUNCTION public.phase0_fail_lead() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE unique_violation USING MESSAGE='synthetic downstream failure'; END $$;
    CREATE TRIGGER phase0_fail_lead BEFORE INSERT ON leads FOR EACH ROW EXECUTE FUNCTION public.phase0_fail_lead();`)
  p=payload()
  await assert.rejects(call(a,p),e=>e.code==='23505')
  assert.deepEqual(await counts(p.normalized_email),{households:0,members:0,leads:0,assessments:0})
  await db.query('DROP TRIGGER phase0_fail_lead ON leads')
  console.log('PASS: downstream unique violation rolls back all household/member writes')
  await a.query('SET ROLE anon')
  await assert.rejects(call(a,payload()),e=>e.code==='42501')
  await a.query('RESET ROLE; SET ROLE authenticated')
  await assert.rejects(call(a,payload()),e=>e.code==='42501')
  await a.query('RESET ROLE; SET ROLE service_role')
  await call(a,payload())
  await a.query('RESET ROLE')
  console.log('PASS: anon/advisor roles cannot invoke ingest; service role can')
  const userA=randomUUID(), userB=randomUUID(), advisorA=randomUUID(), advisorB=randomUUID()
  await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2),($3,$4)',[userA,'advisor-a@example.invalid',userB,'advisor-b@example.invalid'])
  await db.query('INSERT INTO advisor_profiles(id,user_id,display_name,slug) VALUES($1,$2,$3,$4),($5,$6,$7,$8)',[advisorA,userA,'Synthetic A','synthetic-a',advisorB,userB,'Synthetic B','synthetic-b'])
  p=payload({advisor_profile_id:advisorA,advisor_slug:'synthetic-a'})
  const original=await call(a,p)
  await call(b,{...p,idempotency_key:randomUUID(),match_status:'exact_trusted_match',matched_household_id:original.household_id,advisor_profile_id:advisorB,advisor_slug:'synthetic-b'})
  const attribution=await db.query('SELECT original_advisor_id,assigned_advisor_id FROM households WHERE id=$1',[original.household_id])
  assert.deepEqual(attribution.rows[0],{original_advisor_id:advisorA,assigned_advisor_id:advisorA})
  for(const [uid,expected] of [[userA,1],[userB,0]]) {
    await a.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid])
    await a.query('SET ROLE authenticated')
    const visible=await a.query('SELECT id FROM households WHERE id=$1',[original.household_id])
    const assessments=await a.query('SELECT id FROM assessments WHERE household_id=$1',[original.household_id])
    assert.equal(visible.rowCount,expected)
    assert.equal(assessments.rowCount,expected*2)
    await a.query('RESET ROLE')
  }
  await a.query("SELECT set_config('request.jwt.claim.sub','',false)")
  console.log('PASS: existing household first-touch/assignment retained; second advisor cannot read household or assessments')
  await db.query(priorDefinition)
  assert.equal((await db.query("SELECT pg_get_functiondef('public.ingest_public_report_card(jsonb)'::regprocedure) AS definition")).rows[0].definition,priorDefinition)
  assert.deepEqual(await grants(),beforeGrants)
  console.log('PASS: restoring the captured prior definition preserves function grants')
  console.log('All concurrency regressions passed; no production database or external integrations used.')
} finally {
  await Promise.allSettled(clients.map(c=>c.end()))
  if(created) await control.query(`DROP DATABASE ${name}`)
  await control.end()
}
