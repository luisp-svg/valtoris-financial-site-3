import { Navigate, useLocation } from 'react-router-dom'
import { readPublicLocale, withPublicLocale } from '../components/publicSite/locale'

/** Preserve old links while keeping one public solutions and assessment directory. */
export default function ReportCardsPage() {
  const { search, hash } = useLocation()
  return <Navigate replace to={withPublicLocale(`/solutions${hash}`, readPublicLocale(search), search)} />
}
