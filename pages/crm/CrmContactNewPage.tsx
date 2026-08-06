import { Link } from 'react-router-dom'
import QuickAddContactForm from '../../crm/contacts/QuickAddContactForm'
import { ROUTES } from '../../constants/routes'

export default function CrmContactNewPage() {
  return (
    <div className="crm-page">
      <header className="crm-page-header">
        <div>
          <p className="crm-page-eyebrow">
            <Link to={ROUTES.crmContacts}>Contacts</Link>
          </p>
          <h1 className="crm-page-title">Quick Add Contact</h1>
          <p className="crm-page-subtitle">
            Capture a networking contact quickly. Consent stays off unless you explicitly record it.
          </p>
        </div>
      </header>

      <QuickAddContactForm />
    </div>
  )
}
