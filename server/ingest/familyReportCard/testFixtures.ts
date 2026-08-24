import type { DemoAssessmentAnswers } from '../../../components/assessment/types'
import {
  INITIAL_CREDIT_ANSWERS,
  type CreditAssessmentAnswers,
  type CreditDiagnosticAnswers,
} from '../../../components/assessment/credit/types'
import {
  INITIAL_STUDENT_LOAN_ANSWERS,
  type StudentLoanAssessmentAnswers,
  type StudentLoanDiagnosticAnswers,
} from '../../../components/assessment/studentLoan/types'
import type { CalculatorAnswers } from '../../../components/calculator/types'
import { DEMO_BUSINESS_ANSWERS } from '../../../components/reportCard/businessReportCardData'
import { DEMO_RETIREMENT_ANSWERS } from '../../../components/reportCard/retirementReportCardData'
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

export function validProtectionAnswersFixture(
  overrides?: Partial<CalculatorAnswers>,
): CalculatorAnswers {
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
    income: {
      annualHouseholdIncome: '150000',
      incomeReplacementYears: '15',
      customIncomeYears: '',
    },
    housing: {
      housingType: 'own',
      annualMortgagePayment: '24000',
      annualRentPayment: '',
    },
    debt: {
      creditCardDebt: '5000',
      autoLoans: '12000',
      personalLoans: '0',
      studentLoans: '0',
    },
    education: {
      numberOfChildren: '2',
      collegeFundPerChild: '100000',
      customCollegeFund: '',
    },
    finalExpenses: {
      amount: '25000',
      customAmount: '',
    },
    coverage: {
      currentLifeInsurance: '250000',
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

export function validBusinessIngestRequestBodyFixture(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return validIngestRequestBodyFixture({
    submissionId: '550e8400-e29b-41d4-a716-446655440001',
    assessmentType: 'business',
    answers: DEMO_BUSINESS_ANSWERS,
    sourcePage: '/business-report-card',
    ...overrides,
  })
}

export function validRetirementIngestRequestBodyFixture(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return validIngestRequestBodyFixture({
    submissionId: '550e8400-e29b-41d4-a716-446655440002',
    assessmentType: 'retirement',
    answers: DEMO_RETIREMENT_ANSWERS,
    sourcePage: '/retirement-report-card',
    ...overrides,
  })
}

export function validStudentLoanDiagnosticFixture(
  overrides?: Partial<StudentLoanDiagnosticAnswers>,
): StudentLoanDiagnosticAnswers {
  return {
    ...INITIAL_STUDENT_LOAN_ANSWERS.diagnostic,
    loan_types: ['direct'],
    total_balance: 'over_100k',
    loan_status: 'repayment',
    servicer_mode: 'named',
    servicer_name: 'MOHELA',
    knows_plan: 'yes',
    current_plan: 'ibr',
    income: '75k_125k',
    household_size: '2',
    employment_type: 'private',
    employment_tenure: '5_10',
    payment_recent: 'consistent',
    payment_paused: 'no',
    previous_actions: ['idr'],
    primary_goal: 'understand_options',
    urgency: 'within_3_months',
    ...overrides,
  }
}

export function validStudentLoanAnswersFixture(
  overrides?: Partial<StudentLoanAssessmentAnswers>,
): StudentLoanAssessmentAnswers {
  return {
    diagnostic: validStudentLoanDiagnosticFixture(),
    contact: {
      firstName: 'Jamie',
      lastName: 'Rivera',
      email: 'jamie.rivera@example.com',
      phone: '555-201-4488',
    },
    ...overrides,
  }
}

export function validStudentLoanIngestRequestBodyFixture(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return validIngestRequestBodyFixture({
    submissionId: '550e8400-e29b-41d4-a716-446655440004',
    assessmentType: 'student_loan',
    answers: validStudentLoanAnswersFixture(),
    sourcePage: '/student-loan-assessment',
    ...overrides,
  })
}

export function validCreditDiagnosticFixture(
  overrides?: Partial<CreditDiagnosticAnswers>,
): CreditDiagnosticAnswers {
  return {
    ...INITIAL_CREDIT_ANSWERS.diagnostic,
    credit_goal: 'general_health',
    self_reported_score: '740_plus',
    last_reviewed: 'last_30_days',
    inaccuracy_belief: 'no',
    late_recent: 'none',
    payment_consistency: 'on_time',
    negative_items: ['none'],
    utilization: 'under_10',
    open_revolving: '3_5',
    oldest_account: '10_plus',
    hard_inquiries: 'none',
    new_accounts: 'none',
    minimums: 'comfortable',
    current_status: 'current',
    urgency: 'just_exploring',
    prior_actions: ['none'],
    ...overrides,
  }
}

export function validCreditAnswersFixture(
  overrides?: Partial<CreditAssessmentAnswers>,
): CreditAssessmentAnswers {
  return {
    diagnostic: validCreditDiagnosticFixture(),
    contact: {
      firstName: 'Jamie',
      lastName: 'Rivera',
      email: 'jamie.rivera@example.com',
      phone: '555-201-4488',
    },
    ...overrides,
  }
}

export function validCreditIngestRequestBodyFixture(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return validIngestRequestBodyFixture({
    submissionId: '550e8400-e29b-41d4-a716-446655440005',
    assessmentType: 'credit',
    answers: validCreditAnswersFixture(),
    sourcePage: '/credit-assessment',
    ...overrides,
  })
}

export function validProtectionIngestRequestBodyFixture(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return validIngestRequestBodyFixture({
    submissionId: '550e8400-e29b-41d4-a716-446655440003',
    assessmentType: 'protection',
    answers: validProtectionAnswersFixture(),
    sourcePage: '/protection-gap',
    ...overrides,
  })
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
