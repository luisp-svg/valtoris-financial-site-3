import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const db=new PGlite();const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE TYPE public.lead_status AS ENUM('new','unassigned','assigned','duplicate_review');
CREATE TABLE profiles(id uuid PRIMARY KEY,role text,is_active boolean DEFAULT true,deleted_at timestamptz);
CREATE TABLE advisor_profiles(id uuid PRIMARY KEY,user_id uuid REFERENCES profiles(id),slug text,is_active boolean DEFAULT true,deleted_at timestamptz);
CREATE TABLE households(id uuid PRIMARY KEY,display_name text DEFAULT 'Synthetic',assigned_advisor_id uuid,deleted_at timestamptz,merged_into_household_id uuid);
CREATE TABLE leads(id uuid PRIMARY KEY,assessment_type text,submitted_at timestamptz DEFAULT now(),household_id uuid REFERENCES households(id),public_ingest_idempotency_key uuid,assigned_advisor_id uuid,assigned_at timestamptz,assigned_by_user_id uuid,assignment_reason text,duplicate_review_status text DEFAULT 'none',status lead_status DEFAULT 'unassigned',updated_at timestamptz DEFAULT now(),deleted_at timestamptz);
CREATE TABLE assessments(id uuid PRIMARY KEY,household_id uuid,lead_id uuid REFERENCES leads(id),assessment_type text,answers jsonb,created_at timestamptz DEFAULT now(),deleted_at timestamptz);
CREATE TABLE appointments(id uuid PRIMARY KEY,household_id uuid,deleted_at timestamptz);
CREATE TABLE tac_booking_requests(lead_id uuid,appointment_id uuid);
CREATE TABLE activities(lead_id uuid,actor uuid);
CREATE TABLE student_loan_uploads(household_id uuid,upload_complete boolean);CREATE TABLE student_loan_reviews(household_id uuid,status text);CREATE TABLE service_production_records(household_id uuid,service_line text,deleted_at timestamptz);
CREATE FUNCTION crm_is_owner() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='owner' AND is_active AND deleted_at IS NULL)$$;
CREATE FUNCTION crm_is_advisor() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='advisor' AND is_active AND deleted_at IS NULL)$$;
CREATE FUNCTION crm_advisor_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$SELECT id FROM advisor_profiles WHERE user_id=auth.uid() AND is_active AND deleted_at IS NULL$$;
CREATE FUNCTION crm_can_access_household(h uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$SELECT crm_is_owner() OR (crm_is_advisor() AND EXISTS(SELECT 1 FROM households WHERE id=h AND deleted_at IS NULL AND merged_into_household_id IS NULL AND assigned_advisor_id=crm_advisor_id()))$$;
CREATE FUNCTION crm_write_activity(uuid,text,text,text,jsonb,uuid,uuid,uuid,uuid) RETURNS void LANGUAGE sql AS $$INSERT INTO activities VALUES($8,auth.uid())$$;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;ALTER TABLE leads ENABLE ROW LEVEL SECURITY;ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY households_select ON households FOR SELECT TO authenticated USING(crm_can_access_household(id));
CREATE POLICY leads_select ON leads FOR SELECT TO authenticated USING(crm_can_access_household(household_id));
CREATE POLICY old_assessments ON assessments FOR SELECT TO authenticated USING(crm_can_access_household(household_id));
CREATE POLICY old_appointments ON appointments FOR SELECT TO authenticated USING(crm_can_access_household(household_id));
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;`);
await db.exec(await readFile('supabase/drafts/20261023222500_intake_review_assignment_access.sql','utf8'));
await db.exec(await readFile('supabase/drafts/20261023223000_intake_assignment_audit_relationship.sql','utf8'));
await db.exec(await readFile('supabase/drafts/20261023223500_intake_assigned_visibility_only.sql','utf8'));
await db.exec(await readFile('supabase/drafts/20261023224000_assigned_student_review_workspace.sql','utf8'));
const priorRouting=(await db.query("SELECT proname,pg_get_functiondef(oid) AS definition,proacl::text AS acl FROM pg_proc WHERE proname IN ('route_public_intake_reviews','assign_intake_submission')")).rows;
await db.exec(await readFile('supabase/drafts/20261029221458_two_stage_review_routing.sql','utf8'));
for(const prior of priorRouting){
 const current=(await db.query('SELECT pg_get_functiondef(oid) AS definition,proacl::text AS acl FROM pg_proc WHERE proname=$1',[prior.proname])).rows[0];
 const normalized=current.definition.replaceAll("->>'format' IN ('combined-priorities-v1','combined-priorities-v2')","->>'format'='combined-priorities-v1'").replaceAll("'tax','commercial','trucking'","'tax'");
 assert.equal(normalized,prior.definition);assert.equal(current.acl,prior.acl);
}

for(const[n,role]of [[1,'owner'],[2,'advisor'],[3,'advisor'],[4,'advisor'],[5,'advisor']])await db.query('INSERT INTO profiles(id,role,is_active) VALUES($1,$2,$3)',[id(n),role,n!==5]);
for(const[n,user,slug]of [[11,2,'lizbeth-350d9c03'],[12,3,'jazmin-perez'],[13,4,'other'],[14,5,'inactive'],[16,1,'owner']])await db.query('INSERT INTO advisor_profiles(id,user_id,slug) VALUES($1,$2,$3)',[id(n),id(user),slug]);
for(const n of [101,102,103,104])await db.query('INSERT INTO households(id,assigned_advisor_id) VALUES($1,$2)',[id(n),id(16)]);
for(const[n,h,advisor]of [[201,101,null],[202,102,11],[203,103,null],[204,104,13]])await db.query('INSERT INTO leads(id,household_id,public_ingest_idempotency_key,assigned_advisor_id) VALUES($1,$2,$1,$3)',[id(n),id(h),advisor?id(advisor):null]);
for(const[n,l,h,type,selected]of [[301,201,101,'family',['family','health','student_loan']],[302,202,102,'student_loan',['student_loan']],[303,203,103,'health',['health']],[304,204,104,'credit',['credit']]])await db.query('INSERT INTO assessments(id,lead_id,household_id,assessment_type,answers) VALUES($1,$2,$3,$4,$5)',[id(n),id(l),id(h),type,JSON.stringify({format:'combined-priorities-v1',selected})]);
for(const[n,h,l]of [[401,101,201],[404,104,204]]){await db.query('INSERT INTO appointments(id,household_id) VALUES($1,$2)',[id(n),id(h)]);await db.query('INSERT INTO tac_booking_requests VALUES($1,$2)',[id(l),id(n)])}
await db.exec("UPDATE leads SET assessment_type=CASE WHEN id='"+id(202)+"' THEN 'student_loan' WHEN id='"+id(203)+"' THEN 'health' ELSE 'family' END");
// Historical assigned leads must remain visible even when they have no new review-assignment rows.
await db.query('DELETE FROM intake_review_assignments WHERE lead_id=$1',[id(202)]);
async function as(user,sql,args=[]){return db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE authenticated');await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id(user)]);return tx.query(sql,args)})}
assert.equal((await as(1,'SELECT * FROM leads')).rows.length,4);
assert.deepEqual((await as(2,'SELECT id FROM leads ORDER BY id')).rows.map(x=>x.id),[id(201),id(202)]);
assert.deepEqual((await as(3,'SELECT id FROM leads ORDER BY id')).rows.map(x=>x.id),[id(201),id(203)]);
assert.equal((await as(3,'SELECT * FROM appointments')).rows.length,1);
assert.equal((await as(2,'SELECT student_loan_can_access($1) AS allowed',[id(101)])).rows[0].allowed,true);
assert.equal((await as(3,'SELECT student_loan_can_access($1) AS allowed',[id(101)])).rows[0].allowed,false);
assert.equal((await as(2,'SELECT * FROM student_loan_workspace()')).rows.length,2);
assert.equal((await as(3,'SELECT * FROM student_loan_workspace()')).rows.length,0);
assert.equal((await as(3,"SELECT * FROM assessments WHERE assessment_type='credit'")).rows.length,0);
assert.equal((await as(5,'SELECT * FROM leads')).rows.length,0);
assert.equal((await as(2,'SELECT * FROM households')).rows.length,2);
const prior=(await db.query('SELECT updated_at FROM leads WHERE id=$1',[id(201)])).rows[0].updated_at;
await assert.rejects(()=>as(2,'SELECT assign_intake_submission($1,$2,$3)',[id(201),id(12),prior]),/only owners/);
await assert.rejects(()=>as(1,'SELECT assign_intake_submission($1,$2,$3)',[id(201),id(14),prior]),/inactive/);
await as(1,'SELECT assign_intake_submission($1,$2,$3)',[id(201),id(13),prior]);
assert.equal((await as(2,'SELECT * FROM leads WHERE id=$1',[id(201)])).rows.length,0);
assert.equal((await as(3,'SELECT * FROM leads WHERE id=$1',[id(201)])).rows.length,0);
assert.equal((await as(4,'SELECT * FROM leads WHERE id=$1',[id(201)])).rows.length,1);
assert.equal((await db.query('SELECT assigned_advisor_id FROM households WHERE id=$1',[id(101)])).rows[0].assigned_advisor_id,id(16));
assert.equal((await db.query('SELECT count(*)::int AS n FROM activities')).rows[0].n,1);
await assert.rejects(()=>as(1,'SELECT assign_intake_submission($1,$2,$3)',[id(201),id(12),prior]),/assignment_changed_reload/);
await assert.rejects(()=>db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE anon');return tx.query('SELECT assign_intake_submission($1,$2,$3)',[id(201),id(12),prior])}),/permission denied/);
await assert.rejects(()=>as(3,'UPDATE intake_review_assignments SET advisor_id=$1',[id(12)]),/permission denied/);
// Current specialized formats must preserve every selected review, including insurance.
for(const [index,[selected,expected]] of [
 [['health','protection'],[12,13]],
 [['student_loan'],[11]],
 [['commercial'],[13]],
 [['trucking'],[13]],
 [['family','protection'],[13,13]],
 [['retirement','tsp'],[13,13]],
].entries()){
 const h=id(501+index),l=id(601+index),a=id(701+index);
 await db.query('INSERT INTO households(id,assigned_advisor_id) VALUES($1,$2)',[h,id(16)]);
 await db.query('INSERT INTO leads(id,household_id,public_ingest_idempotency_key,assigned_advisor_id,assessment_type) VALUES($1,$2,$1,$3,$4)',[l,h,id(13),selected.includes('health')?'health':selected.includes('student_loan')?'student_loan':'family']);
 await db.query('INSERT INTO assessments(id,lead_id,household_id,assessment_type,answers) VALUES($1,$2,$3,$4,$5)',[a,l,h,selected.includes('health')?'health':selected.includes('student_loan')?'student_loan':'family',JSON.stringify({format:'combined-priorities-v2',strategyVersion:1,selected})]);
 const assigned=(await db.query('SELECT review_type,advisor_id FROM intake_review_assignments WHERE lead_id=$1',[l])).rows;
 assert.equal(assigned.length,selected.length);
 for(const [i,type]of selected.entries())assert.equal(assigned.find(r=>r.review_type===type)?.advisor_id,id(expected[i]));
 const before=(await db.query('SELECT updated_at FROM leads WHERE id=$1',[l])).rows[0].updated_at;
 await as(1,'SELECT assign_intake_submission($1,$2,$3)',[l,id(11),before]);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM intake_review_assignments WHERE lead_id=$1 AND advisor_id=$2',[l,id(11)])).rows[0].n,selected.length);
 assert.equal((await db.query('SELECT assigned_advisor_id FROM households WHERE id=$1',[h])).rows[0].assigned_advisor_id,id(16));
}
// Reapplying only this additive update is harmless; unknown review types remain rejected.
await db.exec(await readFile('supabase/drafts/20261029221458_two_stage_review_routing.sql','utf8'));
await assert.rejects(()=>db.query("INSERT INTO intake_review_assignments(lead_id,review_type,advisor_id,reason) VALUES($1,'unsupported',$2,'manual')",[id(601),id(11)]),/check constraint/);
console.log('PASS: v2 health/protection, student loans, commercial, trucking, life and retirement/TSP route and reassign all selected reviews; v1 access controls retained; migration replay safe.');
console.log('PASS: owner sees all; Liz/Jaz see assigned reviews and appointments; unrelated and inactive users denied; assignment is owner-only, concurrency-protected, audited and retains household ownership; no outbound operations.');await db.close();
