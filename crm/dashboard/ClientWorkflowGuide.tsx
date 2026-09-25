import { Link } from 'react-router-dom'
import { ROUTES, crmContactNewPath } from '../../constants/routes'

/** Navigation guidance only: all destinations retain their existing permissions. */
export default function ClientWorkflowGuide() {
  return <section className="crm-dashboard-panel crm-dashboard-panel-wide" aria-labelledby="crm-client-workflow-title">
    <div className="crm-panel-head"><h2 id="crm-client-workflow-title">Working with a client? Start here</h2></div>
    <ol className="crm-client-workflow">
      <li><strong>Find the person.</strong> <Link to={ROUTES.crmHouseholds}>Find a client or household</Link>, or <Link to={ROUTES.crmContacts}>look in Contacts</Link>. If they are new, <Link to={crmContactNewPath()}>add a contact</Link>.</li>
      <li><strong>Review what they shared.</strong> <Link to={ROUTES.crmIntake}>Open Incoming Leads</Link> for submitted report cards and connection requests. Read the saved answers and contact permissions before following up.</li>
      <li><strong>Complete the relevant intake.</strong> In their household, open Client intakes. Check saved intakes first to resume a draft. Existing contacts do not need a report card.</li>
      <li><strong>Record the next step.</strong> Add a task with a due date from the client workspace. Create an opportunity when you are tracking a product or service discussion.</li>
    </ol>
    <p className="crm-muted">Contacts holds people and partners you add. Households is the client workspace for reports, intakes, tasks, and documents.</p>
  </section>
}
