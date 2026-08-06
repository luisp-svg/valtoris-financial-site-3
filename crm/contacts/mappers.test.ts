import { describe, expect, it } from 'vitest'
import {
  mapConsentSummary,
  mapContactDetail,
  mapContactListItem,
  mapDuplicateMatch,
  parseCreateResult,
  parseDuplicatePreview,
  parseUpdateResult,
} from './mappers'

const household = {
  id: 'hh-1',
  display_name: 'Alex Rivera',
  status: 'lead',
  lead_source: 'manual_contact',
  primary_email: 'alex@example.com',
  primary_phone: '5551234567',
  city: 'Austin',
  state: 'TX',
  assigned_advisor_id: 'adv-1',
  created_at: '2026-08-01T00:00:00.000Z',
  deleted_at: null,
  merged_into_household_id: null,
  assigned_advisor: { id: 'adv-1', display_name: 'Advisor A' },
  members: [
    {
      id: 'mem-1',
      first_name: 'Alex',
      last_name: 'Rivera',
      email: 'alex@example.com',
      phone: '5551234567',
      company: 'Acme',
      job_title: 'VP',
      website: 'https://acme.example',
      is_primary_contact: true,
      deleted_at: null,
    },
  ],
}

describe('mapContactListItem / detail', () => {
  it('maps friendly fields and omits raw JSON/IDs from display labels', () => {
    const item = mapContactListItem({
      id: 'lead-1',
      lead_type: 'Manual Contact',
      contact_category: 'referral_partner',
      how_we_met: 'Mixer',
      submitted_at: '2026-08-01T12:00:00.000Z',
      deleted_at: null,
      household,
    })
    expect(item).toMatchObject({
      fullName: 'Alex Rivera',
      company: 'Acme',
      categoryLabel: 'Referral partner',
      locationLabel: 'Austin, TX',
      assignedAdvisorName: 'Advisor A',
    })
    expect(JSON.stringify(item)).not.toMatch(/consent_snapshot|token|service_role/)
  })

  it('excludes merged or non-manual households', () => {
    expect(
      mapContactListItem({
        id: 'lead-1',
        lead_type: 'Manual Contact',
        deleted_at: null,
        household: { ...household, merged_into_household_id: 'hh-other' },
      }),
    ).toBeNull()
    expect(
      mapContactListItem({
        id: 'lead-1',
        lead_type: 'Family Report Card',
        deleted_at: null,
        household,
      }),
    ).toBeNull()
  })

  it('maps consent summary without exposing raw snapshot shape in label', () => {
    const detail = mapContactDetail(
      {
        id: 'lead-1',
        lead_type: 'Manual Contact',
        contact_category: 'other',
        deleted_at: null,
        household,
        consent_snapshot: {
          privacyAcknowledged: true,
          contactPermission: true,
          emailMarketingConsent: false,
          smsMarketingConsent: false,
          consentVersion: 'v1',
          consentedAt: '2026-08-01T12:00:00.000Z',
          evidenceDescription: 'Said yes',
        },
      },
      { enteredByName: 'Owner Dev' },
    )
    expect(detail?.consent.summaryLabel).toMatch(/Consent recorded/)
    expect(detail?.enteredByName).toBe('Owner Dev')
    expect(detail?.website).toBe('https://acme.example')
  })

  it('defaults consent summary to no consent', () => {
    expect(mapConsentSummary(null).hasConsent).toBe(false)
    expect(mapConsentSummary(null).summaryLabel).toBe('No consent recorded')
  })
})

describe('duplicate / create / update parsers', () => {
  it('maps restricted matches without PII or IDs', () => {
    const match = mapDuplicateMatch({
      visibility: 'restricted',
      match_class: 'exact_email',
      household_id: 'should-not-appear',
      display_name: 'Secret',
    })
    expect(match).toEqual({
      visibility: 'restricted',
      matchClass: 'exact_email',
      matchClassLabel: 'Same email',
    })
  })

  it('rejects malformed RPC shapes', () => {
    expect(parseDuplicatePreview({ ok: false })).toBeNull()
    expect(parseCreateResult({ ok: true, lead_id: 'x' })).toBeNull()
    expect(parseUpdateResult({ ok: true })).toBeNull()
  })

  it('parses create_separate and update collision responses', () => {
    const created = parseCreateResult({
      ok: true,
      mode: 'create_separate',
      lead_id: 'l1',
      household_id: 'h1',
      member_id: 'm1',
    })
    expect(created).toMatchObject({ ok: true, mode: 'create_separate', leadId: 'l1' })
    const collision = parseUpdateResult({
      ok: false,
      reason: 'collision',
      has_restricted_collision: true,
      matches: [],
    })
    expect(collision).toMatchObject({ ok: false, hasRestrictedCollision: true })
  })
})
