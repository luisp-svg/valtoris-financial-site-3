import { Link } from 'react-router-dom'
import { ROUTES } from '../constants/routes'

export default function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <strong>Valtoris Financial</strong>
          <p className="notice">
            Faith, family, and finances aligned through practical protection planning.
          </p>
        </div>
        <div className="footer-meta">
          <nav className="footer-nav" aria-label="Legal">
            <Link to={ROUTES.privacy}>Privacy Policy</Link>
          </nav>
          <p className="notice">
            For educational purposes only. Coverage and solutions depend on underwriting, carrier
            availability, and state rules.
          </p>
        </div>
      </div>
    </footer>
  )
}
