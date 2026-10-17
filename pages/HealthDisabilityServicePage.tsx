import { useLocation } from 'react-router-dom'
import { readPublicLocale } from '../components/publicSite/locale'
import ServicePage from '../components/publicSite/services/ServicePage'
import { healthServiceCopy } from '../components/publicSite/services/healthCopy'
import type { ServiceLinks } from '../components/publicSite/services/serviceLinks'

const HEALTH_LINKS: ServiceLinks = {
  primaryTo: '/health-insurance-report-card',
  secondaryTo: '/employee-benefits-report-card',
  bridgePrimaryTo: '/health-insurance-report-card',
  bridgeSecondaryTo: '/employee-benefits-report-card',
  finalPrimaryTo: '/health-insurance-report-card',
  finalSecondaryTo: '/employee-benefits-report-card',
}

export default function HealthDisabilityServicePage() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)

  return <ServicePage copy={healthServiceCopy[locale]} links={HEALTH_LINKS} />
}
