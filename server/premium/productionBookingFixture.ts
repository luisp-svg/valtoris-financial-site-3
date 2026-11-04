/** Local-only fixture: applies the actual production booking draft to PostgreSQL.
 * Parent tables are populated from the existing synthetic assessment harness.
 * Never imported by application API handlers or client code. */
import { readFile } from 'node:fs/promises'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LocalTacSandbox } from './localSandbox.js'
export const BOOKING_MIGRATION='supabase/drafts/20261023035921_tac_first_booking_handoff.sql'
export async function initializeProductionBookingFixture(sandbox:LocalTacSandbox,root:string){
 const db=sandbox.db
 if((await db.query<{name:string|null}>("SELECT to_regclass('public.tac_booking_requests')::text AS name")).rows[0].name){
  const sql=await readFile(root+'/'+BOOKING_MIGRATION,'utf8')
  for(const name of ['tac_reserve_booking','tac_booking_state','tac_booking_checkpoint','guard_tac_booking_contact_delivery','guard_tac_appointment_link']){
   const definition=sql.match(new RegExp('CREATE FUNCTION public\\.'+name+'\\([\\s\\S]*?\\$\\$;'))?.[0]
   if(!definition)throw new Error('Booking fixture function missing')
   await db.exec(definition.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'))
  }
  await db.exec(await readFile(root+'/supabase/migrations/20261104200100_allow_duplicate_review_booking.sql','utf8'))
  return
 }
 await db.exec(`CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA IF NOT EXISTS extensions;
 CREATE FUNCTION extensions.gen_random_uuid() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
 CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=clock_timestamp();RETURN NEW;END $$;
 ALTER TABLE households ADD COLUMN deleted_at timestamptz,ADD COLUMN merged_into_household_id uuid;
 ALTER TABLE household_members ADD COLUMN normalized_email text,ADD COLUMN normalized_phone text,ADD COLUMN deleted_at timestamptz;
 ALTER TABLE assessments ADD COLUMN deleted_at timestamptz;
 CREATE TABLE advisor_profiles(id uuid PRIMARY KEY);
 CREATE TABLE leads(id uuid PRIMARY KEY,household_id uuid REFERENCES households(id),public_ingest_idempotency_key uuid UNIQUE,
 normalized_email text,normalized_phone text,raw_payload jsonb,status text NOT NULL DEFAULT 'unassigned',duplicate_review_status text NOT NULL DEFAULT 'none',
 assigned_advisor_id uuid REFERENCES advisor_profiles(id),deleted_at timestamptz,lead_type text,assessment_type text,consent_snapshot jsonb DEFAULT '{}');
 CREATE TYPE appointment_status AS ENUM('scheduled','completed','cancelled','no_show');`)
 const original=await readFile(root+'/supabase/migrations/008_policies_appointments_reviews.sql','utf8')
 await db.exec(original.slice(original.indexOf('CREATE TABLE IF NOT EXISTS public.appointments'),original.indexOf('-- annual_reviews')))
 await db.exec(`ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
 CREATE POLICY appointments_read ON appointments FOR SELECT TO authenticated USING(crm_can_access_household(household_id));
 GRANT SELECT ON appointments TO authenticated;
 CREATE TABLE insurance_quote_deliveries(lead_id uuid PRIMARY KEY REFERENCES leads(id),status text DEFAULT 'pending',contact_id text,contact_create_started boolean DEFAULT false,claimed_at timestamptz,delivery_kind text,target_location_id text);
 GRANT USAGE ON SCHEMA public,extensions TO service_role;`)
 await db.exec(await readFile(root+'/supabase/migrations/055_integration_contact_links.sql','utf8'))
 await db.exec(await readFile(root+'/'+BOOKING_MIGRATION,'utf8'))
 await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;CREATE TRIGGER insurance_quote_delivery_enqueue AFTER INSERT ON leads FOR EACH ROW EXECUTE FUNCTION enqueue_insurance_quote_delivery()')
 await db.exec(await readFile(root+'/supabase/migrations/20261104200100_allow_duplicate_review_booking.sql','utf8'))
 await refreshProductionBookingParents(sandbox)
}
export async function refreshProductionBookingParents(sandbox:LocalTacSandbox){
 await sandbox.db.exec(`INSERT INTO leads(id,household_id,public_ingest_idempotency_key,normalized_email,normalized_phone,raw_payload,assessment_type)
 SELECT s.lead_id,s.household_id,s.id,c.email,c.phone,jsonb_build_object('firstName',s.payload->>'first_name','lastName',s.payload->>'last_name','tacBookingManaged',true),s.payload->>'assessment_type'
 FROM local_submissions s JOIN local_contacts c ON c.id=s.contact_id ON CONFLICT(id) DO NOTHING;
 UPDATE household_members m SET normalized_email=c.email,normalized_phone=c.phone FROM local_contacts c WHERE c.member_id=m.id;`)
}
export function bookingFixtureAdmin(sandbox:LocalTacSandbox):Pick<SupabaseClient,'rpc'>{
 return {rpc:async(name:string,args:Record<string,unknown>)=>{
  const order:Record<string,string[]>={tac_reserve_booking:['p_submission','p_location','p_calendar','p_start','p_timezone'],tac_booking_state:['p_submission'],tac_booking_checkpoint:['p_submission','p_op','p_external','p_status']}
  if(!order[name])return {data:null,error:{message:'function_not_allowed'}}
  try{
   const data=await sandbox.db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE service_role');const result=await tx.query<{data:unknown}>(`SELECT public.${name}(${order[name].map((_,i)=>'$'+(i+1)).join(',')}) AS data`,order[name].map(key=>args[key]));return result.rows[0].data})
   return {data,error:null}
  }catch(error){return {data:null,error:{message:error instanceof Error?error.message:'fixture_rpc_failed',code:(error as {code?:string}).code}}}
 }} as unknown as Pick<SupabaseClient,'rpc'>
}
