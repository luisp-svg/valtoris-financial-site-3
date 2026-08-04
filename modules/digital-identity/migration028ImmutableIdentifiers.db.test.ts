/**
 * Live local-Supabase integration for Migration 028 identifier immutability.
 * Skips automatically when local Supabase is unavailable (keeps offline npm test green).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  MIGRATION_028_IMMUTABLE_IDENTIFIER_ERRORS,
  MIGRATION_028_IMMUTABLE_IDENTIFIER_SQLSTATE,
} from './migration028Contract'

const PASS = 'LocalQaPass028!'
const PREFIX = 'm028imm'

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
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
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

const localEnv = tryLoadLocalEnv()

describe.skipIf(!localEnv)('migration 028 digital_card_campaigns identifier immutability (local DB)', () => {
  const env = localEnv as LocalEnv
  let admin: SupabaseClient
  let owner: SupabaseClient
  let advisor: SupabaseClient
  let advisorB: SupabaseClient

  let ownerId = ''
  let advisorId = ''
  let advisorProfileId = ''
  let advisorBProfileId = ''
  let cardAId = ''
  let cardBId = ''
  let campaignWithEventId = ''
  let campaignNullEventId = ''
  let campaignBId = ''

  async function ensureUser(
    email: string,
    fullName: string,
    role: 'owner' | 'advisor',
  ): Promise<string> {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (list.error) throw list.error
    const existing = (list.data?.users || []).find(
      (u) => (u.email || '').toLowerCase() === email.toLowerCase(),
    )
    let userId: string
    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, {
        password: PASS,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (error) throw error
      userId = existing.id
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: PASS,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (error) throw error
      userId = data.user.id
    }
    const { error: profileError } = await admin.from('profiles').upsert(
      { id: userId, email, full_name: fullName, role, is_active: true },
      { onConflict: 'id' },
    )
    if (profileError) throw profileError
    return userId
  }

  async function ensureAdvisorProfile(userId: string, slug: string): Promise<string> {
    const { data: existing } = await admin
      .from('advisor_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
    if (existing?.id) {
      await admin
        .from('advisor_profiles')
        .update({ is_active: true, slug, display_name: slug })
        .eq('id', existing.id)
      return existing.id
    }
    const { data, error } = await admin
      .from('advisor_profiles')
      .insert({
        user_id: userId,
        slug,
        display_name: slug,
        is_active: true,
      })
      .select('id')
      .single()
    if (error) throw error
    return data.id
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

    ownerId = await ensureUser(`${PREFIX}.owner@valtoris.test`, 'M028 Owner', 'owner')
    advisorId = await ensureUser(`${PREFIX}.adv.a@valtoris.test`, 'M028 Advisor A', 'advisor')
    const advisorBUserId = await ensureUser(
      `${PREFIX}.adv.b@valtoris.test`,
      'M028 Advisor B',
      'advisor',
    )
    advisorProfileId = await ensureAdvisorProfile(advisorId, `${PREFIX}-advisor-a`)
    advisorBProfileId = await ensureAdvisorProfile(advisorBUserId, `${PREFIX}-advisor-b`)

    // Clean prior fixtures for these advisors (one active card per advisor)
    await admin
      .from('digital_card_campaigns')
      .delete()
      .like('campaign_code', `${PREFIX}%`)
    await admin
      .from('digital_cards')
      .delete()
      .in('advisor_profile_id', [advisorProfileId, advisorBProfileId])

    cardAId = randomUUID()
    cardBId = randomUUID()
    const { error: cardErr } = await admin.from('digital_cards').insert([
      {
        id: cardAId,
        public_key: `pk_${PREFIX}_card_a01`,
        slug: `${PREFIX}-a`,
        status: 'published',
        advisor_profile_id: advisorProfileId,
        published_at: new Date().toISOString(),
        publish_profile: { displayName: 'M028 A' },
        cta_config: {},
      },
      {
        id: cardBId,
        public_key: `pk_${PREFIX}_card_b01`,
        slug: `${PREFIX}-b`,
        status: 'published',
        advisor_profile_id: advisorBProfileId,
        published_at: new Date().toISOString(),
        publish_profile: { displayName: 'M028 B' },
        cta_config: {},
      },
    ])
    if (cardErr) throw cardErr

    campaignWithEventId = randomUUID()
    campaignNullEventId = randomUUID()
    campaignBId = randomUUID()
    const { error: campErr } = await admin.from('digital_card_campaigns').insert([
      {
        id: campaignWithEventId,
        digital_card_id: cardAId,
        campaign_code: `${PREFIX}-with-event`,
        event_code: 'evt-1',
        label: 'With Event',
        status: 'active',
        created_by_user_id: ownerId,
      },
      {
        id: campaignNullEventId,
        digital_card_id: cardAId,
        campaign_code: `${PREFIX}-null-event`,
        event_code: null,
        label: 'Null Event',
        status: 'active',
        created_by_user_id: advisorId,
      },
      {
        id: campaignBId,
        digital_card_id: cardBId,
        campaign_code: `${PREFIX}-b-active`,
        event_code: 'b-evt',
        label: 'B Campaign',
        status: 'active',
        created_by_user_id: advisorBUserId,
      },
    ])
    if (campErr) throw campErr

    owner = await signIn(`${PREFIX}.owner@valtoris.test`)
    advisor = await signIn(`${PREFIX}.adv.a@valtoris.test`)
    advisorB = await signIn(`${PREFIX}.adv.b@valtoris.test`)
    void advisorB
  }, 60_000)

  afterAll(async () => {
    if (!admin) return
    await admin
      .from('digital_card_campaigns')
      .delete()
      .like('campaign_code', `${PREFIX}%`)
    await admin.from('digital_cards').delete().like('slug', `${PREFIX}%`)
  })

  function expectImmutableError(message: string | undefined, code: string) {
    expect(message || '').toContain(code)
    // PostgREST surfaces SQLSTATE in error details/code depending on version.
    expect(MIGRATION_028_IMMUTABLE_IDENTIFIER_ERRORS).toContain(
      code as (typeof MIGRATION_028_IMMUTABLE_IDENTIFIER_ERRORS)[number],
    )
    expect(MIGRATION_028_IMMUTABLE_IDENTIFIER_SQLSTATE).toBe('22023')
  }

  it('owner cannot mutate digital_card_id after insert', async () => {
    const { error } = await owner
      .from('digital_card_campaigns')
      .update({ digital_card_id: cardBId })
      .eq('id', campaignWithEventId)
    expect(error).toBeTruthy()
    expectImmutableError(error?.message, 'DI_CAMPAIGN:immutable_digital_card_id')
  })

  it('owner cannot mutate campaign_code after insert', async () => {
    const { error } = await owner
      .from('digital_card_campaigns')
      .update({ campaign_code: `${PREFIX}-hacked` })
      .eq('id', campaignWithEventId)
    expect(error).toBeTruthy()
    expectImmutableError(error?.message, 'DI_CAMPAIGN:immutable_campaign_code')
  })

  it('owner cannot mutate event_code after insert', async () => {
    const { error } = await owner
      .from('digital_card_campaigns')
      .update({ event_code: 'hacked-evt' })
      .eq('id', campaignWithEventId)
    expect(error).toBeTruthy()
    expectImmutableError(error?.message, 'DI_CAMPAIGN:immutable_event_code')
  })

  it('advisor cannot mutate identifiers on own-card campaign', async () => {
    const codeErr = await advisor
      .from('digital_card_campaigns')
      .update({ campaign_code: `${PREFIX}-adv-hack` })
      .eq('id', campaignNullEventId)
    expect(codeErr.error).toBeTruthy()
    expectImmutableError(codeErr.error?.message, 'DI_CAMPAIGN:immutable_campaign_code')

    const cardErr = await advisor
      .from('digital_card_campaigns')
      .update({ digital_card_id: cardBId })
      .eq('id', campaignNullEventId)
    expect(cardErr.error).toBeTruthy()
    expectImmutableError(cardErr.error?.message, 'DI_CAMPAIGN:immutable_digital_card_id')

    const eventErr = await advisor
      .from('digital_card_campaigns')
      .update({ event_code: 'new-evt' })
      .eq('id', campaignNullEventId)
    expect(eventErr.error).toBeTruthy()
    expectImmutableError(eventErr.error?.message, 'DI_CAMPAIGN:immutable_event_code')
  })

  it('rejects NULL→value and value→NULL event_code changes', async () => {
    const nullToValue = await owner
      .from('digital_card_campaigns')
      .update({ event_code: 'added' })
      .eq('id', campaignNullEventId)
    expect(nullToValue.error).toBeTruthy()
    expectImmutableError(nullToValue.error?.message, 'DI_CAMPAIGN:immutable_event_code')

    const valueToNull = await owner
      .from('digital_card_campaigns')
      .update({ event_code: null })
      .eq('id', campaignWithEventId)
    expect(valueToNull.error).toBeTruthy()
    expectImmutableError(valueToNull.error?.message, 'DI_CAMPAIGN:immutable_event_code')
  })

  it('same-value identifier updates do not fail', async () => {
    const { error } = await owner
      .from('digital_card_campaigns')
      .update({
        digital_card_id: cardAId,
        campaign_code: `${PREFIX}-with-event`,
        event_code: 'evt-1',
        label: 'With Event Same',
      })
      .eq('id', campaignWithEventId)
    expect(error).toBeNull()
    const { data } = await admin
      .from('digital_card_campaigns')
      .select('label, campaign_code, event_code, digital_card_id')
      .eq('id', campaignWithEventId)
      .single()
    expect(data?.label).toBe('With Event Same')
    expect(data?.campaign_code).toBe(`${PREFIX}-with-event`)
    expect(data?.event_code).toBe('evt-1')
    expect(data?.digital_card_id).toBe(cardAId)
  })

  it('allows descriptive and lifecycle updates', async () => {
    const { error } = await owner
      .from('digital_card_campaigns')
      .update({
        label: 'Lifecycle OK',
        description: 'desc',
        location_label: 'Austin',
        organizer: 'Org',
        advisor_notes: 'private',
        starts_at: '2026-08-12T14:00:00.000Z',
        ends_at: '2026-08-12T16:00:00.000Z',
        status: 'disabled',
      })
      .eq('id', campaignWithEventId)
    expect(error).toBeNull()

    const { error: archiveErr } = await owner
      .from('digital_card_campaigns')
      .update({ deleted_at: new Date().toISOString(), status: 'disabled' })
      .eq('id', campaignWithEventId)
    expect(archiveErr).toBeNull()

    // Restore for later assertions
    await admin
      .from('digital_card_campaigns')
      .update({ deleted_at: null, status: 'active', label: 'With Event' })
      .eq('id', campaignWithEventId)
  })

  it('cross-card RLS denial still succeeds for advisor', async () => {
    const { data, error } = await advisor
      .from('digital_card_campaigns')
      .select('id')
      .eq('id', campaignBId)
    expect(error).toBeNull()
    expect(data || []).toHaveLength(0)

    const { error: updateErr } = await advisor
      .from('digital_card_campaigns')
      .update({ label: 'spoof' })
      .eq('id', campaignBId)
    // RLS: zero rows updated, typically no error
    expect(updateErr).toBeNull()
    const { data: still } = await admin
      .from('digital_card_campaigns')
      .select('label')
      .eq('id', campaignBId)
      .single()
    expect(still?.label).toBe('B Campaign')
  })

  it('create remains functional for owner and advisor', async () => {
    const ownerCode = `${PREFIX}-create-owner-${Date.now().toString(36)}`
    const { data: ownerRow, error: ownerErr } = await owner
      .from('digital_card_campaigns')
      .insert({
        digital_card_id: cardAId,
        campaign_code: ownerCode,
        event_code: 'create-evt',
        label: 'Owner Create',
        status: 'active',
        created_by_user_id: ownerId,
      })
      .select('id, campaign_code, event_code')
      .single()
    expect(ownerErr).toBeNull()
    expect(ownerRow?.campaign_code).toBe(ownerCode)

    const advCode = `${PREFIX}-create-adv-${Date.now().toString(36)}`
    const { data: advRow, error: advErr } = await advisor
      .from('digital_card_campaigns')
      .insert({
        digital_card_id: cardAId,
        campaign_code: advCode,
        event_code: null,
        label: 'Advisor Create',
        status: 'active',
        created_by_user_id: advisorId,
      })
      .select('id, campaign_code, event_code')
      .single()
    expect(advErr).toBeNull()
    expect(advRow?.campaign_code).toBe(advCode)
    expect(advRow?.event_code).toBeNull()
  })
})
