import assert from 'node:assert/strict'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { setupServiceTestDatabase } from './test-service-production-db.mjs'
const f=await setupServiceTestDatabase({throughMigration:79})
let passed=0
const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name)}
try {
 const oldQuote=randomUUID(),oldReport=randomUUID()
 await f.db.query("INSERT INTO leads(id,household_id,lead_type,assessment_type,consent_snapshot) VALUES($1,$3,'Auto Insurance Quote',NULL,'{\"contactPermission\":true}'),($2,$3,'Family Report Card','family','{\"contactPermission\":true}')",[oldQuote,oldReport,f.households.advisor])
 await f.db.query("UPDATE insurance_quote_deliveries SET status='synced',contact_id='oldContact',opportunity_id='oldOpportunity',contact_create_started=true,opportunity_create_started=true,attempt_count=3 WHERE lead_id=$1",[oldQuote])
 const baseline=(await f.db.query('SELECT to_jsonb(q) row FROM insurance_quote_deliveries q WHERE lead_id=$1',[oldQuote])).rows[0].row
 await f.db.query(fs.readFileSync('supabase/migrations/080_agentcrm_shared_delivery.sql','utf8'))
 await check('migration preserves existing quote state and does not enqueue historical reports',async()=>{
  const current=(await f.db.query("SELECT to_jsonb(q)-'delivery_kind'-'target_location_id'-'tag_write_started'-'tag_applied' row FROM insurance_quote_deliveries q WHERE lead_id=$1",[oldQuote])).rows[0].row
  assert.deepEqual(current,baseline)
  assert.equal((await f.db.query('SELECT * FROM insurance_quote_deliveries WHERE lead_id=$1',[oldReport])).rowCount,0)
 })
 const service=await f.session('owner');await service.query('RESET ROLE');await service.query('SET ROLE service_role')
 const service2=await f.session('owner');await service2.query('RESET ROLE');await service2.query('SET ROLE service_role')
 const location='I2Y36c45rBLFZhCQwkDC'
 const lead=async({kind='family',consent=true,household=f.households.advisor,email=randomUUID()+'@example.invalid',phone=null}={})=>{
  const id=randomUUID();await f.db.query('INSERT INTO leads(id,household_id,lead_type,assessment_type,consent_snapshot,normalized_email,normalized_phone) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,household,kind==='quote'?'Auto Insurance Quote':'QA Report Card',kind==='quote'?null:kind,{contactPermission:consent},email,phone]);return id
 }
 const queue=async id=>(await f.db.query('SELECT * FROM insurance_quote_deliveries WHERE lead_id=$1',[id])).rows[0]
 const claim=async(id,kind='report_card',client=service,target=location)=>(await client.query(kind==='report_card'?'SELECT claim_report_card_delivery($1,$2) d':'SELECT claim_insurance_quote_delivery($1) d',kind==='report_card'?[target,id]:[id])).rows[0].d
 const checkpoint=async(d,patch,client=service)=>(await client.query('SELECT checkpoint_insurance_quote_delivery($1,$2,$3) ok',[d.lead_id,d.claim_token,patch])).rows[0].ok
 const finish=async d=>assert.equal(await checkpoint(d,{status:'synced'}),true)
 await check('all seven consented Report Cards enqueue without creating customers or logins',async()=>{
  for(const kind of ['family','business','retirement','protection','student_loan','credit','home_buyer']){const id=await lead({kind});assert.equal((await queue(id)).delivery_kind,'report_card')}
  assert.equal((await f.db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n,4)
 })
 await check('missing, false and string consent never enqueue',async()=>{
  for(const consent of [null,false,'true'])assert.equal(await queue(await lead({consent})),undefined)
 })
 await check('quote delivery keeps its existing kind and destination',async()=>{
  const id=await lead({kind:'quote'});const row=await queue(id);assert.equal(row.delivery_kind,'insurance_quote');assert.equal(row.target_location_id,location)
 })
 await check('ordinary users including owners cannot read or mutate the queue or invoke claims',async()=>{
  for(const role of ['owner','advisor','other','client','anon']){
   const c=await f.session(role)
   await assert.rejects(c.query('SELECT * FROM insurance_quote_deliveries'),/permission denied/)
   await assert.rejects(c.query("SELECT claim_report_card_delivery('location',NULL)"),/permission denied/)
   await assert.rejects(c.query('SELECT claim_insurance_quote_delivery(NULL)'),/permission denied/)
  }
 })
 await check('internal dispatcher is not callable even by service role',()=>assert.rejects(service.query("SELECT claim_agentcrm_delivery('report_card','location',NULL)"),/permission denied/))
 await check('quote wrapper cannot claim a Report Card and vice versa',async()=>{
  const report=await lead(),quote=await lead({kind:'quote'})
  assert.equal(await claim(report,'insurance_quote'),null);assert.equal(await claim(quote),null)
 })
 await check('simultaneous quote and Report Card claims admit one global worker',async()=>{
  const report=await lead(),quote=await lead({kind:'quote',household:f.households.other})
  const jobs=await Promise.all([claim(report),claim(quote,'insurance_quote',service2)])
  assert.equal(jobs.filter(Boolean).length,1);await finish(jobs.find(Boolean))
 })
 await check('live lease prevents another kind from claiming and stale tokens cannot checkpoint',async()=>{
  const id=await lead(),d=await claim(id),other=await lead({kind:'quote'})
  assert.equal(await claim(other,'insurance_quote'),null)
  await f.db.query("UPDATE insurance_quote_deliveries SET claimed_at=now()-interval '6 minutes' WHERE lead_id=$1",[id])
  const replacement=await claim(id);assert.notEqual(replacement.claim_token,d.claim_token)
  assert.equal(await checkpoint(d,{status:'synced'}),false);await finish(replacement)
 })
 await check('last 15 seconds of a lease cannot initiate another network operation',async()=>{
  const id=await lead(),d=await claim(id)
  await f.db.query("UPDATE insurance_quote_deliveries SET claimed_at=now()-interval '4 minutes 50 seconds' WHERE lead_id=$1",[id])
  assert.equal(await checkpoint(d,{contact_create_started:true}),false)
  await f.db.query("UPDATE insurance_quote_deliveries SET status='held' WHERE lead_id=$1",[id])
 })
 await check('returned contact IDs and attempt flags cannot be overwritten or reset',async()=>{
  const d=await claim(await lead());assert.equal(await checkpoint(d,{contact_create_started:true,contact_id:'known123'}),true)
  assert.equal(await checkpoint(d,{contact_id:'different123'}),false)
  assert.equal(await checkpoint(d,{contact_create_started:false}),true);assert.equal((await queue(d.lead_id)).contact_create_started,true)
  await assert.rejects(checkpoint(d,{unexpected:'data'}),/invalid_patch/)
  await assert.rejects(checkpoint(d,{status:null}),/invalid_patch/)
  await finish(d)
 })
 await check('uncertain outcome blocks later work for the same household across kinds',async()=>{
  const household=f.households.advisor,id=await lead({household}),d=await claim(id)
  await checkpoint(d,{contact_create_started:true,status:'held'})
  assert.equal(await claim(await lead({kind:'quote',household}),'insurance_quote'),null)
  await f.db.query("UPDATE insurance_quote_deliveries SET status='synced' WHERE lead_id=$1",[id])
 })
 await check('same identity across different households cannot create after an uncertain outcome',async()=>{
  const email='same-person@example.invalid',d=await claim(await lead({email}))
  await checkpoint(d,{contact_create_started:true,status:'held'})
  assert.equal(await claim(await lead({kind:'quote',email,household:f.households.other}),'insurance_quote'),null)
  await f.db.query("UPDATE insurance_quote_deliveries SET status='synced' WHERE lead_id=$1",[d.lead_id])
 })
 await check('a changed provider location holds work instead of redirecting it',async()=>{
  const id=await lead(),d=await claim(id)
  await checkpoint(d,{status:'pending'})
  await f.db.query("UPDATE insurance_quote_deliveries SET next_attempt_at=now() WHERE lead_id=$1",[id])
  assert.equal(await claim(id,'report_card',service,'differentLocation'),null)
  assert.equal((await queue(id)).last_code,'location_changed')
 })
 await check('withdrawn consent blocks an in-flight write but allows a held outcome',async()=>{
  const d=await claim(await lead())
  await f.db.query("UPDATE leads SET consent_snapshot='{}' WHERE id=$1",[d.lead_id])
  assert.equal(await checkpoint(d,{contact_create_started:true}),false)
  assert.equal(await checkpoint(d,{status:'held',last_code:'consent_missing'}),true)
 })
 await check('a merged household blocks an in-flight write',async()=>{
  await f.db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[f.users.owner])
  const d=await claim(await lead())
  await f.db.query('UPDATE households SET merged_into_household_id=$1 WHERE id=$2',[f.households.other,f.households.advisor])
  assert.equal(await checkpoint(d,{tag_write_started:true}),false)
  assert.equal(await checkpoint(d,{status:'held',last_code:'household_unavailable'}),true)
  await f.db.query('UPDATE households SET merged_into_household_id=NULL WHERE id=$1',[f.households.advisor])
 })
 await check('deleted leads cannot be claimed',async()=>{
  const id=await lead();await f.db.query('UPDATE leads SET deleted_at=now() WHERE id=$1',[id]);assert.equal(await claim(id),null)
 })
 console.log(JSON.stringify({passed,failed:0,productionTouched:false}))
} finally {await f.close()}
