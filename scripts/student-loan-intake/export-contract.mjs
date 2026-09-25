import fs from 'node:fs'
import ts from 'typescript'
const path = 'crm/serviceIntakes/studentLoanSchema.ts'
const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const schema = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const contract = { tracks: schema.STUDENT_LOAN_TRACKS, sections: schema.STUDENT_LOAN_INTAKE_SECTIONS }
const sql = `-- Generated from studentLoanSchema.ts; run node scripts/student-loan-intake/export-contract.mjs --check to verify.\nCREATE OR REPLACE FUNCTION public.student_loan_intake_contract()\nRETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $contract$\nSELECT $json$${JSON.stringify(contract)}$json$::jsonb;\n$contract$;\nREVOKE ALL ON FUNCTION public.student_loan_intake_contract() FROM PUBLIC, anon, authenticated;\n`
const out = 'supabase/migrations/059_student_loan_intake_contract.sql'
if (process.argv.includes('--check')) {
  if (fs.readFileSync(out, 'utf8') !== sql) throw new Error('Student Loan database contract differs from the form schema')
} else fs.writeFileSync(out, sql)
