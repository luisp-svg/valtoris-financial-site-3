import { useLocation } from 'react-router-dom'
import AmazeHealthOffer from '../components/publicSite/services/AmazeHealthOffer'
import { readPublicLocale } from '../components/publicSite/locale'
import ServicePage from '../components/publicSite/services/ServicePage'
import { healthServiceCopy } from '../components/publicSite/services/healthCopy'
import type { ServiceLinks } from '../components/publicSite/services/serviceLinks'

const HEALTH_LINKS: ServiceLinks = {
  primaryTo: '/health-insurance-report-card',
  secondaryTo: '/business-report-card',
  bridgePrimaryTo: '/health-insurance-report-card',
  bridgeSecondaryTo: '/business-report-card',
  finalPrimaryTo: '/health-insurance-report-card',
  finalSecondaryTo: '/business-report-card',
}

export default function HealthDisabilityServicePage() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)

  return <><ServicePage copy={healthServiceCopy[locale]} links={HEALTH_LINKS} /><AmazeHealthOffer /></>
}
