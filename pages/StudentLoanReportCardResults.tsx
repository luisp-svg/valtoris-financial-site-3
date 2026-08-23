import { Link, useLocation } from 'react-router-dom'
import AssessmentBrandHeader from '../components/AssessmentBrandHeader'
import { readSpecializedLocale, resolveSpecializedCopy, withSpecializedLocale } from '../components/assessment/specialized/locale'
import type { SpecializedCopySection } from '../components/assessment/specialized/types'
import { STUDENT_LOAN_ANSWERS_STORAGE_KEY } from '../components/assessment/studentLoan/constants'
import { studentLoanCopy } from '../components/assessment/studentLoan/copy'
import { getStudentLoanResultsModel } from '../components/assessment/studentLoan/resultsModel'
import type { StudentLoanAssessmentAnswers } from '../components/assessment/studentLoan/types'
import { ROUTES } from '../constants/routes'

function loadAnswers(state: unknown): StudentLoanAssessmentAnswers | null {
  if (state && typeof state === 'object' && 'answers' in state) {
    return (state as { answers: StudentLoanAssessmentAnswers }).answers
  }
  try {
    const stored = sessionStorage.getItem(STUDENT_LOAN_ANSWERS_STORAGE_KEY)
    if (stored) return JSON.parse(stored) as StudentLoanAssessmentAnswers
  } catch {
    // Direct visits have no answers; the shell stays unavailable either way.
  }
  return null
}

export default function StudentLoanReportCardResults() {
  const location = useLocation()
  const locale = readSpecializedLocale(location.search)
  const answers = loadAnswers(location.state)
  const results = getStudentLoanResultsModel()
  const firstName = answers?.contact.firstName.trim() ?? ''

  function t(section: SpecializedCopySection, key: string): string {
    return resolveSpecializedCopy(studentLoanCopy, locale, section, key)
  }

  return (
    <div className="results-shell">
      <div className="results-container">
        <header className="results-header">
          <AssessmentBrandHeader />
        </header>

        <section className="question-card" aria-labelledby="student-loan-results-title">
          <h1 className="question-card-title" id="student-loan-results-title">
            Student Loan Report Card™
          </h1>
          {firstName ? <p className="question-card-description">Thanks, {firstName}.</p> : null}
          <p className="question-card-description" data-testid="student-loan-results-unavailable">
            {t('results', 'unavailable')}
          </p>
          <p className="assessment-note">{t('ui', 'resultsLead')}</p>
          {results.available || results.score !== null || results.grade !== null ? (
            <p>Unexpected scored result.</p>
          ) : null}
          <div className="welcome-actions">
            <Link
              className="platform-btn platform-btn-primary"
              to={withSpecializedLocale(ROUTES.studentLoanReportCard, locale)}
            >
              {t('ui', 'backToLanding')}
            </Link>
            <Link
              className="platform-btn platform-btn-outline"
              to={withSpecializedLocale(ROUTES.studentLoanAssessment, locale)}
            >
              {t('ui', 'retake')}
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
