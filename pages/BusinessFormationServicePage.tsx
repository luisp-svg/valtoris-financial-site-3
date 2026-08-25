import { useLocation } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { readPublicLocale } from '../components/publicSite/locale'
import ServicePage from '../components/publicSite/services/ServicePage'
import { businessFormationServiceCopy } from '../components/publicSite/services/businessFormationCopy'
import type { ServiceLinks } from '../components/publicSite/services/serviceLinks'

const FORMATION_LINKS: ServiceLinks = {
  primaryTo: ROUTES.schedule,
  secondaryTo: ROUTES.solutions,
  bridgePrimaryTo: ROUTES.businessReportCard,
  bridgeSecondaryTo: ROUTES.schedule,
  finalPrimaryTo: ROUTES.schedule,
  finalSecondaryTo: ROUTES.solutions,
}

export default function BusinessFormationServicePage() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)

  return <ServicePage copy={businessFormationServiceCopy[locale]} links={FORMATION_LINKS} />
}
