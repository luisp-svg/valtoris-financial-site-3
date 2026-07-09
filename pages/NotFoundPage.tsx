import { Link } from 'react-router-dom'
import BrandWordmark from '../components/BrandWordmark'
import { ROUTES } from '../constants/routes'

export default function NotFoundPage() {
  return (
    <section className="section not-found-page">
      <div className="container not-found-inner">
        <BrandWordmark variant="assessment" className="not-found-brand" />
        <h1 className="not-found-title">We couldn&apos;t find that page.</h1>
        <p className="not-found-copy">
          The page you&apos;re looking for may have moved or no longer exists.
        </p>
        <div className="not-found-actions">
          <Link className="button" to={ROUTES.home}>
            Return Home
          </Link>
          <Link className="button secondary" to={`${ROUTES.home}#diagnostics`}>
            Explore Diagnostics
          </Link>
        </div>
      </div>
    </section>
  )
}
