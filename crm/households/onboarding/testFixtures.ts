import type { CrmHouseholdDetail, HouseholdMemberSummary } from '../types'
import { createEmptyOnboardingAnswers } from './onboardingSchema'
import type { HouseholdOnboardingAnswers } from './onboardingFormTypes'

export function memberFixture(
  partial: Partial<HouseholdMemberSummary> & Pick<HouseholdMemberSummary, 'id'>,
): HouseholdMemberSummary {
  return {
    household_id: 'hh-1',
    first_name: 'Ada',
    last_name: 'Lovelace',
    relationship: 'primary',
    is_primary_contact: true,
    email: 'ada@example.com',
    phone: null,
    date_of_birth: '1815-12-10',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

export function householdFixture(
  partial: Partial<CrmHouseholdDetail> = {},
): CrmHouseholdDetail {
  return {
    id: 'hh-1',
    display_name: 'Ada Household',
    status: 'client',
    primary_email: 'ada@example.com',
    primary_phone: '555-0100',
    assigned_advisor_id: null,
    relationship_stage_id: 'stage',
    updated_at: '2026-07-01T00:00:00.000Z',
    created_at: '2026-06-01T00:00:00.000Z',
    assigned_advisor: null,
    relationship_stage: null,
    members: [memberFixture({ id: 'm1' })],
    address_line1: '1 Analytical Engine Rd',
    address_line2: null,
    city: 'London',
    state: 'EN',
    postal_code: 'SW1A',
    ...partial,
  }
}

export function answersFixture(
  patch?: (answers: HouseholdOnboardingAnswers) => void,
): HouseholdOnboardingAnswers {
  const answers = createEmptyOnboardingAnswers({
    startedAt: '2026-07-01T00:00:00.000Z',
  })
  patch?.(answers)
  return answers
}

/** Minimal valid answers for all ten form sections (completion-ready). */
export function completeFormAnswersFixture(
  patch?: (answers: HouseholdOnboardingAnswers) => void,
): HouseholdOnboardingAnswers {
  return answersFixture((a) => {
    a.overview.maritalOrHouseholdStatus = 'married'
    a.overview.dependentsCount = 0
    a.overview.preferredContactMethod = 'email'
    a.income.noCurrentIncome = true
    a.cashFlow.takeHomeIncomeCents = 0
    a.cashFlow.housingCents = 0
    a.cashFlow.utilitiesCents = 0
    a.cashFlow.foodCents = 0
    a.cashFlow.transportationCents = 0
    a.assets.noAssets = true
    a.debts.noDebts = true
    a.insurance.noCurrentCoverage = true
    a.insurance.protectionConcernsAcknowledged = true
    a.retirement.planningStatus = 'not_yet_planning'
    a.retirement.desiredIncomeUnknown = true
    a.retirement.contributionAcknowledged = true
    a.retirement.retirementConfidence = 'not_discussed'
    a.estate.itemsAcknowledged = true
    a.estate.legacyGoals = 'Family'
    for (const item of a.estate.items) {
      if (
        item.key === 'will' ||
        item.key === 'financial_poa' ||
        item.key === 'healthcare_poa' ||
        item.key === 'advance_directive' ||
        item.key === 'beneficiary_review'
      ) {
        item.status = 'unknown'
      } else {
        item.status = 'not_applicable'
      }
    }
    a.goals.noCurrentGoals = true
    patch?.(a)
  })
}
