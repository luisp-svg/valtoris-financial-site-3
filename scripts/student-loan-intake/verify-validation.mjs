import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import ts from 'typescript'
import assert from 'node:assert/strict'
const db = new PGlite()
await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;')
for (const file of ['20261023010000_student_loan_intake_fields.sql', '20261023010100_student_loan_validation.sql']) await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'))
const js = ts.transpileModule(fs.readFileSync('crm/serviceIntakes/studentLoanSchema.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const schema = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const a = schema.emptyStudentLoanIntake()
let checks = 0
async function validate(answers,complete,expected) {
 let message = ''
 try { await db.query('SELECT public.validate_student_loan_intake($1::jsonb,$2::boolean)',[JSON.stringify(answers),complete]) } catch(e) { message = e.message }
 if(expected) assert.match(message,expected); else assert.equal(message,'')
 checks++
}
await validate(a,false)
a.sections.client[0].dateOfBirth = '2999-01-01'; await validate(a,false,/future_birth_date/)
a.sections.client[0].dateOfBirth = '2025-02-30'; await validate(a,false,/invalid_date/)
a.sections.client[0].dateOfBirth = '1980-02-29'; await validate(a,false)
delete a.sections.client[0].dateOfBirth; delete a.sections.client[0].fsaLoginReady; delete a.sections.client[0].fsaDataStatus; delete a.sections.client[0].fsaDataDate
await validate(a,false)
a.sections.client[0].fsaPassword = 'fixture'; await validate(a,false,/invalid_fields/)
await db.close()
console.log(JSON.stringify({databaseValidationChecks:checks, passed:true}))
