import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PUBLIC_REPORT_CARD_ASSESSMENT_TYPES } from '../../../modules/reportCard/publicIngestCatalog'
import {
  SPECIALIZED_ASSESSMENT_PRODUCTS,
  STUDENT_LOAN_ASSESSMENT_TYPE,
} from '../../../modules/reportCard/specializedAssessmentCatalog'
import { WORKSPACE_ASSESSMENT_TYPES } from '../../../crm/households/householdsApi'
import { ROUTES } from '../../../constants/routes'
import { STUDENT_LOAN_CTA } from '../../../constants/homepage'
import { validIngestRequestBodyFixture } from '../../../server/ingest/familyReportCard/testFixtures'
import { validateFamilyReportCardIngestRequest } from '../../../server/ingest/familyReportCard/validation'
import StudentLoanReportCardResults from '../../../pages/StudentLoanReportCardResults'
import { STUDENT_LOAN_QUESTIONS } from './questions'
import {
  FORBIDDEN_STUDENT_LOAN_FIELD_TOKENS,
  STUDENT_LOAN_ASSESSMENT_STEPS,
  STUDENT_LOAN_CONTACT_STEP,
  STUDENT_LOAN_CONTACT_STEP_ID,
  STUDENT_LOAN_DIAGNOSTIC_QUESTION_COUNT,
  STUDENT_LOAN_DIAGNOSTIC_QUESTION_IDS,
} from './constants'
import {
  STUDENT_LOAN_REPAYMENT_PLAN_CATALOG_VERSION,
  STUDENT_LOAN_REPAYMENT_PLAN_VALUES,
  STUDENT_LOAN_REPAYMENT_TERMINOLOGY_VERIFIED_ON,
} from './repaymentPlans'
import { studentLoanCopy } from './copy'
import { canSubmitStudentLoanToCrm } from './ingestBoundary'
import { getStudentLoanResultsModel } from './resultsModel'
import { isStudentLoanContactComplete, isStudentLoanDiagnosticComplete } from './completeness'
import { INITIAL_STUDENT_LOAN_ANSWERS } from './types'

const ROOT = process.cwd()
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations')
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'

function fileSha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(join(ROOT, relativePath))).digest('hex')
}

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function collectCanonicalValues(): string[] {
  const values: string[] = []
  for (const question of STUDENT_LOAN_QUESTIONS) {
    for (const field of question.fields) {
      if (field.input === 'short_text') continue
      for (const option of field.options) values.push(option.value)
    }
  }
  return values
}

describe('Student Loan Phase A foundation', () => {
  it('defines exactly 10 diagnostic question groups and excludes contact', () => {
    expect(STUDENT_LOAN_DIAGNOSTIC_QUESTION_IDS).toEqual([
      'loan_types',
      'total_balance',
      'loan_status',
      'loan_servicer',
      'repayment_plan',
      'income_household',
      'employment',
      'payment_history',
      'previous_actions',
      'goal_urgency',
    ])
    expect(STUDENT_LOAN_QUESTIONS.map((question) => question.id)).toEqual([
      ...STUDENT_LOAN_DIAGNOSTIC_QUESTION_IDS,
    ])
    expect(STUDENT_LOAN_DIAGNOSTIC_QUESTION_COUNT).toBe(10)
    expect(STUDENT_LOAN_CONTACT_STEP_ID).toBe('contact')
    expect(STUDENT_LOAN_DIAGNOSTIC_QUESTION_IDS).not.toContain(STUDENT_LOAN_CONTACT_STEP_ID)
    expect(STUDENT_LOAN_CONTACT_STEP).toBe(12)
    expect(STUDENT_LOAN_ASSESSMENT_STEPS).toBe(12)
    expect(isStudentLoanContactComplete(INITIAL_STUDENT_LOAN_ANSWERS)).toBe(false)
    expect(isStudentLoanDiagnosticComplete(INITIAL_STUDENT_LOAN_ANSWERS.diagnostic)).toBe(false)
  })

  it('stores language-neutral canonical values', () => {
    const values = collectCanonicalValues()
    expect(values).toContain('direct')
    expect(values).toContain('under_25k')
    expect(values).toContain('deferment_forbearance')
    expect(values).not.toContain('Federal Direct Loan')
    expect(values).not.toContain('Under $25,000')
    for (const value of values) {
      expect(value).toMatch(/^[a-z0-9_]+$/)
    }
  })

  it('does not collect SSN, FSA, DOB, or account-number fields', () => {
    const fieldIds = STUDENT_LOAN_QUESTIONS.flatMap((question) => [
      question.id,
      ...question.fields.map((field) => field.id),
    ])
    const typeKeys = source('components/assessment/studentLoan/types.ts')
    for (const token of FORBIDDEN_STUDENT_LOAN_FIELD_TOKENS) {
      expect(fieldIds.join(' ')).not.toContain(token)
      expect(typeKeys).not.toMatch(new RegExp(`\\b${token}\\b`, 'i'))
    }
  })

  it('keeps repayment plans in app config, not schema', () => {
    expect(STUDENT_LOAN_REPAYMENT_PLAN_CATALOG_VERSION).toBe(2)
    expect(STUDENT_LOAN_REPAYMENT_TERMINOLOGY_VERIFIED_ON).toBe('2026-08-22')
    expect(STUDENT_LOAN_REPAYMENT_PLAN_VALUES).toEqual([
      'rap',
      'tiered_standard',
      'standard',
      'ibr',
      'paye',
      'icr',
      'save',
      'repaye',
      'other',
      'not_sure',
    ])
    const migrations = readdirSync(MIGRATIONS_DIR).join('\n')
    expect(migrations).not.toMatch(/repayment_plan/)
    expect(source('supabase/migrations/048_student_loan_report_card_ingest.sql')).not.toContain('repaye')
    expect(source('components/assessment/studentLoan/questions.ts')).toContain('STUDENT_LOAN_REPAYMENT_PLAN_OPTIONS')
  })

  it('adds public Student Loan routes without Spanish route duplication', () => {
    expect(ROUTES.studentLoanReportCard).toBe('/student-loan-report-card')
    expect(ROUTES.studentLoanAssessment).toBe('/student-loan-assessment')
    expect(ROUTES.studentLoanReportCardResults).toBe('/student-loan-results')
    expect(STUDENT_LOAN_CTA).toContain('Student Loan')
    const app = source('src/App.tsx')
    expect(app).toContain('StudentLoanReportCardPage')
    expect(app).toContain('StudentLoanAssessment')
    expect(app).toContain('StudentLoanReportCardResults')
    expect(app).not.toContain('/es/student-loan')
  })

  it('does not fabricate a results score or grade', () => {
    const model = getStudentLoanResultsModel()
    expect(model.available).toBe(false)
    expect(model.score).toBeNull()
    expect(model.overallScore).toBeNull()
    expect(model.grade).toBeNull()
    expect(model.categoryScores).toEqual([])
    expect(model.criticalFlags).toEqual([])
    expect(model.topReviewAreas).toEqual([])
    expect(model.primaryGoal).toBeNull()
    expect(model.bookingCta).toBeNull()

    const html = renderToStaticMarkup(
      createElement(MemoryRouter, { initialEntries: ['/student-loan-results'] }, createElement(StudentLoanReportCardResults)),
    )
    expect(html).toContain('Your Student Loan Report Card results are not available yet.')
    expect(html).not.toContain('Unexpected scored result')
    expect(html).not.toMatch(/\b(A\+|A-|B\+|72|88)\b/)
    expect(html).not.toContain('data-score')
  })

  it('keeps specialized product identity separate from Family and does not create Opportunities', () => {
    expect(canSubmitStudentLoanToCrm()).toBe(true)
    expect(PUBLIC_REPORT_CARD_ASSESSMENT_TYPES).toContain('student_loan')
    expect(SPECIALIZED_ASSESSMENT_PRODUCTS).toEqual(['student_loan', 'credit', 'home_buyer'])
    expect(STUDENT_LOAN_ASSESSMENT_TYPE).toBe('student_loan')
    expect(WORKSPACE_ASSESSMENT_TYPES).toContain('student_loan')

    const rejected = validateFamilyReportCardIngestRequest(
      validIngestRequestBodyFixture({ assessmentType: 'household_onboarding' }),
    )
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.code).toBe('invalid_assessment_type')

    const assessmentSource = source('pages/StudentLoanAssessment.tsx')
    expect(assessmentSource).toContain('completePublicReportCardCrmSubmission')
    expect(assessmentSource).not.toContain('/api/ingest-student-loan')
    expect(assessmentSource.toLowerCase()).not.toContain('create opportunity')
    expect(source('components/assessment/studentLoan/ingestBoundary.ts')).not.toContain('opportunity')
  })

  it('leaves 047–049 byte-identical and does not add Migration 051', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort()
    expect(files).toHaveLength(54)
    expect(files[46]).toBe('047_credit_repair_student_loan_sales_catalog.sql')
    expect(files[47]).toBe('048_student_loan_report_card_ingest.sql')
    expect(files[48]).toBe('049_specialize_public_report_card_follow_up_copy.sql')
    expect(files[49]).toBe('050_credit_report_card_ingest.sql')
    expect(files.some((name) => name.startsWith('051_'))).toBe(true)
    expect(files.some((name) => name.startsWith('052_'))).toBe(true)
    expect(files.some((name) => name.startsWith('053_'))).toBe(true)
    expect(files.some((name) => name.startsWith('054_'))).toBe(true)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
  })

  it('keeps English question copy out of the scoring path', () => {
    expect(studentLoanCopy.en?.questions.loan_types).toContain('student loans')
    expect(existsSync(join(ROOT, 'components/assessment/studentLoan/scoreStudentLoanAssessment.ts'))).toBe(
      true,
    )
    expect(source('components/assessment/studentLoan/scoreStudentLoanAssessment.ts')).not.toContain(
      "from './copy'",
    )
  })
})
