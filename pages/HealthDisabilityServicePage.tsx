import { useLocation } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { readPublicLocale } from '../components/publicSite/locale'
import ServicePage from '../components/publicSite/services/ServicePage'
import { healthServiceCopy } from '../components/publicSite/services/healthCopy'
import type { ServiceLinks } from '../components/publicSite/services/serviceLinks'

const HEALTH_LINKS: ServiceLinks = {
  primaryTo: ROUTES.schedule,
  secondaryTo: ROUTES.solutions,
  bridgePrimaryTo: ROUTES.schedule,
  bridgeSecondaryTo: ROUTES.solutions,
  finalPrimaryTo: ROUTES.schedule,
  finalSecondaryTo: ROUTES.solutions,
}

export default function HealthDisabilityServicePage() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)

  return <ServicePage copy={healthServiceCopy[locale]} links={HEALTH_LINKS} />
}
