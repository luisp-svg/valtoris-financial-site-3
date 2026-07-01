import LeadForm from '../components/LeadForm'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import { CALENDLY_REPORT_CARD_BUTTON_LABEL } from '../constants/urls'

export default function CheckupPage() {
  return (
    <section className="section">
      <div className="container two-col">
        <div className="panel">
          <div className="kicker">Family Financial Report Card™</div>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.6rem)' }}>
            Schedule your complimentary Family Financial Report Card™ review.
          </h1>
          <p>
            Receive a complete evaluation of your family's protection, retirement, debt strategy,
            estate planning, tax efficiency, and long-term financial goals.
          </p>
          <ScheduleReportCardLink className="button checkup-schedule-link" />
        </div>
        <LeadForm
          source="family-financial-report-card"
          title={CALENDLY_REPORT_CARD_BUTTON_LABEL}
        />
      </div>
    </section>
  )
}
