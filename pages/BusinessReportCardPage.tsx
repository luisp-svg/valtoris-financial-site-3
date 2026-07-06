import { useNavigate } from 'react-router-dom'
import LeadForm from '../components/LeadForm'
import { BUSINESS_REPORT_STORAGE_KEY } from '../components/business/constants'
import { BUSINESS_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

export default function BusinessReportCardPage() {
  const navigate = useNavigate()

  function handleLeadSuccess(payload: Record<string, FormDataEntryValue>) {
    const businessName = typeof payload.name === 'string' ? payload.name.trim() : ''
    const context = { businessName }
    sessionStorage.setItem(BUSINESS_REPORT_STORAGE_KEY, JSON.stringify(context))

    console.log('Navigation to results:', ROUTES.businessReportCardResults)
    navigate(ROUTES.businessReportCardResults, { state: context })
  }

  function handleViewSampleReport() {
    navigate(ROUTES.businessReportCardResults)
  }

  return (
    <section className="section business-report-card-page">
      <div className="container two-col">
        <div className="panel">
          <div className="kicker">Business Financial Report Card™</div>
          <h1 className="business-report-card-headline">
            Your business finally has a financial health report.
          </h1>
          <p className="business-report-card-lead">
            Discover where your business is strong, where it&apos;s exposed, and what to fix first
            to protect revenue, reduce risk, and increase enterprise value.
          </p>
          <ul className="business-report-card-points">
            <li>Business Financial Score with letter grade</li>
            <li>Eight category breakdowns with personalized guidance</li>
            <li>Top 3 Business Priorities and 90-day action plan</li>
          </ul>
          <button type="button" className="business-report-card-sample" onClick={handleViewSampleReport}>
            View Sample Business Report Card™
          </button>
        </div>
        <LeadForm
          source="business-financial-report-card"
          title={BUSINESS_CTA}
          onSuccess={handleLeadSuccess}
        />
      </div>
    </section>
  )
}
