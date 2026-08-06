import { describe, expect, it } from 'vitest'
import { resetFormAfterSaveAndAddAnother } from './formReset'
import { emptyContactFormValues } from './validation'

describe('resetFormAfterSaveAndAddAnother', () => {
  it('clears PII, note, and consent by default', () => {
    const prev = {
      ...emptyContactFormValues(),
      first_name: 'Alex',
      last_name: 'Rivera',
      email: 'a@x.com',
      phone: '555',
      company: 'Acme',
      job_title: 'VP',
      website: 'https://a.com',
      note: 'secret',
      consentEnabled: true,
      evidenceDescription: 'said yes',
      contact_category: 'vendor' as const,
      how_we_met: 'Mixer',
      state: 'TX',
      assigned_advisor_id: 'adv-1',
    }
    const next = resetFormAfterSaveAndAddAnother(prev, { keepDefaults: false, isOwner: true })
    expect(next.first_name).toBe('')
    expect(next.email).toBe('')
    expect(next.phone).toBe('')
    expect(next.company).toBe('')
    expect(next.note).toBe('')
    expect(next.consentEnabled).toBe(false)
    expect(next.evidenceDescription).toBe('')
    expect(next.contact_category).toBe('potential_client')
    expect(next.assigned_advisor_id).toBe('')
  })

  it('retains only explicit defaults when Keep entry defaults is on', () => {
    const prev = {
      ...emptyContactFormValues(),
      first_name: 'Alex',
      email: 'a@x.com',
      contact_category: 'vendor' as const,
      how_we_met: 'Mixer',
      state: 'TX',
      assigned_advisor_id: 'adv-1',
    }
    const next = resetFormAfterSaveAndAddAnother(prev, { keepDefaults: true, isOwner: true })
    expect(next.first_name).toBe('')
    expect(next.email).toBe('')
    expect(next.contact_category).toBe('vendor')
    expect(next.how_we_met).toBe('Mixer')
    expect(next.state).toBe('TX')
    expect(next.assigned_advisor_id).toBe('adv-1')
  })
})
