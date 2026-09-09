import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../constants/routes'
import {
  appendCardAttributionToPath,
  createDefaultAdvisorCardCtas,
  publicCardCtaClickSideEffects,
} from '../../modules/digital-identity'
import type { IdentitySurfacePublicDto } from '../../modules/digital-identity'
import {
  buildDiagnosticActions,
  buildOutcomeSections,
  publicCardPageSideEffects,
  selectPublicCardHelpTiles,
} from './publicCardViewModel'

const KEY = 'pk_live_abcdefghijklmnop'
const ADVISOR_UUID = '11111111-2222-4333-8444-555555555555'

function cardWithDefaultCtas(
  overrides: Partial<IdentitySurfacePublicDto> = {},
): IdentitySurfacePublicDto {
  return {
    publicKey: KEY,
    slug: 'jane-advisor',
    kind: 'advisor_card',
    displayName: 'Jane Advisor',
    approvedTitle: 'Financial Strategist',
    approvedCompany: 'Valtoris Financial',
    headline: null,
    bio: null,
    headshotUrl: null,
    phone: null,
    email: null,
    website: null,
    socialLinks: [],
    specialties: [],
    calendlyUrl: null,
    themeKey: 'default',
    ctas: createDefaultAdvisorCardCtas().items.filter((item) => item.enabled),
    primaryConnectLabel: "Let's Connect",
    cardUrl: `/c/k/${KEY}`,
    ...overrides,
  }
}

describe('Digital Identity Report Card CTA expansion', () => {
  it('preserves Family, Business, and Protection routes, labels, and visibility', () => {
    const defaults = createDefaultAdvisorCardCtas()
    expect(defaults.items.find((item) => item.key === 'family_report_card')).toMatchObject({
      enabled: true,
      label: 'Family Financial Report Card',
      href: '/family-assessment',
    })
    expect(defaults.items.find((item) => item.key === 'business_report_card')).toMatchObject({
      enabled: true,
      label: 'Business Financial Report Card',
      href: '/business-report-card',
    })
    expect(defaults.items.find((item) => item.key === 'protection_gap')).toMatchObject({
      enabled: true,
      label: 'Protection Gap',
      href: '/protection-gap',
    })

    const help = selectPublicCardHelpTiles(buildOutcomeSections(cardWithDefaultCtas()))
    expect(help.find((tile) => tile.key === 'protect_family')?.href).toBe(ROUTES.familyAssessment)
    expect(help.find((tile) => tile.key === 'grow_business')?.href).toBe(ROUTES.businessReportCard)
    expect(help.find((tile) => tile.key === 'protection_gap')?.href).toBe(ROUTES.protectionGap)

    const hidden = selectPublicCardHelpTiles(
      buildOutcomeSections(
        cardWithDefaultCtas({
          ctas: createDefaultAdvisorCardCtas()
            .items.filter((item) => item.enabled)
            .filter(
              (item) =>
                item.key !== 'family_report_card' &&
                item.key !== 'business_report_card' &&
                item.key !== 'protection_gap',
            ),
        }),
      ),
    )
    expect(hidden.some((tile) => tile.key === 'protect_family')).toBe(false)
    expect(hidden.some((tile) => tile.key === 'grow_business')).toBe(false)
    expect(hidden.some((tile) => tile.key === 'protection_gap')).toBe(false)
  })

  it('routes Student Loan, Credit, and Home Buyer CTAs to the approved landings', () => {
    const defaults = createDefaultAdvisorCardCtas()
    expect(defaults.items.find((item) => item.key === 'student_loan_report_card')).toMatchObject({
      enabled: true,
      label: 'Student Loan Report Card',
      href: ROUTES.studentLoanReportCard,
    })
    expect(defaults.items.find((item) => item.key === 'credit_assessment')).toMatchObject({
      enabled: true,
      label: 'Credit Report Card',
      href: ROUTES.creditReportCard,
    })
    expect(defaults.items.find((item) => item.key === 'home_buyer_report_card')).toMatchObject({
      enabled: true,
      label: 'Home Buyer Readiness',
      href: ROUTES.homeBuyerReportCard,
    })

    const diagnostics = buildDiagnosticActions(cardWithDefaultCtas())
    expect(diagnostics.find((item) => item.key === 'student_loan_report_card')?.href).toBe(
      ROUTES.studentLoanReportCard,
    )
    expect(diagnostics.find((item) => item.key === 'credit_assessment')?.href).toBe(
      ROUTES.creditReportCard,
    )
    expect(diagnostics.find((item) => item.key === 'home_buyer_report_card')?.href).toBe(
      ROUTES.homeBuyerReportCard,
    )

    const help = selectPublicCardHelpTiles(buildOutcomeSections(cardWithDefaultCtas()))
    expect(help.find((tile) => tile.key === 'student_loan')?.href).toBe(ROUTES.studentLoanReportCard)
    expect(help.find((tile) => tile.key === 'improve_credit')?.href).toBe(ROUTES.creditReportCard)
    expect(help.find((tile) => tile.key === 'home_buyer')?.href).toBe(ROUTES.homeBuyerReportCard)
  })

  it('stamps existing card, campaign, event, source, and UTM attribution without advisor UUIDs', () => {
    const help = selectPublicCardHelpTiles(buildOutcomeSections(cardWithDefaultCtas()))
    const attribution = {
      campaignCode: 'summit',
      eventCode: 'day1',
      sourceChannel: 'link' as const,
      utmSource: 'flyer',
      utmMedium: 'print',
      utmCampaign: 'q3',
      utmTerm: 'home',
      utmContent: 'cta',
    }

    for (const key of ['student_loan', 'improve_credit', 'home_buyer'] as const) {
      const tile = help.find((item) => item.key === key)
      expect(tile?.href).toBeTruthy()
      const attributed = appendCardAttributionToPath(tile!.href!, KEY, attribution)
      expect(attributed).toContain(`card=${KEY}`)
      expect(attributed).toContain('c=summit')
      expect(attributed).toContain('e=day1')
      expect(attributed).toContain('src=link')
      expect(attributed).toContain('utm_source=flyer')
      expect(attributed).toContain('utm_medium=print')
      expect(attributed).toContain('utm_campaign=q3')
      expect(attributed).toContain('utm_term=home')
      expect(attributed).toContain('utm_content=cta')
      expect(attributed).not.toContain(ADVISOR_UUID)
      expect(attributed).not.toMatch(/advisorProfileId|advisor_profile_id|advisorId/)
    }
  })

  it('hides the new tiles when those services are disabled on the card', () => {
    const help = selectPublicCardHelpTiles(
      buildOutcomeSections(
        cardWithDefaultCtas({
          ctas: createDefaultAdvisorCardCtas()
            .items.filter((item) => item.enabled)
            .filter(
              (item) =>
                item.key !== 'student_loan_report_card' &&
                item.key !== 'credit_assessment' &&
                item.key !== 'home_buyer_report_card',
            ),
        }),
      ),
    )
    expect(help.map((tile) => tile.key)).toEqual([
      'protect_family',
      'protection_gap',
      'grow_business',
      'prepare_retirement',
    ])
  })

  it('keeps Home Buyer copy free of mortgage qualification language', () => {
    const source = [
      createDefaultAdvisorCardCtas(),
      buildOutcomeSections(cardWithDefaultCtas()),
      buildDiagnosticActions(cardWithDefaultCtas()),
    ]
      .map((value) => JSON.stringify(value))
      .join('\n')
    expect(source).toMatch(/Home Buyer Readiness/)
    expect(source).not.toMatch(/Mortgage Ready|Prequalified|Approved|Qualified/i)
  })

  it('keeps Digital Identity CTA copy on the existing English card surface', () => {
    const help = selectPublicCardHelpTiles(buildOutcomeSections(cardWithDefaultCtas()))
    expect(help.find((tile) => tile.key === 'student_loan')?.description).toBe(
      'Review your loans, repayment strategy, and potential opportunities.',
    )
    expect(help.find((tile) => tile.key === 'improve_credit')?.description).toBe(
      "See what's helping or hurting your credit profile and where to focus next.",
    )
    expect(help.find((tile) => tile.key === 'home_buyer')?.description).toBe(
      'See how prepared you are across credit, income, debt, savings, cash flow, and down payment readiness.',
    )
    expect(help.map((tile) => tile.title).join(' ')).not.toMatch(
      /Tarjeta|Préstamo|Crédito|Comprador/i,
    )
  })

  it('does not write CRM records or send messages when a CTA is clicked', () => {
    expect(publicCardPageSideEffects()).toMatchObject({
      writesAnalytics: false,
      writesDigitalCardEvents: false,
      createsLead: false,
      createsHousehold: false,
      createsActivity: false,
    })
    expect(publicCardCtaClickSideEffects()).toEqual({
      createsLead: false,
      createsHousehold: false,
      createsOpportunity: false,
      createsActivity: false,
      sendsSms: false,
      sendsEmail: false,
    })
  })
})
