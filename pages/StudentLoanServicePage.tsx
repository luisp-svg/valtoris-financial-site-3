import { useLocation } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { readPublicLocale } from '../components/publicSite/locale'
import ServicePage from '../components/publicSite/services/ServicePage'
import { studentLoanServiceCopy } from '../components/publicSite/services/copy'
import { reportCardServiceLinks } from '../components/publicSite/services/serviceLinks'

export default function StudentLoanServicePage() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)

  return (
    <ServicePage copy={studentLoanServiceCopy[locale]} links={reportCardServiceLinks(ROUTES.studentLoanReportCard)} />
  )
}
