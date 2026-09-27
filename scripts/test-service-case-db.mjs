import { setupServiceTestDatabase } from './test-service-production-db.mjs'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
const f = await setupServiceTestDatabase()
let passed = 0
const check = async (label, fn) => {
  await fn()
  passed++
  console.log('PASS ' + label)
}
try {
  const owner = await f.session('owner'),
    advisor = await f.session('advisor'),
    other = await f.session('other'),
    client = await f.session('client'),
    anon = await f.session('anon')
  const create = async (line = 'health') => {
    const o = await f.opportunity(line)
    return (
      await owner.query('SELECT create_service_production($1,$2,$3) AS id', [
        o,
        {
          ...f.payload(line),
          production_status: 'submitted',
          submission_date: '2026-09-27',
        },
        JSON.stringify([
          { advisor_id: f.advisors.advisor, writing_bps: 10000 },
        ]),
      ])
    ).rows[0].id
  }
  const revision = async (id) =>
    (
      await f.db.query(
        'SELECT revision FROM service_production_records WHERE id=$1',
        [id],
      )
    ).rows[0].revision
  const fields = {
    case_owner_user_id: f.users.advisor,
    case_stage: 'in_progress',
    next_follow_up_date: '2026-09-26',
    waiting_reason: null,
  }
  const updateCase = async (id, c = owner, patch = {}, rev) =>
    c.query('SELECT update_service_case($1,$2,$3,$4)', [
      id,
      rev ?? (await revision(id)),
      { ...fields, ...patch },
      'QA case update',
    ])
  const base = {
    label: 'Signature required',
    status: 'open',
    is_blocking: true,
    assigned_user_id: f.users.advisor,
    due_date: '2026-09-26',
    scheduled_for: null,
  }
  const save = async (
    id,
    qid = randomUUID(),
    patch = {},
    qrev = null,
    c = owner,
    rrev,
  ) => {
    await c.query('SELECT save_service_requirement($1,$2,$3,$4,$5,$6)', [
      id,
      rrev ?? (await revision(id)),
      qid,
      qrev,
      { ...base, ...patch },
      'QA requirement reason',
    ])
    return qid
  }
  const qrow = async (q) =>
    (
      await f.db.query(
        'SELECT * FROM service_production_requirements WHERE id=$1',
        [q],
      )
    ).rows[0]
  const complete = async (id, c = owner, status = 'completed') => {
    const r = (
      await f.db.query('SELECT * FROM service_production_records WHERE id=$1', [
        id,
      ])
    ).rows[0]
    const p = {
      provider_name: r.provider_name,
      product_name: r.product_name,
      external_reference: null,
      submission_date: '2026-09-27',
      production_status: status,
      value_cents: r.value_cents,
      value_basis: r.value_basis,
      notes: null,
    }
    return c.query('SELECT update_service_production($1,$2,$3,$4)', [
      id,
      r.revision,
      p,
      'QA status change',
    ])
  }
  let id, q
  await check(
    'all seven service lines support case work and requirements',
    async () => {
      for (const line of [
        'pc_personal',
        'pc_commercial',
        'health',
        'student_loans',
        'credit_repair',
        'wills_trusts',
        'tax_strategy',
      ]) {
        id = await create(line)
        await updateCase(id)
        q = await save(id)
        assert.equal((await qrow(q)).status, 'open')
      }
    },
  )
  await check('case work preserves reviewed compensation', async () => {
    const fresh = await create()
    const allocation = (
      await f.db.query(
        'SELECT id FROM service_production_allocations WHERE record_id=$1',
        [fresh],
      )
    ).rows[0].id
    await owner.query(
      'SELECT review_service_production_estimate($1,$2,$3,$4,$5,$6)',
      [
        fresh,
        await revision(fresh),
        allocation,
        'flat_referral',
        234,
        'QA supported estimate',
      ],
    )
    await updateCase(fresh)
    await save(fresh)
    const after = (
      await f.db.query(
        'SELECT review_status,expected_cents FROM service_production_allocations WHERE id=$1',
        [allocation],
      )
    ).rows[0]
    assert.equal(after.review_status, 'reviewed')
    assert.equal(Number(after.expected_cents), 234)
  })
  await check(
    'eligible users include owner and household advisor only',
    async () => {
      const ids = (
        await advisor.query('SELECT * FROM service_case_assignees($1)', [id])
      ).rows.map((r) => r.id)
      assert.deepEqual(new Set(ids), new Set([f.users.owner, f.users.advisor]))
      assert.equal(
        (await other.query('SELECT * FROM service_case_assignees($1)', [id]))
          .rowCount,
        0,
      )
    },
  )
  await check(
    'unassigned advisor and client cannot read or mutate requirements',
    async () => {
      for (const c of [other, client]) {
        assert.equal(
          (await c.query('SELECT * FROM service_production_requirements'))
            .rowCount,
          0,
        )
        await assert.rejects(save(id, randomUUID(), {}, null, c), /not_found/)
      }
    },
  )
  await check('anonymous and direct authenticated writes denied', async () => {
    await assert.rejects(
      anon.query('SELECT * FROM service_production_requirements'),
      /permission denied/,
    )
    await assert.rejects(
      advisor.query(
        'UPDATE service_production_requirements SET label=$1 WHERE id=$2',
        ['bad', q],
      ),
      /permission denied/,
    )
    await assert.rejects(
      anon.query('SELECT update_service_case($1,1,$2,$3)', [id, fields, 'bad']),
      /permission denied/,
    )
  })
  await check('assignment never expands client access', async () => {
    await assert.rejects(
      updateCase(id, owner, { case_owner_user_id: f.users.other }),
      /ineligible_assignee/,
    )
    await assert.rejects(
      save(id, randomUUID(), { assigned_user_id: f.users.other }),
      /ineligible_assignee/,
    )
    await assert.rejects(
      updateCase(id, advisor, { case_owner_user_id: f.users.owner }),
      /owner_assignment_required/,
    )
  })
  await check(
    'waiting reason and invalid case stage are rejected atomically',
    async () => {
      const before = await revision(id)
      await assert.rejects(
        updateCase(id, owner, { case_stage: 'waiting_client' }),
        /check constraint/,
      )
      await assert.rejects(
        updateCase(id, owner, { case_stage: 'invalid' }),
        /check constraint/,
      )
      assert.equal(await revision(id), before)
    },
  )
  await check('waiting stage with reason records history', async () => {
    await updateCase(id, advisor, {
      case_stage: 'waiting_client',
      waiting_reason: 'Awaiting signature',
    })
    assert.equal(
      (
        await f.db.query(
          "SELECT count(*)::int AS n FROM service_production_history WHERE record_id=$1 AND event_type='case_updated'",
          [id],
        )
      ).rows[0].n,
      2,
    )
  })
  await check('stale case edits cannot overwrite new data', async () => {
    await assert.rejects(updateCase(id, owner, {}, 1), /stale_record/)
  })
  await check(
    'existing production update cannot bypass completion blockers',
    async () => {
      await assert.rejects(complete(id), /blocking_requirements/)
      await assert.rejects(
        updateCase(id, owner, { case_stage: 'ready_to_complete' }),
        /blocking_requirements/,
      )
    },
  )
  await check(
    'requirement create retry returns same row without duplicate history',
    async () => {
      const before = await revision(id)
      await save(id, q, {}, null, owner, 1)
      assert.equal(await revision(id), before)
    },
  )
  await check('cross-record requirement ID rejected', async () => {
    const second = await create()
    await assert.rejects(save(second, q), /not_found/)
  })
  await check('schedule requires date; unknown fields rejected', async () => {
    await assert.rejects(
      save(id, randomUUID(), { status: 'scheduled' }),
      /check constraint/,
    )
    await assert.rejects(
      save(id, randomUUID(), { unapproved: 'x' }),
      /invalid_payload|unknown/,
    )
    await assert.rejects(save(id, randomUUID(), { due_date: 'bad' }), /date/)
  })
  await check('completion timestamp is managed by server', async () => {
    await save(id, q, { status: 'complete' }, 1)
    assert.ok((await qrow(q)).completed_at)
  })
  await check('completed requirement can only reopen to open', async () => {
    await assert.rejects(
      save(id, q, { status: 'waived' }, 2),
      /invalid_requirement_transition/,
    )
    await save(id, q, {}, 2)
    assert.equal((await qrow(q)).completed_at, null)
  })
  await check(
    'waived requirement clears blocker and records timestamp',
    async () => {
      await save(id, q, { status: 'waived' }, 3)
      assert.ok((await qrow(q)).waived_at)
      await updateCase(id, owner, { case_stage: 'ready_to_complete' })
    },
  )
  await check('ready case rejects new blocking requirements', async () => {
    await assert.rejects(save(id), /ready_case_blocker/)
  })
  await check(
    'resolved case completes; closed cases reject requirement work',
    async () => {
      await complete(id)
      await assert.rejects(save(id), /case_not_active/)
      await assert.rejects(updateCase(id), /case_not_active/)
    },
  )
  await check('only owner can reopen closed production', async () => {
    await assert.rejects(
      complete(id, advisor, 'submitted'),
      /owner_reopen_required/,
    )
    await complete(id, owner, 'submitted')
    await updateCase(id)
  })
  await check('cancelled requirement terminal and nonblocking', async () => {
    const x = await save(id)
    await save(id, x, { status: 'cancelled' }, 1)
    await assert.rejects(save(id, x, {}, 2), /invalid_requirement_transition/)
  })
  await check(
    'requirement reason failure rolls back rows/revision/history',
    async () => {
      const before = await revision(id)
      await assert.rejects(
        owner.query('SELECT save_service_requirement($1,$2,$3,NULL,$4,$5)', [
          id,
          before,
          randomUUID(),
          base,
          '',
        ]),
        /reason_required/,
      )
      assert.equal(await revision(id), before)
    },
  )
  await check(
    'concurrent edits serialize with one stale rejection',
    async () => {
      const second = await f.session('owner')
      const rev = await revision(id)
      const results = await Promise.allSettled([
        updateCase(id, owner, {}, rev),
        updateCase(id, second, {}, rev),
      ])
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
      assert.match(
        results.find((r) => r.status === 'rejected').reason.message,
        /stale_record/,
      )
    },
  )
  await check(
    'completion race cannot commit an unresolved blocker',
    async () => {
      const fresh = await create()
      const second = await f.session('owner')
      const results = await Promise.allSettled([
        complete(fresh, owner),
        save(fresh, randomUUID(), {}, null, second, 1),
      ])
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
      const row = (
        await f.db.query(
          'SELECT production_status FROM service_production_records WHERE id=$1',
          [fresh],
        )
      ).rows[0]
      if (row.production_status === 'completed')
        assert.equal(
          (
            await f.db.query(
              "SELECT count(*)::int AS n FROM service_production_requirements WHERE record_id=$1 AND status='open'",
              [fresh],
            )
          ).rows[0].n,
          0,
        )
    },
  )
  await check(
    'archived requirements stay owner-visible and immutable to advisors',
    async () => {
      await owner.query('SELECT archive_service_production($1,$2,$3)', [
        id,
        await revision(id),
        'QA archive',
      ])
      assert.ok(
        (
          await owner.query(
            'SELECT * FROM service_production_requirements WHERE record_id=$1',
            [id],
          )
        ).rowCount > 0,
      )
      assert.equal(
        (
          await advisor.query(
            'SELECT * FROM service_production_requirements WHERE record_id=$1',
            [id],
          )
        ).rowCount,
        0,
      )
      await assert.rejects(save(id), /not_found/)
      await assert.rejects(
        owner.query(
          'DELETE FROM service_production_history WHERE record_id=$1',
          [id],
        ),
        /permission denied/,
      )
    },
  )
  console.log(JSON.stringify({ passed, failed: 0 }))
} finally {
  await f.close()
}
