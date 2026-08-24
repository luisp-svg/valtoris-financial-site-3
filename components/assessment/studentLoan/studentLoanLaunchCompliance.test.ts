import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { STUDENTAID_GOV_URL } from '../../../constants/urls'
import StepStudentLoanContact from '../steps/studentLoan/StepStudentLoanContact'
import { INITIAL_STUDENT_LOAN_CONTACT } from './types'
import StudentLoanReportCardPage from '../../../pages/StudentLoanReportCardPage'
import StudentLoanReportCardResults from '../../../pages/StudentLoanReportCardResults'
import { resolveSpecializedCopy } from '../specialized/locale'
import SpecializedQuestionRenderer from '../specialized/renderer'
import type { SpecializedAnswerMap, SpecializedQuestion } from '../specialized/types'
import { STUDENT_LOAN_DIAGNOSTIC_QUESTION_IDS, FORBIDDEN_STUDENT_LOAN_FIELD_TOKENS } from './constants'
import { studentLoanCopy } from './copy'
import { STUDENT_LOAN_QUESTIONS } from './questions'
import {
  STUDENT_LOAN_REPAYMENT_PLAN_CATALOG_VERSION,
  STUDENT_LOAN_REPAYMENT_PLAN_VALUES,
  STUDENT_LOAN_REPAYMENT_TERMINOLOGY_SOURCE_CATEGORY,
  STUDENT_LOAN_REPAYMENT_TERMINOLOGY_VERIFIED_ON,
} from './repaymentPlans'
import { buildStudentLoanResultsSession } from './resultsModel'
import { scoreStudentLoanAssessment, STUDENT_LOAN_SCORING_VERSION } from './scoreStudentLoanAssessment'
import { strongDiagnostic } from './scoreStudentLoanAssessment.test'
import { validateStudentLoanAnswers } from '../../../server/ingest/familyReportCard/validateStudentLoanAnswers'
import { validStudentLoanAnswersFixture } from '../../../server/ingest/familyReportCard/testFixtures'

const ROOT = process.cwd()
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'

function fileSha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(join(ROOT, relativePath))).digest('hex')
}

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function t(
  section: 'questions' | 'helpers' | 'fields' | 'answers' | 'placeholders' | 'validation' | 'ui' | 'results',
  key: string,
) {
  return resolveSpecializedCopy(studentLoanCopy, 'en', section, key)
}

function renderQuestion(question: SpecializedQuestion, values: SpecializedAnswerMap) {
  return renderToStaticMarkup(
    createElement(SpecializedQuestionRenderer, {
      question,
      values,
      t,
      onChange: () => undefined,
    }),
  )
}

function englishCopyBlob(): string {
  const catalog = studentLoanCopy.en
  if (!catalog) throw new Error('English Student Loan copy is required')
  return JSON.stringify(catalog)
}

describe('Student Loan launch compliance', () => {
  it('keeps exactly 10 diagnostic groups and the approved plan catalog', () => {
    expect(STUDENT_LOAN_QUESTIONS).toHaveLength(10)
    expect(STUDENT_LOAN_DIAGNOSTIC_QUESTION_IDS).toHaveLength(10)
    expect(STUDENT_LOAN_REPAYMENT_PLAN_CATALOG_VERSION).toBe(2)
    expect(STUDENT_LOAN_REPAYMENT_TERMINOLOGY_VERIFIED_ON).toBe('2026-08-22')
    expect(STUDENT_LOAN_REPAYMENT_TERMINOLOGY_SOURCE_CATEGORY).toContain('StudentAid.gov')
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
  })

  it('labels current and legacy plans without implying enrollment or eligibility', () => {
    expect(t('answers', 'current_plan.rap')).toBe('Repayment Assistance Plan (RAP)')
    expect(t('answers', 'current_plan.tiered_standard')).toBe('Tiered Standard')
    expect(t('answers', 'current_plan.save')).toBe('SAVE (legacy / transitioning)')
    expect(t('answers', 'current_plan.repaye')).toBe('REPAYE (legacy plan)')
    expect(t('helpers', 'current_plan')).toMatch(/does not mean you are eligible/)
    expect(t('helpers', 'current_plan')).toMatch(/open for new enrollment/)
    expect(t('answers', 'current_plan.save')).not.toMatch(/enroll|apply now|available to join/i)
    expect(t('questions', 'repayment_plan')).toBe('What repayment plan are you on, if you know it?')
  })

  it('keeps the scorer plan-neutral and scoring_version 1', () => {
    expect(STUDENT_LOAN_SCORING_VERSION).toBe(1)
    const ibr = scoreStudentLoanAssessment(strongDiagnostic({ current_plan: 'ibr' }))
    const rap = scoreStudentLoanAssessment(strongDiagnostic({ current_plan: 'rap' }))
    const paye = scoreStudentLoanAssessment(strongDiagnostic({ current_plan: 'paye' }))
    expect(rap.overallScore).toBe(ibr.overallScore)
    expect(paye.overallScore).toBe(ibr.overallScore)
    expect(rap.scoringVersion).toBe(1)
    expect(source('components/assessment/studentLoan/scoreStudentLoanAssessment.ts')).not.toMatch(
      /eligible for RAP|better plan|worse plan/i,
    )
  })

  it('accepts RAP and legacy SAVE on both client catalog and server validation', () => {
    const answers = validStudentLoanAnswersFixture()
    expect(validateStudentLoanAnswers({
      ...answers,
      diagnostic: { ...answers.diagnostic, current_plan: 'rap' },
    }).ok).toBe(true)
    expect(validateStudentLoanAnswers({
      ...answers,
      diagnostic: { ...answers.diagnostic, current_plan: 'save' },
    }).ok).toBe(true)
    expect(validateStudentLoanAnswers({
      ...answers,
      diagnostic: { ...answers.diagnostic, current_plan: 'graduated' },
    }).ok).toBe(false)
  })

  it('keeps the public score name diagnostic and non-governmental', () => {
    expect(t('results', 'score')).toBe('Student Loan Report Card Score')
    expect(t('results', 'score')).not.toMatch(/health|federal|eligibility|forgiveness score/i)
    expect(t('results', 'disclaimer')).toMatch(/educational/)
    expect(t('results', 'disclaimer')).toMatch(/answers you provided/)
    expect(t('results', 'disclaimer')).toMatch(/not a government determination/)
    expect(t('results', 'disclaimer')).toMatch(/not the U\.S\. Department of Education or a federal loan servicer/)
    expect(t('results', 'disclaimer')).toMatch(/actual loan records and current federal rules/)
    expect(t('results', 'disclaimer')).toMatch(/does not guarantee eligibility, forgiveness, approval, savings, or a particular payment/)
    expect(t('results', 'officialResourceLink')).toBe('StudentAid.gov')
    expect(STUDENTAID_GOV_URL).toBe('https://studentaid.gov')
  })

  it('avoids prohibited guarantee, affiliation, and enrollment language', () => {
    const blob = [
      englishCopyBlob(),
      source('pages/StudentLoanReportCardPage.tsx'),
      source('pages/StudentLoanReportCardResults.tsx'),
      source('pages/StudentLoanAssessment.tsx'),
    ].join('\n')
    expect(blob).not.toMatch(/guaranteed forgiveness|guaranteed eligibility|guaranteed savings|guaranteed payment/i)
    expect(blob).not.toMatch(/Apply for Forgiveness|Enroll Now|Get Approved|Lower My Payment Now/)
    expect(blob).not.toMatch(/Department of Education seal|official federal score|federal student-loan score/i)
    expect(blob).not.toContain('Student Loan Health Score')
    expect(blob).toContain('Review My Results With Valtoris')
  })

  it('keeps privacy boundaries and a bounded servicer-name-only field', () => {
    const fieldIds = STUDENT_LOAN_QUESTIONS.flatMap((question) => question.fields.map((field) => field.id))
    for (const token of FORBIDDEN_STUDENT_LOAN_FIELD_TOKENS) {
      expect(fieldIds.join(' ')).not.toContain(token)
    }
    expect(t('helpers', 'loan_servicer')).toMatch(/Do not enter account numbers, passwords, or FSA login details/)
    expect(t('helpers', 'servicer_name')).toMatch(/Company name only/)
    const session = buildStudentLoanResultsSession(validStudentLoanAnswersFixture())
    expect(Object.keys(session).sort()).toEqual(['diagnostic', 'firstName'])
  })

  it('renders official StudentAid.gov as a non-partner resource on results', () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        {
          initialEntries: [
            {
              pathname: '/student-loan-results',
              state: { answers: buildStudentLoanResultsSession(validStudentLoanAnswersFixture()) },
            },
          ],
        },
        createElement(StudentLoanReportCardResults),
      ),
    )
    expect(html).toContain('href="https://studentaid.gov"')
    expect(html).toContain('Federal Student Aid operates that site; Valtoris does not.')
    expect(html).toContain('Review My Results With Valtoris')
    expect(html).toContain('Student Loan Report Card Score')
    expect(html.indexOf('student-loan-official-resource')).toBeLessThan(html.indexOf('Review My Results With Valtoris'))
  })

  it('renders all 10 English question groups without government branding', () => {
    const landing = renderToStaticMarkup(
      createElement(MemoryRouter, { initialEntries: ['/student-loan-report-card'] }, createElement(StudentLoanReportCardPage)),
    )
    expect(landing).toContain('VALTORIS STUDENT LOAN REPORT CARD')
    expect(landing).toContain('Student Loan Report Card Score')
    expect(landing).not.toContain('CRM storage is not enabled')
    expect(landing).not.toContain('Department of Education seal')

    for (const question of STUDENT_LOAN_QUESTIONS) {
      const values: SpecializedAnswerMap = {}
      if (question.id === 'loan_types') values.loan_types = []
      if (question.id === 'previous_actions') values.previous_actions = []
      const html = renderQuestion(question, values)
      expect(html).toContain(t('questions', question.labelKey))
      expect(html).not.toContain('ed.gov/sites/default/files')
    }
  })

  it('shows Student Loan contact required errors without touching shared inputs', () => {
    const html = renderToStaticMarkup(
      createElement(StepStudentLoanContact, {
        contact: INITIAL_STUDENT_LOAN_CONTACT,
        t,
        showErrors: true,
        onChange: () => undefined,
      }),
    )
    expect(html.match(/This field is required\./g)?.length).toBe(4)
  })

  it('leaves 047–049 byte-identical and does not add Migration 051', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).sort()
    expect(files).toHaveLength(50)
    expect(files[49]).toBe('050_credit_report_card_ingest.sql')
    expect(files.some((name) => name.startsWith('051_'))).toBe(false)
    expect(fileSha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(fileSha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(fileSha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
  })
})
