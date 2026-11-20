import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const db = new PGlite()
await db.exec(`
CREATE ROLE authenticated;
CREATE ROLE anon;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE TABLE public.profiles (id uuid PRIMARY KEY, is_active boolean, deleted_at timestamptz, role text);
INSERT INTO profiles VALUES
 ('00000000-0000-0000-0000-000000000001', true, NULL, 'advisor'),
 ('00000000-0000-0000-0000-000000000002', true, NULL, 'advisor'),
 ('00000000-0000-0000-0000-000000000003', false, NULL, 'advisor');
`)
await db.exec(await readFile('scripts/sql/academy/course-launch.sql', 'utf8'))
const key = (await db.query("SELECT answer_key FROM tac_academy_courses WHERE slug='student-loan'")).rows[0].answer_key.split('')
const call = async (course, lesson=null, done=false, answers=null) =>
  (await db.query('SELECT tac_academy_course($1,$2,$3,$4) AS course', [course,lesson,done,answers])).rows[0].course
await db.exec('SET ROLE anon')
await assert.rejects(call('student-loan'), { code: '42501' })
await db.exec('SET ROLE authenticated')
await assert.rejects(call('student-loan'), { code: '42501' })
const signIn = n => db.exec(`SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000${n}'`)
await signIn(1)
await assert.rejects(db.query('SELECT answer_key FROM tac_academy_courses'), { code: '42501' })
await assert.rejects(db.query('SELECT * FROM tac_academy_progress'), { code: '42501' })
const original = await call('student-loan')
assert.equal(original.questions.length,100)
assert.ok(original.questions.every(q => !Object.hasOwn(q,'key')))
assert.equal(original.lessons.filter(l => /^m\d+$/.test(l.id)).length,55)
await call('student-loan','m01',true)
await call('student-loan','m01',true)
await assert.rejects(call('student-loan','missing',true), { code: '22023' })
await assert.rejects(call('student-loan',null,false, ['A']), { code: '22023' })
assert.equal((await call('student-loan',null,false,key)).lastCorrect,100)
const saved = await call('student-loan',null,false,key.map(a => a === 'A' ? 'B' : 'A'))
assert.equal(saved.lastCorrect,0)
assert.equal(saved.bestCorrect,100)
assert.deepEqual(saved.completed,['m01'])
assert.equal(saved.lastLesson,'m01')
assert.equal(saved.attempts,2)
await signIn(2)
assert.deepEqual((await call('student-loan')).completed,[])
assert.equal((await call('student-loan')).bestCorrect,null)
assert.equal((await call('texas-pc')).questions.length,16)
await signIn(3)
await assert.rejects(call('texas-pc'), { code: '42501' })
console.log('Academy integration checks passed')
await db.close()
