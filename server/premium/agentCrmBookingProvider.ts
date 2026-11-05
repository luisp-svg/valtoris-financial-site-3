import { readAgentCrmConfig } from '../agentcrm/config.js'
import { normalizeEmail,normalizePhone } from '../../crm/households/normalizeContact.js'
import { SilentTestBookingClient } from '../agentcrm/silentTestBookingClient.js'
import { PREMIUM_CALENDARS } from './booking.js'
import { dateInZone,type TacBookingProvider } from './tacBookingService.js'
import type { TacBookingRecord } from './tacBookingStore.js'
import type { CombinedAnswers } from '../../modules/reportCard/combined/engine.js'
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const availabilityCache=new Map<string,{expires:number;slots:Promise<string[]>}>()
const id=(v:unknown)=>{if(typeof v!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(v))throw new Error('booking_invalid_provider_id');return v}
const qa=(b:TacBookingRecord)=>({requestId:b.id,submissionId:b.submission_id,contactKey:b.member_id,email:b.email,calendarId:b.calendar_id,startTime:new Date(b.starts_at).toISOString(),endTime:new Date(b.ends_at).toISOString()})
/** The only provider writes here are contact creation and appointment creation.
 * No contact updates, tags, owner assignments, tasks, workflows or messages. */
export class AgentCrmBookingProvider implements TacBookingProvider {
 readonly locationId:string
 private readonly token:string
 private readonly testOnly:boolean
 private readonly qaCalendar:string
 private readonly silent:SilentTestBookingClient|null
 constructor(private readonly env:NodeJS.ProcessEnv=process.env,private readonly fetchImpl:typeof fetch=fetch){
  const config=readAgentCrmConfig({...env,AGENTCRM_PRIVATE_INTEGRATION_TOKEN:env.AGENTCRM_BOOKING_PRIVATE_INTEGRATION_TOKEN||env.AGENTCRM_PRIVATE_INTEGRATION_TOKEN})
  if(!config.configured)throw new Error('booking_connection_unconfigured')
  this.locationId=config.locationId;this.token=config.token
  this.testOnly=env.AGENTCRM_BOOKING_TEST_ONLY!=='false'
  this.qaCalendar=env.AGENTCRM_SILENT_TEST_CALENDAR_ID||''
  this.silent=this.testOnly?new SilentTestBookingClient({token:this.token,locationId:this.locationId,calendarId:this.qaCalendar,allowTestWrites:env.AGENTCRM_BOOKING_WRITES_ENABLED==='true'},fetchImpl):null
 }
 calendar(answers:CombinedAnswers){
  if(this.testOnly)return this.qaCalendar
  const focusedHealth=answers.selected.includes('health')&&answers.selected.every(type=>type==='health'||(answers.strategyVersion===1&&type==='protection'))
  return focusedHealth?PREMIUM_CALENDARS[1]:answers.selected.length===1&&answers.selected[0]==='student_loan'?PREMIUM_CALENDARS[2]:PREMIUM_CALENDARS[0]
 }
 assertAllowed(submission:string,email:string,calendar:string){
  if(this.env.VALTORIS_TAC_BOOKING_ENABLED!=='true')throw new Error('tac_booking_disabled')
  if(this.testOnly){
   const allowed=(this.env.AGENTCRM_BOOKING_TEST_SUBMISSIONS||'').split(',').map(s=>s.trim())
   if(!allowed.includes(submission)||!/^[a-z0-9][a-z0-9._+-]*@example\.invalid$/.test(email)||calendar!==this.qaCalendar)throw new Error('booking_test_scope_required')
  }else if(this.env.AGENTCRM_BOOKING_PRODUCTION_APPROVED!=='true'||!PREMIUM_CALENDARS.includes(calendar as typeof PREMIUM_CALENDARS[number]))throw new Error('booking_production_not_approved')
 }
 private async request(method:'GET'|'POST',path:string,body?:Record<string,unknown>,version='2021-07-28'):Promise<unknown>{
  const allowed=method==='POST'?['/contacts/','/calendars/events/appointments'].includes(path):
   /^\/calendars\/[\w-]+(?:\/free-slots\?.*|\/notifications)?$/.test(path)||path.startsWith('/workflows/?locationId=')||path.startsWith('/contacts/?')||/^\/contacts\/[\w-]+(?:\/appointments)?$/.test(path)||/^\/calendars\/events\/appointments\/[\w-]+$/.test(path)
  if(!allowed)throw new Error('booking_endpoint_forbidden')
  if(method==='POST'&&this.env.AGENTCRM_BOOKING_WRITES_ENABLED!=='true')throw new Error('booking_writes_disabled')
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000)
  try{
   const response=await this.fetchImpl('https://services.leadconnectorhq.com'+path,{method,redirect:'error',signal:controller.signal,
    headers:{Authorization:`Bearer ${this.token}`,Version:version,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
   if(!response.ok)throw new Error(`booking_provider_http_${response.status}`)
   return await response.json()
  }catch(error){if(error instanceof Error&&/^booking_/.test(error.message))throw error;throw new Error('booking_provider_unavailable')}finally{clearTimeout(timer)}
 }
 async assertSilent(calendar:string){
  if(this.silent){await this.silent.assertSilentCalendar(calendar);return}
  if(!PREMIUM_CALENDARS.includes(calendar as typeof PREMIUM_CALENDARS[number]))throw new Error('booking_calendar_forbidden')
  const data=record(record(await this.request('GET',`/calendars/${id(calendar)}`)).calendar)
  if(data.locationId!==this.locationId||data.id!==calendar||data.googleInvitationEmails!==false||data.shouldSendAlertEmailsToAssignedMember===true||data.alertEmail||data.isLivePaymentMode===true||data.enableRecurring===true||Number(data.slotDuration)!==30)throw new Error('booking_calendar_notifications_not_safe')
  const rules=await this.request('GET',`/calendars/${calendar}/notifications`)
  if(!Array.isArray(rules)||rules.some(n=>{const r=record(n);return r.deleted!==true&&r.isActive!==false&&r.channel!=='inApp'}))throw new Error('booking_notifications_not_safe')
  const flows=record(await this.request('GET',`/workflows/?locationId=${encodeURIComponent(this.locationId)}`))
  if(!Array.isArray(flows.workflows)||flows.workflows.some(w=>record(w).status!=='draft')||record(flows.meta).nextPageUrl)throw new Error('booking_workflows_not_safe')
 }
 async slots(calendar:string,day:string,timezone:string){
  id(calendar)
  const key=[this.locationId,calendar,day,timezone].join('|'),cached=availabilityCache.get(key)
  if(cached&&cached.expires>Date.now())return (await cached.slots).filter(slot=>Date.parse(slot)>Date.now())
  const entry={expires:Date.now()+10000,slots:this.readSlots(calendar,day,timezone)}
  if(availabilityCache.size>128)availabilityCache.delete(availabilityCache.keys().next().value!)
  availabilityCache.set(key,entry)
  try{return [...await entry.slots]}catch(error){if(availabilityCache.get(key)===entry)availabilityCache.delete(key);throw error}
 }
 private async readSlots(calendar:string,day:string,timezone:string){
  // A 72-hour range safely covers one local day across UTC offsets and DST.
  const from=Date.parse(day+'T00:00:00Z')-14*3600000,to=from+72*3600000
  if(!Number.isFinite(from)||from>Date.now()+90*86400000||to<Date.now())return []
  const data=record(await this.request('GET',`/calendars/${calendar}/free-slots?${new URLSearchParams({startDate:String(from),endDate:String(to),timezone})}`))
  const slots=Object.values(data).flatMap(v=>Array.isArray(record(v).slots)?record(v).slots as unknown[]:[])
  return [...new Set(slots.filter((slot):slot is string=>typeof slot==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(slot)&&Number.isFinite(Date.parse(slot))&&Date.parse(slot)>Date.now()&&dateInZone(slot,timezone)===day))].sort((a,b)=>Date.parse(a)-Date.parse(b)).slice(0,96)
 }
 async findContacts(b:TacBookingRecord){
  this.assertAllowed(b.submission_id,b.email,b.calendar_id)
  if(this.silent)return this.silent.findContacts(qa(b))
  const matches=new Set<string>()
  for(const query of [b.email,...(b.phone?[b.phone]:[])]){
   const data=record(await this.request('GET',`/contacts/?${new URLSearchParams({locationId:this.locationId,query,limit:'100'})}`)),meta=record(data.meta)
   const rows=data.contacts,total=data.count??meta.total
   if(!Array.isArray(rows)||typeof total!=='number'||total!==rows.length||total>=100||(meta.nextPage!==undefined&&meta.nextPage!==null&&meta.nextPage!==''))throw new Error('booking_identity_search_incomplete')
   for(const raw of rows){const c=record(raw);if(normalizeEmail(String(c.email||''))===b.email||(b.phone&&normalizePhone(String(c.phone||''))===b.phone))matches.add(id(c.id))}
  }
  return [...matches]
 }
 async verifyContact(b:TacBookingRecord,contact:string){
  this.assertAllowed(b.submission_id,b.email,b.calendar_id)
  if(this.silent){await this.silent.verifyContact(qa(b),contact);return}
  const c=record(record(await this.request('GET',`/contacts/${id(contact)}`)).contact)
  if(c.id!==contact||c.locationId!==this.locationId||normalizeEmail(String(c.email||''))!==b.email||normalizePhone(String(c.phone||''))!==b.phone||String(c.firstName||'').trim().toLowerCase()!==b.first_name.trim().toLowerCase()||String(c.lastName||'').trim().toLowerCase()!==b.last_name.trim().toLowerCase())throw new Error('booking_identity_review_required')
 }
 async createContact(b:TacBookingRecord){
  this.assertAllowed(b.submission_id,b.email,b.calendar_id)
  if(this.silent)return this.silent.createContact(qa(b))
  await this.assertSilent(b.calendar_id)
  const data=record(await this.request('POST','/contacts/',{locationId:this.locationId,firstName:b.first_name,lastName:b.last_name,email:b.email,...(b.phone?{phone:b.phone}:{}),source:`Valtoris TAC Booking ${b.member_id}`,dnd:true}))
  const contactId=id(record(data.contact).id)
  const saved=record(record(await this.request('GET',`/contacts/${contactId}`)).contact)
  if(saved.dnd!==true||saved.source!==`Valtoris TAC Booking ${b.member_id}`)throw new Error('booking_contact_suppression_not_verified')
  return contactId
 }
 async findEvents(b:TacBookingRecord,contact:string){
  this.assertAllowed(b.submission_id,b.email,b.calendar_id)
  if(this.silent)return this.silent.findEvents(qa(b),contact)
  const data=record(await this.request('GET',`/contacts/${id(contact)}/appointments`))
  if(!Array.isArray(data.events)||record(data.meta).nextPageUrl)throw new Error('booking_event_search_incomplete')
  return data.events.filter(e=>record(e).title===`Valtoris TAC ${b.id}`).map(e=>id(record(e).id))
 }
 async verifyEvent(b:TacBookingRecord,contact:string,eventId:string):Promise<'confirmed'|'cancelled'|'held'>{
  this.assertAllowed(b.submission_id,b.email,b.calendar_id)
  const raw=record(await this.request('GET',`/calendars/events/appointments/${id(eventId)}`,undefined,'2021-04-15')),e=record(raw.appointment||raw.event||raw)
  if(e.id!==eventId||e.locationId!==this.locationId||e.contactId!==contact||e.calendarId!==b.calendar_id||e.title!==(this.testOnly?`TAC QA ${b.id}`:`Valtoris TAC ${b.id}`)||Date.parse(String(e.startTime))!==Date.parse(b.starts_at)||Date.parse(String(e.endTime))!==Date.parse(b.ends_at))throw new Error('booking_event_verification_failed')
  if(this.testOnly&&(e.assignedUserId||(Array.isArray(e.guests)&&e.guests.length)))throw new Error('booking_test_event_not_isolated')
  const status=String(e.appointmentStatus??e.status)
  if(['cancelled','canceled','invalid','noshow'].includes(status))return 'cancelled'
  return ['new','confirmed','booked','showed'].includes(status)?'confirmed':'held'
 }
 async createEvent(b:TacBookingRecord,contact:string){
  this.assertAllowed(b.submission_id,b.email,b.calendar_id)
  if(this.silent){const value=await this.silent.createEvent(qa(b),contact);this.removeCachedSlot(b);return value}
  await this.assertSilent(b.calendar_id);await this.verifyContact(b,contact)
  const data=record(await this.request('POST','/calendars/events/appointments',{calendarId:b.calendar_id,locationId:this.locationId,contactId:contact,title:`Valtoris TAC ${b.id}`,description:'Consultation recorded in TAC. Detailed intake remains in TAC.',startTime:new Date(b.starts_at).toISOString(),endTime:new Date(b.ends_at).toISOString(),appointmentStatus:'confirmed',toNotify:false,ignoreDateRange:false,ignoreFreeSlotValidation:false},'2021-04-15'))
  const value=id(record(data.event||data.appointment||data).id);this.removeCachedSlot(b);return value
 }
 private removeCachedSlot(b:TacBookingRecord){
  for(const [key,entry] of availabilityCache)if(key.startsWith(this.locationId+'|'+b.calendar_id+'|'))entry.slots=entry.slots.then(values=>values.filter(value=>Date.parse(value)!==Date.parse(b.starts_at)))
 }
}
