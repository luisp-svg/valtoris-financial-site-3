import { useLocation } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { readPublicLocale } from '../components/publicSite/locale'
import ServicePage from '../components/publicSite/services/ServicePage'
import { creditServiceCopy } from '../components/publicSite/services/copy'

export default function CreditServicePage() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)

  return <ServicePage copy={creditServiceCopy[locale]} diagnosticTo={ROUTES.creditReportCard} />
}
