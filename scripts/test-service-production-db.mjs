// Disposable loopback PostgreSQL integration test. Never connects to a hosted database.
// SERVICE_PRODUCTION_TEST_URL may override the isolated local test cluster.
import pg from 'pg'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
const connection =
  process.env.SERVICE_PRODUCTION_TEST_URL ??
  'postgresql://postgres:service-local-qa-only@127.0.0.1:55473/postgres'
const url = new URL(connection)
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
  throw new Error('Only a disposable loopback database is allowed')
export async function setupServiceTestDatabase() {
  const admin = new pg.Client({
    connectionString: connection,
    connectionTimeoutMillis: 5000,
  })
  await admin.connect()
  const name = 'service_qa_' + randomUUID().replaceAll('-', '')
  await admin.query(`CREATE DATABASE ${name}`)
  const testUrl = new URL(connection)
  testUrl.pathname = '/' + name
  const db = new pg.Client({
    connectionString: testUrl.href,
    connectionTimeoutMillis: 5000,
  })
  await db.connect()
  await db.query(`DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
 DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
 DO $$ BEGIN CREATE ROLE service_role BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
 CREATE SCHEMA extensions; CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_user::text$$;
 CREATE TABLE auth.users (id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner uuid);
 GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;`)
  for (const file of fs
    .readdirSync('supabase/migrations')
    .filter((f) => /^\d.*sql$/.test(f))
    .sort()) {
    try {
      await db.query(fs.readFileSync('supabase/migrations/' + file, 'utf8'))
    } catch (e) {
      throw new Error(file + ': ' + e.message)
    }
  }
  const users = {
    owner: randomUUID(),
    advisor: randomUUID(),
    other: randomUUID(),
    client: randomUUID(),
  }
  for (const [label, id] of Object.entries(users))
    await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)', [
      id,
      label + '@service-qa.example.invalid',
    ])
  await db.query("UPDATE public.profiles SET role='owner' WHERE id=$1", [
    users.owner,
  ])
  await db.query("UPDATE public.profiles SET role='client' WHERE id=$1", [
    users.client,
  ])
  const advisors = { advisor: randomUUID(), other: randomUUID() }
  for (const [label, id] of Object.entries(advisors))
    await db.query(
      'INSERT INTO public.advisor_profiles(id,user_id,display_name,slug) VALUES($1,$2,$3,$4)',
      [id, users[label], `QA ${label}`, `service-qa-${label}`],
    )
  const households = { advisor: randomUUID(), other: randomUUID() }
  for (const [label, id] of Object.entries(households))
    await db.query(
      `INSERT INTO public.households(id,display_name,assigned_advisor_id,relationship_pipeline_id,relationship_stage_id) VALUES($1,$2,$3,'22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333001')`,
      [id, 'QA ' + label + ' household', advisors[label]],
    )
  const sessions = []
  async function session(role) {
    const c = new pg.Client({
      connectionString: testUrl.href,
      connectionTimeoutMillis: 5000,
    })
    await c.connect()
    await c.query(role === 'anon' ? 'SET ROLE anon' : 'SET ROLE authenticated')
    await c.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
      users[role] ?? '',
    ])
    sessions.push(c)
    return c
  }
  async function opportunity(line, household = households.advisor) {
    const vertical = line.startsWith('pc_') ? 'pc' : line
    const id = randomUUID()
    await db.query(
      `INSERT INTO public.opportunities(id,household_id,service_vertical_id,pipeline_id,stage_id,title)
    SELECT $1,$2,v.id,p.id,s.id,$3 FROM public.service_verticals v JOIN public.pipelines p ON p.service_vertical_id=v.id AND p.is_default AND p.is_active JOIN public.pipeline_stages s ON s.pipeline_id=p.id AND s.sort_order=1 WHERE v.code=$4`,
      [id, household, `QA ${line}`, vertical],
    )
    return id
  }
  const payload = (line) => ({
    service_line: line,
    provider_name: 'QA Provider',
    product_name: 'QA Service',
    production_status: 'draft',
    value_cents: 12345,
    value_basis: ['health', 'pc_personal', 'pc_commercial'].includes(line)
      ? 'annual_premium'
      : 'contract_value',
  })
  const splits = [
    { advisor_id: advisors.advisor, writing_bps: 6000 },
    { advisor_id: advisors.other, writing_bps: 4000 },
  ]
  async function close() {
    await Promise.all(sessions.map((c) => c.end()))
    await db.end()
    await admin.query(`DROP DATABASE ${name}`)
    await admin.end()
  }
  return {
    db,
    users,
    advisors,
    households,
    session,
    opportunity,
    payload,
    splits,
    close,
  }
}
export async function runServiceTests() {
  const f = await setupServiceTestDatabase()
  let passed = 0
  const check = async (label, fn) => {
    await fn()
    passed++
    console.log('PASS ' + label)
  }
  const owner = await f.session('owner'),
    advisor = await f.session('advisor'),
    other = await f.session('other'),
    client = await f.session('client'),
    anon = await f.session('anon')
  const create = async (c, o, p, s = f.splits) =>
    (
      await c.query('SELECT public.create_service_production($1,$2,$3) AS id', [
        o,
        p,
        JSON.stringify(s),
      ])
    ).rows[0].id
  const reject = async (p, pattern) => assert.rejects(p, pattern)
  try {
    const records = {}
    await check(
      'all seven service lines create with existing household/opportunity links',
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
          const opp = await f.opportunity(line)
          records[line] = { id: await create(owner, opp, f.payload(line)), opp }
        }
        assert.equal(
          (
            await owner.query(
              'SELECT count(*)::int AS n FROM service_production_records',
            )
          ).rows[0].n,
          7,
        )
      },
    )
    const r = records.credit_repair
    await check('concurrent retry returns one record', async () => {
      const o = await f.opportunity('credit_repair')
      const owner2 = await f.session('owner')
      const ids = await Promise.all([
        create(owner, o, f.payload('credit_repair')),
        create(owner2, o, f.payload('credit_repair')),
      ])
      assert.equal(ids[0], ids[1])
    })
    await check('advisor can read assigned client production', async () =>
      assert.equal(
        (
          await advisor.query(
            'SELECT id FROM service_production_records WHERE id=$1',
            [r.id],
          )
        ).rowCount,
        1,
      ),
    )
    await check(
      'writing attribution alone does not expose another client',
      async () =>
        assert.equal(
          (
            await other.query(
              'SELECT id FROM service_production_records WHERE id=$1',
              [r.id],
            )
          ).rowCount,
          0,
        ),
    )
    await check('reserved client role reads no production', async () =>
      assert.equal(
        (await client.query('SELECT id FROM service_production_records'))
          .rowCount,
        0,
      ),
    )
    await check('anonymous access denied', async () =>
      reject(
        anon.query('SELECT id FROM service_production_records'),
        /permission denied/,
      ),
    )
    await check('direct authenticated writes denied', async () => {
      await reject(
        advisor.query(
          "UPDATE service_production_records SET notes='bypass' WHERE id=$1",
          [r.id],
        ),
        /permission denied/,
      )
      await reject(
        owner.query('DELETE FROM service_production_history'),
        /permission denied/,
      )
    })
    await check('advisor sees only own compensation allocation', async () => {
      const rows = (
        await advisor.query(
          'SELECT advisor_id FROM service_production_allocations WHERE record_id=$1',
          [r.id],
        )
      ).rows
      assert.deepEqual(
        rows.map((a) => a.advisor_id),
        [f.advisors.advisor],
      )
    })
    const allocations = (
      await owner.query(
        'SELECT * FROM service_production_allocations WHERE record_id=$1 ORDER BY writing_bps DESC',
        [r.id],
      )
    ).rows
    await check('new estimates are unknown, not zero', async () =>
      assert(
        allocations.every(
          (a) => a.expected_cents === null && a.review_status === 'unreviewed',
        ),
      ),
    )
    const review = (c, rev, a, amount = 9876, model = 'credit_repair') =>
      c.query('SELECT review_service_production_estimate($1,$2,$3,$4,$5,$6)', [
        r.id,
        rev,
        a,
        model,
        amount,
        'QA provider agreement, final advisor amount',
      ])
    await check('advisor cannot self-approve compensation', async () =>
      reject(review(advisor, 1, allocations[0].id), /not_found/),
    )
    await check('owner can review a supported zero estimate', async () => {
      await review(owner, 1, allocations[0].id, 0)
      assert.equal(
        (
          await advisor.query(
            'SELECT expected_cents FROM service_production_allocations WHERE id=$1',
            [allocations[0].id],
          )
        ).rows[0].expected_cents,
        '0',
      )
    })
    await check('stale concurrent edit rejected', async () =>
      reject(review(owner, 1, allocations[1].id), /stale_record/),
    )
    await check(
      'another advisor estimate remains private in history',
      async () => {
        await review(owner, 2, allocations[1].id)
        assert.equal(
          (
            await advisor.query(
              "SELECT * FROM service_production_history WHERE record_id=$1 AND event_type='estimate_reviewed'",
              [r.id],
            )
          ).rowCount,
          1,
        )
        assert.equal(
          (
            await owner.query(
              "SELECT * FROM service_production_history WHERE record_id=$1 AND event_type='estimate_reviewed'",
              [r.id],
            )
          ).rowCount,
          2,
        )
      },
    )
    await check('invalid model rejected', async () =>
      reject(
        review(owner, 3, allocations[0].id, 200, 'pc_split'),
        /invalid_model/,
      ),
    )
    await check(
      'changing production value invalidates estimates atomically',
      async () => {
        const { service_line, ...patch } = f.payload('credit_repair')
        await advisor.query('SELECT update_service_production($1,3,$2,$3)', [
          r.id,
          { ...patch, value_cents: 25000 },
          'QA correction',
        ])
        assert(
          (
            await owner.query(
              'SELECT expected_cents,review_status FROM service_production_allocations WHERE record_id=$1',
              [r.id],
            )
          ).rows.every(
            (a) =>
              a.expected_cents === null && a.review_status === 'unreviewed',
          ),
        )
      },
    )
    await check(
      'invalid allocations roll back the whole creation',
      async () => {
        const o = await f.opportunity('health')
        await reject(
          create(owner, o, f.payload('health'), [
            { advisor_id: f.advisors.advisor, writing_bps: 5000 },
          ]),
          /invalid_splits/,
        )
        assert.equal(
          (
            await owner.query(
              'SELECT id FROM service_production_records WHERE opportunity_id=$1',
              [o],
            )
          ).rowCount,
          0,
        )
      },
    )
    await check(
      'duplicate advisor and injected review fields rejected',
      async () => {
        const o = await f.opportunity('health')
        await reject(
          create(owner, o, f.payload('health'), [
            { advisor_id: f.advisors.advisor, writing_bps: 5000 },
            { advisor_id: f.advisors.advisor, writing_bps: 5000 },
          ]),
          /invalid_splits/,
        )
        await reject(
          create(owner, o, f.payload('health'), [
            {
              advisor_id: f.advisors.advisor,
              writing_bps: 10000,
              expected_cents: 100,
            },
          ]),
          /CRM_PP/,
        )
      },
    )
    await check(
      'invalid service line and insurance value basis rejected',
      async () => {
        const o = await f.opportunity('credit_repair')
        await reject(
          create(owner, o, f.payload('health')),
          /invalid_service_line/,
        )
        await reject(
          create(owner, o, {
            ...f.payload('credit_repair'),
            value_basis: 'annual_premium',
          }),
          /check constraint/,
        )
      },
    )
    await check(
      'negative money, decimal cents, submitted date missing rejected',
      async () => {
        const o = await f.opportunity('health')
        await reject(
          create(owner, o, { ...f.payload('health'), value_cents: -1 }),
          /check constraint/,
        )
        await reject(
          create(owner, o, { ...f.payload('health'), value_cents: 1.5 }),
          /invalid input/,
        )
        await reject(
          create(owner, o, {
            ...f.payload('health'),
            production_status: 'submitted',
          }),
          /check constraint/,
        )
      },
    )
    await check(
      'inaccessible opportunity cannot be used or updated',
      async () => {
        const o = await f.opportunity('health', f.households.other)
        await reject(create(advisor, o, f.payload('health')), /not_found/)
        await reject(
          other.query('SELECT archive_service_production($1,4,$2)', [
            r.id,
            'QA forbidden',
          ]),
          /not_found/,
        )
      },
    )
    await check(
      'allocation replacement retains previous snapshots',
      async () => {
        await owner.query(
          'SELECT set_service_production_allocations($1,4,$2,$3)',
          [
            r.id,
            JSON.stringify([
              { advisor_id: f.advisors.advisor, writing_bps: 10000 },
            ]),
            'QA new split',
          ],
        )
        assert.equal(
          (
            await owner.query(
              'SELECT * FROM service_production_allocations WHERE record_id=$1 AND effective_to IS NOT NULL',
              [r.id],
            )
          ).rowCount,
          2,
        )
      },
    )
    await check(
      'history append-only even for direct database updates',
      async () =>
        reject(
          f.db.query(
            "UPDATE service_production_history SET reason='rewrite' WHERE record_id=$1",
            [r.id],
          ),
          /history_immutable/,
        ),
    )
    await check(
      'archive keeps history and hides record from advisor',
      async () => {
        await owner.query('SELECT archive_service_production($1,5,$2)', [
          r.id,
          'QA archive',
        ])
        assert.equal(
          (
            await advisor.query(
              'SELECT id FROM service_production_records WHERE id=$1',
              [r.id],
            )
          ).rowCount,
          0,
        )
        assert.equal(
          (
            await owner.query(
              'SELECT id FROM service_production_records WHERE id=$1',
              [r.id],
            )
          ).rowCount,
          1,
        )
        assert(
          (
            await owner.query(
              'SELECT id FROM service_production_history WHERE record_id=$1',
              [r.id],
            )
          ).rowCount > 0,
        )
      },
    )
    await check('archived opportunity can create a fresh record', async () =>
      assert.notEqual(
        await create(owner, r.opp, f.payload('credit_repair')),
        r.id,
      ),
    )
    await check('only owner can replace writing shares', async () => {
      const record = records.health
      await reject(
        advisor.query('SELECT set_service_production_allocations($1,1,$2,$3)', [
          record.id,
          JSON.stringify(f.splits),
          'Not authorized',
        ]),
        /not_found/,
      )
    })
    const carrier = randomUUID(),
      product = randomUUID()
    await f.db.query(
      "INSERT INTO carriers(id,code,name,code_normalized,name_normalized) VALUES($1,'service-qa','Service QA Carrier','service-qa','service qa carrier')",
      [carrier],
    )
    await f.db.query(
      "INSERT INTO insurance_products(id,carrier_id,name,name_normalized,product_line) VALUES($1,$2,'QA Term','qa term','life_term')",
      [product, carrier],
    )
    const policy = async (opportunity) =>
      f.db.query(
        "INSERT INTO policy_applications(household_id,opportunity_id,carrier_id,product_id,product_line,state) VALUES($1,$2,$3,$4,'life_term','TX') RETURNING id",
        [f.households.advisor, opportunity, carrier, product],
      )
    await check(
      'existing insurance draft behavior remains available',
      async () => assert.equal((await policy(null)).rowCount, 1),
    )
    await check(
      'insurance conversion cannot duplicate a service record',
      async () =>
        reject(policy(records.health.opp), /opportunity_already_used/),
    )
    await check(
      'service conversion cannot duplicate an insurance record',
      async () => {
        const o = await f.opportunity('health')
        await policy(o)
        await reject(
          create(owner, o, f.payload('health')),
          /opportunity_already_used/,
        )
      },
    )
    await check(
      'concurrent insurance and service conversion produces only one record',
      async () => {
        const o = await f.opportunity('health')
        const outcomes = await Promise.allSettled([
          policy(o),
          create(owner, o, f.payload('health')),
        ])
        assert.equal(outcomes.filter((o) => o.status === 'fulfilled').length, 1)
        assert.equal(outcomes.filter((o) => o.status === 'rejected').length, 1)
      },
    )
    await check(
      'inactive writing advisor cannot receive a new allocation',
      async () => {
        await f.db.query(
          'UPDATE advisor_profiles SET is_active=false WHERE id=$1',
          [f.advisors.other],
        )
        const o = await f.opportunity('health')
        await reject(create(owner, o, f.payload('health')), /invalid_splits/)
        await f.db.query(
          'UPDATE advisor_profiles SET is_active=true WHERE id=$1',
          [f.advisors.other],
        )
      },
    )
    await check(
      'missing change reason rolls back the production edit',
      async () => {
        const record = records.health
        const { service_line, ...patch } = f.payload('health')
        await reject(
          owner.query('SELECT update_service_production($1,1,$2,$3)', [
            record.id,
            { ...patch, provider_name: 'Should roll back' },
            '',
          ]),
          /check constraint/,
        )
        assert.equal(
          (
            await owner.query(
              'SELECT provider_name,revision FROM service_production_records WHERE id=$1',
              [record.id],
            )
          ).rows[0].provider_name,
          'QA Provider',
        )
      },
    )
    console.log(
      JSON.stringify({
        passed,
        failed: 0,
        migrations: 73,
        engine: 'local native PostgreSQL',
        productionTouched: false,
      }),
    )
  } finally {
    await f.close()
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runServiceTests().catch((e) => {
    console.error(e.message)
    process.exitCode = 1
  })
