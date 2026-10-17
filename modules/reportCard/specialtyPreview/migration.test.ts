import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { describe,it,expect } from 'vitest'
const migration=(name:string)=>readFileSync(new URL(`../../../supabase/migrations/${name}`,import.meta.url),'utf8')
describe('additive guided Report Card SQL migration',()=>{
 it('extends all four functions, preserves service-only permissions, and is repeatable',async()=>{
  const db=new PGlite()
  try{
   await db.exec(`CREATE ROLE anon; CREATE ROLE service_role; CREATE TYPE public.assessment_type AS ENUM ('family','business','retirement','protection','student_loan','credit','home_buyer');`)
   for(const name of ['ingest_public_report_card','create_public_family_follow_up_task','resolve_public_family_duplicate_review','enqueue_insurance_quote_delivery'])await db.exec(`CREATE FUNCTION public.${name}(p_type text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF p_type NOT IN ('family', 'business', 'retirement', 'protection', 'student_loan', 'credit', 'home_buyer') THEN RAISE EXCEPTION 'invalid_assessment_type'; END IF; RETURN CASE p_type WHEN 'home_buyer' THEN 'Home Buyer Report Card' ELSE p_type END; END $$; REVOKE ALL ON FUNCTION public.${name}(text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.${name}(text) TO service_role;`)
   await db.exec(migration('20261017041000_guided_report_card_types.sql'))
   const writer=migration('20261017041100_guided_report_card_ingest.sql')
   await db.exec(writer);await db.exec(writer)
   for(const name of ['ingest_public_report_card','create_public_family_follow_up_task','resolve_public_family_duplicate_review','enqueue_insurance_quote_delivery']){
    const r=await db.query<{value:string}>(`select public.${name}('health') as value`);expect(r.rows[0].value).toBe('Health Insurance Report Card')
    const rights=await db.query<{anon:boolean;service:boolean}>(`select has_function_privilege('anon','public.${name}(text)','execute') as anon,has_function_privilege('service_role','public.${name}(text)','execute') as service`)
    expect(rights.rows[0]).toEqual({anon:false,service:true})
   }
   const types=await db.query<{value:string}>(`select unnest(enum_range(null::public.assessment_type))::text as value`);expect(types.rows.map(r=>r.value)).toEqual(expect.arrayContaining(['health','tsp','benefits','tax']))
  }finally{await db.close()}
 },20000)
})
