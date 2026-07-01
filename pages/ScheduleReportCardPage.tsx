import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'

export default function ScheduleReportCardPage() {
  return (
    <div className="schedule-shell">
      <div className="schedule-container">
        <header className="schedule-header">
          <BrandLogo className="schedule-logo" />
        </header>

        <section className="schedule-card">
          <p className="schedule-kicker">Book Your Review</p>
          <h1>Schedule My Report Card</h1>
          <p className="schedule-lead">
            Choose a time to review your Family Financial Report Card™ with a Valtoris advisor.
          </p>

          <ScheduleReportCardLink className="schedule-primary-btn" />

          <Link className="schedule-back-link" to="/">
            Return Home
          </Link>
        </section>
      </div>
    </div>
  )
}
