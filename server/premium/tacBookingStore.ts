import type { SupabaseClient } from '@supabase/supabase-js'
export type TacBookingRecord = {
 id:string;submission_id:string;lead_id:string;assessment_id:string;contact_key:string;appointment_id:string;
 location_id:string;member_id:string;email:string;phone:string|null;first_name:string;last_name:string;
 calendar_id:string;starts_at:string;ends_at:string;timezone:string;create_started:boolean;
 contact_create_started:boolean;external_contact_id:string|null;external_event_id:string|null;
 state:'pending'|'confirmed'|'cancelled'|'held';created_at:string;
}
export interface TacBookingStore {
 load(submission:string):Promise<TacBookingRecord|null>
 reserve(submission:string,location:string,calendar:string,start:string,timezone:string):Promise<void>
 checkpoint(submission:string,op:'claim_contact'|'claim_event'|'reject_event'|'reschedule'|'link_contact'|'link_event'|'provider_status',external?:string,status?:string):Promise<boolean>
}
export class SupabaseTacBookingStore implements TacBookingStore {
 constructor(private readonly admin:Pick<SupabaseClient,'rpc'>){}
 private async rpc(name:string,args:Record<string,unknown>){
  const result=await this.admin.rpc(name,args)
  if(result.error){
   if(name==='tac_reserve_booking'&&result.error.code==='P0001'&&result.error.message==='identity_review_required')throw new Error('booking_identity_review_required')
   throw new Error('tac_booking_database_unavailable')
  }
  return result.data
 }
 async load(submission:string){return await this.rpc('tac_booking_state',{p_submission:submission}) as TacBookingRecord|null}
 async reserve(submission:string,location:string,calendar:string,start:string,timezone:string){
  await this.rpc('tac_reserve_booking',{p_submission:submission,p_location:location,p_calendar:calendar,p_start:start,p_timezone:timezone})
 }
 async checkpoint(submission:string,op:Parameters<TacBookingStore['checkpoint']>[1],external?:string,status?:string){
  return await this.rpc('tac_booking_checkpoint',{p_submission:submission,p_op:op,p_external:external??null,p_status:status??null})===true
 }
}
