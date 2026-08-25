import { useLocation } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { readPublicLocale } from '../components/publicSite/locale'
import ServicePage from '../components/publicSite/services/ServicePage'
import { estateServiceCopy } from '../components/publicSite/services/estateCopy'
import type { ServiceLinks } from '../components/publicSite/services/serviceLinks'

const ESTATE_LINKS: ServiceLinks = {
  primaryTo: ROUTES.schedule,
  secondaryTo: ROUTES.solutions,
  bridgePrimaryTo: ROUTES.reportCard,
  bridgeSecondaryTo: ROUTES.protectionAnalysis,
  finalPrimaryTo: ROUTES.schedule,
  finalSecondaryTo: ROUTES.solutions,
}

export default function EstateLegacyServicePage() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)

  return <ServicePage copy={estateServiceCopy[locale]} links={ESTATE_LINKS} />
}
