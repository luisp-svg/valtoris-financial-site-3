import { setupServiceTestDatabase } from './test-service-production-db.mjs'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
const f = await setupServiceTestDatabase()
let passed = 0
const check = async (name, fn) => {
  await fn()
  passed++
  console.log('PASS ' + name)
}
try {
  const owner = await f.session('owner'),
    advisor = await f.session('advisor'),
    other = await f.session('other'),
    anon = await f.session('anon')
  const key = 'pk_' + randomUUID().replaceAll('-', '')
  const insert = (c, a, k, slug) =>
    c.query(
      "INSERT INTO digital_cards(advisor_profile_id,public_key,slug,status) VALUES($1,$2,$3,'published') RETURNING id,public_key",
      [a, k, slug],
    )
  let id
  await check('advisor can publish own card', async () => {
    id = (await insert(advisor, f.advisors.advisor, key, 'qa-card')).rows[0].id
  })
  await check('other advisor sees no card', async () => {
    assert.equal(
      (await other.query('SELECT id FROM digital_cards WHERE id=$1', [id]))
        .rowCount,
      0,
    )
  })
  await check('anonymous cannot read private card table', async () => {
    await assert.rejects(anon.query('SELECT * FROM digital_cards'))
  })
  await check('advisor and owner cannot rotate permanent key', async () => {
    for (const c of [advisor, owner])
      await assert.rejects(
        c.query('UPDATE digital_cards SET public_key=$2 WHERE id=$1', [
          id,
          'pk_' + randomUUID().replaceAll('-', ''),
        ]),
        /permanent_identity_is_immutable/,
      )
  })
  await check('card cannot be assigned to a different advisor', async () => {
    await assert.rejects(
      owner.query(
        'UPDATE digital_cards SET advisor_profile_id=$2 WHERE id=$1',
        [id, f.advisors.other],
      ),
      /permanent_identity_is_immutable/,
    )
  })
  await check('owner cannot hard delete even a disabled card', async () => {
    await owner.query(
      "UPDATE digital_cards SET status='disabled' WHERE id=$1",
      [id],
    )
    await assert.rejects(
      owner.query('DELETE FROM digital_cards WHERE id=$1', [id]),
      /retire_card_instead_of_delete/,
    )
  })
  await check('valid public profile and slug edits preserve key', async () => {
    const r = await advisor.query(
      "UPDATE digital_cards SET slug='qa-renamed',publish_profile=$2,status='published' WHERE id=$1 RETURNING public_key",
      [id, { approvedTitle: 'QA title' }],
    )
    assert.equal(r.rows[0].public_key, key)
  })
  await check(
    'another advisor cannot edit or publish for the owner',
    async () => {
      assert.equal(
        (
          await other.query(
            "UPDATE digital_cards SET slug='qa-hijack' WHERE id=$1",
            [id],
          )
        ).rowCount,
        0,
      )
      await assert.rejects(
        insert(
          other,
          f.advisors.advisor,
          'pk_' + randomUUID().replaceAll('-', ''),
          'qa-forbidden',
        ),
      )
    },
  )
  await check('retired key is retained and cannot be reused', async () => {
    await owner.query('UPDATE digital_cards SET deleted_at=now() WHERE id=$1', [
      id,
    ])
    await assert.rejects(
      insert(other, f.advisors.other, key, 'qa-reuse'),
      /unique/,
    )
    assert.equal(
      (
        await owner.query('SELECT public_key FROM digital_cards WHERE id=$1', [
          id,
        ])
      ).rows[0].public_key,
      key,
    )
  })
  await check(
    'concurrent creation produces exactly one active card',
    async () => {
      const c2 = await f.session('advisor')
      const results = await Promise.allSettled([
        insert(
          advisor,
          f.advisors.advisor,
          'pk_' + randomUUID().replaceAll('-', ''),
          'qa-race-one',
        ),
        insert(
          c2,
          f.advisors.advisor,
          'pk_' + randomUUID().replaceAll('-', ''),
          'qa-race-two',
        ),
      ])
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
      assert.equal(results.filter((r) => r.status === 'rejected').length, 1)
      assert.equal(
        (
          await advisor.query(
            'SELECT id FROM digital_cards WHERE deleted_at IS NULL',
          )
        ).rowCount,
        1,
      )
    },
  )
  await check('duplicate safeguard reuses existing index', async () => {
    assert.equal(
      (
        await f.db.query(
          "SELECT count(*) n FROM pg_indexes WHERE schemaname='public' AND tablename='digital_cards' AND indexname='digital_cards_one_active_per_advisor_uidx'",
        )
      ).rows[0].n,
      '1',
    )
  })
  await check('inactive profile has no card access', async () => {
    await f.db.query('UPDATE profiles SET is_active=false WHERE id=$1', [
      f.users.advisor,
    ])
    assert.equal(
      (await advisor.query('SELECT id FROM digital_cards')).rowCount,
      0,
    )
  })
  console.log(JSON.stringify({ passed, failed: 0, productionTouched: false }))
} finally {
  await f.close()
}
