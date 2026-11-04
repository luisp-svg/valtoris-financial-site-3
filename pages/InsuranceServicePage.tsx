import { useLocation } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { readPublicLocale } from '../components/publicSite/locale'
import PublicLink from '../components/publicSite/PublicLink'
import { FUNNEL_PATHS, funnelContent } from '../components/publicSite/aeo/funnelContent'
import ServicePage from '../components/publicSite/services/ServicePage'
import { insuranceServiceCopy } from '../components/publicSite/services/insuranceCopy'
import type { ServiceLinks } from '../components/publicSite/services/serviceLinks'

const INSURANCE_LINKS: ServiceLinks = {
  primaryTo: '/personal-insurance-report-card',
  secondaryTo: ROUTES.solutions,
  bridgePrimaryTo: '/personal-insurance-report-card',
  bridgeSecondaryTo: ROUTES.solutions,
  finalPrimaryTo: '/personal-insurance-report-card',
  finalSecondaryTo: ROUTES.solutions,
}

export default function InsuranceServicePage() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)

  return <><ServicePage copy={insuranceServiceCopy[locale]} links={INSURANCE_LINKS} /><section className="container premium-review-focus"><h2>{locale==='es'?'Elige tu revisión de seguros':'Choose Your Insurance Review'}</h2>{(['lifestyle','commercial','trucking']as const).map(type=><article key={type}><h3><PublicLink to={FUNNEL_PATHS[type]}>{funnelContent[type][locale].title}</PublicLink></h3><p>{funnelContent[type][locale].summary}</p></article>)}</section></>
}
