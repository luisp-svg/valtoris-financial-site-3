import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildQuickAddCreatePayload, buildManualContactUpdatePayload } from './payload'
import { emptyContactFormValues, validateContactForm } from './validation'
import { resetFormAfterSaveAndAddAnother } from './formReset'
import { CONTACTS_FETCH_CAP, CONTACTS_PAGE_SIZE } from './listPipeline'

const ROOT = join(import.meta.dirname, '../..')

describe('Q1B matrix contracts (static)', () => {
  it('required fields and invalid website', () => {
    expect(validateContactForm(emptyContactFormValues()).first_name).toBeTruthy()
    const badWeb = {
      ...emptyContactFormValues(),
      first_name: 'A',
      last_name: 'B',
      email: 'a@b.com',
      website: 'javascript:alert(1)',
    }
    expect(validateContactForm(badWeb).website).toMatch(/http/)
  })

  it('create payload never includes consentedAt; default omits consent', () => {
    const base = {
      ...emptyContactFormValues(),
      first_name: 'A',
      last_name: 'B',
      email: 'a@b.com',
      contact_category: 'other' as const,
    }
    const noConsent = buildQuickAddCreatePayload(base, { includeAssignedAdvisor: false })
    expect(noConsent).not.toHaveProperty('consent')
    expect(JSON.stringify(noConsent)).not.toMatch(/consentedAt/)
    const withConsent = buildQuickAddCreatePayload(
      {
        ...base,
        consentEnabled: true,
        privacyAcknowledged: true,
        contactPermission: true,
        evidenceDescription: 'Verbal yes',
      },
      { includeAssignedAdvisor: false },
    )
    expect(withConsent.consent).toMatchObject({ evidenceDescription: 'Verbal yes' })
    expect(JSON.stringify(withConsent)).not.toMatch(/consentedAt/)
  })

  it('Save & Add Another clears PII/consent; defaults only when selected', () => {
    const prev = {
      ...emptyContactFormValues(),
      first_name: 'A',
      last_name: 'B',
      email: 'a@b.com',
      phone: '555',
      company: 'Co',
      job_title: 'VP',
      website: 'https://x.com',
      note: 'secret',
      consentEnabled: true,
      evidenceDescription: 'yes',
      contact_category: 'vendor' as const,
      how_we_met: 'Mixer',
      state: 'TX',
      assigned_advisor_id: 'adv-1',
    }
    const cleared = resetFormAfterSaveAndAddAnother(prev, { keepDefaults: false, isOwner: true })
    expect(cleared.first_name).toBe('')
    expect(cleared.email).toBe('')
    expect(cleared.phone).toBe('')
    expect(cleared.company).toBe('')
    expect(cleared.note).toBe('')
    expect(cleared.consentEnabled).toBe(false)
    expect(cleared.evidenceDescription).toBe('')
    const kept = resetFormAfterSaveAndAddAnother(prev, { keepDefaults: true, isOwner: true })
    expect(kept.contact_category).toBe('vendor')
    expect(kept.how_we_met).toBe('Mixer')
    expect(kept.state).toBe('TX')
    expect(kept.assigned_advisor_id).toBe('adv-1')
    expect(kept.email).toBe('')
  })

  it('edit uses update RPC only and omits assignment/lifecycle/consent', () => {
    const edit = readFileSync(join(ROOT, 'crm/contacts/ContactEditForm.tsx'), 'utf8')
    expect(edit).toContain('updateManualContactRecord')
    expect(edit).toContain("previewContactDuplicates(supabase, values, 'update', leadId)")
    expect(edit).not.toContain('name="assigned_advisor_id"')
    expect(edit).not.toContain('consentEnabled')
    expect(edit).not.toContain('quick_add_contact')
    expect(edit).toMatch(/Assignment, consent, and lifecycle are not editable/)
    const payload = buildManualContactUpdatePayload({
      ...emptyContactFormValues(),
      first_name: 'A',
      last_name: 'B',
      email: 'a@b.com',
      contact_category: 'other',
      assigned_advisor_id: 'should-not-appear',
      consentEnabled: true,
    })
    expect(payload).not.toHaveProperty('assigned_advisor_id')
    expect(payload).not.toHaveProperty('consent')
    expect(payload).not.toHaveProperty('status')
  })

  it('Quick Add blocks double submit and holds tokens only in memory', () => {
    const form = readFileSync(join(ROOT, 'crm/contacts/QuickAddContactForm.tsx'), 'utf8')
    expect(form).toContain('if (submittingRef.current) return')
    expect(form).toContain('tokenRef')
    expect(form).not.toContain('localStorage')
    expect(form).not.toContain('sessionStorage')
    expect(form).not.toContain('consentedAt')
  })

  it('list uses capped full fetch then client pagination (not a 25-row server page)', () => {
    const api = readFileSync(join(ROOT, 'crm/contacts/contactsApi.ts'), 'utf8')
    expect(api).toContain('.limit(CONTACTS_FETCH_CAP)')
    expect(api).toContain('filterManualContacts')
    expect(api).toContain('paginateManualContacts')
    expect(api).toContain('This is NOT server-side pagination')
    expect(CONTACTS_FETCH_CAP).toBeGreaterThanOrEqual(100)
    expect(CONTACTS_PAGE_SIZE).toBe(25)
  })

  it('restricted modal has no Open existing for restricted-only collisions', () => {
    const modal = readFileSync(join(ROOT, 'crm/contacts/DuplicateCollisionModal.tsx'), 'utf8')
    expect(modal).toMatch(/showRestrictedOnly/)
    expect(modal).toMatch(/Open existing/)
    expect(modal).toContain("visibility === 'accessible' && m.householdId")
  })
})
