import type { DemoAssessmentAnswers } from '../../../components/assessment/types'
import type { ConsentSnapshot, MatchCandidate } from './types'

/** Minimal, always-complete DemoAssessmentAnswers fixture for server-side tests. */
export function validFamilyAnswersFixture(
  overrides?: Partial<DemoAssessmentAnswers>,
): DemoAssessmentAnswers {
  return {
    family: {
      firstName: 'Jamie',
      lastName: 'Rivera',
      email: 'jamie.rivera@example.com',
      phone: '555-201-4488',
      age: '38',
      state: 'TX',
      maritalStatus: 'married',
      numberOfChildren: '2',
    },
    financial: {
      householdIncome: '150000',
      monthlyHousingPayment: '2200',
      totalDebt: '18000',
      emergencyFundMonths: '3',
      monthlyCashFlow: 'break-even',
      retirementContribution: '6-10',
    },
    protection: {
      currentLifeInsurance: '250000',
      hasDisabilityProtection: 'yes',
      hasWill: 'no',
      hasTrust: 'no',
      beneficiariesReviewed: 'yes',
      guardianDocumented: 'no',
    },
    goals: {
      selected: ['protect-family', 'debt-free'],
    },
    ...overrides,
  }
}

export function fullConsentSnapshotFixture(overrides?: Partial<ConsentSnapshot>): ConsentSnapshot {
  return {
    assessmentStorageAcknowledged: true,
    contactPermission: true,
    emailMarketingConsent: false,
    smsMarketingConsent: false,
    privacyAcknowledged: true,
    consentVersion: '2026-07-01',
    consentedAt: '2026-07-28T18:00:00.000Z',
    ...overrides,
  }
}

const VALID_SUBMISSION_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

/** Minimal valid raw request body for `validateFamilyReportCardIngestRequest` / `ingestFamilyReportCard`. */
export function validIngestRequestBodyFixture(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    submissionId: VALID_SUBMISSION_ID,
    assessmentType: 'family',
    assessmentVersion: 1,
    answers: validFamilyAnswersFixture(),
    sourcePage: '/family-report-card',
    consent: fullConsentSnapshotFixture(),
    submittedAt: '2026-07-28T18:00:00.000Z',
    ...overrides,
  }
}

export function matchCandidateFixture(overrides?: Partial<MatchCandidate>): MatchCandidate {
  return {
    householdId: 'hh-existing-1',
    displayName: 'Jamie Rivera',
    normalizedEmail: 'jamie.rivera@example.com',
    normalizedPhone: '+15552014488',
    firstName: 'Jamie',
    lastName: 'Rivera',
    source: 'household',
    ...overrides,
  }
}
