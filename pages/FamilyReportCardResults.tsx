import { useLocation, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import ReportDashboard from '../components/reportDashboard/ReportDashboard'
import { SAMPLE_GREETING } from '../components/reportCard/reportCardData'
import { DEMO_ANSWERS_STORAGE_KEY } from '../components/assessment/constants'
import { DemoAssessmentAnswers, INITIAL_DEMO_ANSWERS } from '../components/assessment/types'
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
  const firstName = answers.family.firstName.trim()
  const greeting = firstName ? `Prepared for ${firstName}` : SAMPLE_GREETING

  return (
    <div className="results-shell report-dashboard-shell">
      <div className="results-container report-dashboard-container">
        <header className="results-header report-dashboard-header">
          <BrandLogo className="results-logo" />
        </header>

        <ReportDashboard firstName={firstName} greeting={greeting} />

        <section className="rd-cta">
          <h2 className="rd-cta-title">
            Schedule Your Complimentary Family Financial Strategy Session™
          </h2>
          <ScheduleReportCardLink className="rd-cta-button">
            Schedule My Strategy Session™
          </ScheduleReportCardLink>
          <button
            type="button"
            className="results-back-link"
            onClick={() => navigate(ROUTES.reportCard)}
          >
            Retake Assessment
          </button>
        </section>
      </div>
    </div>
  )
}
