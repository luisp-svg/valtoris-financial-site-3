import { describe, expect, it } from 'vitest'
import { emptyAssetItem, emptyDebtItem, emptyIncomeSource } from './onboardingFormTypes'
import {
  computeCashFlowTotals,
  computeKnownAssetTotalCents,
  computeKnownDebtTotals,
  validateAssetsSection,
  validateCashFlowSection,
  validateDebtsSection,
  validateIncomeSection,
  validateMembersSection,
  validateOverviewSection,
} from './onboardingValidation'
import { answersFixture, householdFixture, memberFixture } from './testFixtures'

describe('overview validation', () => {
  it('treats empty overview as not_started and does not copy CRM fields into answers', () => {
    const answers = answersFixture()
    const result = validateOverviewSection(answers, { household: householdFixture() })
    expect(result.status).toBe('not_started')
    expect(answers.overview).not.toHaveProperty('display_name')
    expect(answers.overview).not.toHaveProperty('primary_email')
  })

  it('allows explicit zero dependents and completes when required fields are set', () => {
    const answers = answersFixture((a) => {
      a.overview.maritalOrHouseholdStatus = 'married'
      a.overview.dependentsCount = 0
      a.overview.preferredContactMethod = 'email'
      a.overview.advisorNotes = 'Optional notes'
    })
    const result = validateOverviewSection(answers, { household: householdFixture() })
    expect(result.status).toBe('complete')
    expect(result.missingRequiredFields).toEqual([])
  })

  it('marks incomplete required fields as in_progress once started', () => {
    const answers = answersFixture((a) => {
      a.overview.maritalOrHouseholdStatus = 'single'
    })
    const result = validateOverviewSection(answers, { household: householdFixture() })
    expect(result.status).toBe('in_progress')
    expect(result.missingRequiredFields).toContain('dependentsCount')
    expect(result.missingRequiredFields).toContain('preferredContactMethod')
  })
})

describe('members validation', () => {
  it('is not_started with zero active members', () => {
    const answers = answersFixture()
    const result = validateMembersSection(answers, {
      household: householdFixture({ members: [] }),
    })
    expect(result.status).toBe('not_started')
    expect(result.missingRequiredFields).toContain('activeMembers')
  })

  it('completes with one valid primary member', () => {
    const answers = answersFixture()
    const result = validateMembersSection(answers, { household: householdFixture() })
    expect(result.status).toBe('complete')
  })

  it('requires a primary contact and refreshes completion when household changes', () => {
    const answers = answersFixture()
    const withoutPrimary = householdFixture({
      members: [memberFixture({ id: 'm1', is_primary_contact: false })],
    })
    expect(validateMembersSection(answers, { household: withoutPrimary }).status).toBe(
      'in_progress',
    )
    const withPrimary = householdFixture({
      members: [memberFixture({ id: 'm1', is_primary_contact: true })],
    })
    expect(validateMembersSection(answers, { household: withPrimary }).status).toBe('complete')
  })
})

describe('income validation', () => {
  it('supports multiple sources and blank versus explicit zero amounts', () => {
    const answers = answersFixture((a) => {
      a.income.sources = [
        emptyIncomeSource({
          id: 's1',
          employerOrSourceName: 'Acme',
          employmentStatus: 'employed_full_time',
          grossAnnualIncomeCents: 10000000,
          netMonthlyIncomeCents: null,
          otherIncomeCents: 0,
        }),
        emptyIncomeSource({
          id: 's2',
          employerOrSourceName: 'Side',
          employmentStatus: 'self_employed',
          netMonthlyIncomeCents: 50000,
        }),
      ]
    })
    expect(validateIncomeSection(answers).status).toBe('complete')
    expect(answers.income.sources[0]?.netMonthlyIncomeCents).toBeNull()
    expect(answers.income.sources[0]?.otherIncomeCents).toBe(0)
  })

  it('completes with explicit no-current-income state', () => {
    const answers = answersFixture((a) => {
      a.income.noCurrentIncome = true
    })
    expect(validateIncomeSection(answers).status).toBe('complete')
  })

  it('marks incomplete sources as in_progress and negatives as needs_attention', () => {
    const incomplete = answersFixture((a) => {
      a.income.sources = [emptyIncomeSource({ id: 's1' })]
    })
    expect(validateIncomeSection(incomplete).status).toBe('in_progress')

    const negative = answersFixture((a) => {
      a.income.sources = [
        emptyIncomeSource({
          id: 's1',
          employerOrSourceName: 'Acme',
          grossAnnualIncomeCents: -100 as never,
        }),
      ]
    })
    expect(validateIncomeSection(negative).status).toBe('needs_attention')
  })
})

describe('cash flow validation', () => {
  it('computes totals with blanks as zero for display only and handles surplus/deficit', () => {
    const answers = answersFixture((a) => {
      a.cashFlow.takeHomeIncomeCents = 500000
      a.cashFlow.housingCents = 200000
      a.cashFlow.utilitiesCents = null
      a.cashFlow.foodCents = 0
      a.cashFlow.transportationCents = 50000
      a.cashFlow.unknownCategories = ['utilitiesCents']
    })
    const totals = computeCashFlowTotals(answers.cashFlow)
    expect(totals.totalExpensesCents).toBe(250000)
    expect(totals.surplusOrDeficitCents).toBe(250000)

    answers.cashFlow.takeHomeIncomeCents = 100000
    expect(computeCashFlowTotals(answers.cashFlow).surplusOrDeficitCents).toBe(-150000)
  })

  it('requires take-home and core expense acknowledgment', () => {
    const answers = answersFixture((a) => {
      a.cashFlow.takeHomeIncomeCents = 0
      a.cashFlow.housingCents = 100
    })
    const result = validateCashFlowSection(answers)
    expect(result.status).toBe('in_progress')
    expect(result.missingRequiredFields).toContain('utilitiesCents')
    expect(result.missingRequiredFields).toContain('foodCents')
  })

  it('rejects negative expenses', () => {
    const answers = answersFixture((a) => {
      a.cashFlow.takeHomeIncomeCents = 1000
      a.cashFlow.housingCents = -1 as never
      a.cashFlow.utilitiesCents = 0
      a.cashFlow.foodCents = 0
      a.cashFlow.transportationCents = 0
    })
    expect(validateCashFlowSection(answers).status).toBe('needs_attention')
  })
})

describe('assets validation', () => {
  it('supports multiple assets, blank balances, explicit zero, and known totals', () => {
    const answers = answersFixture((a) => {
      a.assets.items = [
        emptyAssetItem({ id: 'a1', category: 'checking', balanceCents: null }),
        emptyAssetItem({ id: 'a2', category: 'savings', balanceCents: 0 }),
        emptyAssetItem({ id: 'a3', category: 'brokerage', balanceCents: 250000 }),
      ]
    })
    expect(validateAssetsSection(answers).status).toBe('complete')
    expect(computeKnownAssetTotalCents(answers)).toBe(250000)
  })

  it('completes with no-assets acknowledgment and rejects negatives', () => {
    const none = answersFixture((a) => {
      a.assets.noAssets = true
    })
    expect(validateAssetsSection(none).status).toBe('complete')

    const negative = answersFixture((a) => {
      a.assets.items = [
        emptyAssetItem({ id: 'a1', category: 'checking', balanceCents: -5 as never }),
      ]
    })
    expect(validateAssetsSection(negative).status).toBe('needs_attention')
  })
})

describe('debts validation', () => {
  it('supports multiple debts, blank/zero balances, and known totals', () => {
    const answers = answersFixture((a) => {
      a.debts.items = [
        emptyDebtItem({
          id: 'd1',
          debtType: 'mortgage',
          balanceCents: 10000000,
          minimumPaymentCents: 150000,
          interestRatePercent: 4.5,
        }),
        emptyDebtItem({
          id: 'd2',
          debtType: 'credit_card',
          balanceCents: null,
          minimumPaymentCents: 0,
          interestRatePercent: null,
        }),
      ]
    })
    expect(validateDebtsSection(answers).status).toBe('complete')
    expect(computeKnownDebtTotals(answers)).toEqual({
      totalBalanceCents: 10000000,
      totalMinimumPaymentCents: 150000,
    })
  })

  it('completes with no-debt acknowledgment and rejects invalid amounts/rates', () => {
    const none = answersFixture((a) => {
      a.debts.noDebts = true
    })
    expect(validateDebtsSection(none).status).toBe('complete')

    const invalid = answersFixture((a) => {
      a.debts.items = [
        emptyDebtItem({
          id: 'd1',
          debtType: 'auto_loan',
          balanceCents: -1 as never,
          interestRatePercent: 120,
        }),
      ]
    })
    const result = validateDebtsSection(invalid)
    expect(result.status).toBe('needs_attention')
    expect(Object.keys(result.errors).length).toBeGreaterThan(0)
  })
})
