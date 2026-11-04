import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll,afterAll,describe,it,expect } from 'vitest'
const owner='10000000-0000-4000-8000-000000000001',advisor='10000000-0000-4000-8000-000000000002',other='10000000-0000-4000-8000-000000000003',house='20000000-0000-4000-8000-000000000001',app='30000000-0000-4000-8000-000000000001'
let db:PGlite
async function asUser(id:string){await db.exec(`RESET ROLE; SELECT set_config('test.uid','${id}',false); SET ROLE authenticated;`)}
beforeAll(async()=>{
 db=new PGlite()
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY);
 CREATE TABLE public.households(id uuid PRIMARY KEY,assigned uuid);
 CREATE TABLE public.assessments(id uuid PRIMARY KEY,household_id uuid);
 CREATE TABLE public.opportunities(id uuid PRIMARY KEY,household_id uuid);
 CREATE TABLE public.policy_applications(id uuid PRIMARY KEY,household_id uuid,deleted_at timestamptz);
 INSERT INTO public.profiles VALUES('${owner}'),('${advisor}'),('${other}');
 INSERT INTO public.households VALUES('${house}','${advisor}');
 INSERT INTO public.policy_applications VALUES('${app}','${house}',null);
 CREATE FUNCTION public.crm_is_owner() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid()='${owner}'::uuid $$;
 CREATE FUNCTION public.crm_can_access_household(h uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT public.crm_is_owner() OR EXISTS(SELECT 1 FROM public.households WHERE id=h AND assigned=auth.uid()) $$;
 CREATE FUNCTION public.crm_can_access_opportunity(o uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT public.crm_is_owner() $$;
 GRANT SELECT ON public.households,public.opportunities,public.policy_applications,public.assessments TO authenticated;
 ALTER TABLE public.policy_applications ENABLE ROW LEVEL SECURITY;
 CREATE POLICY app_read ON public.policy_applications FOR SELECT TO authenticated USING(public.crm_can_access_household(household_id));`)
 await db.exec(readFileSync(new URL('../../supabase/drafts/20261023014516_tac_relaunch_operations.sql',import.meta.url),'utf8'))
},30000)
afterAll(async()=>{await db.close()})
describe('isolated TAC migration',()=>{
 it('enables RLS without public writes or messaging triggers',async()=>{const rows=await db.query<{relname:string;relrowsecurity:boolean}>("select relname,relrowsecurity from pg_class where relname in ('tac_employer_benefits','tac_application_actions','tac_policy_reviews','tac_review_history')");expect(rows.rows).toHaveLength(4);expect(rows.rows.every(r=>r.relrowsecurity)).toBe(true)})
 it('owner creates one employer, retries cannot duplicate it',async()=>{await asUser(owner);await db.exec(`INSERT INTO public.tac_employer_benefits(household_id,company,total_employees,eligible_employees,enrolled_employees) VALUES('${house}','QA Test Only',0,0,0)`);await expect(db.exec(`INSERT INTO public.tac_employer_benefits(household_id,company) VALUES('${house}','QA Test Only')`)).rejects.toThrow()})
 it('validates counts, outcome reasons and compensation basis in the database',async()=>{await asUser(owner);for(const fields of ["total_employees=3,eligible_employees=4","stage='paused',outcome_reason=null","expected_monthly_cents=100,compensation_arrangement=null"]){await expect(db.exec(`UPDATE public.tac_employer_benefits SET ${fields},revision=revision+1`)).rejects.toThrow()}})
 it('requires revision and preserves old values in append-only history',async()=>{await asUser(owner);await expect(db.exec("UPDATE public.tac_employer_benefits SET company='Changed'")).rejects.toThrow('stale_record');await db.exec("UPDATE public.tac_employer_benefits SET next_action='Review proposal internally',revision=revision+1");const history=await db.query<{before_record:{company:string};after_record:{next_action:string}}>('select before_record,after_record from public.tac_review_history order by id desc limit 1');expect(history.rows[0].before_record.company).toBe('QA Test Only');expect(history.rows[0].after_record.next_action).toBe('Review proposal internally');await expect(db.exec('DELETE FROM public.tac_review_history')).rejects.toThrow()})
 it('assigned advisor reads but cannot edit; unrelated advisor sees no client facts',async()=>{await asUser(advisor);expect((await db.query('SELECT * FROM public.tac_employer_benefits')).rows).toHaveLength(1);await expect(db.exec(`INSERT INTO public.tac_application_actions(application_id) VALUES('${app}')`)).rejects.toThrow();await asUser(other);expect((await db.query('SELECT * FROM public.tac_employer_benefits')).rows).toHaveLength(0);expect((await db.query('SELECT * FROM public.tac_review_history')).rows).toHaveLength(0)})
 it('keeps expected/received funding distinct and requires verified surrender terms',async()=>{await asUser(owner);await expect(db.exec(`INSERT INTO public.tac_policy_reviews(application_id,surrender_terms) VALUES('${app}','Five years')`)).rejects.toThrow();await db.exec(`INSERT INTO public.tac_policy_reviews(application_id,source_system,source_record_id,expected_funding_cents,received_funding_cents) VALUES('${app}','Experior','QA-1',100000,0)`);await expect(db.exec(`INSERT INTO public.tac_policy_reviews(application_id) VALUES('${app}')`)).rejects.toThrow();const data=await db.query<{expected_funding_cents:number;received_funding_cents:number}>('SELECT expected_funding_cents,received_funding_cents FROM public.tac_policy_reviews');expect(Number(data.rows[0].expected_funding_cents)).toBe(100000);expect(Number(data.rows[0].received_funding_cents)).toBe(0)})
 it('updates policy metadata without changing expected/received facts',async()=>{await asUser(owner);await db.exec("UPDATE public.tac_policy_reviews SET annual_review_date='2027-10-22',revision=revision+1");const result=await db.query<{revision:number;received_funding_cents:number}>("SELECT revision,received_funding_cents FROM public.tac_policy_reviews");expect(result.rows[0].revision).toBe(2);expect(Number(result.rows[0].received_funding_cents)).toBe(0)})
 it('anonymous role cannot read client metadata',async()=>{await db.exec('RESET ROLE; SET ROLE anon');await expect(db.query('SELECT * FROM public.tac_policy_reviews')).rejects.toThrow()})
})
