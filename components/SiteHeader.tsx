import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import BrandLogo from './BrandLogo'

export default function SiteHeader() {
  const [showTextLogo, setShowTextLogo] = useState(false)

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to={ROUTES.home} className="logo-link">
          {!showTextLogo && (
            <BrandLogo className="logo-image" onMissing={() => setShowTextLogo(true)} />
          )}
          {showTextLogo && <span className="logo-text">Valtoris Financial</span>}
        </Link>
        <nav className="nav" aria-label="Primary">
          <Link to={ROUTES.home}>Home</Link>
          <Link to={ROUTES.reportCard}>Family Report Card™</Link>
          <Link to={ROUTES.protectionGap}>Protection Analysis™</Link>
          <Link to={ROUTES.businessReportCard}>Business Report Card™</Link>
        </nav>
      </div>
    </header>
  )
}
