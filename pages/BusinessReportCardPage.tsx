import { useNavigate } from 'react-router-dom'
import { BUSINESS_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

export default function BusinessReportCardPage() {
  const navigate = useNavigate()

  function handleStartAssessment() {
    navigate(ROUTES.businessAssessment)
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
        <div className="panel business-report-card-cta-panel">
          <h3 className="business-report-card-cta-title">Business Financial Assessment™</h3>
          <p className="business-report-card-cta-copy">
            A professional diagnostic for business owners — answer focused questions and receive your
            personalized Business Financial Report Card™.
          </p>
          <button
            type="button"
            className="assessment-btn assessment-btn-primary business-report-card-cta-button"
            onClick={handleStartAssessment}
          >
            {BUSINESS_CTA}
          </button>
        </div>
      </div>
    </section>
  )
}
