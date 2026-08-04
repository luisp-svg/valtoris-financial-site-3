import { describe, expect, it } from 'vitest'
import type { IdentitySurfacePublicDto } from '../../modules/digital-identity'
import {
  buildDiagnosticActions,
  buildHeroActions,
  buildOutcomeSections,
  documentTitleForCard,
  errorCopyForStatus,
  getInitials,
  mapFetchFailureToStatus,
  PUBLIC_CARD_A11Y_CONTRACT,
  publicCardLayoutClasses,
  publicCardPageSideEffects,
  resolveContactVisibility,
} from './publicCardViewModel'

function sampleCard(overrides: Partial<IdentitySurfacePublicDto> = {}): IdentitySurfacePublicDto {
  return {
    publicKey: 'pk_live_abcdefghijklmnop',
    slug: 'jane-advisor',
    kind: 'advisor_card',
    displayName: 'Jane Advisor',
    approvedTitle: 'Financial Advisor',
    approvedCompany: 'Valtoris Financial',
    headline: 'Clarity first.',
    bio: 'About Jane',
    headshotUrl: 'https://cdn.example.com/jane.jpg',
    phone: '555-0100',
    email: 'jane@example.com',
    website: 'https://example.com',
    socialLinks: [],
    specialties: ['Retirement'],
    calendlyUrl: 'https://calendly.com/jane',
    themeKey: 'default',
    ctas: [
      { key: 'lets_connect', label: "Let's Connect", enabled: true },
      { key: 'save_contact', label: 'Save Contact', enabled: true },
      {
        key: 'book_appointment',
        label: 'Book Appointment',
        enabled: true,
        href: 'https://calendly.com/jane',
      },
      {
        key: 'family_report_card',
        label: 'Family Financial Report Card',
        enabled: true,
        href: '/family-assessment',
      },
      {
        key: 'business_report_card',
        label: 'Business Financial Report Card',
        enabled: true,
        href: '/business-report-card',
      },
      {
        key: 'protection_gap',
        label: 'Protection Gap',
        enabled: true,
        href: '/protection-gap',
      },
    ],
    primaryConnectLabel: "Let's Connect",
    cardUrl: '/c/k/pk_live_abcdefghijklmnop',
    ...overrides,
  }
}

describe('publicCardViewModel', () => {
  it('builds initials for headshot fallback', () => {
    expect(getInitials('Jane Advisor')).toBe('JA')
    expect(getInitials('Madonna')).toBe('MA')
  })

  it('omits hidden phone and email when null on DTO', () => {
    const contact = resolveContactVisibility(
      sampleCard({ phone: null, email: null, website: null }),
    )
    expect(contact.showPhone).toBe(false)
    expect(contact.showEmail).toBe(false)
    expect(contact.showWebsite).toBe(false)
  })

  it('shows phone/email/website when present', () => {
    const contact = resolveContactVisibility(sampleCard())
    expect(contact.showPhone).toBe(true)
    expect(contact.showEmail).toBe(true)
    expect(contact.showWebsite).toBe(true)
  })

  it('keeps Let’s Connect disabled and enables Save Contact vCard download', () => {
    const actions = buildHeroActions(sampleCard())
    const connect = actions.find((a) => a.key === 'lets_connect')
    const save = actions.find((a) => a.key === 'save_contact')
    expect(connect?.label).toBe("Let's Connect")
    expect(connect?.mode).toBe('disabled_placeholder')
    expect(save?.mode).toBe('vcard_download')
    expect(save?.label).toBe('Save Contact')
  })

  it('shows appointment only when Calendly exists', () => {
    const withCalendly = buildHeroActions(sampleCard())
    expect(withCalendly.some((a) => a.key === 'book_appointment')).toBe(true)

    const without = buildHeroActions(
      sampleCard({
        calendlyUrl: null,
        ctas: [
          { key: 'lets_connect', label: "Let's Connect", enabled: true },
          { key: 'save_contact', label: 'Save Contact', enabled: true },
          {
            key: 'family_report_card',
            label: 'Family Financial Report Card',
            enabled: true,
            href: '/family-assessment',
          },
        ],
      }),
    )
    expect(without.some((a) => a.key === 'book_appointment')).toBe(false)
  })

  it('includes API diagnostic CTAs and Credit Assessment coming soon', () => {
    const diagnostics = buildDiagnosticActions(sampleCard())
    expect(diagnostics.map((d) => d.key)).toEqual([
      'family_report_card',
      'business_report_card',
      'protection_gap',
      'credit_assessment',
    ])
    const credit = diagnostics.find((d) => d.key === 'credit_assessment')
    expect(credit?.mode).toBe('coming_soon')
  })

  it('groups outcomes by goals and marks credit as coming soon', () => {
    const outcomes = buildOutcomeSections(sampleCard())
    expect(outcomes.some((o) => o.title === 'Protect Your Family')).toBe(true)
    expect(outcomes.some((o) => o.title === 'Grow Your Business')).toBe(true)
    expect(outcomes.some((o) => o.title === 'Prepare for Retirement')).toBe(true)
    expect(outcomes.some((o) => o.title === 'Build Business Wealth')).toBe(true)

    const credit = outcomes.filter((o) => o.comingSoon)
    expect(credit.map((o) => o.title)).toEqual(['Improve Credit', 'Build Business Credit'])
    expect(credit.every((o) => o.href === null)).toBe(true)
  })

  it('maps error states to consistent user copy', () => {
    expect(errorCopyForStatus('unavailable').title).toMatch(/unavailable/i)
    expect(errorCopyForStatus('unavailable').message).toMatch(/not published|unavailable/i)
    expect(errorCopyForStatus('network_error').message).toMatch(/connection/i)
    expect(mapFetchFailureToStatus('unavailable')).toBe('unavailable')
    expect(mapFetchFailureToStatus('timeout')).toBe('network_error')
  })

  it('exposes responsive layout class names', () => {
    const classes = publicCardLayoutClasses()
    expect(classes.page).toBe('public-card-page')
    expect(classes.outcomeGrid).toBe('public-card-outcome-grid')
  })

  it('declares accessibility contract for the public card view', () => {
    expect(PUBLIC_CARD_A11Y_CONTRACT.loadingUsesAriaBusy).toBe(true)
    expect(PUBLIC_CARD_A11Y_CONTRACT.statesUseAriaLive).toBe(true)
    expect(PUBLIC_CARD_A11Y_CONTRACT.sectionsUseAriaLabelledBy).toBe(true)
    expect(PUBLIC_CARD_A11Y_CONTRACT.headshotUsesAltText).toBe(true)
    expect(PUBLIC_CARD_A11Y_CONTRACT.disabledActionsUseAriaDisabled).toBe(true)
    expect(PUBLIC_CARD_A11Y_CONTRACT.prefersReducedMotionHonored).toBe(true)
  })

  it('builds document title from display name', () => {
    expect(documentTitleForCard(sampleCard())).toBe('Jane Advisor · Valtoris Financial')
  })

  it('allows vCard download without CRM, analytics, or admin imports', () => {
    expect(publicCardPageSideEffects()).toEqual({
      writesAnalytics: false,
      createsLead: false,
      createsHousehold: false,
      downloadsVCard: true,
      opensConnectForm: false,
      importsAdminClient: false,
    })
  })

  it('never surfaces raw publish_profile or cta_config blobs from DTO helpers', () => {
    const card = sampleCard()
    const json = JSON.stringify({
      hero: buildHeroActions(card),
      diagnostics: buildDiagnosticActions(card),
      outcomes: buildOutcomeSections(card),
      contact: resolveContactVisibility(card),
    })
    expect(json).not.toMatch(/publish_profile|publishProfile|cta_config|ctaConfig/)
    expect(json).not.toMatch(/advisorProfileId|advisorId|userId|householdId/)
  })
})
