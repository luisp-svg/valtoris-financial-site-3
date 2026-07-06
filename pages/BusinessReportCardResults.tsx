import { useLocation, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import ReportDashboard from '../components/reportDashboard/ReportDashboard'
import {
  BUSINESS_SAMPLE_GREETING,
  getBusinessReportDashboardData,
} from '../components/reportCard/businessReportCardData'
import {
  BUSINESS_REPORT_STORAGE_KEY,
  BusinessReportContext,
  INITIAL_BUSINESS_REPORT_CONTEXT,
} from '../components/business/constants'
import { SCHEDULE_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

function loadBusinessContext(state: unknown): BusinessReportContext {
  if (state && typeof state === 'object' && 'businessName' in state) {
    const businessName = (state as { businessName?: unknown }).businessName
    if (typeof businessName === 'string') {
      return { businessName }
    }
  }

  try {
    const stored = sessionStorage.getItem(BUSINESS_REPORT_STORAGE_KEY)
    if (stored) return JSON.parse(stored) as BusinessReportContext
  } catch {
    // Demo fallback when opened directly.
  }

  return INITIAL_BUSINESS_REPORT_CONTEXT
}

export default function BusinessReportCardResults() {
  const location = useLocation()
  const navigate = useNavigate()
  const { businessName } = loadBusinessContext(location.state)
  const trimmedName = businessName.trim()
  const greeting = trimmedName ? `Prepared for ${trimmedName}` : BUSINESS_SAMPLE_GREETING

  return (
    <div className="results-shell report-dashboard-shell">
      <div className="results-container report-dashboard-container">
        <header className="results-header report-dashboard-header">
          <BrandLogo className="results-logo" />
        </header>

        <ReportDashboard data={getBusinessReportDashboardData(trimmedName, greeting)} />

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
            onClick={() => navigate(ROUTES.businessReportCard)}
          >
            Back to Business Report Card
          </button>
        </section>
      </div>
    </div>
  )
}
