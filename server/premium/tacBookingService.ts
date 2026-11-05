import type { CombinedAnswers } from '../../modules/reportCard/combined/engine.js'
import type { BookingProof } from './booking.js'
import type { TacBookingRecord,TacBookingStore } from './tacBookingStore.js'
export interface TacBookingProvider {
 locationId:string
 calendar(answers:CombinedAnswers):string
 assertAllowed(submission:string,email:string,calendar:string):void
 assertSilent(calendar:string):Promise<void>
 slots(calendar:string,day:string,timezone:string):Promise<string[]>
 findContacts(booking:TacBookingRecord):Promise<string[]>
 verifyContact(booking:TacBookingRecord,id:string):Promise<void>
 createContact(booking:TacBookingRecord):Promise<string>
 findEvents(booking:TacBookingRecord,contact:string):Promise<string[]>
 verifyEvent(booking:TacBookingRecord,contact:string,id:string):Promise<'confirmed'|'cancelled'|'held'>
 createEvent(booking:TacBookingRecord,contact:string):Promise<string>
}
export interface TacBookingActions {
 slots(submission:string,answers:CombinedAnswers,day:string,timezone:string):Promise<{slots:string[];booking:{state:string;startTime:string;timezone:string}|null}>
 book(submission:string,answers:CombinedAnswers,start:string,timezone:string):Promise<{state:'confirmed'|'pending';startTime:string}>
 verify(submission:string):Promise<BookingProof|null>
}
function instant(value:string){return typeof value==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))}
export function validBookingTimezone(value:string){try{new Intl.DateTimeFormat('en',{timeZone:value}).format();return value.length<=80}catch{return false}}
export function dateInZone(value:string,zone:string){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))}
export class TacBookingService implements TacBookingActions {
 constructor(private readonly store:TacBookingStore,private readonly provider:TacBookingProvider){}
 async slots(submission:string,answers:CombinedAnswers,day:string,timezone:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T12:00:00Z'))||!validBookingTimezone(timezone))throw new Error('invalid_booking_date')
  const calendar=this.provider.calendar(answers)
  this.provider.assertAllowed(submission,answers.contact.email,calendar)
  const existing=await this.store.load(submission)
  if(existing)return {slots:[],booking:{state:existing.state,startTime:existing.starts_at,timezone:existing.timezone}}
  const slots=await this.provider.slots(calendar,day,timezone)
  return {slots,booking:null}
 }
 async book(submission:string,answers:CombinedAnswers,start:string,timezone:string){
  if(!instant(start)||!validBookingTimezone(timezone))throw new Error('invalid_booking_time')
  const calendar=this.provider.calendar(answers)
  this.provider.assertAllowed(submission,answers.contact.email,calendar)
  let booking=await this.store.load(submission)
  if(booking){
   if(Date.parse(booking.starts_at)!==Date.parse(start)||booking.calendar_id!==calendar||booking.timezone!==timezone)throw new Error('booking_already_reserved')
  }else{
   if(Date.parse(start)<=Date.now())throw new Error('invalid_booking_time')
   // Read availability first. This does not write a provider event or contact.
   const slots=await this.provider.slots(calendar,dateInZone(start,timezone),timezone)
   if(!slots.some(slot=>Date.parse(slot)===Date.parse(start)))throw new Error('booking_slot_unavailable')
   // One transaction creates TAC's pending appointment and durable handoff.
   await this.store.reserve(submission,this.provider.locationId,calendar,start,timezone)
   booking=await this.store.load(submission)
  }
  if(!booking)throw new Error('tac_booking_not_saved')
  await this.provider.assertSilent(booking.calendar_id)
  let contact=booking.external_contact_id
  if(!contact){
   const candidates=await this.provider.findContacts(booking)
   // Duplicate provider contacts do not block booking when one verifies against this submission.
   // Stable ordering makes concurrent attempts choose the same verified contact.
   for(const candidate of [...new Set(candidates)].sort()){
    try{await this.provider.verifyContact(booking,candidate);contact=candidate;break}
    catch(error){if(!(error instanceof Error)||error.message!=='booking_identity_review_required')throw error}
   }
   if(candidates.length&&!contact)throw new Error('booking_identity_review_required')
   if(!contact){
    if(booking.contact_create_started||!await this.store.checkpoint(submission,'claim_contact'))return {state:'pending' as const,startTime:booking.starts_at}
    contact=await this.provider.createContact(booking)
   }
   await this.provider.verifyContact(booking,contact)
   if(!await this.store.checkpoint(submission,'link_contact',contact))throw new Error('booking_contact_link_failed')
  }
  await this.provider.verifyContact(booking,contact)
  booking=(await this.store.load(submission))!
  let event=booking.external_event_id
  if(!event){
   const candidates=await this.provider.findEvents(booking,contact)
   if(candidates.length>1)throw new Error('booking_duplicate_events_review')
   if(candidates.length===1)event=candidates[0]
   else{
    if(booking.create_started||!await this.store.checkpoint(submission,'claim_event'))return {state:'pending' as const,startTime:booking.starts_at}
    await this.provider.assertSilent(booking.calendar_id)
    event=await this.provider.createEvent(booking,contact)
   }
   if(await this.provider.verifyEvent(booking,contact,event)!=='confirmed')throw new Error('booking_confirmation_unavailable')
   if(!await this.store.checkpoint(submission,'link_event',event))throw new Error('booking_event_link_failed')
  }
  const proof=await this.verify(submission)
  return {state:proof?'confirmed' as const:'pending' as const,startTime:booking.starts_at}
 }
 async verify(submission:string):Promise<BookingProof|null>{
  const booking=await this.store.load(submission)
  if(!booking||!booking.external_contact_id||!booking.external_event_id)return null
  this.provider.assertAllowed(submission,booking.email,booking.calendar_id)
  await this.provider.verifyContact(booking,booking.external_contact_id)
  const state=await this.provider.verifyEvent(booking,booking.external_contact_id,booking.external_event_id)
  if(!await this.store.checkpoint(submission,'provider_status',undefined,state))throw new Error('booking_status_sync_failed')
  if(state!=='confirmed')return null
  return {eventId:booking.external_event_id,contactId:booking.external_contact_id,calendarId:booking.calendar_id,startTime:booking.starts_at,verifiedAt:new Date().toISOString()}
 }
}
