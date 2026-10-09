import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const db=new PGlite()
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE profiles(id uuid PRIMARY KEY,role text,is_active boolean DEFAULT true,deleted_at timestamptz);
CREATE TABLE advisor_profiles(id uuid PRIMARY KEY,user_id uuid REFERENCES profiles(id));
CREATE TABLE households(id uuid PRIMARY KEY,assigned_advisor_id uuid REFERENCES advisor_profiles(id),deleted_at timestamptz,merged_into_household_id uuid);
CREATE TABLE policy_applications(id uuid PRIMARY KEY,household_id uuid,opportunity_id uuid,production_stage text,next_follow_up_date date,deleted_at timestamptz);
CREATE TABLE tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),household_id uuid,opportunity_id uuid,lead_id uuid,assessment_id uuid,title text,description text,due_date date,priority text,status text,assigned_user_id uuid,created_by_user_id uuid,source_type text,workflow_type text,metadata jsonb,deleted_at timestamptz,completed_at timestamptz,updated_at timestamptz DEFAULT clock_timestamp(),CONSTRAINT tasks_workflow_type_check CHECK(workflow_type IS NULL OR workflow_type IN ('review_initial_diagnostic','review_digital_identity_lead')));
CREATE FUNCTION crm_is_owner() RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='owner' AND is_active AND deleted_at IS NULL) $$;
CREATE FUNCTION crm_archive_access(h uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT crm_is_owner() OR EXISTS(SELECT 1 FROM households JOIN advisor_profiles ap ON ap.id=assigned_advisor_id WHERE households.id=h AND ap.user_id=auth.uid()) $$;
CREATE FUNCTION crm_can_access_household(h uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT crm_archive_access(h) $$;
CREATE TABLE test_activities(title text);
CREATE FUNCTION crm_write_activity(uuid,text,text,text,jsonb,uuid,uuid,uuid,uuid) RETURNS void LANGUAGE sql AS $$ INSERT INTO test_activities VALUES($3) $$;
GRANT SELECT ON profiles,advisor_profiles,households,policy_applications TO authenticated;
`)
await db.exec(readFileSync(new URL('../docs/proposed-migrations/20261009173309_production_follow_up_automation.sql',import.meta.url),'utf8'))
const owner='00000000-0000-0000-0000-000000000001',advisor='00000000-0000-0000-0000-000000000002',outsider='00000000-0000-0000-0000-000000000003',ap='00000000-0000-0000-0000-000000000004',h='00000000-0000-0000-0000-000000000005',app='00000000-0000-0000-0000-000000000006'
await db.query(`INSERT INTO profiles(id,role) VALUES($1,'owner'),($2,'advisor'),($3,'advisor')`,[owner,advisor,outsider])
await db.query(`INSERT INTO advisor_profiles VALUES($1,$2);`,[ap,advisor]);await db.query(`INSERT INTO households(id,assigned_advisor_id) VALUES($1,$2)`,[h,ap])
await db.query(`INSERT INTO policy_applications VALUES($1,$2,NULL,'submitted','2026-10-09',NULL)`,[app,h])
const as=async(id)=>{await db.exec('RESET ROLE');await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[id]);await db.exec('SET ROLE authenticated')}
const configure=async(assignee,enabled,rev)=> (await db.query(`SELECT configure_production_task_tracking($1,$2,$3,$4) data`,[app,assignee,enabled,rev])).rows[0].data
await as(advisor);await assert.rejects(configure(advisor,true,0),/FOLLOWUP:unavailable/)
await as(owner);await assert.rejects(configure(outsider,true,0),/FOLLOWUP:invalid_assignee/)
const binding=await configure(advisor,true,0)
assert.ok(binding.task_id);assert.equal((await configure(advisor,true,0)).task_id,binding.task_id)
await assert.rejects(configure(owner,true,0),/FOLLOWUP:conflict/)
await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM tasks')).rows[0].n,1)
await db.query(`UPDATE policy_applications SET next_follow_up_date='2026-10-12',production_stage='in_underwriting' WHERE id=$1`,[app])
let t=(await db.query('SELECT * FROM tasks')).rows[0];assert.equal(t.due_date.toISOString().slice(0,10),'2026-10-12');assert.match(t.title,/in underwriting/)
await as(advisor);await assert.rejects(db.query(`SELECT act_on_crm_task($1,$2,'reschedule','2026-10-13','test')`,[t.id,t.updated_at]),/TASK:reschedule_case/)
await db.query(`SELECT act_on_crm_task($1,$2,'complete')`,[t.id,t.updated_at])
await db.exec('RESET ROLE');await db.query(`UPDATE policy_applications SET production_stage='approved' WHERE id=$1`,[app]);assert.equal((await db.query('SELECT count(*)::int n FROM tasks')).rows[0].n,1)
await db.query(`UPDATE policy_applications SET next_follow_up_date='2026-10-15' WHERE id=$1`,[app]);assert.equal((await db.query('SELECT count(*)::int n FROM tasks')).rows[0].n,2)
t=(await db.query(`SELECT * FROM tasks WHERE status='open'`)).rows[0]
await as(owner);const paused=await configure(advisor,false,1);await db.exec('RESET ROLE')
await db.query(`UPDATE policy_applications SET next_follow_up_date='2026-10-16' WHERE id=$1`,[app]);assert.equal((await db.query(`SELECT due_date::text FROM tasks WHERE id=$1`,[t.id])).rows[0].due_date,'2026-10-15')
await as(owner);await configure(advisor,true,paused.revision);await db.exec('RESET ROLE')
await db.query(`UPDATE policy_applications SET next_follow_up_date=NULL WHERE id=$1`,[app]);assert.equal((await db.query(`SELECT status FROM tasks WHERE id=$1`,[t.id])).rows[0].status,'cancelled')
await db.query(`UPDATE policy_applications SET next_follow_up_date='2026-10-20' WHERE id=$1`,[app]);assert.equal((await db.query('SELECT count(*)::int n FROM tasks')).rows[0].n,3)
await db.query(`UPDATE profiles SET is_active=false WHERE id=$1`,[advisor]);await db.query(`UPDATE policy_applications SET next_follow_up_date='2026-10-21' WHERE id=$1`,[app]);assert.match((await db.query('SELECT sync_error FROM production_task_tracking')).rows[0].sync_error,/no longer has access/)
await as(outsider);assert.equal((await db.query('SELECT * FROM production_task_tracking')).rows.length,0);await assert.rejects(db.query('UPDATE production_task_tracking SET enabled=false'))
await db.exec('RESET ROLE; SET ROLE anon');await assert.rejects(db.query('SELECT * FROM production_task_tracking'));await assert.rejects(db.query(`SELECT configure_production_task_tracking($1,$2,true,0)`,[app,owner]))
console.log('Production follow-up database checks passed: idempotency, access, stale writes, date/stage sync, completion, next cycle, pause, cancellation and invalid assignee.')
await db.close()
