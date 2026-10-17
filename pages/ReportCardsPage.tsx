import { guidedReportCardsEnabled } from '../modules/reportCard/guidedRelease'
import { SPECIALTY_CARDS } from '../modules/reportCard/specialtyPreview/catalog'
import AnswerSection from '../components/publicSite/aeo/AnswerSection'
import { useLocation } from 'react-router-dom'
import HomeDiagnostics from '../components/publicSite/home/HomeDiagnostics'
import SiteHomeSection from '../components/publicSite/home/SiteHomeSection'
import PublicLink from '../components/publicSite/PublicLink'
import { homeCopy } from '../components/publicSite/home/copy'
import { useHomeDocumentMeta } from '../components/publicSite/home/useHomeDocumentMeta'
import { readPublicLocale } from '../components/publicSite/locale'
import { ROUTES } from '../constants/routes'

export default function ReportCardsPage() {
  const locale = readPublicLocale(useLocation().search), es = locale === 'es'
  const title = es ? 'Elige tu Report Card' : 'Choose Your Report Card'
  useHomeDocumentMeta({metaTitle: `${title} | Valtoris Financial`, metaDescription: es ? 'Comienza con una revisión educativa de tu familia, negocio, crédito y más.' : 'Start with a free educational review for your family, business, retirement, credit, student loans, or homebuying goals.'})
  return <div className="platform-home site-home"><section className="container" style={{paddingBlock:'3rem'}}><p className="platform-eyebrow">Valtoris Financial</p><h1>{title}</h1><p>{es ? 'Elige el área que quieres entender primero. Las revisiones breves ofrecen observaciones y próximos pasos; la revisión de vivienda incluye una calificación de preparación. No garantizan aprobación ni resultados.' : 'Choose the area you want to understand first. Short reviews provide observations and next steps; the homebuyer review includes a readiness grade. They do not guarantee approval or outcomes.'}</p></section><HomeDiagnostics copy={homeCopy[locale]} />{guidedReportCardsEnabled && <section className="container" style={{paddingBlock:'2rem'}}><h2>{import.meta.env.DEV ? (es?'Report Cards nuevos y ajustes · borradores':'New Report Cards and refinements · drafts') : (es?'Salud, TSP, beneficios e impuestos':'Health, TSP, benefits and taxes')}</h2><div className="home-ask-cards">{Object.entries(SPECIALTY_CARDS).filter(([key])=>import.meta.env.DEV || ['health','tsp','benefits','tax'].includes(key)).map(([,card])=><PublicLink key={card.path} to={card.path}>{card.title[locale]}</PublicLink>)}</div></section>}<SiteHomeSection tone="white" titleId="buyer-review" title={es ? '¿Planeas comprar una vivienda?' : 'Planning to buy a home?'}><PublicLink className="platform-btn platform-btn-primary" to={ROUTES.homeBuyerReportCard}>{es ? 'Reporte para compradores de vivienda' : 'Homebuyer Report Card'}</PublicLink></SiteHomeSection><AnswerSection page="reportCards" locale={locale} /></div>
}
