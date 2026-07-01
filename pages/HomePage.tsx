import { Link } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import HeroVisual from '../components/HeroVisual'
import LeadForm from '../components/LeadForm'

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="kicker">Helping Families Become Legacy Ready™</div>
            <h1>Every Family Deserves a Financial Report Card™</h1>
            <p>
              Discover where your family stands today with a complimentary Family Financial Report Card™.
              In just a few minutes, we'll evaluate your family's financial foundation, identify strengths
              and opportunities, and provide a personalized roadmap toward becoming Legacy Ready™.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
              <Link className="button" to={ROUTES.reportCard}>Get My Family Financial Report Card™</Link>
              <Link className="button secondary" to={ROUTES.reportCardResults}>See a Sample Family Financial Report Card™</Link>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      <section className="section">
        <div className="container card-grid">
          <article className="card"><h3>Insurance Planning</h3><p>Life, living benefits, health, and property coverage designed around real household risk.</p></article>
          <article className="card"><h3>Wealth Support</h3><p>Annuity education and strategy conversations for clients seeking protection and predictable income.</p></article>
          <article className="card"><h3>Financial Reset</h3><p>Credit repair and student loan guidance that can improve financial flexibility before major decisions.</p></article>
        </div>
      </section>

      <section className="section">
        <div className="container two-col">
          <div className="panel">
            <h2>Lead capture stack</h2>
            <p>This development version includes editable API routes, webhook forwarding, and Google Sheets integration placeholders so the site can be run locally and redeployed to Vercel.</p>
          </div>
          <LeadForm source="homepage" />
        </div>
      </section>
    </>
  )
}
