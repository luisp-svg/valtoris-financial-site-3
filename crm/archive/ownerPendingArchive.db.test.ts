import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import {afterAll,beforeAll,expect,it} from 'vitest'
const db=new PGlite()
const owner='11111111-1111-4111-8111-111111111111',advisor='22222222-2222-4222-8222-222222222222'
let n=0
beforeAll(async()=>{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA extensions;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE TABLE households(id uuid PRIMARY KEY,display_name text,assigned_advisor_id uuid,deleted_at timestamptz,merged_into_household_id uuid);
 CREATE TABLE leads(id uuid PRIMARY KEY,household_id uuid,status text,deleted_at timestamptz,lead_type text);
 CREATE TABLE duplicate_reviews(id uuid PRIMARY KEY,incoming_lead_id uuid,status text);
 CREATE TABLE activities(id uuid DEFAULT gen_random_uuid(),household_id uuid,metadata jsonb,deleted_at timestamptz);
 CREATE FUNCTION crm_is_owner() RETURNS boolean LANGUAGE sql AS $$ SELECT auth.uid()='${owner}'::uuid $$;
 CREATE FUNCTION crm_rpc_context() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('crm.rpc_context',true) $$;
 CREATE FUNCTION crm_archive_access(hid uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM households WHERE id=hid AND merged_into_household_id IS NULL AND (crm_is_owner() OR assigned_advisor_id=auth.uid())) $$;
 CREATE FUNCTION crm_write_activity(hid uuid,kind text,title text,body text,meta jsonb,a uuid,b uuid,c uuid,d uuid) RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE result uuid:=gen_random_uuid();BEGIN INSERT INTO activities(id,household_id,metadata)VALUES(result,hid,meta);RETURN result;END $$;`)
 await db.exec(readFileSync('supabase/migrations/20261105163428_owner_archive_pending_duplicates.sql','utf8'))
 const original=readFileSync('supabase/migrations/065_crm_archive_recovery.sql','utf8')
 const restore=original.slice(original.indexOf('CREATE OR REPLACE FUNCTION public.restore_crm_record('),original.indexOf('CREATE OR REPLACE FUNCTION public.list_archived_crm_records('))
 await db.exec(restore)
})
afterAll(()=>db.close())
async function setup(){
 const h=(await db.query<{id:string}>('select gen_random_uuid() as id')).rows[0].id,l=(await db.query<{id:string}>('select gen_random_uuid() as id')).rows[0].id
 await db.query('insert into households(id,display_name,assigned_advisor_id) values($1,$2,$3)',[h,'Synthetic cleanup '+n++,advisor])
 await db.query("insert into leads(id,household_id,status,lead_type)values($1,$2,'duplicate_review','Manual Contact')",[l,h])
 await db.query("insert into duplicate_reviews values(gen_random_uuid(),$1,'pending')",[l])
 return {h,l}
}
async function asUser<T>(user:string,run:()=>Promise<T>){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);return run()}
it.each(['household','lead'] as const)('owner can archive and restore a pending duplicate %s without resolving or deleting history',async kind=>{
 const {h,l}=await setup(),id=kind==='household'?h:l
 await asUser(owner,async()=>{
  const result=await db.query<{result:{ok:boolean;archived:boolean}}>('select archive_crm_record($1,$2) as result',[kind,id])
  expect(result.rows[0].result).toMatchObject({ok:true,archived:true})
  expect((await db.query<{status:string}>('select status from duplicate_reviews where incoming_lead_id=$1',[l])).rows[0].status).toBe('pending')
  expect((await db.query('select * from leads where id=$1',[l])).rows).toHaveLength(1)
  await db.query('select restore_crm_record($1,$2)',[kind,id])
  expect((await db.query<{deleted_at:null}>(`select deleted_at from ${kind==='household'?'households':'leads'} where id=$1`,[id])).rows[0].deleted_at).toBeNull()
  expect((await db.query('select * from activities where household_id=$1',[h])).rows).toHaveLength(2)
 })
})
it('keeps advisor pending-duplicate blocks and signed-out / unassigned denial',async()=>{
 const {h,l}=await setup()
 await asUser(advisor,async()=>{
  await expect(db.query("select archive_crm_record('household',$1)",[h])).rejects.toThrow('resolve_duplicate_first')
  await expect(db.query("select archive_crm_record('lead',$1)",[l])).rejects.toThrow('resolve_duplicate_first')
 })
 for(const user of ['', '33333333-3333-4333-8333-333333333333'])await asUser(user,()=>expect(db.query("select archive_crm_record('household',$1)",[h])).rejects.toThrow('not_authorized'))
 expect((await db.query<{allowed:boolean}>("select has_function_privilege('anon','archive_crm_record(text,uuid)','execute') as allowed")).rows[0].allowed).toBe(false)
})
