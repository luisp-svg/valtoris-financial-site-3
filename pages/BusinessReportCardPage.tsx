import LeadForm from '../components/LeadForm'

export default function BusinessReportCardPage() {
  return (
    <section className="section">
      <div className="container two-col">
        <div className="panel">
          <div className="kicker">Business Financial Report Card™</div>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.6rem)' }}>Protection planning built for business-minded households.</h1>
          <p>Discover where your business stands today and get a personalized roadmap toward stronger financial protection.</p>
        </div>
        <LeadForm source="business-financial-report-card" title="Request your business report card" />
      </div>
    </section>
  )
}
