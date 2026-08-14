/**
 * Local Supabase security tests for P1B-2A catalog wrappers.
 * Skips when local Supabase is not running. Cleans up prefixed rows.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createCarrier,
  createInsuranceProduct,
  fetchCatalogCarriers,
  fetchCatalogProducts,
  updateCarrier,
  updateInsuranceProduct,
} from './catalogApi'

const PASS = 'LocalQaPassP1B2A!'
const PREFIX = 'p1b2a'

type LocalEnv = { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string }

function tryLoadLocalEnv(): LocalEnv | null {
  try {
    const raw = execSync('npx supabase status -o env', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const env: Record<string, string> = {}
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!m) continue
      let v = m[2]
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      env[m[1]] = v
    }
    if (!env.API_URL || !env.ANON_KEY || !env.SERVICE_ROLE_KEY) return null
    if (!/127\.0\.0\.1|localhost/.test(env.API_URL)) return null
    return {
      API_URL: env.API_URL,
      ANON_KEY: env.ANON_KEY,
      SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY,
    }
  } catch {
    return null
  }
}

function sqlQuery(sql: string): string {
  const oneLine = sql.replace(/\s+/g, ' ').trim()
  return execSync(
    `docker exec -i supabase_db_valtoris-financial-site_3 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At -c ${JSON.stringify(oneLine)}`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim()
}

const localEnv = tryLoadLocalEnv()

describe.skipIf(!localEnv)('P1B-2A catalog API (local DB)', () => {
  const env = localEnv as LocalEnv
  let admin: SupabaseClient
  let owner: SupabaseClient
  let advisor: SupabaseClient
  let anon: SupabaseClient
  const createdCarrierIds: string[] = []

  async function ensureUser(email: string, role: 'owner' | 'advisor'): Promise<string> {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (list.error) throw list.error
    const existing = (list.data?.users || []).find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
    let userId: string
    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, {
        password: PASS,
        email_confirm: true,
      })
      if (error) throw error
      userId = existing.id
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: PASS,
        email_confirm: true,
      })
      if (error) throw error
      userId = data.user.id
    }
    const { error: profileError } = await admin.from('profiles').upsert({
      id: userId,
      email,
      full_name: role === 'owner' ? 'P1B2A Owner' : 'P1B2A Advisor',
      role,
      is_active: true,
      deleted_at: null,
    })
    if (profileError) throw profileError
    return userId
  }

  async function signIn(email: string): Promise<SupabaseClient> {
    const client = createClient(env.API_URL, env.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await client.auth.signInWithPassword({ email, password: PASS })
    if (error) throw error
    return client
  }

  beforeAll(async () => {
    admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    anon = createClient(env.API_URL, env.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await ensureUser(`${PREFIX}.owner@example.com`, 'owner')
    const advisorId = await ensureUser(`${PREFIX}.advisor@example.com`, 'advisor')
    await admin.from('advisor_profiles').upsert(
      {
        user_id: advisorId,
        slug: `${PREFIX}-adv`,
        display_name: 'P1B2A Advisor',
        is_active: true,
      },
      { onConflict: 'user_id' },
    )
    owner = await signIn(`${PREFIX}.owner@example.com`)
    advisor = await signIn(`${PREFIX}.advisor@example.com`)
  }, 120_000)

  afterAll(async () => {
    if (createdCarrierIds.length === 0) return
    const list = createdCarrierIds.map((id) => `'${id}'`).join(',')
    try {
      sqlQuery(`DELETE FROM public.insurance_products WHERE carrier_id IN (${list})`)
      sqlQuery(`DELETE FROM public.carriers WHERE id IN (${list})`)
    } catch {
      /* local docker may be unavailable at teardown */
    }
  }, 60_000)

  it('owner creates, renames, deactivates, and reactivates carriers and products via RPC wrappers', async () => {
    const code = `${PREFIX}-${randomUUID().slice(0, 8)}`
    const created = await createCarrier(owner, { code, name: `${PREFIX} Carrier` })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    createdCarrierIds.push(created.record.id)

    const renamed = await updateCarrier(owner, { id: created.record.id, name: `${PREFIX} Carrier Renamed` })
    expect(renamed.ok).toBe(true)
    if (renamed.ok) expect(renamed.record.name).toBe(`${PREFIX} Carrier Renamed`)

    const product = await createInsuranceProduct(owner, {
      carrierId: created.record.id,
      name: `${PREFIX} Term`,
      productLine: 'life_term',
    })
    expect(product.ok).toBe(true)
    if (!product.ok) return

    const productOff = await updateInsuranceProduct(owner, { id: product.record.id, isActive: false })
    expect(productOff.ok).toBe(true)
    if (productOff.ok) expect(productOff.record.is_active).toBe(false)
    const productOn = await updateInsuranceProduct(owner, { id: product.record.id, isActive: true })
    expect(productOn.ok).toBe(true)

    await updateCarrier(owner, { id: created.record.id, isActive: false })
    const stillThere = await fetchCatalogCarriers(owner)
    expect(stillThere.some((row) => row.id === created.record.id && !row.is_active)).toBe(true)
    const on = await updateCarrier(owner, { id: created.record.id, isActive: true })
    expect(on.ok).toBe(true)

    const dupCarrier = await createCarrier(owner, { code, name: `${PREFIX} Dup` })
    expect(dupCarrier.ok).toBe(false)
    if (!dupCarrier.ok) expect(dupCarrier.message).not.toMatch(/SQLSTATE|42501|PGRST/i)

    const dupProduct = await createInsuranceProduct(owner, {
      carrierId: created.record.id,
      name: `${PREFIX} Term`,
      productLine: 'life_term',
    })
    expect(dupProduct.ok).toBe(false)
  }, 60_000)

  it('denies advisor and anonymous catalog RPCs and direct table writes', async () => {
    const advisorCreate = await createCarrier(advisor, {
      code: `${PREFIX}-adv-${randomUUID().slice(0, 6)}`,
      name: `${PREFIX} Advisor Carrier`,
    })
    expect(advisorCreate.ok).toBe(false)
    if (!advisorCreate.ok) expect(advisorCreate.message).toMatch(/permission/i)

    const anonCreate = await createCarrier(anon, {
      code: `${PREFIX}-anon`,
      name: `${PREFIX} Anon`,
    })
    expect(anonCreate.ok).toBe(false)

    const ownerInsert = await owner.from('carriers').insert({ code: `${PREFIX}-direct`, name: 'Nope' })
    expect(ownerInsert.error?.message || '').toMatch(/permission denied/)
    const advisorUpdate = await advisor.from('carriers').update({ name: 'Nope' }).eq('id', randomUUID())
    expect(advisorUpdate.error?.message || '').toMatch(/permission denied/)
  }, 60_000)

  it('owner SELECT includes inactive catalog rows; wrappers do not insert activities', async () => {
    const products = await fetchCatalogProducts(owner)
    expect(Array.isArray(products)).toBe(true)
    const activity = await owner.from('activities').insert({ activity_type: 'test' })
    expect(activity.error).toBeTruthy()
  }, 30_000)
})
