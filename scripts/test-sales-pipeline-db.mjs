import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { setupServiceTestDatabase } from './test-service-production-db.mjs'
const f = await setupServiceTestDatabase()
let passed = 0
const check = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
try {
  const owner = await f.session('owner'), advisor = await f.session('advisor'), other = await f.session('other'), anon = await f.session('anon'), client = await f.session('client')
  const id = await f.opportunity('health')
  await check('existing create paths accept omitted product', async () => {
    assert.equal((await advisor.query('SELECT presented_product FROM opportunities WHERE id=$1', [id])).rows[0].presented_product, null)
  })
  await check('authorized advisor can edit product without replacing metadata or stage', async () => {
    await f.db.query("UPDATE opportunities SET metadata='{\"preserve\":true}' WHERE id=$1", [id])
    const before = (await advisor.query('SELECT stage_id,metadata FROM opportunities WHERE id=$1', [id])).rows[0]
    await advisor.query("UPDATE opportunities SET presented_product='QA Health Plan' WHERE id=$1", [id])
    const after = (await advisor.query('SELECT stage_id,metadata,presented_product FROM opportunities WHERE id=$1', [id])).rows[0]
    assert.equal(after.presented_product, 'QA Health Plan'); assert.equal(after.stage_id, before.stage_id); assert.deepEqual(after.metadata, before.metadata)
  })
  await check('other advisor and client cannot read or update product', async () => {
    for (const c of [other, client]) {
      assert.equal((await c.query('SELECT presented_product FROM opportunities WHERE id=$1', [id])).rowCount, 0)
      assert.equal((await c.query("UPDATE opportunities SET presented_product='Forbidden' WHERE id=$1 RETURNING id", [id])).rowCount, 0)
    }
  })
  await check('anonymous cannot read private pipeline', () => assert.rejects(anon.query('SELECT presented_product FROM opportunities')))
  await check('database rejects blank, padded, and oversized product descriptions', async () => {
    for (const value of ['', ' ', ' QA ', 'x'.repeat(201)]) await assert.rejects(advisor.query('UPDATE opportunities SET presented_product=$2 WHERE id=$1', [id, value]), /opportunities_presented_product_check/)
  })
  await check('owner can update and advisor can explicitly clear product', async () => {
    await owner.query("UPDATE opportunities SET presented_product='Owner reviewed plan' WHERE id=$1", [id])
    await advisor.query('UPDATE opportunities SET presented_product=NULL WHERE id=$1', [id])
    assert.equal((await owner.query('SELECT presented_product FROM opportunities WHERE id=$1', [id])).rows[0].presented_product, null)
  })
  await check('stage protection remains enforced', () => assert.rejects(advisor.query("UPDATE opportunities SET status='won' WHERE id=$1", [id]), /require move_opportunity_stage/))
  await check('rollback removes only product field and preserves opportunity', async () => {
    const before = (await f.db.query("SELECT to_jsonb(o)-'presented_product' data FROM opportunities o WHERE id=$1", [id])).rows[0].data
    await f.db.query('ALTER TABLE opportunities DROP COLUMN presented_product')
    const after = (await f.db.query('SELECT to_jsonb(o) data FROM opportunities o WHERE id=$1', [id])).rows[0].data
    assert.deepEqual(after,before)
  })
  // Restore approved schema before checking the separate, pre-existing access gap.
  await f.db.query(readFileSync('supabase/migrations/077_opportunity_presented_product.sql', 'utf8'))
  await check('inactive advisor cannot access pipeline', async () => {
    await f.db.query('UPDATE profiles SET is_active=false WHERE id=$1', [f.users.advisor])
    assert.equal((await advisor.query('SELECT id FROM opportunities WHERE id=$1', [id])).rowCount, 0)
    assert.equal((await advisor.query("UPDATE opportunities SET presented_product='Denied' WHERE id=$1 RETURNING id", [id])).rowCount, 0)
    assert.equal((await advisor.query('SELECT crm_can_access_household($1) allowed',[f.households.advisor])).rows[0].allowed,false)
    await f.db.query('UPDATE profiles SET is_active=true WHERE id=$1', [f.users.advisor])
  })
  await check('active assigned advisor and owner retain household access', async () => {
    assert.equal((await advisor.query('SELECT crm_can_access_household($1) allowed',[f.households.advisor])).rows[0].allowed,true)
    assert.equal((await owner.query('SELECT crm_can_access_household($1) allowed',[f.households.other])).rows[0].allowed,true)
    assert.equal((await advisor.query('SELECT crm_can_access_household($1) allowed',[f.households.other])).rows[0].allowed,false)
  })
  await check('deleted login, changed role, or inactive advisor record denies access', async () => {
    await f.db.query('UPDATE profiles SET deleted_at=now() WHERE id=$1',[f.users.advisor])
    assert.equal((await advisor.query('SELECT crm_can_access_household($1) allowed',[f.households.advisor])).rows[0].allowed,false)
    await f.db.query("UPDATE profiles SET deleted_at=NULL,role='client' WHERE id=$1",[f.users.advisor])
    assert.equal((await advisor.query('SELECT crm_can_access_household($1) allowed',[f.households.advisor])).rows[0].allowed,false)
    await f.db.query("UPDATE profiles SET role='advisor' WHERE id=$1",[f.users.advisor])
    await f.db.query('UPDATE advisor_profiles SET is_active=false WHERE id=$1',[f.advisors.advisor])
    assert.equal((await advisor.query('SELECT crm_can_access_household($1) allowed',[f.households.advisor])).rows[0].allowed,false)
    await f.db.query('UPDATE advisor_profiles SET is_active=true WHERE id=$1',[f.advisors.advisor])
  })
  console.log(JSON.stringify({ passed, failed: 0 }))
} finally { await f.close() }
