import { guidedReportCardsEnabled } from '../modules/reportCard/guidedRelease'
import HomeAskValtoris from '../components/publicSite/home/HomeAskValtoris'
import AnswerSection from '../components/publicSite/aeo/AnswerSection'
import { useLocation } from 'react-router-dom'
import HomeAudiencePaths from '../components/publicSite/home/HomeAudiencePaths'
import HomeFinalCta from '../components/publicSite/home/HomeFinalCta'
import HomeFounderStory from '../components/publicSite/home/HomeFounderStory'
import HomeHero from '../components/publicSite/home/HomeHero'
import HomeProcess from '../components/publicSite/home/HomeProcess'
import HomeReportCardShowcase from '../components/publicSite/home/HomeReportCardShowcase'
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
      {guidedReportCardsEnabled && <HomeAskValtoris locale={locale} />}
      {!guidedReportCardsEnabled && <HomeAudiencePaths copy={copy} />}
      <HomeProcess copy={copy} />
      <HomeReportCardShowcase copy={copy} locale={locale} />
      <HomeServiceGrid copy={copy} />
      <HomeWhyValtoris copy={copy} />
      <HomeFounderStory copy={copy} />
      <section className="site-home-founder" aria-labelledby="home-liz-heading">
        <div className="container site-home-founder-grid">
          <div className="site-home-founder-image-wrap">
            <img
              className="site-home-founder-image"
              src="/images/advisors/liz.jpg"
              alt={locale === 'es' ? 'Liz, estratega de préstamos estudiantiles y especialista en salud' : 'Liz, Student Loan Strategist and Health Specialist'}
              width="841"
              height="1280"
              loading="lazy"
            />
          </div>
          <div className="site-home-founder-copy">
            <p className="site-home-kicker">{locale === 'es' ? 'Conozca a nuestro equipo' : 'Meet our team'}</p>
            <h2 id="home-liz-heading" className="platform-section-title">
              {locale === 'es' ? 'Conozca a Liz' : 'Meet Liz'}
            </h2>
            <p className="site-home-founder-role">
              {locale === 'es' ? 'Estratega de préstamos estudiantiles y especialista en salud' : 'Student Loan Strategist & Health Specialist'}
            </p>
            <p><strong>{locale === 'es' ? '10 años de experiencia' : '10 years of experience'}</strong></p>
          </div>
        </div>
      </section>
      <AnswerSection page="home" locale={locale} />
      <HomeFinalCta copy={copy} />
    </div>
  )
}
