import { Link, useLocation } from 'react-router-dom'
import AssessmentBrandHeader from '../components/AssessmentBrandHeader'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import { readSpecializedLocale, resolveSpecializedCopy, withSpecializedLocale } from '../components/assessment/specialized/locale'
import type { SpecializedCopySection } from '../components/assessment/specialized/types'
import { STUDENT_LOAN_ANSWERS_STORAGE_KEY } from '../components/assessment/studentLoan/constants'
import { studentLoanCopy } from '../components/assessment/studentLoan/copy'
import {
  getStudentLoanResultsModel,
  type StudentLoanResultsSession,
} from '../components/assessment/studentLoan/resultsModel'
import type { StudentLoanFlagSeverity } from '../components/assessment/studentLoan/scoreStudentLoanAssessment'
import type { StudentLoanDiagnosticAnswers } from '../components/assessment/studentLoan/types'
import { ROUTES } from '../constants/routes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function readResultsSession(value: unknown): StudentLoanResultsSession | null {
  if (!isRecord(value) || !isRecord(value.diagnostic)) return null
  return {
    diagnostic: value.diagnostic as StudentLoanDiagnosticAnswers,
    firstName: typeof value.firstName === 'string' ? value.firstName : '',
  }
}

function loadResultsSession(state: unknown): StudentLoanResultsSession | null {
  if (isRecord(state) && isRecord(state.answers)) {
    return readResultsSession(state.answers)
  }
  try {
    const stored = sessionStorage.getItem(STUDENT_LOAN_ANSWERS_STORAGE_KEY)
    if (!stored) return null
    return readResultsSession(JSON.parse(stored))
  } catch {
    // Direct visits have no answers; the shell stays unavailable.
  }
  return null
}

function flagCardClass(severity: StudentLoanFlagSeverity): string {
  if (severity === 'immediate_review') return 'priority-card priority-card-critical'
  if (severity === 'high_priority') return 'priority-card priority-card-important'
  return 'priority-card priority-card-longterm'
}

function flagBadgeClass(severity: StudentLoanFlagSeverity): string {
  if (severity === 'immediate_review') return 'priority-badge priority-badge-critical'
  if (severity === 'high_priority') return 'priority-badge priority-badge-important'
  return 'priority-badge priority-badge-longterm'
}

export default function StudentLoanReportCardResults() {
  const location = useLocation()
  const locale = readSpecializedLocale(location.search)
  const session = loadResultsSession(location.state)
  const results = getStudentLoanResultsModel(session)
  const firstName = session?.firstName.trim() ?? ''

  function t(section: SpecializedCopySection, key: string): string {
    return resolveSpecializedCopy(studentLoanCopy, locale, section, key)
  }

  if (!results.available || results.overallScore === null || !results.grade) {
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
            <p className="question-card-description" data-testid="student-loan-results-unavailable">
              {t('results', 'unavailable')}
            </p>
            <p className="assessment-note">{t('ui', 'resultsLead')}</p>
            <div className="welcome-actions">
              <Link
                className="platform-btn platform-btn-primary"
                to={withSpecializedLocale(ROUTES.studentLoanAssessment, locale)}
              >
                {t('ui', 'retake')}
              </Link>
              <Link
                className="platform-btn platform-btn-outline"
                to={withSpecializedLocale(ROUTES.studentLoanReportCard, locale)}
              >
                {t('ui', 'backToLanding')}
              </Link>
            </div>
          </section>
        </div>
      </div>
    )
  }

  const statusText = results.statusLabelKey ? t('results', results.statusLabelKey) : ''

  return (
    <div className="results-shell">
      <div className="results-container">
        <header className="results-header">
          <AssessmentBrandHeader />
          {firstName ? (
            <p className="results-prepared-for">
              {t('ui', 'preparedFor')} {firstName}
            </p>
          ) : null}
        </header>

        {results.criticalFlags.length > 0 ? (
          <section className="results-priorities" aria-labelledby="student-loan-flags-title">
            <h2 className="results-section-title" id="student-loan-flags-title">
              {t('results', 'flags')}
            </h2>
            <div className="results-priorities-list">
              {results.criticalFlags.map((flag) => (
                <article key={flag.id} className={flagCardClass(flag.severity)} data-flag-id={flag.id}>
                  <span className={flagBadgeClass(flag.severity)}>{t('results', flag.labelKey)}</span>
                  <h3 className="priority-title">{t('results', `review.${flag.id}.title`)}</h3>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="results-hero" aria-labelledby="student-loan-score-title">
          <p className="results-kicker">Student Loan Report Card™</p>
          <h1 className="results-title" id="student-loan-score-title">
            {t('results', 'score')}
          </h1>
          <div className="results-grade-card">
            <div className="results-grade-block">
              <span className="results-grade-label">{t('results', 'score')}</span>
              <span className="results-grade-value" data-testid="student-loan-overall-score">
                {results.overallScore}
              </span>
            </div>
            <div className="results-grade-divider" aria-hidden="true" />
            <div className="results-grade-block">
              <span className="results-grade-label">{t('results', 'grade')}</span>
              <span className="results-level-value" data-testid="student-loan-grade">
                {results.grade} — {statusText}
              </span>
            </div>
          </div>
          <div className="results-progress-section">
            <div className="results-progress-header">
              <span>{t('results', 'status')}</span>
              <strong>{statusText}</strong>
            </div>
            <div className="results-progress-track">
              <div className="results-progress-fill" style={{ width: `${results.overallScore}%` }} />
            </div>
          </div>
        </section>

        <section className="results-panel" aria-labelledby="student-loan-categories-title">
          <h2 id="student-loan-categories-title">{t('results', 'categories')}</h2>
          <ul>
            {results.categoryScores.map((category) => (
              <li key={category.id} data-category-id={category.id}>
                {t('results', category.labelKey)}: {category.score}/{category.max}
              </li>
            ))}
          </ul>
        </section>

        <section className="results-priorities" aria-labelledby="student-loan-review-title">
          <h2 className="results-section-title" id="student-loan-review-title">
            {t('results', 'topAreas')}
          </h2>
          <div className="results-priorities-list">
            {results.topReviewAreas.map((area) => (
              <article key={area.id} className={flagCardClass(area.severity)} data-review-id={area.id}>
                <span className={flagBadgeClass(area.severity)}>{t('results', area.titleKey)}</span>
                <p className="priority-detail-text">{t('results', area.explanationKey)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="results-panel">
          <h2>{t('results', 'primaryGoal')}</h2>
          <p data-testid="student-loan-primary-goal">
            {results.primaryGoal ? t('answers', `primary_goal.${results.primaryGoal}`) : ''}
          </p>
          {results.informationalBalance ? (
            <p>
              {t('ui', 'informationalBalance')}: {t('answers', `total_balance.${results.informationalBalance}`)}
            </p>
          ) : null}
          {results.servicerDisplay ? (
            <p>
              {t('ui', 'servicer')}: {results.servicerDisplay}
            </p>
          ) : null}
          {results.urgency ? (
            <p>
              {t('ui', 'urgency')}: {t('answers', `urgency.${results.urgency}`)}
            </p>
          ) : null}
        </section>

        <p className="family-results-disclaimer">{t('results', 'disclaimer')}</p>

        <section className="results-cta">
          <h2 className="results-cta-headline">{t('results', 'reviewWithValtoris')}</h2>
          <p className="results-cta-support">{t('ui', 'nextStepSupport')}</p>
          <ScheduleReportCardLink className="platform-btn platform-btn-secondary">
            {t('results', 'reviewWithValtoris')}
          </ScheduleReportCardLink>
          <Link
            className="results-back-link"
            to={withSpecializedLocale(ROUTES.studentLoanAssessment, locale)}
          >
            {t('ui', 'retakeCta')}
          </Link>
        </section>
      </div>
    </div>
  )
}
