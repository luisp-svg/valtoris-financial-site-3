import { Link, useLocation, useNavigate } from 'react-router-dom'
import AssessmentBrandHeader from '../components/AssessmentBrandHeader'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import ReportDashboard from '../components/reportDashboard/ReportDashboard'
import { getFamilyReportDashboardData, SAMPLE_GREETING } from '../components/reportCard/reportCardData'
import { DEMO_ANSWERS_STORAGE_KEY } from '../components/assessment/constants'
import { DemoAssessmentAnswers, INITIAL_DEMO_ANSWERS } from '../components/assessment/types'
import { PROTECTION_CTA, RETAKE_ASSESSMENT_CTA, SCHEDULE_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

function loadAnswers(state: unknown): DemoAssessmentAnswers {
  if (state && typeof state === 'object' && 'answers' in state) {
    return (state as { answers: DemoAssessmentAnswers }).answers
  }

  try {
    const stored = sessionStorage.getItem(DEMO_ANSWERS_STORAGE_KEY)
    if (stored) return JSON.parse(stored) as DemoAssessmentAnswers
  } catch {
    // Demo fallback when opened directly.
  }

  return INITIAL_DEMO_ANSWERS
}

export default function FamilyReportCardResults() {
  const location = useLocation()
  const navigate = useNavigate()
  const answers = loadAnswers(location.state)
  const submissionWarning =
    location.state &&
    typeof location.state === 'object' &&
    'submissionWarning' in location.state
      ? String((location.state as { submissionWarning?: string }).submissionWarning ?? '')
      : ''
  const firstName = answers.family.firstName.trim()
  const greeting = firstName ? `Prepared for ${firstName}` : SAMPLE_GREETING

  return (
    <div className="results-shell report-dashboard-shell">
      <div className="results-container report-dashboard-container">
        <header className="results-header report-dashboard-header">
          <AssessmentBrandHeader />
        </header>

        <p className="family-results-diagnostic-label">
          Family Financial Report Card™ · Initial Financial Diagnostic
        </p>
        <p className="family-results-disclaimer">
          These results are educational estimates based on self-reported information. They are not
          financial, legal, tax, investment, credit, or insurance advice, and they are not a
          guarantee. An advisor review may reach different conclusions.
        </p>

        {submissionWarning ? (
          <p className="submission-notice" role="status">
            {submissionWarning}
          </p>
        ) : null}

        <ReportDashboard data={getFamilyReportDashboardData(firstName, greeting, answers)} />

        <section className="rd-cta">
          <h2 className="rd-cta-title">{SCHEDULE_CTA}</h2>
          <p className="rd-cta-copy">
            Review your Family Financial Report Card™ with a Valtoris strategist and receive a
            customized action plan for protecting and growing your family&apos;s wealth.
          </p>
          <ScheduleReportCardLink className="platform-btn platform-btn-secondary">{SCHEDULE_CTA}</ScheduleReportCardLink>
          <Link className="results-back-link" to={ROUTES.protectionAnalysis}>
            {PROTECTION_CTA}
          </Link>
          <button
            type="button"
            className="results-back-link"
            onClick={() => navigate(ROUTES.familyAssessment)}
          >
            {RETAKE_ASSESSMENT_CTA}
          </button>
        </section>
      </div>
    </div>
  )
}
