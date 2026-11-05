import assert from 'node:assert/strict'
import { readFileSync,mkdtempSync,writeFileSync,rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { planAclRecovery } from './plan-acl-recovery.mjs'

const query=readFileSync(new URL('./sql/academy/acl-recovery-snapshot.sql',import.meta.url),'utf8')
  .replace('REPLACE_WITH_PROJECT_REF','isolated-fixture')
const proposal=readFileSync(new URL('./sql/academy/proposed-browser-privilege-hardening.sql',import.meta.url),'utf8')
const snapshot=async db=>(await db.query(query)).rows[0].snapshot
const setup=async()=>{
  const db=new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.example(id integer,"odd,column" text);
    GRANT SELECT,INSERT ON public.example TO authenticated;
    GRANT MAINTAIN,TRIGGER ON public.example TO authenticated WITH GRANT OPTION;
    GRANT REFERENCES(id) ON public.example TO PUBLIC;
    GRANT ALL ON public.example TO service_role;
    CREATE FUNCTION public.handle_new_auth_user() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
    GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO authenticated WITH GRANT OPTION;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,MAINTAIN ON TABLES TO authenticated;
  `)
  return db
}

test('captured grants and grant options can be restored exactly in an isolated database',async()=>{
  const db=await setup()
  try {
    const before=await snapshot(db)
    await db.exec(proposal)
    const current=await snapshot(db)
    const plan=planAclRecovery(before,current)
    assert.equal(plan.status,'manual-review-required')
    assert.ok(plan.statements.some(s=>s.includes('WITH GRANT OPTION')))
    assert.ok(plan.statements.some(s=>s.includes('REFERENCES ("id")')))
    assert.ok(plan.statements.every(s=>!s.includes('GRANT ALL')))
    await db.exec(`BEGIN;\n${plan.statements.join('\n')}\nCOMMIT;`)
    assert.deepEqual(await snapshot(db),before)
    assert.equal(planAclRecovery(before,await snapshot(db)).removedGrantCount,0)
  } finally { await db.close() }
})

test('unrelated grant loss or additions stop recovery planning',async()=>{
  for (const change of ['REVOKE SELECT ON public.example FROM authenticated','GRANT DELETE ON public.example TO anon']) {
    const db=await setup()
    try {
      const before=await snapshot(db)
      await db.exec(proposal)
      await db.exec(change)
      const otherSource=structuredClone(before);otherSource.sourceLabel='different-source'
      assert.throws(()=>planAclRecovery(before,otherSource),/source mismatch/)
      const current=await snapshot(db)
      assert.throws(()=>planAclRecovery(before,current),/privileges changed|Grants were added/)
    } finally { await db.close() }
  }
})

test('changed object identity, source labels and incomplete inventories are rejected',async()=>{
  const db=await setup()
  try {
    const before=await snapshot(db)
    await db.exec('ALTER TABLE public.example RENAME COLUMN id TO changed_id')
    assert.throws(()=>planAclRecovery(before,{}),/Invalid recovery snapshot/)
    const current=await snapshot(db)
    assert.throws(()=>planAclRecovery(before,current),/Object identity/)
    const partial=structuredClone(before);partial.objects.pop()
    assert.throws(()=>planAclRecovery(before,partial),/Invalid recovery snapshot|inventory changed/)
    const unlabelled=structuredClone(before);unlabelled.sourceLabel='REPLACE_WITH_PROJECT_REF'
    assert.throws(()=>planAclRecovery(unlabelled,before),/verified source label/)
  } finally { await db.close() }
})

test('changed helper definitions cannot receive stale recovery grants',async()=>{
  const db=await setup()
  try {
    const before=await snapshot(db)
    await db.exec(proposal)
    await db.exec('CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;')
    const current=await snapshot(db)
    assert.throws(()=>planAclRecovery(before,current),/Object identity/)
  } finally { await db.close() }
})

test('CLI emits review-only JSON and keeps malformed input private',async()=>{
  const db=await setup(),dir=mkdtempSync(path.join(tmpdir(),'acl-recovery-'))
  try {
    const before=await snapshot(db)
    const first=path.join(dir,'before.json'),second=path.join(dir,'current.json')
    writeFileSync(first,JSON.stringify(before));writeFileSync(second,JSON.stringify(before))
    const script=fileURLToPath(new URL('./plan-acl-recovery.mjs',import.meta.url))
    const run=()=>spawnSync(process.execPath,[script,first,second],{encoding:'utf8'})
    const valid=run()
    assert.equal(valid.status,0)
    assert.equal(JSON.parse(valid.stdout).status,'manual-review-required')
    assert.equal(JSON.parse(valid.stdout).removedGrantCount,0)
    writeFileSync(second,'private-secret')
    const bad=run()
    assert.equal(bad.status,1);assert.equal(bad.stdout,'')
    assert.ok(!bad.stderr.includes('private-secret'))
  } finally { await db.close();rmSync(dir,{recursive:true,force:true}) }
})
