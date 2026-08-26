import { useLocation } from 'react-router-dom'
import HomeAudiencePaths from '../components/publicSite/home/HomeAudiencePaths'
import HomeDiagnostics from '../components/publicSite/home/HomeDiagnostics'
import HomeFinalCta from '../components/publicSite/home/HomeFinalCta'
import HomeHero from '../components/publicSite/home/HomeHero'
import HomeProcess from '../components/publicSite/home/HomeProcess'
import HomeServiceGrid from '../components/publicSite/home/HomeServiceGrid'
import HomeWhyValtoris from '../components/publicSite/home/HomeWhyValtoris'
import { homeCopy } from '../components/publicSite/home/copy'
import { useHomeDocumentMeta } from '../components/publicSite/home/useHomeDocumentMeta'
import { readPublicLocale } from '../components/publicSite/locale'

export default function HomePage() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)
  const copy = homeCopy[locale]
  useHomeDocumentMeta(copy)

  return (
    <div className="platform-home site-home">
      <HomeHero copy={copy} />
      <HomeAudiencePaths copy={copy} />
      <HomeProcess copy={copy} />
      <HomeDiagnostics copy={copy} />
      <HomeServiceGrid copy={copy} />
      <HomeWhyValtoris copy={copy} />
      <HomeFinalCta copy={copy} />
    </div>
  )
}
