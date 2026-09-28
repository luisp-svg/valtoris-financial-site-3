import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { setupServiceTestDatabase } from './test-service-production-db.mjs'
const f = await setupServiceTestDatabase()
const seed = readFileSync('scripts/sql/sales-catalog/add-dcbg-empower.sql','utf8')
try {
  const owner = await f.session('owner'), advisor = await f.session('advisor')
  await owner.query(seed)
  const snapshot = async () => (await owner.query("SELECT jsonb_agg(to_jsonb(v) ORDER BY v.code) data FROM service_verticals v WHERE code IN ('dcbg','empower_employee_benefits')")).rows[0].data
  const before = await snapshot()
  await owner.query(seed)
  assert.deepEqual(await snapshot(), before)
  for (const code of ['dcbg','empower_employee_benefits']) {
    const result = await advisor.query('SELECT v.id,v.name,p.id pipeline_id,s.id stage_id FROM service_verticals v JOIN pipelines p ON p.service_vertical_id=v.id AND p.is_default AND p.is_active JOIN pipeline_stages s ON s.pipeline_id=p.id WHERE v.code=$1 ORDER BY s.sort_order',[code])
    assert.equal(result.rowCount,5)
    const v=result.rows[0]
    const inserted=await advisor.query('INSERT INTO opportunities(household_id,service_vertical_id,pipeline_id,stage_id,title,assigned_advisor_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[f.households.advisor,v.id,v.pipeline_id,v.stage_id,'QA '+v.name,f.advisors.advisor])
    assert.equal(inserted.rowCount,1)
  }
  assert.equal((await owner.query("SELECT count(*)::int n FROM pipeline_stages s JOIN pipelines p ON p.id=s.pipeline_id JOIN service_verticals v ON v.id=p.service_vertical_id WHERE v.code IN ('dcbg','empower_employee_benefits') AND s.is_won")).rows[0].n,2)
  console.log('PASS both services visible to active advisors; five stages each; opportunity creation for both; correct won stages; idempotent seed')
} finally { await f.close() }
