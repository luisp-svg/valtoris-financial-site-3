import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setupServiceTestDatabase } from './test-service-production-db.mjs'
const f = await setupServiceTestDatabase()
let passed = 0
const check = async (name, fn) => { await fn(); passed++; console.log('PASS '+name) }
try {
 const owner=await f.session('owner'), manager=await f.session('advisor'), other=await f.session('other'), client=await f.session('client'), anon=await f.session('anon')
 const counts=async()=> (await f.db.query("SELECT (SELECT count(*) FROM profiles) profiles,(SELECT count(*) FROM households) households,(SELECT count(*) FROM policy_applications) policies")).rows[0]
 const before=await counts()
 await owner.query("UPDATE app_settings SET value=jsonb_build_object('user_ids',jsonb_build_array($1::text)) WHERE key='recruiting_managers'",[f.users.advisor])
 const cmd=async(c,id,rev,action,payload,reason='QA review')=>(await c.query('SELECT recruit_command($1,$2,$3,$4,$5) id',[id,rev,action,payload,reason])).rows[0].id
 const row=async(id)=>(await owner.query('SELECT * FROM recruit_records WHERE id=$1',[id])).rows[0]
 const edit=async(c,id,patch={})=>{const r=await row(id);return cmd(c,id,r.revision,'edit',{full_name:r.full_name,email:r.email,phone:r.phone,assigned_advisor_id:r.assigned_advisor_id,advisor_profile_id:r.advisor_profile_id,stage:r.stage,next_action:r.next_action,next_action_due_on:r.next_action_due_on,is_archived:r.is_archived,...patch})}
 let id
 await check('owner and designated active manager are authorized; other advisor is not',async()=>{
  for(const c of [owner,manager])assert.equal((await c.query('SELECT crm_can_manage_recruiting() allowed')).rows[0].allowed,true)
  assert.equal((await other.query('SELECT crm_can_manage_recruiting() allowed')).rows[0].allowed,false)
 })
 await check('manager creates recruiting record without customer or login creation',async()=>{
  id=await cmd(manager,null,null,'create',{full_name:'QA Recruit',email:'other@service-qa.example.invalid',assigned_advisor_id:f.advisors.other})
  assert.deepEqual(await counts(),before)
 })
 await check('assignment alone grants no management or read access',async()=>{
  assert.equal((await other.query('SELECT id FROM recruit_records')).rowCount,0)
  await assert.rejects(edit(other,id,{stage:'licensing'}),/management access required/)
 })
 await check('client and anonymous denied',async()=>{
  assert.equal((await client.query('SELECT id FROM recruit_records')).rowCount,0)
  await assert.rejects(anon.query('SELECT id FROM recruit_records'))
  await assert.rejects(cmd(client,null,null,'create',{full_name:'No',email:'no@example.invalid'}),/management access/)
 })
 await check('duplicate normalized email rejected',()=>assert.rejects(cmd(owner,null,null,'create',{full_name:'Duplicate',email:' OTHER@service-qa.example.invalid '}),/recruit_email_unique/))
 await check('owner links existing matching identity; self view is read-only',async()=>{
  await edit(owner,id,{advisor_profile_id:f.advisors.other})
  assert.equal((await other.query('SELECT id FROM recruit_records WHERE id=$1',[id])).rowCount,1)
  assert.equal((await other.query('SELECT id FROM recruit_history WHERE recruit_id=$1',[id])).rowCount,0)
  await assert.rejects(other.query("UPDATE recruit_records SET stage='active_agent' WHERE id=$1",[id]))
 })
 await check('wrong identity cannot be linked',()=>assert.rejects(edit(owner,id,{advisor_profile_id:f.advisors.advisor}),/email must match/))
 await check('manager cannot alter delegation setting or become owner',async()=>{
  assert.equal((await manager.query("UPDATE app_settings SET value='{}' WHERE key='recruiting_managers' RETURNING key")).rowCount,0)
  await assert.rejects(manager.query("UPDATE profiles SET role='owner' WHERE id=$1",[f.users.advisor]))
 })
 await check('stale revision rejected',async()=>{
  const r=await row(id);await edit(manager,id,{next_action:'Call recruit'})
  await assert.rejects(cmd(manager,id,r.revision,'edit',{}),/Refresh before saving/)
 })
 await check('simultaneous edits cannot overwrite each other',async()=>{
  const r=await row(id)
  const payload={full_name:r.full_name,email:r.email,phone:r.phone,assigned_advisor_id:r.assigned_advisor_id,advisor_profile_id:r.advisor_profile_id,stage:r.stage,next_action:'Concurrent follow-up',next_action_due_on:null,is_archived:false}
  const results=await Promise.allSettled([cmd(owner,id,r.revision,'edit',payload),cmd(manager,id,r.revision,'edit',payload)])
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1)
  assert.equal(results.filter(x=>x.status==='rejected' && /Refresh before saving/.test(x.reason.message)).length,1)
 })
 await check('disabled linked advisor cannot read onboarding records',async()=>{
  await f.db.query('UPDATE advisor_profiles SET is_active=false WHERE id=$1',[f.advisors.other])
  assert.equal((await other.query('SELECT id FROM recruit_records WHERE id=$1',[id])).rowCount,0)
  await f.db.query('UPDATE advisor_profiles SET is_active=true WHERE id=$1',[f.advisors.other])
 })
 await check('deleted login and inactive manager advisor profile lose management',async()=>{
  await f.db.query('UPDATE profiles SET deleted_at=now() WHERE id=$1',[f.users.advisor])
  await assert.rejects(edit(manager,id),/management access/)
  await f.db.query('UPDATE profiles SET deleted_at=null WHERE id=$1',[f.users.advisor])
  await f.db.query('UPDATE advisor_profiles SET is_active=false WHERE id=$1',[f.advisors.advisor])
  await assert.rejects(edit(manager,id),/management access/)
  await f.db.query('UPDATE advisor_profiles SET is_active=true WHERE id=$1',[f.advisors.advisor])
 })
 await check('ready stage denied without verified supporting scope',()=>assert.rejects(edit(manager,id,{stage:'ready_to_write'}),/Current verified license/))
 const carrier=randomUUID()
 await f.db.query("INSERT INTO carriers(id,code,name,code_normalized,name_normalized) VALUES($1,'recruit-qa','QA Carrier','recruit-qa','qa carrier')",[carrier])
 const license={kind:'license',state:'TX',authority_scope:'life',provider_reference:'QA license',effective_on:'2020-01-01',expires_on:'2099-12-31',no_expiration:false,status:'verified',evidence_reference:'QA state record'}
 const eo={kind:'eo',state:null,authority_scope:null,provider_reference:'QA E&O',effective_on:'2020-01-01',expires_on:'2099-12-31',no_expiration:false,status:'verified',evidence_reference:'QA E&O record'}
 const credential=async(p)=>cmd(manager,id,(await row(id)).revision,'credential',p)
 await check('verified credentials require evidence and state',async()=>{
  await assert.rejects(credential({...license,evidence_reference:null}),/check/)
  await assert.rejects(credential({...license,state:null}),/check/)
 })
 await credential(license);await credential(eo)
 let cid
 const review={carrier_id:carrier,state:'TX',authority_scope:'life',contract_status:'verified',contract_effective_on:'2020-01-01',contract_expires_on:'2099-12-31',contract_no_expiration:false,contract_evidence:'QA contract',appointment_status:'verified',appointment_effective_on:'2020-01-01',appointment_expires_on:'2099-12-31',appointment_no_expiration:false,appointment_evidence:'QA appointment',review_now:true}
 const carrierSave=async(p)=>cmd(manager,id,(await row(id)).revision,'carrier',p)
 const ready=async()=> (await manager.query('SELECT recruit_readiness($1) r',[id])).rows[0].r[0]?.ready
 await check('reviewed current license, E&O, contract and appointment allow readiness',async()=>{
  await carrierSave(review);cid=(await owner.query('SELECT id FROM recruit_carrier_readiness WHERE recruit_id=$1',[id])).rows[0].id
  assert.equal(await ready(),true);await edit(manager,id,{stage:'ready_to_write'});await edit(manager,id,{stage:'active_agent'})
 })
 await check('evidence change invalidates carrier review and revocation fails readiness',async()=>{
  const lic=(await owner.query("SELECT id FROM recruit_credentials WHERE recruit_id=$1 AND kind='license'",[id])).rows[0].id
  await credential({...license,id:lic,status:'revoked'});assert.equal(await ready(),false)
  await credential({...license,id:lic});assert.equal(await ready(),false)
  await carrierSave({...review,id:cid});assert.equal(await ready(),true)
 })
 await check('expiration and scope mismatch fail current readiness',async()=>{
  await carrierSave({...review,id:cid,appointment_effective_on:'2020-01-01',appointment_expires_on:'2020-02-01'});assert.equal(await ready(),false)
  await carrierSave({...review,id:cid,state:'FL'});assert.equal(await ready(),false)
  await carrierSave({...review,id:cid});assert.equal(await ready(),true)
 })
 await check('child ID from another recruit cannot be overwritten',async()=>{
  const second=await cmd(owner,null,null,'create',{full_name:'Second',email:'second@example.invalid'})
  await assert.rejects(cmd(owner,second,(await row(second)).revision,'carrier',{...review,id:cid}),/not available/)
 })
 await check('direct writes and history tampering denied',async()=>{
  await assert.rejects(manager.query('DELETE FROM recruit_history WHERE recruit_id=$1',[id]))
  await assert.rejects(owner.query("UPDATE recruit_credentials SET status='revoked' WHERE recruit_id=$1",[id]))
 })
 await check('disabled manager and revoked designation lose authority',async()=>{
  await f.db.query('UPDATE profiles SET is_active=false WHERE id=$1',[f.users.advisor])
  assert.equal((await manager.query('SELECT id FROM recruit_records')).rowCount,0)
  await assert.rejects(edit(manager,id),/management access/)
  await f.db.query('UPDATE profiles SET is_active=true WHERE id=$1',[f.users.advisor])
  await owner.query("UPDATE app_settings SET value='{}' WHERE key='recruiting_managers'")
  await assert.rejects(edit(manager,id),/management access/)
 })
 await check('archive hides self-view without deleting evidence',async()=>{
  await edit(owner,id,{is_archived:true})
  assert.equal((await other.query('SELECT id FROM recruit_records WHERE id=$1',[id])).rowCount,0)
  assert.equal((await owner.query('SELECT id FROM recruit_credentials WHERE recruit_id=$1',[id])).rowCount,2)
 })
 await check('archived ready-stage record can be restored without requalifying the recorded stage',async()=>{
  await edit(owner,id,{is_archived:false});assert.equal((await row(id)).stage,'active_agent')
  assert.equal((await other.query('SELECT id FROM recruit_records WHERE id=$1',[id])).rowCount,1)
 })
 await check('existing accounts, households and policies remain unchanged',async()=>assert.deepEqual(await counts(),before))
 console.log(JSON.stringify({passed,failed:0,productionTouched:false}))
} finally { await f.close() }
