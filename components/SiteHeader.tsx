import { useState } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'

export default function SiteHeader() {
  const [showTextLogo, setShowTextLogo] = useState(false)

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo-link">
          {!showTextLogo && (
            <BrandLogo className="logo-image" onMissing={() => setShowTextLogo(true)} />
          )}
          {showTextLogo && <span className="logo-text">Valtoris Financial</span>}
        </Link>
        <nav className="nav" aria-label="Primary">
          <Link to="/">Home</Link>
          <Link to="/checkup">Family Financial Report Card™</Link>
          <Link to="/protectioncalc">Protection Calculator™</Link>
          <Link to="/business">Business Financial Report Card™</Link>
        </nav>
      </div>
    </header>
  )
}
