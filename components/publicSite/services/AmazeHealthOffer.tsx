import { useLocation } from 'react-router-dom'
import { readPublicLocale } from '../locale'
import PublicLink from '../PublicLink'
import { ROUTES } from '../../../constants/routes'
import { AMAZE_ENROLLMENT_URL } from './amazeHealth'

export default function AmazeHealthOffer() {
  const es = readPublicLocale(useLocation().search) === 'es'
  return <section className="premium-invitation" aria-labelledby="amaze-offer-heading">
    <div className="container">
      <p className="premium-kicker">Amaze Health · {es ? '$99/mes' : '$99/month'}</p>
      <h2 id="amaze-offer-heading">{es ? 'Un equipo de atención médica al alcance de su familia.' : 'A healthcare team within reach of your family.'}</h2>
      <p className="premium-lead">{es ? 'Atención virtual 24/7, copagos de $0 por consultas virtuales de Amaze y Rx Valet incluido. Es una membresía de atención médica, no un seguro.' : '24/7 virtual care, $0 Amaze virtual visit copays, and Rx Valet included. A healthcare membership, not health insurance.'}</p>
      <div className="site-home-hero-actions">
        <PublicLink className="platform-btn platform-btn-primary" to={ROUTES.amazeHealth}>{es ? 'Conocer Amaze Health' : 'Explore Amaze Health'}</PublicLink>
        <a className="platform-btn platform-btn-outline" href={AMAZE_ENROLLMENT_URL}>{es ? 'Inscribirme con Amaze' : 'Enroll with Amaze'}</a>
      </div>
    </div>
  </section>
}
