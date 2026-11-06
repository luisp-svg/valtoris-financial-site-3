import { useLocation } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { readPublicLocale } from '../components/publicSite/locale'
import PublicLink from '../components/publicSite/PublicLink'
import ServicePage from '../components/publicSite/services/ServicePage'
import { insuranceServiceCopy } from '../components/publicSite/services/insuranceCopy'
import type { ServiceLinks } from '../components/publicSite/services/serviceLinks'

const INSURANCE_LINKS: ServiceLinks = {
  primaryTo: ROUTES.reportCard,
  secondaryTo: ROUTES.solutions,
  bridgePrimaryTo: ROUTES.reportCard,
  bridgeSecondaryTo: ROUTES.solutions,
  finalPrimaryTo: ROUTES.reportCard,
  finalSecondaryTo: ROUTES.solutions,
}

export default function InsuranceServicePage() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)

  return <>
    <ServicePage copy={insuranceServiceCopy[locale]} links={INSURANCE_LINKS} />
    <section className="container premium-review-focus">
      <h2>{locale === 'es' ? 'Report Cards de seguros' : 'Insurance Report Cards'}</h2>
      <ul>
        <li><PublicLink to={ROUTES.reportCard}>{locale === 'es' ? 'Seguro de hogar y auto en el Report Card Familiar' : 'Home and auto insurance in the Family Report Card'}</PublicLink></li>
        <li><PublicLink to={ROUTES.businessReportCard}>{locale === 'es' ? 'Seguro comercial en el Report Card Empresarial' : 'Commercial insurance in the Business Owner Report Card'}</PublicLink></li>
      </ul>
    </section>
  </>
}
