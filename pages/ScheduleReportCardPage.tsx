import { Link } from 'react-router-dom'
import AssessmentBrandHeader from '../components/AssessmentBrandHeader'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import { SCHEDULE_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

export default function ScheduleReportCardPage() {
  return (
    <div className="schedule-shell">
      <div className="schedule-container">
        <header className="schedule-header">
          <AssessmentBrandHeader />
        </header>

        <section className="schedule-card">
          <p className="schedule-kicker">Book Your Review</p>
          <h1>{SCHEDULE_CTA}</h1>
          <p className="schedule-lead">
            Choose a time to review your Family Financial Report Card™ with a Valtoris advisor.
          </p>

          <ScheduleReportCardLink className="platform-btn platform-btn-primary" />

          <Link className="schedule-back-link" to={ROUTES.home}>
            Return Home
          </Link>
        </section>
      </div>
    </div>
  )
}
