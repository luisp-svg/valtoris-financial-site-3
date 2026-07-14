import LeadForm from '../components/LeadForm'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import { FAMILY_CTA } from '../constants/homepage'

export default function CheckupPage() {
  return (
    <section className="section">
      <div className="container two-col">
        <div className="panel">
          <div className="kicker">Family Financial Report Card™</div>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.6rem)' }}>
            Book your Family Financial Report Card™ strategy session.
          </h1>
          <p>
            Receive a complete evaluation of your family's protection, retirement, debt strategy,
            estate planning, tax efficiency, and long-term financial goals.
          </p>
          <ScheduleReportCardLink className="platform-btn platform-btn-primary checkup-schedule-link" />
        </div>
        <LeadForm source="family-financial-report-card" title={FAMILY_CTA} />
      </div>
    </section>
  )
}
