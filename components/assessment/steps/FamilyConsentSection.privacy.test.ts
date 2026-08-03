import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../../constants/routes'
import { INITIAL_FAMILY_CONSENT_STATE } from '../../reportCard/familyIngest/familyConsent'
import FamilyConsentSection from './FamilyConsentSection'

describe('Privacy Policy route wiring', () => {
  it('exposes a stable /privacy route constant', () => {
    expect(ROUTES.privacy).toBe('/privacy')
  })

  it('keeps required privacy acknowledgment unchecked by default', () => {
    expect(INITIAL_FAMILY_CONSENT_STATE.privacyAcknowledged).toBe(false)
    expect(INITIAL_FAMILY_CONSENT_STATE.assessmentStorageAcknowledged).toBe(false)
    expect(INITIAL_FAMILY_CONSENT_STATE.contactPermission).toBe(false)
    expect(INITIAL_FAMILY_CONSENT_STATE.emailMarketingConsent).toBe(false)
    expect(INITIAL_FAMILY_CONSENT_STATE.smsMarketingConsent).toBe(false)
  })

  it('exports the Family consent section for /privacy-linked UI', () => {
    expect(typeof FamilyConsentSection).toBe('function')
    expect(ROUTES.privacy).toMatch(/^\/privacy$/)
  })
})
