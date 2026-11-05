import { randomUUID } from 'node:crypto'
import { afterAll,beforeAll,beforeEach,afterEach,expect,it,vi } from 'vitest'
import { LocalTacSandbox } from './localSandbox'
import { initializeProductionBookingFixture,bookingFixtureAdmin } from './productionBookingFixture'
import { SupabaseTacBookingStore } from './tacBookingStore'
import { productionBookingHarness,call } from './productionBookingTestHarness'
import { PRIORITIES } from '../../modules/reportCard/combined/engine'
import { _resetRateLimitStateForTests } from '../ingest/familyReportCard/abuse'
let sandbox:LocalTacSandbox,store:SupabaseTacBookingStore
beforeAll(async()=>{sandbox=new LocalTacSandbox();await sandbox.initialize(process.cwd());await initializeProductionBookingFixture(sandbox,process.cwd());store=new SupabaseTacBookingStore(bookingFixtureAdmin(sandbox));helpers=productionBookingHarness(sandbox,store)},30000)
afterAll(async()=>{await sandbox.db.close()})
beforeEach(()=>{vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Real network forbidden in production SQL verification')}));_resetRateLimitStateForTests()})
afterEach(()=>{expect(fetch).not.toHaveBeenCalled();vi.unstubAllGlobals()})
let helpers:ReturnType<typeof productionBookingHarness>
const setup=(...args:Parameters<ReturnType<typeof productionBookingHarness>['setup']>)=>helpers.setup(...args)
it.each(PRIORITIES)('$id uses real booking RPCs and HTTP gate: TAC appointment -> provider -> canonical link -> results',async({id})=>{
 const f=await setup(id)
 expect((await call(f,'report')).status).toBe(423)
 expect((await call(f,'slots')).body.slots).toEqual([f.start])
 const body={submissionId:f.journey.id,startTime:f.start,timezone:'UTC',contactId:'browserCannotChoose',calendarId:'browserCannotChoose'}
 expect((await call(f,'book',body)).status).toBe(200)
 expect((await call(f,'book',body)).status).toBe(200)
 const report=await call(f,'report');expect(report.status).toBe(200);expect(report.body.results).toHaveLength(1)
 const b=(await store.load(f.journey.id))!
 const a=(await sandbox.db.query<{external_agentcrm_event_id:string;agentcrm_sync_status:string}>('SELECT * FROM appointments WHERE id=$1',[b.appointment_id])).rows[0]
 expect(a.external_agentcrm_event_id).toBe(b.external_event_id);expect(a.agentcrm_sync_status).toBe('confirmed')
 expect((await sandbox.db.query('SELECT * FROM integration_contact_links WHERE household_member_id=$1',[b.member_id])).rows).toHaveLength(1)
 expect(f.provider.createContact).toHaveBeenCalledTimes(1);expect(f.provider.createEvent).toHaveBeenCalledTimes(1)
 f.cancel();expect((await call(f,'report')).status).toBe(423)
 expect((await sandbox.db.query<{status:string}>('SELECT status FROM appointments WHERE id=$1',[b.appointment_id])).rows[0].status).toBe('cancelled')
},30000)
it('database and RPC permissions block anon and authenticated booking writes',async()=>{
 const f=await setup()
 for(const role of ['anon','authenticated'])await expect(sandbox.db.transaction(async tx=>{await tx.exec(`SET LOCAL ROLE ${role}`);await tx.query('SELECT tac_reserve_booking($1,$2,$3,$4,$5)',[f.journey.id,'qaLocation','qaCalendar',f.start,'UTC'])})).rejects.toThrow()
 await expect(sandbox.db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE authenticated');await tx.query('SELECT * FROM tac_booking_contacts')})).rejects.toThrow()
})
it.each(PRIORITIES)('$id books during duplicate review and unlocks only its verified results',async({id})=>{
 const f=await setup(id)
 await sandbox.db.query("UPDATE leads SET duplicate_review_status='pending',status='duplicate_review' WHERE public_ingest_idempotency_key=$1",[f.journey.id])
 expect((await call(f,'report')).status).toBe(423)
 const result=await call(f,'book',{submissionId:f.journey.id,startTime:f.start,timezone:'UTC'})
 expect(result.status).toBe(200);expect(result.body.state).toBe('confirmed')
 expect((await call(f,'report')).status).toBe(200)
 expect(f.provider.createEvent).toHaveBeenCalledTimes(1)
 const lead=(await sandbox.db.query<{duplicate_review_status:string;status:string}>("SELECT duplicate_review_status,status FROM leads WHERE public_ingest_idempotency_key=$1",[f.journey.id])).rows[0]
 expect(lead).toMatchObject({duplicate_review_status:'pending',status:'duplicate_review'})
 expect((await call(f,'book',{submissionId:randomUUID(),startTime:f.start,timezone:'UTC'})).status).toBe(401)
 expect((await call(f,'book',{submissionId:f.journey.id,startTime:f.start,timezone:'UTC'},{headers:{host:'localhost:5173',origin:'https://evil.example','content-type':'application/json'}})).status).toBe(403)
})
it('serializes concurrent submissions and never repeats an uncertain provider creation',async()=>{
 const f=await setup()
 await Promise.all(Array.from({length:5},()=>f.service.book(f.journey.id,f.saved.answers,f.start,'UTC')))
 expect(f.provider.createContact).toHaveBeenCalledTimes(1);expect(f.provider.createEvent).toHaveBeenCalledTimes(1)
 const uncertain=await setup('tsp')
 vi.mocked(uncertain.provider.createContact).mockImplementationOnce(async b=>{uncertain.contacts.set(b.email,'acceptedButTimedOut');throw new Error('timeout')})
 await expect(uncertain.service.book(uncertain.journey.id,uncertain.saved.answers,uncertain.start,'UTC')).rejects.toThrow('timeout')
 expect((await uncertain.service.book(uncertain.journey.id,uncertain.saved.answers,uncertain.start,'UTC')).state).toBe('confirmed')
 expect(uncertain.provider.createContact).toHaveBeenCalledTimes(1)
})
it('blocks the legacy delivery queue while booking contact creation is uncertain',async()=>{
 const f=await setup()
 await store.reserve(f.journey.id,'qaLocation','qaCalendar',f.start,'UTC');expect(await store.checkpoint(f.journey.id,'claim_contact')).toBe(true)
 const b=(await store.load(f.journey.id))!
 await expect(sandbox.db.query("INSERT INTO insurance_quote_deliveries(lead_id,status) VALUES($1,'processing')",[b.lead_id])).rejects.toThrow('booking_contact_review_required')
})
it('keeps the combined relaunch out of the legacy export queue and retains legacy health routing',async()=>{
 const f=await setup('health'),b=(await sandbox.db.query<{lead_id:string}>('SELECT lead_id FROM local_submissions WHERE id=$1',[f.journey.id])).rows[0]
 expect((await sandbox.db.query('SELECT * FROM insurance_quote_deliveries WHERE lead_id=$1',[b.lead_id])).rows).toHaveLength(0)
 const legacy=randomUUID();await sandbox.db.query("INSERT INTO leads(id,lead_type,assessment_type,consent_snapshot,raw_payload) VALUES($1,'Health Insurance Report Card','health','{\"contactPermission\":true}','{}')",[legacy])
 expect((await sandbox.db.query('SELECT * FROM insurance_quote_deliveries WHERE lead_id=$1',[legacy])).rows).toHaveLength(1)
})
it('retrieves an existing reservation during an availability outage and retains its original timezone',async()=>{
 const f=await setup('lifestyle')
 await f.service.book(f.journey.id,f.saved.answers,f.start,'UTC')
 vi.mocked(f.provider.slots).mockRejectedValue(new Error('provider availability outage'))
 const slots=await f.service.slots(f.journey.id,f.saved.answers,'2027-01-01','America/Chicago')
 expect(slots.booking).toMatchObject({state:'confirmed',timezone:'UTC'})
 expect(Date.parse(slots.booking!.startTime)).toBe(Date.parse(f.start))
 expect(slots.slots).toEqual([])
 expect((await f.service.book(f.journey.id,f.saved.answers,f.start,'UTC')).state).toBe('confirmed')
 expect(f.provider.createContact).toHaveBeenCalledTimes(1);expect(f.provider.createEvent).toHaveBeenCalledTimes(1)
})
it('checks an existing appointment after its start time without creating a second event',async()=>{
 const f=await setup('lifestyle')
 await f.service.book(f.journey.id,f.saved.answers,f.start,'UTC')
 const spy=vi.spyOn(Date,'now').mockReturnValue(Date.parse(f.start)+60000)
 try{expect((await f.service.book(f.journey.id,f.saved.answers,f.start,'UTC')).state).toBe('confirmed')}
 finally{spy.mockRestore()}
 expect(f.provider.createEvent).toHaveBeenCalledTimes(1)
})

it('books a contact-only conversation through TAC first without inventing report answers or results',async()=>{
 const f=await setup('family',false,true);expect(f.saved.answers.consultationOnly).toBe(true);expect(f.saved.answers.diagnostic).toEqual({});
 expect((await call(f,'report')).status).toBe(423);
 for(let i=0;i<2;i++)expect((await call(f,'book',{submissionId:f.journey.id,startTime:f.start,timezone:'UTC'})).body.state).toBe('confirmed');
 const report=await call(f,'report');expect(report.body.consultationOnly).toBe(true);expect(report.body.results).toEqual([]);
 expect(f.contacts.size).toBe(1);expect(f.events.size).toBe(1);
})

it('reuses an exact booking contact across separate duplicate submissions without merging their records',async()=>{
 const first=await setup('tax'),second=await setup('family')
 await first.service.book(first.journey.id,first.saved.answers,first.start,'UTC')
 const original=(await store.load(first.journey.id))!
 await sandbox.db.query(`UPDATE leads SET normalized_email=$2,normalized_phone=$3,duplicate_review_status='pending',status='duplicate_review'
 WHERE public_ingest_idempotency_key=$1`,[second.journey.id,original.email,original.phone])
 await sandbox.db.query(`UPDATE household_members SET normalized_email=$2,normalized_phone=$3 WHERE household_id=(SELECT household_id FROM leads WHERE public_ingest_idempotency_key=$1)`,[second.journey.id,original.email,original.phone])
 const later=new Date(Date.parse(first.start)+3600000).toISOString()
 await store.reserve(second.journey.id,'qaLocation','qaCalendar',later,'UTC')
 const pending=(await store.load(second.journey.id))!
 expect(pending.contact_key).toBe(original.contact_key)
 expect(pending.assessment_id).not.toBe(original.assessment_id)
 expect(pending.lead_id).not.toBe(original.lead_id)
 expect((await call(second,'report')).status).toBe(423)
 expect((await second.service.book(second.journey.id,second.saved.answers,later,'UTC')).state).toBe('confirmed')
 expect((await call(second,'report')).status).toBe(200)
 expect(second.provider.createContact).not.toHaveBeenCalled()
 expect(second.provider.createEvent).toHaveBeenCalledTimes(1)
 await second.service.book(second.journey.id,second.saved.answers,later,'UTC')
 expect(second.provider.createEvent).toHaveBeenCalledTimes(1)
 await sandbox.db.query('UPDATE assessments SET lead_id=$2 WHERE id=$1',[pending.assessment_id,original.lead_id])
 expect(await store.load(second.journey.id)).toBeNull()
})

it('still blocks conflicting identities and inactive households even when duplicate review is pending',async()=>{
 const first=await setup(),second=await setup()
 await store.reserve(first.journey.id,'qaLocation','qaCalendar',first.start,'UTC')
 const original=(await store.load(first.journey.id))!
 await sandbox.db.query("UPDATE leads SET normalized_email=$2,duplicate_review_status='pending',status='duplicate_review' WHERE public_ingest_idempotency_key=$1",[second.journey.id,original.email])
 await sandbox.db.query('UPDATE household_members SET normalized_email=$2 WHERE household_id=(SELECT household_id FROM leads WHERE public_ingest_idempotency_key=$1)',[second.journey.id,original.email])
 await expect(store.reserve(second.journey.id,'qaLocation','qaCalendar',second.start,'UTC')).rejects.toThrow('booking_identity_review_required')
 expect(await store.load(second.journey.id)).toBeNull()
 const third=await setup()
 await sandbox.db.query("UPDATE households SET deleted_at=now() WHERE id=(SELECT household_id FROM leads WHERE public_ingest_idempotency_key=$1)",[third.journey.id])
 await expect(store.reserve(third.journey.id,'qaLocation','qaCalendar',third.start,'UTC')).rejects.toThrow('booking_identity_review_required')
})

it.each(PRIORITIES)('$id books with verified duplicate provider contacts without creating another contact',async({id})=>{
 const f=await setup(id),exact='bExact'+randomUUID().replace(/-/g,'')
 vi.mocked(f.provider.findContacts).mockResolvedValue(['zExact','aMismatch',exact,exact])
 vi.mocked(f.provider.verifyContact).mockImplementation(async(_booking,contact)=>{if(contact==='aMismatch')throw new Error('booking_identity_review_required')})
 const body={submissionId:f.journey.id,startTime:f.start,timezone:'UTC'}
 expect((await call(f,'book',body)).status).toBe(200)
 expect((await store.load(f.journey.id))?.external_contact_id).toBe(exact)
 expect((await call(f,'report')).status).toBe(200)
 expect((await call(f,'book',body)).status).toBe(200)
 expect(f.provider.createContact).not.toHaveBeenCalled();expect(f.provider.createEvent).toHaveBeenCalledTimes(1)
})
it('does not attach mismatched contacts or turn provider read errors into new contacts',async()=>{
 for(const error of ['booking_identity_review_required','booking_provider_unavailable']){
  const f=await setup()
  vi.mocked(f.provider.findContacts).mockResolvedValue(['candidate'])
  vi.mocked(f.provider.verifyContact).mockRejectedValue(new Error(error))
  await expect(f.service.book(f.journey.id,f.saved.answers,f.start,'UTC')).rejects.toThrow(error)
  expect(f.provider.createContact).not.toHaveBeenCalled();expect(f.provider.createEvent).not.toHaveBeenCalled()
  expect((await call(f,'report')).status).toBe(423)
 }
})
