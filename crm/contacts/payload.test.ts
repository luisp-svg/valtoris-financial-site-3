import { describe, expect, it } from 'vitest'
import {
  buildDuplicatePreviewPayload,
  buildManualContactUpdatePayload,
  buildQuickAddCreatePayload,
} from './payload'
import { emptyContactFormValues } from './validation'

function baseValues() {
  return {
    ...emptyContactFormValues(),
    first_name: 'Alex',
    last_name: 'Rivera',
    email: 'alex@example.com',
    contact_category: 'potential_client' as const,
  }
}

describe('buildQuickAddCreatePayload', () => {
  it('builds create payload without consentedAt', () => {
    const payload = buildQuickAddCreatePayload(baseValues(), { includeAssignedAdvisor: false })
    expect(payload.first_name).toBe('Alex')
    expect(payload.email).toBe('alex@example.com')
    expect(payload).not.toHaveProperty('consentedAt')
    expect(payload).not.toHaveProperty('consent')
    expect(payload).not.toHaveProperty('assigned_advisor_id')
  })

  it('includes advisor only when owner flag is set', () => {
    const values = { ...baseValues(), assigned_advisor_id: 'adv-1' }
    const owner = buildQuickAddCreatePayload(values, { includeAssignedAdvisor: true })
    const advisor = buildQuickAddCreatePayload(values, { includeAssignedAdvisor: false })
    expect(owner.assigned_advisor_id).toBe('adv-1')
    expect(advisor).not.toHaveProperty('assigned_advisor_id')
  })

  it('includes explicit consent channels and evidence without consentedAt', () => {
    const values = {
      ...baseValues(),
      consentEnabled: true,
      privacyAcknowledged: true,
      contactPermission: true,
      evidenceDescription: 'Verbal yes at mixer',
    }
    const payload = buildQuickAddCreatePayload(values, { includeAssignedAdvisor: false })
    expect(payload.consent).toEqual({
      privacyAcknowledged: true,
      contactPermission: true,
      emailMarketingConsent: false,
      smsMarketingConsent: false,
      evidenceDescription: 'Verbal yes at mixer',
    })
    expect(JSON.stringify(payload)).not.toMatch(/consentedAt/)
  })

  it('rejects invalid category', () => {
    const values = { ...baseValues(), contact_category: '' as const }
    expect(() => buildQuickAddCreatePayload(values, { includeAssignedAdvisor: false })).toThrow(
      'QUICK_ADD:invalid_category',
    )
  })
})

describe('buildManualContactUpdatePayload', () => {
  it('omits assignment and consent fields', () => {
    const values = {
      ...baseValues(),
      assigned_advisor_id: 'adv-1',
      consentEnabled: true,
      phone: '5551112222',
    }
    const payload = buildManualContactUpdatePayload(values)
    expect(payload.phone).toBe('5551112222')
    expect(payload).not.toHaveProperty('assigned_advisor_id')
    expect(payload).not.toHaveProperty('consent')
    expect(payload).not.toHaveProperty('consentedAt')
    expect(payload).not.toHaveProperty('note')
  })

  it('requires token for update_separate', () => {
    expect(() =>
      buildManualContactUpdatePayload(baseValues(), { mode: 'update_separate' }),
    ).toThrow('QUICK_ADD:invalid_token')
    const payload = buildManualContactUpdatePayload(baseValues(), {
      mode: 'update_separate',
      createToken: 'opaque-token',
    })
    expect(payload.mode).toBe('update_separate')
    expect(payload.create_token).toBe('opaque-token')
  })
})

describe('buildDuplicatePreviewPayload', () => {
  it('requires lead_id for update', () => {
    expect(() => buildDuplicatePreviewPayload(baseValues(), 'update')).toThrow('QUICK_ADD:not_found')
    const payload = buildDuplicatePreviewPayload(baseValues(), 'update', 'lead-1')
    expect(payload).toMatchObject({ operation: 'update', lead_id: 'lead-1' })
  })
})
