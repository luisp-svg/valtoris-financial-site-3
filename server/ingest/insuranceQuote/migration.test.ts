import { readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
const sql=readFileSync('supabase/migrations/056_insurance_quote_intake.sql','utf8')
it('preserves the Digital Identity photo transfer and guarded CRM archive',()=>{
 expect(sql).toContain('v_photo_count > 1')
 expect(sql).toContain("doc_type = 'relationship_photo'")
 expect(sql).toContain("v_lead.lead_type <> 'Digital Identity' AND v_photo_count > 0")
 expect(sql).toContain('CRM_DUP:unsafe_dependents')
 expect(sql).toContain('CRM_INTAKE:duplicate_review_pending')
 expect(sql.indexOf("'Intake archived'")).toBeLessThan(sql.indexOf('deleted_at = now()'))
 expect(sql).not.toMatch(/CREATE TABLE|CREATE POLICY|DISABLE ROW LEVEL SECURITY/)
 expect(sql).toContain('REVOKE ALL ON FUNCTION public.ingest_insurance_quote(jsonb) FROM PUBLIC, anon, authenticated')
})
