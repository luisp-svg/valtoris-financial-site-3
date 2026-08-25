import { useLocation } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { readPublicLocale } from '../components/publicSite/locale'
import ServicePage from '../components/publicSite/services/ServicePage'
import { insuranceServiceCopy } from '../components/publicSite/services/insuranceCopy'
import type { ServiceLinks } from '../components/publicSite/services/serviceLinks'

const INSURANCE_LINKS: ServiceLinks = {
  primaryTo: ROUTES.protectionAnalysis,
  secondaryTo: ROUTES.schedule,
  bridgePrimaryTo: ROUTES.protectionAnalysis,
  bridgeSecondaryTo: ROUTES.schedule,
  finalPrimaryTo: ROUTES.protectionAnalysis,
  finalSecondaryTo: ROUTES.schedule,
}

export default function InsuranceServicePage() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)

  return <ServicePage copy={insuranceServiceCopy[locale]} links={INSURANCE_LINKS} />
}
