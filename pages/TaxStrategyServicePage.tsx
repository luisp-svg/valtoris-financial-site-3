import { useLocation } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { readPublicLocale } from '../components/publicSite/locale'
import ServicePage from '../components/publicSite/services/ServicePage'
import { taxStrategyServiceCopy } from '../components/publicSite/services/taxCopy'
import type { ServiceLinks } from '../components/publicSite/services/serviceLinks'

const TAX_LINKS: ServiceLinks = {
  primaryTo: ROUTES.schedule,
  secondaryTo: ROUTES.solutions,
  bridgePrimaryTo: ROUTES.businessReportCard,
  bridgeSecondaryTo: ROUTES.reportCard,
  finalPrimaryTo: ROUTES.schedule,
  finalSecondaryTo: ROUTES.solutions,
}

export default function TaxStrategyServicePage() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)

  return <ServicePage copy={taxStrategyServiceCopy[locale]} links={TAX_LINKS} />
}
