import { describe, expect, it, vi } from 'vitest'
import { BusinessAssessmentAnswers, INITIAL_BUSINESS_ANSWERS } from '../business/types'
import { DEMO_BUSINESS_ANSWERS } from '../../reportCard/businessReportCardData'
import { submitBusinessReportCardLead } from '../../reportCard/submitReportCardLead'
import { scoreBusinessAssessment } from './scoreBusinessAssessment'

function buildAnswers(overrides: Partial<BusinessAssessmentAnswers>): BusinessAssessmentAnswers {
  return {
    owner: { ...INITIAL_BUSINESS_ANSWERS.owner, ...overrides.owner },
    business: { ...INITIAL_BUSINESS_ANSWERS.business, ...overrides.business },
    foundation: { ...INITIAL_BUSINESS_ANSWERS.foundation, ...overrides.foundation },
    cashFlowTax: { ...INITIAL_BUSINESS_ANSWERS.cashFlowTax, ...overrides.cashFlowTax },
    protectionRisk: { ...INITIAL_BUSINESS_ANSWERS.protectionRisk, ...overrides.protectionRisk },
    retirementFundingExit: {
      ...INITIAL_BUSINESS_ANSWERS.retirementFundingExit,
      ...overrides.retirementFundingExit,
    },
    goals: { ...INITIAL_BUSINESS_ANSWERS.goals, ...overrides.goals },
  }
}

export const WEAK_BUSINESS_PROFILE: BusinessAssessmentAnswers = buildAnswers({
  owner: {
    firstName: 'Weak',
    lastName: 'Owner',
    email: 'weak@example.com',
    phone: '5551112222',
  },
  business: {
    name: 'Weak Co',
    industry: 'restaurant-food',
    yearsInBusiness: 'under-2',
    employees: 'solo',
    grossAnnualRevenue: 'under-100k',
    ownerCompensationMethod: 'not-consistent',
    ownerPersonalIncome: 'zero',
  },
  foundation: {
    entityStructure: 'sole-prop',
    operatingDocs: 'none',
    financeSeparation: 'not-separated',
  },
  cashFlowTax: {
    operatingCashFlow: 'negative',
    reserveMonths: 'none',
    revenuePredictability: 'unpredictable',
    acceptsCardPayments: 'yes',
    cardSalesPercentage: '75-100',
    estimatedProcessingRate: 'unsure',
    lastProcessingReview: 'never',
    taxPlanning: 'none',
    taxBenefitStrategies: 'no',
  },
  protectionRisk: {
    keyPersonBuySell: 'no',
    continuityPlan: 'no',
    coreInsurance: 'no',
    specializedCoverage: 'no',
  },
  retirementFundingExit: {
    ownerRetirementSavings: 'not-saving',
    businessCredit: 'personal',
    growthCapital: 'difficult',
    successionPlan: 'none',
    valuationBaseline: 'no',
  },
  goals: {
    selected: ['protect-key-people'],
  },
})

export const AVERAGE_BUSINESS_PROFILE: BusinessAssessmentAnswers = buildAnswers({
  owner: {
    firstName: 'Average',
    lastName: 'Owner',
    email: 'average@example.com',
    phone: '5553334444',
  },
  business: {
    name: 'Average LLC',
    industry: 'professional-services',
    yearsInBusiness: '6-10',
    employees: '2-5',
    grossAnnualRevenue: '250k-499k',
    ownerCompensationMethod: 'owners-draw',
    ownerPersonalIncome: '50k-99k',
  },
  foundation: {
    entityStructure: 'single-member-llc',
    operatingDocs: 'needs-update',
    financeSeparation: 'mostly-separated',
  },
  cashFlowTax: {
    operatingCashFlow: 'break-even',
    reserveMonths: '1-2',
    revenuePredictability: 'mostly-predictable',
    acceptsCardPayments: 'yes',
    cardSalesPercentage: '50-74',
    estimatedProcessingRate: '3.5-plus',
    lastProcessingReview: 'over-12mo',
    taxPlanning: 'annual-review',
    taxBenefitStrategies: 'yes-basic',
  },
  protectionRisk: {
    keyPersonBuySell: 'planning',
    continuityPlan: 'informal',
    coreInsurance: 'yes-basic',
    specializedCoverage: 'partial',
  },
  retirementFundingExit: {
    ownerRetirementSavings: '6-10',
    businessCredit: 'building',
    growthCapital: 'limited',
    successionPlan: 'informal',
    valuationBaseline: 'outdated',
  },
  goals: {
    selected: ['improve-cash-flow', 'reduce-taxes'],
  },
})

export const STRONG_BUSINESS_PROFILE: BusinessAssessmentAnswers = buildAnswers({
  owner: {
    firstName: 'Strong',
    lastName: 'Owner',
    email: 'strong@example.com',
    phone: '5555556666',
  },
  business: {
    name: 'Strong Inc',
    industry: 'technology',
    yearsInBusiness: 'over-20',
    employees: '21-50',
    grossAnnualRevenue: '5m-plus',
    ownerCompensationMethod: 'salary-plus-distributions',
    ownerPersonalIncome: '200k-499k',
  },
  foundation: {
    entityStructure: 's-corp',
    operatingDocs: 'current',
    financeSeparation: 'fully-separated',
  },
  cashFlowTax: {
    operatingCashFlow: 'positive-reinvest',
    reserveMonths: '6plus',
    revenuePredictability: 'very-predictable',
    acceptsCardPayments: 'yes',
    cardSalesPercentage: '25-49',
    estimatedProcessingRate: '2-2.49',
    lastProcessingReview: 'within-6mo',
    taxPlanning: 'proactive',
    taxBenefitStrategies: 'yes-multiple',
  },
  protectionRisk: {
    keyPersonBuySell: 'yes-funded',
    continuityPlan: 'documented',
    coreInsurance: 'yes-reviewed',
    specializedCoverage: 'comprehensive',
  },
  retirementFundingExit: {
    ownerRetirementSavings: 'over-15',
    businessCredit: 'established',
    growthCapital: 'readily',
    successionPlan: 'documented',
    valuationBaseline: 'recent',
  },
  goals: {
    selected: ['plan-exit', 'build-owner-wealth'],
  },
})

describe('scoreBusinessAssessment profiles', () => {
  it('produces clearly different overall scores for weak, average, and strong profiles', () => {
    const weak = scoreBusinessAssessment(WEAK_BUSINESS_PROFILE)
    const average = scoreBusinessAssessment(AVERAGE_BUSINESS_PROFILE)
    const strong = scoreBusinessAssessment(STRONG_BUSINESS_PROFILE)

    expect(weak.overallScore).toBeLessThan(average.overallScore)
    expect(average.overallScore).toBeLessThan(strong.overallScore)

    expect(weak.overallScore).toBeLessThan(60)
    expect(strong.overallScore).toBeGreaterThan(85)
    expect(strong.overallScore - weak.overallScore).toBeGreaterThanOrEqual(40)
  })

  it('produces different grades and current levels across profiles', () => {
    const weak = scoreBusinessAssessment(WEAK_BUSINESS_PROFILE)
    const average = scoreBusinessAssessment(AVERAGE_BUSINESS_PROFILE)
    const strong = scoreBusinessAssessment(STRONG_BUSINESS_PROFILE)

    expect(weak.overallGrade).not.toBe(strong.overallGrade)
    expect(average.overallGrade).not.toBe(strong.overallGrade)
    expect(weak.currentLevel).toBe('Needs Immediate Attention')
    expect(strong.currentLevel).not.toBe(weak.currentLevel)
  })

  it('produces different category scores and priorities across profiles', () => {
    const weak = scoreBusinessAssessment(WEAK_BUSINESS_PROFILE)
    const average = scoreBusinessAssessment(AVERAGE_BUSINESS_PROFILE)
    const strong = scoreBusinessAssessment(STRONG_BUSINESS_PROFILE)

    const weakProtection = weak.categories.find((c) => c.id === 'business-protection')!.score
    const strongProtection = strong.categories.find((c) => c.id === 'business-protection')!.score
    expect(weakProtection).toBeLessThan(strongProtection)

    expect(weak.priorities[0]?.title).not.toBe(strong.priorities[0]?.title)
    expect(weak.priorities.map((p) => p.title)).not.toEqual(average.priorities.map((p) => p.title))
    expect(strong.priorities.map((p) => p.title)).not.toEqual(weak.priorities.map((p) => p.title))
  })

  it('does not penalize a high processing rate when the owner knows the rate and reviews statements', () => {
    const awareHighRate = scoreBusinessAssessment(
      buildAnswers({
        cashFlowTax: {
          ...AVERAGE_BUSINESS_PROFILE.cashFlowTax,
          cardSalesPercentage: '50-74',
          estimatedProcessingRate: '3.5-plus',
          lastProcessingReview: 'within-6mo',
        },
      }),
    )
    const unawareHighRate = scoreBusinessAssessment(
      buildAnswers({
        cashFlowTax: {
          ...WEAK_BUSINESS_PROFILE.cashFlowTax,
        },
      }),
    )

    const awareCashflow = awareHighRate.categories.find((c) => c.id === 'cashflow')!.score
    const unawareCashflow = unawareHighRate.categories.find((c) => c.id === 'cashflow')!.score

    expect(awareCashflow).toBeGreaterThan(unawareCashflow)
    expect(
      unawareHighRate.categories
        .find((c) => c.id === 'cashflow')!
        .recommendations.some((item) => item.includes('merchant processing')),
    ).toBe(true)
  })

  it('flags high revenue without retirement savings in recommendations and priorities', () => {
    const flagged = scoreBusinessAssessment(
      buildAnswers({
        business: {
          ...AVERAGE_BUSINESS_PROFILE.business,
          grossAnnualRevenue: '2.5m-4.99m',
        },
        retirementFundingExit: {
          ...AVERAGE_BUSINESS_PROFILE.retirementFundingExit,
          ownerRetirementSavings: 'not-saving',
        },
      }),
    )

    const retirement = flagged.categories.find((c) => c.id === 'retirement')!
    expect(retirement.score).toBe(15)
    expect(
      retirement.recommendations.some((item) =>
        item.includes('meaningful business revenue'),
      ),
    ).toBe(true)
    const priorityTitles = flagged.priorities.map((item) => item.title)
    expect(priorityTitles).toContain('Build Owner Wealth Outside the Business')
  })

  it('scores demo business profile in a believable B-range without hardcoded 78', () => {
    const demo = scoreBusinessAssessment(DEMO_BUSINESS_ANSWERS)

    expect(demo.overallScore).toBeGreaterThanOrEqual(70)
    expect(demo.overallScore).toBeLessThanOrEqual(85)
    expect(demo.overallGrade).not.toBe('F')
    expect(demo.overallScore).not.toBe(78)
  })

  it('is deterministic for identical answers', () => {
    const first = scoreBusinessAssessment(AVERAGE_BUSINESS_PROFILE)
    const second = scoreBusinessAssessment(AVERAGE_BUSINESS_PROFILE)

    expect(first).toEqual(second)
  })
})

describe('submitBusinessReportCardLead', () => {
  it('maps dynamic score, grade, priorities, business fields, and raw answers into Google Sheets payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'ok',
    })
    vi.stubGlobal('fetch', fetchMock)

    const scored = scoreBusinessAssessment(AVERAGE_BUSINESS_PROFILE)
    const result = await submitBusinessReportCardLead(AVERAGE_BUSINESS_PROFILE)

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.leadType).toBe('Business Report Card')
    expect(body.firstName).toBe('Average')
    expect(body.lastName).toBe('Owner')
    expect(body.email).toBe('average@example.com')
    expect(body.phone).toBe('5553334444')
    expect(body.businessName).toBe('Average LLC')
    expect(body.businessIndustry).toBe('professional-services')
    expect(body.entityStructure).toBe('single-member-llc')
    expect(body.grossAnnualRevenue).toBe('250k-499k')
    expect(body.ownerCompensationMethod).toBe('owners-draw')
    expect(body.ownerPersonalIncome).toBe('50k-99k')
    expect(body.acceptsCardPayments).toBe('yes')
    expect(body.cardSalesPercentage).toBe('50-74')
    expect(body.estimatedProcessingRate).toBe('3.5-plus')
    expect(body.lastProcessingReview).toBe('over-12mo')
    expect(body.overallScore).toBe(scored.overallScore)
    expect(body.overallGrade).toBe(scored.overallGrade)
    expect(body.topPriority1).toBe(scored.priorities[0]?.title)
    expect(body.topPriority2).toBe(scored.priorities[1]?.title)
    expect(body.topPriority3).toBe(scored.priorities[2]?.title)
    expect(body.protectionGap).toBe(scored.protectionRating)
    expect(body.rawAnswers).toBe(JSON.stringify(AVERAGE_BUSINESS_PROFILE))
    expect(body.overallScore).not.toBe(78)
    expect(body.overallGrade).not.toBe('B')

    vi.unstubAllGlobals()
  })
})
