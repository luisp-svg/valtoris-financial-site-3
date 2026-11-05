import {afterEach,expect,it,vi} from 'vitest'
import {AgentCrmBookingProvider} from './agentCrmBookingProvider'
import {PREMIUM_CALENDARS} from './booking'
import {combinedFixture} from './testFixtures'
import type {TacBookingRecord} from './tacBookingStore'
const calendar=PREMIUM_CALENDARS[0],location='testLocation'
function fixture(){
 const env={AGENTCRM_PRIVATE_INTEGRATION_TOKEN:'synthetic-token',AGENTCRM_LOCATION_ID:location,VALTORIS_TAC_BOOKING_ENABLED:'true',AGENTCRM_BOOKING_TEST_ONLY:'false',AGENTCRM_BOOKING_PRODUCTION_APPROVED:'true',AGENTCRM_BOOKING_WRITES_ENABLED:'true'}
 const booking={id:'00000000-0000-4000-8000-000000000001',member_id:'00000000-0000-4000-8000-000000000002',submission_id:'00000000-0000-4000-8000-000000000003',email:'qa@example.invalid',phone:'+12025550100',first_name:'Valtoris',last_name:'QA',calendar_id:calendar,location_id:location,starts_at:'2026-11-02T15:00:00Z',ends_at:'2026-11-02T15:30:00Z'} as TacBookingRecord
 const c:Record<string,unknown>={id:'contact1',locationId:location,email:booking.email,phone:booking.phone,firstName:'Valtoris',lastName:'QA',dnd:true,source:`Valtoris TAC Booking ${booking.member_id}`}
 const cal:Record<string,unknown>={id:calendar,locationId:location,googleInvitationEmails:false,slotDuration:30,enableRecurring:false,isLivePaymentMode:false}
 const fetchImpl=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
  const u=new URL(String(url));let data:unknown
  if(u.pathname.endsWith('/free-slots'))data={'2026-11-02':{slots:['2026-11-02T15:00:00Z']}}
  else if(u.pathname==='/calendars/'+calendar)data={calendar:cal}
  else if(u.pathname.endsWith('/notifications'))data=[]
  else if(u.pathname==='/workflows/')data={workflows:[{status:'draft'}]}
  else if(u.pathname==='/contacts/'&&init?.method==='POST')data={contact:c}
  else if(u.pathname==='/contacts/')data={contacts:[],meta:{total:0,nextPage:''}}
  else if(u.pathname==='/contacts/contact1')data={contact:c}
  else if(u.pathname==='/contacts/contact1/appointments')data={events:[]}
  else if(u.pathname==='/calendars/events/appointments')data={id:'event1'}
  else if(u.pathname==='/calendars/events/appointments/event1')data={appointment:{id:'event1',contactId:'contact1',locationId:location,calendarId:calendar,title:`Valtoris TAC ${booking.id}`,startTime:booking.starts_at,endTime:booking.ends_at,appointmentStatus:'confirmed'}}
  else throw new Error('Unexpected request')
  return new Response(JSON.stringify(data),{status:200})
 })
 return {env,booking,c,cal,fetchImpl,provider:new AgentCrmBookingProvider(env,fetchImpl)}
}
afterEach(()=>vi.restoreAllMocks())
it('sends only DND contact creation and a silent booking with server-owned identity',async()=>{
 const f=fixture();f.provider.assertAllowed(f.booking.submission_id,f.booking.email,calendar)
 await f.provider.createContact(f.booking)
 await f.provider.createEvent(f.booking,'contact1')
 expect(await f.provider.verifyEvent(f.booking,'contact1','event1')).toBe('confirmed')
 const posts=f.fetchImpl.mock.calls.filter(([,init])=>init?.method==='POST')
 expect(posts.map(([url])=>new URL(String(url)).pathname)).toEqual(['/contacts/','/calendars/events/appointments'])
 expect(JSON.parse(String(posts[0][1]?.body))).toMatchObject({dnd:true,email:f.booking.email,phone:f.booking.phone})
 expect(JSON.parse(String(posts[0][1]?.body))).not.toHaveProperty('tags')
 expect(JSON.parse(String(posts[1][1]?.body))).toMatchObject({toNotify:false,ignoreDateRange:false,ignoreFreeSlotValidation:false,contactId:'contact1',calendarId:calendar})
})
it.each([{googleInvitationEmails:true},{shouldSendAlertEmailsToAssignedMember:true},{slotDuration:60}])('blocks unsafe real calendar configuration %j',async patch=>{
 const f=fixture();Object.assign(f.cal,patch)
 await expect(f.provider.createEvent(f.booking,'contact1')).rejects.toThrow('booking_calendar_notifications_not_safe')
 expect(f.fetchImpl.mock.calls.every(([,init])=>init?.method==='GET')).toBe(true)
})
it('requires explicit production approval and retains calendar routing',()=>{
 const f=fixture();f.env.AGENTCRM_BOOKING_PRODUCTION_APPROVED='false'
 expect(()=>f.provider.assertAllowed(f.booking.submission_id,f.booking.email,calendar)).toThrow('booking_production_not_approved')
 expect(f.provider.calendar(combinedFixture(['health']))).toBe(PREMIUM_CALENDARS[1])
 expect(f.provider.calendar(combinedFixture(['student_loan']))).toBe(PREMIUM_CALENDARS[2])
 expect(f.provider.calendar(combinedFixture(['family','health']))).toBe(PREMIUM_CALENDARS[0])
})
it('never changes an existing mismatched contact or creates an event for it',async()=>{
 const f=fixture();f.c.email='another@example.invalid'
 await expect(f.provider.createEvent(f.booking,'contact1')).rejects.toThrow('booking_identity_review_required')
 expect(f.fetchImpl.mock.calls.every(([,init])=>init?.method==='GET')).toBe(true)
})
it('checks DND after new contact creation and cannot repeat a disabled write',async()=>{
 const f=fixture();f.c.dnd=false
 await expect(f.provider.createContact(f.booking)).rejects.toThrow('booking_contact_suppression_not_verified')
 f.env.AGENTCRM_BOOKING_WRITES_ENABLED='false'
 await expect(f.provider.createContact(f.booking)).rejects.toThrow('booking_writes_disabled')
 expect(f.fetchImpl.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1)
})
it('coalesces repeated availability reads across request-scoped provider instances',async()=>{
 const f=fixture();vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-10-22T00:00:00Z'))
 const second=new AgentCrmBookingProvider(f.env,f.fetchImpl)
 const values=await Promise.all([f.provider.slots(calendar,'2026-11-02','UTC'),second.slots(calendar,'2026-11-02','UTC')])
 expect(values[0]).toEqual(['2026-11-02T15:00:00Z']);expect(values[1]).toEqual(values[0])
 expect(f.fetchImpl).toHaveBeenCalledTimes(1)
})

it('routes the specialized Health & Disability card to health without rerouting broader or legacy reviews',()=>{
 const f=fixture();const health={...combinedFixture(['health','protection']),strategyVersion:1 as const};
 expect(f.provider.calendar(health)).toBe(PREMIUM_CALENDARS[1]);
 expect(f.provider.calendar({...health,selected:['health','protection','family']})).toBe(PREMIUM_CALENDARS[0]);
 expect(f.provider.calendar(combinedFixture(['health','protection']))).toBe(PREMIUM_CALENDARS[0]);
 const qa=new AgentCrmBookingProvider({...f.env,AGENTCRM_BOOKING_TEST_ONLY:'true',AGENTCRM_LOCATION_ID:'I2Y36c45rBLFZhCQwkDC',AGENTCRM_SILENT_TEST_CALENDAR_ID:'isolatedQaCalendar'},f.fetchImpl);
 expect(qa.calendar(health)).toBe('isolatedQaCalendar');
 expect(f.fetchImpl).not.toHaveBeenCalled();
});

it('accepts an existing email-only contact without changing it',async()=>{
 const f=fixture();delete f.c.phone;delete f.c.firstName;delete f.c.lastName
 await expect(f.provider.verifyContact(f.booking,'contact1')).resolves.toBeUndefined()
 expect(f.fetchImpl.mock.calls.every(([,init])=>init?.method==='GET')).toBe(true)
})
it.each([{email:''},{email:'other@example.invalid'},{phone:'+12025559999'},{firstName:'Other'},{lastName:'Other'},{locationId:'otherLocation'}])('rejects populated conflicting identity %j',async patch=>{
 const f=fixture();Object.assign(f.c,patch)
 await expect(f.provider.verifyContact(f.booking,'contact1')).rejects.toThrow('booking_identity_review_required')
 expect(f.fetchImpl.mock.calls.every(([,init])=>init?.method==='GET')).toBe(true)
})
