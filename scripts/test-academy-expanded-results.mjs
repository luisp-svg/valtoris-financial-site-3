import { PGlite } from '@electric-sql/pglite'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const database = new PGlite()
const sqlDirectory = fileURLToPath(new URL('./sql/academy/', import.meta.url))
await database.exec(`
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
    $$SELECT nullif(current_setting('test.uid', true), '')::uuid$$;
  CREATE TABLE public.profiles (
    id uuid PRIMARY KEY, full_name text, role text,
    is_active boolean, deleted_at timestamptz
  );
`)
for (const file of [
  'pilot-progress.sql', 'pilot-owner-overview.sql', 'pilot-core-exam.sql',
  'pilot-core-certificate.sql', 'pilot-student-loan-exam.sql',
]) {
  await database.exec(await readFile(sqlDirectory + file, 'utf8'))
}
const advisorIds = Array.from({ length: 5 }, (_, index) => `00000000-0000-0000-0000-00000000000${index + 1}`)
for (const [index, advisorId] of advisorIds.entries()) {
  await database.query('INSERT INTO profiles VALUES ($1, $2, $3, $4, NULL)', [
    advisorId, `Advisor ${index + 1}`, index === 3 ? 'owner' : 'advisor', index !== 4,
  ])
  await database.query(`
    INSERT INTO academy_pilot_progress VALUES ($1, ARRAY[
      'core-valtoris', 'core-referrals', 'core-marketing', 'core-networking',
      'first-conversation', 'verify-the-record', 'handoff-and-follow-up'
    ], 'handoff-and-follow-up')
  `, [advisorId])
}
await database.query('INSERT INTO academy_pilot_student_loan_exam VALUES ($1, 6)', [advisorIds[1]])
await database.exec(await readFile(sqlDirectory + 'pilot-student-loan-certificate.sql', 'utf8'))
await database.exec(await readFile(sqlDirectory + 'pilot-student-loan-expanded-results.sql', 'utf8'))

async function setActor(advisorId) {
  await database.query("SELECT set_config('test.uid', $1, false)", [advisorId])
}
async function expandedExam(answers = null) {
  const result = await database.query('SELECT academy_pilot_student_loan_expanded_exam($1::integer[]) result', [answers])
  return result.rows[0].result
}

await setActor(advisorIds[1])
const historical = await expandedExam()
assert.equal(historical.best, null)
assert.ok(historical.certificate.id)

const failed = await expandedExam([1, 1, 1, 1, 1, 1, 1])
assert.equal(failed.best, 1)
assert.equal(failed.lastScore, 1)
assert.ok(failed.lastAttemptAt)
assert.deepEqual(failed.certificate, historical.certificate)

const passed = await expandedExam([0, 0, 2, 0, 1, 2, 0])
assert.equal(passed.best, 6)
assert.equal(passed.lastScore, 6)
const retry = await expandedExam([1, 1, 1, 1, 1, 1, 1])
assert.equal(retry.best, 6)
assert.equal(retry.lastScore, 1)
assert.deepEqual(retry.certificate, historical.certificate)

const saved = await expandedExam()
assert.equal(saved.best, 6)
assert.equal(saved.lastScore, 1)
assert.ok(saved.lastAttemptAt)
await assert.rejects(expandedExam([0, 0]), /Answer all seven/)
assert.equal((await expandedExam()).best, 6)

await setActor(advisorIds[0])
assert.equal((await expandedExam()).best, null)
const freshPass = await expandedExam([0, 0, 2, 0, 1, 2, 2])
assert.equal(freshPass.best, 7)
assert.ok(freshPass.certificate.id)

await setActor(advisorIds[3])
const overview = await database.query('SELECT * FROM academy_pilot_owner_overview()')
const advisor = overview.rows.find(row => row.advisor_id === advisorIds[1])
assert.equal(advisor.student_loan_expanded_exam_best, 6)
assert.equal(advisor.student_loan_expanded_exam_last, 1)
assert.ok(advisor.student_loan_expanded_exam_attempted_at)

await setActor(advisorIds[2])
await assert.rejects(database.query('SELECT * FROM academy_pilot_owner_overview()'), /owner access/)
await database.query("UPDATE academy_pilot_progress SET completed = '{}' WHERE advisor_id = $1", [advisorIds[2]])
await assert.rejects(expandedExam([0, 0, 2, 0, 1, 2, 2]), /Complete Core/)
await setActor(advisorIds[4])
await assert.rejects(expandedExam(), /access denied/)
await setActor('')
await assert.rejects(expandedExam(), /access denied/)
await database.exec('SET ROLE authenticated')
await assert.rejects(database.query('SELECT * FROM academy_pilot_student_loan_exam'), /permission denied/)
await database.exec('RESET ROLE; SET ROLE anon')
await assert.rejects(expandedExam(), /permission denied/)

console.log('PASS historical separation, grading, saved results, certificates, owner view and access guards')
await database.close()
