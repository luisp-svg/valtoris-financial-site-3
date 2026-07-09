import { Link } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import BrandWordmark from './BrandWordmark'

export default function SiteHeader() {
  return (
    <header className="header">
      <div className="container header-inner">
        <Link to={ROUTES.home} className="logo-link">
          <BrandWordmark variant="header" />
        </Link>
        <nav className="nav" aria-label="Primary">
          <Link to={ROUTES.home}>Home</Link>
          <Link to={ROUTES.solutions}>Solutions</Link>
          <Link to={ROUTES.reportCard}>Family Report Card™</Link>
          <Link to={ROUTES.businessReportCard}>Business Report Card™</Link>
          <Link to={ROUTES.protectionAnalysis}>Protection Analysis™</Link>
        </nav>
      </div>
    </header>
  )
}
