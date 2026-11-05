import { coverageReview } from '../../modules/reportCard/specialtyPreview/coverageReview.js'
/** Local-only persistence adapter. Imported by the localhost preview/test runner only.
 * Does not read remote credentials, make network calls or implement outbound messaging.
 * Parent tables below are sandbox integration fixtures, not a Supabase replacement.
 */
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { validateCombined, restoreStoredCombined, projectDiagnostic, type CombinedAnswers } from '../../modules/reportCard/combined/engine.js'
import { ingestPublicReportCard } from '../ingest/familyReportCard/ingestFamilyReportCard.js'
import { verifiedBookingEvent, PREMIUM_CALENDARS } from './booking.js'
import { deliverReportCardFollowUp } from '../agentcrm/reportCardFollowUp.js'
import type { SavedAssessment, PremiumDeps } from './http.js'
const OWNER='10000000-0000-4000-8000-000000000001'
const uuid=()=>randomUUID()
const externalId=()=>uuid().replace(/-/g,'')
export class LocalTacSandbox {
 readonly db:PGlite
 constructor(dataDir?:string){this.db=new PGlite(dataDir)}
 async initialize(root:string){
  const found=await this.db.query<{name:string|null}>("SELECT to_regclass('public.local_sandbox_version')::text AS name")
  if(found.rows[0].name){await this.initializeBookingLedger();return}
  await this.db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
   GRANT USAGE ON SCHEMA auth TO authenticated;
   CREATE TABLE profiles(id uuid PRIMARY KEY,full_name text,role text);
   INSERT INTO profiles VALUES('${OWNER}','Local QA Owner','owner');
   CREATE TABLE households(id uuid PRIMARY KEY,display_name text,assigned uuid);
   CREATE TABLE household_members(id uuid PRIMARY KEY,household_id uuid REFERENCES households(id),first_name text,last_name text);
   CREATE TABLE opportunities(id uuid PRIMARY KEY,household_id uuid REFERENCES households(id),title text,submission_id uuid UNIQUE);
   CREATE TABLE assessments(id uuid PRIMARY KEY,household_id uuid REFERENCES households(id),lead_id uuid,assessment_type text,answers jsonb,derived_metrics jsonb,completed_at timestamptz,updated_at timestamptz);
   CREATE TABLE policy_applications(id uuid PRIMARY KEY,household_id uuid REFERENCES households(id),deleted_at timestamptz);
   CREATE TABLE local_contacts(id text PRIMARY KEY,email text UNIQUE NOT NULL CHECK(email LIKE '%@example.invalid'),phone text UNIQUE,household_id uuid REFERENCES households(id),member_id uuid REFERENCES household_members(id));
   CREATE TABLE local_submissions(id uuid PRIMARY KEY,lead_id uuid UNIQUE NOT NULL,contact_id text REFERENCES local_contacts(id),household_id uuid REFERENCES households(id),member_id uuid REFERENCES household_members(id),assessment_id uuid REFERENCES assessments(id),payload jsonb NOT NULL);
   CREATE TABLE local_bookings(id text PRIMARY KEY,contact_id text REFERENCES local_contacts(id),event jsonb NOT NULL);
   CREATE TABLE local_opportunities(id text PRIMARY KEY,submission_id uuid UNIQUE,body jsonb NOT NULL);
   CREATE TABLE local_tasks(id text PRIMARY KEY,submission_id uuid UNIQUE,contact_id text,body jsonb NOT NULL);
   CREATE TABLE local_delivery(submission_id uuid PRIMARY KEY,checkpoint jsonb NOT NULL);
   CREATE FUNCTION crm_is_owner() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='${OWNER}'::uuid $$;
   CREATE FUNCTION crm_can_access_household(h uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT crm_is_owner() OR EXISTS(SELECT 1 FROM households WHERE id=h AND assigned=auth.uid()) $$;
   CREATE FUNCTION crm_can_access_opportunity(o uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT crm_is_owner() $$;
   GRANT SELECT ON profiles,households,opportunities,assessments,policy_applications TO authenticated;
   ALTER TABLE policy_applications ENABLE ROW LEVEL SECURITY;
   CREATE POLICY app_read ON policy_applications FOR SELECT TO authenticated USING(crm_can_access_household(household_id));`)
  await this.db.exec(await readFile(root+'/supabase/drafts/20261023014516_tac_relaunch_operations.sql','utf8'))
  await this.initializeBookingLedger()
  await this.db.exec("CREATE TABLE local_sandbox_version(version integer PRIMARY KEY); INSERT INTO local_sandbox_version VALUES(1)")
 }
 async initializeBookingLedger(){
  await this.db.exec(`CREATE TABLE IF NOT EXISTS local_tac_booking_requests (
   assessment_id uuid PRIMARY KEY REFERENCES local_submissions(id),
   contact_id text NOT NULL REFERENCES local_contacts(id),
   request_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
   status text NOT NULL CHECK(status IN ('pending','confirmed','cancelled')),
   external_event_id text UNIQUE, starts_at timestamptz NOT NULL,
   created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE local_bookings ADD COLUMN IF NOT EXISTS tac_request_id uuid REFERENCES local_tac_booking_requests(request_id);
  DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='local_booking_requires_tac') THEN
   ALTER TABLE local_bookings ADD CONSTRAINT local_booking_requires_tac CHECK(tac_request_id IS NOT NULL) NOT VALID;
  END IF; END $$;`)
 }
 async seedContact(answers:CombinedAnswers){
  const email=answers.contact.email.trim().toLowerCase()
  if(!email.endsWith('@example.invalid'))throw new Error('Local sandbox accepts example.invalid test contacts only.')
  return this.db.transaction(async tx=>{
   const found=await tx.query<{id:string;phone:string;household_id:string;member_id:string}>('SELECT * FROM local_contacts WHERE email=$1',[email]);if(found.rows[0]){if(found.rows[0].phone!==answers.contact.phone)throw new Error('Local test identity conflict');return found.rows[0]}
   const house=uuid(),member=uuid(),id=externalId(),names=answers.contact.fullName.trim().split(/\s+/)
   await tx.query('INSERT INTO households VALUES($1,$2,$3)',[house,answers.contact.fullName,OWNER]);await tx.query('INSERT INTO household_members VALUES($1,$2,$3,$4)',[member,house,names.shift(),names.join(' ')])
   await tx.query('INSERT INTO local_contacts VALUES($1,$2,$3,$4,$5)',[id,email,answers.contact.phone,house,member]);return {id,household_id:house,member_id:member}
  })
 }
 async persist(payload:Record<string,unknown>){
  const raw=payload.answers as Record<string,unknown>
  const answers=validateCombined({...raw,contact:{fullName:`${payload.first_name} ${payload.last_name}`,email:payload.normalized_email,phone:payload.normalized_phone}})
  if(!answers)throw new Error('Invalid local assessment')
  const contact=await this.seedContact(answers)
  return this.db.transaction(async tx=>{
   const prior=await tx.query<{lead_id:string;assessment_id:string}>('SELECT * FROM local_submissions WHERE id=$1',[payload.idempotency_key]);if(prior.rows[0])return {created:false,...prior.rows[0],household_id:contact.household_id,member_id:contact.member_id,match_status:'existing_household',sheets_sync_status:'skipped'}
   const assessment=uuid(),lead=uuid(),when=payload.submitted_at||new Date().toISOString()
   await tx.query('INSERT INTO assessments VALUES($1,$2,$3,$4,$5,$6,$7,$7)',[assessment,contact.household_id,lead,payload.assessment_type,JSON.stringify(payload.answers),JSON.stringify(payload.derived_metrics),when])
   await tx.query('INSERT INTO opportunities VALUES($1,$2,$3,$4)',[uuid(),contact.household_id,'QA '+answers.selected.join(' / '),payload.idempotency_key])
   await tx.query('INSERT INTO local_submissions VALUES($1,$2,$3,$4,$5,$6,$7)',[payload.idempotency_key,lead,contact.id,contact.household_id,contact.member_id,assessment,JSON.stringify(payload)])
   if(answers.selected.includes('benefits')){
    const diagnostic=projectDiagnostic('benefits',answers.diagnostic),count=diagnostic.employees==='unknown'?null:Number(diagnostic.employees)
    await tx.query("SELECT set_config('test.uid',$1,true)",[OWNER]);await tx.exec('SET LOCAL ROLE authenticated')
    await tx.query("INSERT INTO tac_employer_benefits(household_id,opportunity_id,source_assessment_id,company,total_employees,report_answers,review_date,next_action) SELECT $1,id,$2,$3,$4,$5,current_date,'Review employer answers internally' FROM opportunities WHERE submission_id=$6 ON CONFLICT(household_id,opportunity_id) DO NOTHING",[contact.household_id,assessment,answers.contact.fullName+' Test Company',Number.isFinite(count)?count:null,JSON.stringify(diagnostic),payload.idempotency_key])
    await tx.exec('RESET ROLE')
   }
   return {created:true,lead_id:lead,household_id:contact.household_id,member_id:contact.member_id,assessment_id:assessment,match_status:'new_prospect',sheets_sync_status:'skipped'}
  })
 }
 async load(id:string):Promise<SavedAssessment|null>{
  const result=await this.db.query<{id:string;answers:Record<string,unknown>;derived_metrics:Record<string,unknown>;completed_at:string;updated_at:string;payload:Record<string,unknown>}>('SELECT a.*,s.payload FROM assessments a JOIN local_submissions s ON s.assessment_id=a.id WHERE s.id=$1',[id]);const r=result.rows[0];if(!r)return null
  const p=r.payload,answers=restoreStoredCombined({...r.answers,contact:{fullName:`${p.first_name} ${p.last_name}`,email:p.normalized_email,phone:p.normalized_phone}});if(!answers)throw new Error('Stored local review invalid')
  return {id:r.id,answers,derived:r.derived_metrics,submittedAt:new Date(r.completed_at).toISOString(),updatedAt:new Date(r.updated_at).toISOString()}
 }
 async followUp(id:string){
  const rows=await this.db.query<{lead_id:string;contact_id:string;household_id:string;payload:Record<string,unknown>}>('SELECT * FROM local_submissions WHERE id=$1',[id]);const row=rows.rows[0];if(!row)throw new Error('Test submission unavailable')
  const saved=(await this.load(id))!
  const prior=await this.db.query<{checkpoint:Record<string,unknown>}>('SELECT checkpoint FROM local_delivery WHERE submission_id=$1',[id])
  const delivery={lead_id:row.lead_id,contact_id:row.contact_id,opportunity_id:null,opportunity_create_started:false,task_id:null,task_create_started:false,...prior.rows[0]?.checkpoint}
  await deliverReportCardFollowUp({delivery,target:{locationId:'localQA',pipelineId:'localPipeline',initialStageId:'localProspect',assignedUserId:'localOwner'},assessmentType:String(row.payload.assessment_type),reviewPriorities:saved.answers.selected,reviewOperations:saved.answers.selected.filter(t=>t==='health'||t==='benefits').map(type=>({type,...coverageReview(type,projectDiagnostic(type,saved.answers.diagnostic))!.internal})),contactName:saved.answers.contact.fullName,dueDate:new Date(Date.parse(saved.submittedAt)+86400000).toISOString(),verifyContact:async()=>{if(!saved.answers.contact.email.endsWith('@example.invalid'))throw new Error('Test contact required')},checkpoint:async patch=>{Object.assign(delivery,patch);await this.db.query('INSERT INTO local_delivery VALUES($1,$2) ON CONFLICT(submission_id) DO UPDATE SET checkpoint=excluded.checkpoint',[id,JSON.stringify(delivery)])},transport:{
   get:async(path)=>{
    if(path==='/opportunities/search'){const opportunities=(await this.db.query<{body:Record<string,unknown>}>('SELECT body FROM local_opportunities WHERE submission_id=$1',[id])).rows.map(r=>r.body);return {opportunities,meta:{total:opportunities.length}}}
    if(path.startsWith('/opportunities/'))return {opportunity:(await this.db.query<{body:unknown}>('SELECT body FROM local_opportunities WHERE submission_id=$1',[id])).rows[0]?.body}
    const tasks=(await this.db.query<{body:unknown}>('SELECT body FROM local_tasks WHERE contact_id=$1',[row.contact_id])).rows.map(r=>r.body)
    return path.endsWith('/tasks')?{tasks}:{task:tasks.find(t=>path.endsWith('/'+(t as {id:string}).id))}
   },
   post:async(path,body)=>{
    if(path==='/opportunities/'){const item={...body,id:externalId()};await this.db.query('INSERT INTO local_opportunities VALUES($1,$2,$3) ON CONFLICT(submission_id) DO NOTHING',[item.id,id,JSON.stringify(item)]);return {opportunity:item}}
    if(path===`/contacts/${row.contact_id}/tasks`){const item={...body,id:externalId(),contactId:row.contact_id};await this.db.query('INSERT INTO local_tasks VALUES($1,$2,$3,$4) ON CONFLICT(submission_id) DO NOTHING',[item.id,id,row.contact_id,JSON.stringify(item)]);return {task:item}}
    throw new Error('Local outbound firewall: only internal opportunity/task writes are supported.')
   }
  }})
 }
 async setBooking(id:string,status='confirmed'){
  const row=(await this.db.query<{contact_id:string}>('SELECT contact_id FROM local_submissions WHERE id=$1',[id])).rows[0];if(!row)throw new Error('Test assessment not found')
  const startsAt=new Date(Date.now()+86400000).toISOString()
  // Commit TAC's booking intent FIRST. Provider delivery may not precede this.
  await this.db.query("INSERT INTO local_tac_booking_requests(assessment_id,contact_id,status,starts_at) VALUES($1,$2,'pending',$3) ON CONFLICT(assessment_id) DO NOTHING",[id,row.contact_id,startsAt])
  const intent=(await this.db.query<{request_id:string;external_event_id:string|null}>('SELECT * FROM local_tac_booking_requests WHERE assessment_id=$1',[id])).rows[0]
  if(!intent)throw new Error('TAC booking must be saved before provider delivery')
  // Local provider adapter only: deterministic identity prevents a retry creating
  // another external event. No real AgentCRM API or messaging endpoint is called.
  const event={id:intent.external_event_id||'local'+id.replace(/-/g,''),contactId:row.contact_id,locationId:'localQA',calendarId:PREMIUM_CALENDARS[0],appointmentStatus:status,startTime:startsAt}
  await this.db.transaction(async tx=>{
   await tx.query('INSERT INTO local_bookings(id,contact_id,event,tac_request_id) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET event=excluded.event,tac_request_id=excluded.tac_request_id',[event.id,row.contact_id,JSON.stringify(event),intent.request_id])
   await tx.query('UPDATE local_tac_booking_requests SET status=$2,external_event_id=$3,starts_at=$4,updated_at=now() WHERE assessment_id=$1',[id,status==='cancelled'?'cancelled':'confirmed',event.id,event.startTime])
  })
  return event
 }
 deps(secret:string):PremiumDeps{return {env:{VALTORIS_PREMIUM_ENABLED:'true',VALTORIS_ASSESSMENT_SESSION_SECRET:secret},load:id=>this.load(id),ingest:async body=>ingestPublicReportCard(body,{admin:{rpc:async(name:string,args:Record<string,unknown>)=>name==='ingest_public_report_card'?{data:await this.persist(args.p_payload as Record<string,unknown>),error:null}:{data:null,error:null}} as unknown as SupabaseClient,findCandidates:async()=>[],sheetsWriter:async()=>({status:'skipped'}),runStudentLoanDryRun:async()=>null,orchestrateFollowUpTask:async()=>({status:'skipped',taskId:null,errorCategory:null,needsManualReview:false})}),verifyBooking:async(answers,notBefore)=>{const rows=await this.db.query<{id:string;event:Record<string,unknown>}>('SELECT c.id,b.event FROM local_contacts c JOIN local_bookings b ON b.contact_id=c.id WHERE c.email=$1',[answers.contact.email.toLowerCase()]);for(const row of rows.rows){const proof=verifiedBookingEvent({event:row.event},row.id,'localQA',Date.now(),notBefore);if(proof)return proof}return null},saveDiscovery:async(saved,discovery)=>{const result=await this.db.query("UPDATE assessments SET derived_metrics=derived_metrics || jsonb_build_object('comprehensiveDiscovery',$2::jsonb),updated_at=clock_timestamp() WHERE id=$1 AND updated_at=$3 RETURNING id",[saved.id,JSON.stringify(discovery),saved.updatedAt]);return result.rows.length===1},saveProof:async(saved,proof)=>{await this.db.query("UPDATE assessments SET derived_metrics=jsonb_set(derived_metrics,'{bookingVerification}',$2::jsonb) WHERE id=$1",[saved.id,JSON.stringify(proof)]);return true}}}
 async audit(){
  const counts:Record<string,number>={};for(const table of ['local_contacts','local_submissions','assessments','local_opportunities','local_tasks','local_bookings','tac_employer_benefits','local_tac_booking_requests'])counts[table]=Number((await this.db.query<{count:string}>(`SELECT count(*) AS count FROM ${table}`)).rows[0].count)
  const records=(await this.db.query('SELECT s.id,a.answers->\'selected\' AS priorities,a.derived_metrics ? \'bookingVerification\' AS booking_verified,c.email,b.event->>\'appointmentStatus\' AS booking_status FROM local_submissions s JOIN assessments a ON a.id=s.assessment_id JOIN local_contacts c ON c.id=s.contact_id LEFT JOIN local_bookings b ON b.contact_id=c.id ORDER BY a.completed_at DESC')).rows
  const duplicates:Record<string,number>={}
  for(const [label,table,key] of [['emails','local_contacts','email'],['phones','local_contacts','phone'],['opportunities','local_opportunities','submission_id'],['internalTasks','local_tasks','submission_id']])duplicates[label]=Number((await this.db.query<{count:string}>(`SELECT count(*) AS count FROM (SELECT ${key} FROM ${table} GROUP BY ${key} HAVING count(*)>1) q`)).rows[0].count)
  return {synthetic:true,persistent:true,outboundEnabled:false,counts,duplicates,records}
 }
}
