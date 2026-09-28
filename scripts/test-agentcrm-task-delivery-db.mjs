// Disposable loopback database only; no provider requests or production writes.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { setupServiceTestDatabase } from './test-service-production-db.mjs'
const f = await setupServiceTestDatabase({ throughMigration: 80 })
let passed = 0
const check = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const location = 'I2Y36c45rBLFZhCQwkDC'
try {
 const lead = async ({ kind = 'report_card', household = f.households.advisor, email = randomUUID() + '@example.invalid' } = {}) => {
  const id = randomUUID()
  await f.db.query('INSERT INTO leads(id,household_id,lead_type,assessment_type,consent_snapshot,normalized_email) VALUES($1,$2,$3,$4,$5,$6)', [id,household,kind === 'report_card' ? 'Family Report Card' : 'Auto Insurance Quote',kind === 'report_card' ? 'family' : null,{contactPermission:true},email])
  return id
 }
 const oldReport = await lead(), oldQuote = await lead({kind:'insurance_quote'})
 await f.db.query("UPDATE insurance_quote_deliveries SET status='synced',contact_id='oldContact',opportunity_id='oldOpportunity' WHERE lead_id=ANY($1::uuid[])",[[oldReport,oldQuote]])
 const baseline = (await f.db.query('SELECT to_jsonb(q) row FROM insurance_quote_deliveries q ORDER BY lead_id')).rows
 await f.db.query(fs.readFileSync('supabase/migrations/081_agentcrm_report_card_task_delivery.sql','utf8'))
 await check('preserves every existing row and delivery status without backfill', async () => {
  assert.deepEqual((await f.db.query("SELECT to_jsonb(q)-'task_id'-'task_create_started' row FROM insurance_quote_deliveries q ORDER BY lead_id")).rows,baseline)
  assert.equal((await f.db.query('SELECT count(*)::int n FROM insurance_quote_deliveries WHERE task_id IS NOT NULL OR task_create_started')).rows[0].n,0)
 })
 const service = await f.session('owner'); await service.query('RESET ROLE'); await service.query('SET ROLE service_role')
 const claim = async (id,kind='report_card') => (await service.query(kind === 'report_card' ? 'SELECT claim_report_card_delivery($1,$2) d' : 'SELECT claim_insurance_quote_delivery($1) d',kind === 'report_card' ? [location,id] : [id])).rows[0].d
 const cp = async (d,patch) => (await service.query('SELECT checkpoint_insurance_quote_delivery($1,$2,$3) ok',[d.lead_id,d.claim_token,patch])).rows[0].ok
 const row = async id => (await f.db.query('SELECT * FROM insurance_quote_deliveries WHERE lead_id=$1',[id])).rows[0]
 const finish = async d => assert.equal(await cp(d,{status:'synced'}),true)
 const ready = async () => {const d=await claim(await lead());assert.ok(d);assert.equal(await cp(d,{contact_id:'contact123',opportunity_id:'opportunity123'}),true);return d}
 await check('records task intent and ID without permitting overwrite or reset',async()=>{
  const d=await ready()
  assert.equal(await cp(d,{task_create_started:true}),true)
  assert.equal(await cp(d,{task_id:'task123'}),true)
  assert.equal(await cp(d,{task_id:'different'}),false)
  assert.equal(await cp(d,{task_create_started:false}),true)
  assert.equal((await row(d.lead_id)).task_create_started,true)
  await finish(d)
 })
 await check('rejects task IDs before intent and before contact/opportunity identity',async()=>{
  const d=await claim(await lead())
  assert.equal(await cp(d,{task_create_started:true}),false)
  assert.equal(await cp(d,{contact_id:'contact123',opportunity_id:'opportunity123'}),true)
  assert.equal(await cp(d,{task_id:'unstarted'}),false)
  await finish(d)
 })
 await check('rejects malformed IDs, boolean strings, nulls and unknown patch fields',async()=>{
  const d=await ready()
  for(const patch of [{task_id:null},{task_id:123},{task_id:'../task'},{task_create_started:'true'},{task_create_started:null},{unknown:true}])await assert.rejects(cp(d,patch),/invalid_patch/)
  await finish(d)
 })
 await check('quote callers retain old checkpoints and cannot write task fields',async()=>{
  const d=await claim(await lead({kind:'insurance_quote'}),'insurance_quote')
  assert.equal(await cp(d,{contact_id:'quoteContact',opportunity_id:'quoteOpportunity',opportunity_create_started:true}),true)
  assert.equal(await cp(d,{task_create_started:true}),false)
  assert.equal(await cp(d,{task_create_started:false}),false)
  await finish(d)
 })
 await check('unresolved task intent cannot be marked synced by an older worker',async()=>{
  const d=await ready()
  assert.equal(await cp(d,{task_create_started:true}),true)
  assert.equal(await cp(d,{status:'synced'}),false)
  assert.equal(await cp(d,{task_id:'reconciledTask',status:'synced'}),true)
 })
 await check('repeat submission may reuse opportunity but gets distinct task identity',async()=>{
  for(const task_id of ['repeatTaskA','repeatTaskB']){
   const d=await ready();assert.equal(await cp(d,{task_create_started:true,task_id}),true);await finish(d)
  }
 })
 await check('same provider task cannot be attached to two submissions',async()=>{
  const d=await ready()
  await assert.rejects(cp(d,{task_create_started:true,task_id:'repeatTaskA'}),/duplicate key/)
  await finish(d)
 })
 await check('uncertain task blocks related work across households and kinds',async()=>{
  const email=randomUUID()+'@example.invalid', d=await claim(await lead({email}))
  assert.equal(await cp(d,{contact_id:'relatedContact',opportunity_id:'relatedOpportunity',task_create_started:true,status:'held'}),true)
  assert.equal(await claim(await lead({email,household:f.households.other,kind:'insurance_quote'}),'insurance_quote'),null)
  await f.db.query("UPDATE insurance_quote_deliveries SET task_id='resolvedRelatedTask',status='synced' WHERE lead_id=$1",[d.lead_id])
 })
 await check('expired leases cannot record task writes',async()=>{
  const d=await ready()
  await f.db.query("UPDATE insurance_quote_deliveries SET claimed_at=now()-interval '6 minutes' WHERE lead_id=$1",[d.lead_id])
  const next=await claim(d.lead_id)
  assert.notEqual(next.claim_token,d.claim_token)
  assert.equal(await cp(d,{task_create_started:true}),false)
  await finish(next)
 })
 await check('withdrawn consent blocks task writes even alongside held status',async()=>{
  const d=await ready()
  await f.db.query("UPDATE leads SET consent_snapshot='{}' WHERE id=$1",[d.lead_id])
  assert.equal(await cp(d,{task_create_started:true,status:'held'}),false)
  assert.equal(await cp(d,{status:'held',last_code:'consent_missing'}),true)
 })
 await check('deleted household blocks task checkpoint without blocking a hold',async()=>{
  const d=await ready()
  await f.db.query('UPDATE households SET deleted_at=now() WHERE id=$1',[f.households.advisor])
  assert.equal(await cp(d,{task_create_started:true}),false)
  assert.equal(await cp(d,{status:'held'}),true)
  await f.db.query('UPDATE households SET deleted_at=NULL WHERE id=$1',[f.households.advisor])
 })
 await check('RLS remains forced and all ordinary roles are denied queue access',async()=>{
  const flags=(await f.db.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='public.insurance_quote_deliveries'::regclass")).rows[0]
  assert.equal(flags.relrowsecurity,true);assert.equal(flags.relforcerowsecurity,true)
  for(const role of ['owner','advisor','other','client','anon']){
   const c=await f.session(role)
   await assert.rejects(c.query('SELECT task_id FROM insurance_quote_deliveries'),/permission denied/)
   await assert.rejects(c.query('SELECT checkpoint_insurance_quote_delivery($1,$2,$3)',[oldReport,randomUUID(),{}]),/permission denied/)
  }
  await assert.rejects(service.query("SELECT claim_agentcrm_delivery('report_card','location',NULL)"),/permission denied/)
 })
 console.log(JSON.stringify({passed,failed:0,productionTouched:false}))
} finally { await f.close() }
