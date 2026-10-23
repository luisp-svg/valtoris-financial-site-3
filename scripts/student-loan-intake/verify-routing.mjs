import {PGlite} from '@electric-sql/pglite'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const db = new PGlite()
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA extensions;
CREATE DOMAIN extensions.citext AS text;
CREATE TYPE public.attribution_method AS ENUM('advisor_link','unknown');
CREATE TYPE public.lead_status AS ENUM('assigned','unassigned','duplicate_review');
CREATE TYPE public.assignment_reason AS ENUM('advisor_link','service_based');
CREATE TABLE public.advisor_profiles(id uuid,deleted_at timestamptz,is_active boolean,slug text);`)
// The real writer parses against minimal table declarations. Execution is deferred;
// this test verifies the migration preserves its compiled definition and access grants.
const writer = fs.readFileSync('supabase/migrations/072_public_report_card_concurrency.sql','utf8')
await db.exec(`CREATE TYPE public.assessment_type AS ENUM('family','business','retirement','protection','student_loan','credit','home_buyer'); CREATE TYPE public.duplicate_review_status AS ENUM('pending','none');`)
const extra = {households:['deleted_at','merged_into_household_id'],household_members:['deleted_at','created_at'],leads:['deleted_at'],assessments:['deleted_at'],duplicate_reviews:[],activities:[]}
for (const match of writer.matchAll(/INSERT INTO public\.(\w+) \(\s*([\s\S]*?)\) VALUES/g)) {
 const table=match[1]
 const columns=[...new Set(['id',...match[2].split(',').map(v=>v.trim()),...(extra[table]||[])])]
 const type = key => key==='id' || key.endsWith('_id') || key==='public_ingest_idempotency_key' || key==='potential_duplicate_of' ? 'uuid' : key.endsWith('_at') ? 'timestamptz' : ['raw_payload','original_source_metadata','top_priorities','consent_snapshot','priorities','answers','derived_metrics','metadata','payload_snapshot'].includes(key) ? 'jsonb' : ['is_primary_contact'].includes(key) ? 'boolean' : ['age','scoring_version'].includes(key) ? 'integer' : key==='overall_score' ? 'numeric' : 'text'
 await db.exec('CREATE TABLE IF NOT EXISTS public.'+table+'('+columns.map(k=>k+' '+type(k)+(k==='id'?' PRIMARY KEY DEFAULT gen_random_uuid()':'')).join(',')+')')
}
await db.exec(writer)
await db.exec(fs.readFileSync('supabase/migrations/20261023010200_student_loan_liz_routing.sql','utf8'))
const {rows} = await db.query("select pg_get_functiondef('public.ingest_public_report_card(jsonb)'::regprocedure) as definition")
const text = rows[0].definition
assert.match(text,/lizbeth-350d9c03/)
assert.match(text,/WHEN v_student_loan_advisor IS NOT NULL THEN v_student_loan_advisor/)
assert.match(text,/WHEN v_match_status = 'possible_match' THEN 'duplicate_review'/)
assert.match(text,/v_advisor_profile_id,\s*v_advisor_slug,\s*v_campaign_code/)
const grants = await db.query("select has_function_privilege('anon','public.ingest_public_report_card(jsonb)','EXECUTE') as anon, has_function_privilege('authenticated','public.ingest_public_report_card(jsonb)','EXECUTE') as authenticated, has_function_privilege('service_role','public.ingest_public_report_card(jsonb)','EXECUTE') as service")
assert.deepEqual(grants.rows[0],{anon:false,authenticated:false,service:true})
console.log(JSON.stringify({migrationCompiled:true,attributionPreserved:true,duplicateReviewPreserved:true,serviceRoleOnly:true}))
const liz='1886b4c1-6289-4610-9526-c1e057cbed15',other='11111111-1111-4111-8111-111111111111'
await db.query("INSERT INTO public.advisor_profiles VALUES($1,null,true,'lizbeth-350d9c03'),($2,null,true,'other')",[liz,other])
async function ingest(extra={}) {
 const payload={idempotency_key:crypto.randomUUID(),assessment_type:'student_loan',match_status:'new_prospect',first_name:'Synthetic',last_name:'Test',...extra}
 const result=await db.query('select public.ingest_public_report_card($1::jsonb) as result',[JSON.stringify(payload)])
 return {payload,result:result.rows[0].result}
}
const plain=await ingest()
let row=(await db.query('select assigned_advisor_id from public.leads where id=$1',[plain.result.lead_id])).rows[0]
assert.equal(row.assigned_advisor_id,liz)
assert.equal((await db.query('select assigned_advisor_id from public.households where id=$1',[plain.result.household_id])).rows[0].assigned_advisor_id,liz)
const referred=await ingest({advisor_profile_id:other,advisor_slug:'other'})
row=(await db.query('select assigned_advisor_id,original_advisor_id from public.leads where id=$1',[referred.result.lead_id])).rows[0]
assert.deepEqual(row,{assigned_advisor_id:liz,original_advisor_id:other})
const generic=await ingest({assessment_type:'family',advisor_profile_id:other,advisor_slug:'other'})
assert.equal((await db.query('select assigned_advisor_id from public.leads where id=$1',[generic.result.lead_id])).rows[0].assigned_advisor_id,other)
const matched=await ingest({match_status:'exact_trusted_match',matched_household_id:generic.result.household_id})
assert.equal((await db.query('select assigned_advisor_id from public.leads where id=$1',[matched.result.lead_id])).rows[0].assigned_advisor_id,liz)
assert.equal((await db.query('select assigned_advisor_id from public.households where id=$1',[generic.result.household_id])).rows[0].assigned_advisor_id,other)
const duplicate=await ingest({match_status:'possible_match',candidate_household_id:generic.result.household_id})
assert.equal((await db.query('select status from public.leads where id=$1',[duplicate.result.lead_id])).rows[0].status,'duplicate_review')
const replay=await ingest(plain.payload)
assert.equal(replay.result.created,false); assert.equal(replay.result.lead_id,plain.result.lead_id)
await db.query('update public.advisor_profiles set is_active=false where id=$1',[liz])
await assert.rejects(ingest(),/student_loan_advisor_unavailable/)
console.log(JSON.stringify({syntheticIngestScenarios:7, passed:true, excludesProductionRlsAndTriggers:true}))
await db.close()
