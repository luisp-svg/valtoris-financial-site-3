import { useState } from 'react'
import BrandLogo from './BrandLogo'

export default function HeroVisual() {
  const [showCard, setShowCard] = useState(false)

  if (showCard) {
    return (
      <aside className="hero-card" aria-label="Family Financial Report Card">
        <div className="hero-card-accent" aria-hidden="true" />
        <p className="hero-card-kicker">Valtoris</p>
        <h2 className="hero-card-title">Your Family Financial Report Card™</h2>
        <p className="hero-card-subtitle">Your roadmap to becoming Legacy Ready™</p>
      </aside>
    )
  }

  return (
    <BrandLogo
      className="hero-logo"
      onMissing={() => setShowCard(true)}
    />
  )
}
