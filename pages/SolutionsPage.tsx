import { useLocation } from 'react-router-dom'
import { readPublicLocale } from '../components/publicSite/locale'
import SolutionsHub from '../components/publicSite/solutions/SolutionsHub'
import { solutionsCopy } from '../components/publicSite/solutions/copy'
import { useServiceDocumentMeta } from '../components/publicSite/services/useServiceDocumentMeta'

export default function SolutionsPage() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)
  const copy = solutionsCopy[locale]
  useServiceDocumentMeta(copy)

  return <SolutionsHub copy={copy} />
}
