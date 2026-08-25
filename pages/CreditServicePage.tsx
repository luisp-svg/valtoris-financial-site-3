import { useLocation } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { readPublicLocale } from '../components/publicSite/locale'
import ServicePage from '../components/publicSite/services/ServicePage'
import { creditServiceCopy } from '../components/publicSite/services/copy'
import { reportCardServiceLinks } from '../components/publicSite/services/serviceLinks'

export default function CreditServicePage() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)

  return <ServicePage copy={creditServiceCopy[locale]} links={reportCardServiceLinks(ROUTES.creditReportCard)} />
}
