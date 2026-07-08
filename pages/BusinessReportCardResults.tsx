import { useLocation, useNavigate } from 'react-router-dom'
import AssessmentBrandHeader from '../components/AssessmentBrandHeader'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import ReportDashboard from '../components/reportDashboard/ReportDashboard'
import {
  BUSINESS_SAMPLE_GREETING,
  DEMO_BUSINESS_ANSWERS,
  getBusinessReportDashboardData,
} from '../components/reportCard/businessReportCardData'
import { BUSINESS_ANSWERS_STORAGE_KEY } from '../components/business/constants'
import { BusinessAssessmentAnswers } from '../components/assessment/business/types'
import { RETAKE_ASSESSMENT_CTA, SCHEDULE_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

function loadAnswers(state: unknown): BusinessAssessmentAnswers | undefined {
  if (state && typeof state === 'object' && 'answers' in state) {
    return (state as { answers: BusinessAssessmentAnswers }).answers
  }

  try {
    const stored = sessionStorage.getItem(BUSINESS_ANSWERS_STORAGE_KEY)
    if (stored) return JSON.parse(stored) as BusinessAssessmentAnswers
  } catch {
    // Demo fallback when opened directly.
  }

  return undefined
}

export default function BusinessReportCardResults() {
  const location = useLocation()
  const navigate = useNavigate()
  const answers = loadAnswers(location.state)
  const businessName = answers?.business.name.trim() ?? ''
  const greeting = businessName ? `Prepared for ${businessName}` : BUSINESS_SAMPLE_GREETING

  return (
    <div className="results-shell report-dashboard-shell">
      <div className="results-container report-dashboard-container">
        <header className="results-header report-dashboard-header">
          <AssessmentBrandHeader />
        </header>

        <ReportDashboard
          data={getBusinessReportDashboardData(businessName, greeting, answers ?? DEMO_BUSINESS_ANSWERS)}
        />

        <section className="rd-cta">
          <h2 className="rd-cta-title">{SCHEDULE_CTA}</h2>
          <p className="rd-cta-copy">
            Review your Business Financial Report Card™ with a Valtoris strategist and receive a
            customized action plan for protecting and growing your business.
          </p>
          <ScheduleReportCardLink className="rd-cta-button">{SCHEDULE_CTA}</ScheduleReportCardLink>
          <button
            type="button"
            className="results-back-link"
            onClick={() => navigate(ROUTES.businessAssessment)}
          >
            {RETAKE_ASSESSMENT_CTA}
          </button>
        </section>
      </div>
    </div>
  )
}
