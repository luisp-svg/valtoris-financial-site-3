import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import {beforeAll,afterAll,describe,it,expect} from 'vitest'
const owner='10000000-0000-4000-8000-000000000001',liz='10000000-0000-4000-8000-000000000002',other='10000000-0000-4000-8000-000000000003',house='20000000-0000-4000-8000-000000000001',upload='30000000-0000-4000-8000-000000000001'
let db:PGlite
beforeAll(async()=>{
 db=new PGlite()
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE SCHEMA storage;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text,is_active boolean DEFAULT true,deleted_at timestamptz);
 CREATE TABLE public.households(id uuid PRIMARY KEY,display_name text,assigned_advisor_id uuid,deleted_at timestamptz,merged_into_household_id uuid);
 CREATE TABLE public.advisor_profiles(id uuid PRIMARY KEY,user_id uuid,slug text,is_active boolean DEFAULT true,deleted_at timestamptz);
 CREATE TABLE public.leads(id uuid,household_id uuid,assessment_type text,assigned_advisor_id uuid,deleted_at timestamptz,status text,submitted_at timestamptz);
 CREATE TABLE public.service_production_records(id uuid PRIMARY KEY,household_id uuid,service_line text,deleted_at timestamptz);
 CREATE TABLE public.assessments(id uuid PRIMARY KEY,household_id uuid,assessment_type text,updated_at timestamptz,deleted_at timestamptz);
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid,bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 INSERT INTO profiles(id,role) VALUES('${owner}','owner'),('${liz}','advisor'),('${other}','advisor');
 INSERT INTO advisor_profiles(id,user_id,slug) VALUES('${liz}','${liz}','lizbeth-350d9c03'),('${other}','${other}','other');
 INSERT INTO households(id,display_name,assigned_advisor_id) VALUES('${house}','Synthetic household','${other}');
 INSERT INTO leads VALUES(gen_random_uuid(),'${house}','student_loan','${liz}',null,'assigned',now());`)
 await db.exec(readFileSync('supabase/migrations/20261023044613_student_loan_upload_review.sql','utf8'))
 await db.exec(`GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,service_role;GRANT SELECT ON storage.objects TO authenticated;
 INSERT INTO student_loan_uploads(id,household_id,uploaded_by,file_name,storage_path,sha256,byte_size,authorization_reference,inventory)VALUES('${upload}','${house}','${owner}','synthetic.txt','${house}/${upload}/aid-data.txt','${'a'.repeat(64)}',100,'Synthetic test permission','{}');
 INSERT INTO storage.objects VALUES(gen_random_uuid(),'student-loan-data','${house}/${upload}/aid-data.txt');`)
},15000)
afterAll(async()=>await db.close())
async function asUser(id:string){await db.exec(`RESET ROLE;SELECT set_config('test.uid','${id}',false);SET ROLE authenticated;`)}
describe('Student loan data permissions and durable generation',()=>{
 it('does not expose unfinished uploads; finalization requires a real storage object and matching uploader',async()=>{
  await asUser(liz);expect((await db.query('SELECT * FROM student_loan_uploads')).rows).toHaveLength(0)
  await db.exec('RESET ROLE')
  await expect(db.query('SELECT public.student_loan_finish_upload($1,$2)',[liz,upload])).rejects.toThrow('not_authorized')
  await db.query('SELECT public.student_loan_finish_upload($1,$2)',[owner,upload])
 })
 it('allows scoped student loan access without changing household assignment',async()=>{
  await asUser(liz);expect((await db.query('SELECT * FROM student_loan_uploads')).rows).toHaveLength(1)
  expect((await db.query('SELECT * FROM public.student_loan_workspace()')).rows).toHaveLength(1)
  await db.exec('RESET ROLE');expect((await db.query('select assigned_advisor_id from households')).rows[0].assigned_advisor_id).toBe(other)
 })
 it('rejects direct authenticated writes and service mutation RPCs',async()=>{
  await asUser(liz)
  await expect(db.query("update student_loan_uploads set upload_complete=false")).rejects.toThrow()
  await expect(db.query('SELECT public.student_loan_begin_review($1,$2,null,null)',[liz,upload])).rejects.toThrow(/permission denied/)
 })
 it('denies anonymous reads',async()=>{
  await db.exec('RESET ROLE;SET ROLE anon');await expect(db.query('SELECT * FROM student_loan_uploads')).rejects.toThrow();await db.exec('RESET ROLE')
 })
 it('blocks concurrent generation and saves recommendations immediately without human approval',async()=>{
  const first=await db.query<{result:{id:string}}>('SELECT to_jsonb(public.student_loan_begin_review($1,$2,null,null)) as result',[liz,upload])
  const id=first.rows[0].result.id
  await expect(db.query('SELECT public.student_loan_begin_review($1,$2,null,null)',[liz,upload])).rejects.toThrow('in_progress')
  const result=await db.query<{result:{status:string}}>('SELECT to_jsonb(public.student_loan_finish_review($1,$2,$3,$4,$5,$6)) as result',[liz,id,JSON.stringify({summary:'Synthetic recommendations'}),JSON.stringify([{id:'idr',checkedAt:new Date().toISOString()}]),'synthetic-test-model','Synthetic recommendations'])
  expect(result.rows[0].result.status).toBe('ready')
  expect((await db.query("select * from student_loan_review_audit where action='ai_recommendations_generated'")).rows).toHaveLength(1)
  await expect(db.query('SELECT public.student_loan_finish_review($1,$2,$3,$4,$5,$6)',[liz,id,'{}','[]','model','text'])).rejects.toThrow('conflict')
 })
 it('revokes access for inactive advisors even when a lead remains assigned',async()=>{
  await db.exec(`UPDATE profiles SET is_active=false WHERE id='${liz}'`);await asUser(liz)
  expect((await db.query('SELECT * FROM student_loan_uploads')).rows).toHaveLength(0)
  await db.exec(`RESET ROLE;UPDATE profiles SET is_active=true WHERE id='${liz}'`)
 })
})
