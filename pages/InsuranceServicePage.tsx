import { useLocation } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { readPublicLocale } from '../components/publicSite/locale'
import PublicLink from '../components/publicSite/PublicLink'
import ServicePage from '../components/publicSite/services/ServicePage'
import { insuranceServiceCopy } from '../components/publicSite/services/insuranceCopy'
import type { ServiceLinks } from '../components/publicSite/services/serviceLinks'

const INSURANCE_LINKS: ServiceLinks = {
  primaryTo: ROUTES.getQuote,
  secondaryTo: ROUTES.solutions,
  bridgePrimaryTo: ROUTES.getQuote,
  bridgeSecondaryTo: ROUTES.solutions,
  finalPrimaryTo: ROUTES.getQuote,
  finalSecondaryTo: ROUTES.solutions,
}

export default function InsuranceServicePage() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)

  return <>
    <ServicePage copy={insuranceServiceCopy[locale]} links={INSURANCE_LINKS} />
    <section className="container premium-review-focus">
      <h2>{locale === 'es' ? 'Solicita una cotización de seguro' : 'Request an Insurance Quote'}</h2>
      <ul>
        <li><PublicLink to={ROUTES.personalInsurance}>{locale === 'es' ? 'Cotizaciones de hogar y auto' : 'Home and auto insurance quotes'}</PublicLink></li>
        <li><PublicLink to={ROUTES.commercialInsurance}>{locale === 'es' ? 'Cotización de seguro comercial' : 'Commercial insurance quote'}</PublicLink></li>
      </ul>
    </section>
  </>
}
