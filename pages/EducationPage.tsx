import AnswerSection from '../components/publicSite/aeo/AnswerSection'
import { useLocation } from 'react-router-dom'
import PublicLink from '../components/publicSite/PublicLink'
import { readPublicLocale } from '../components/publicSite/locale'
import { useHomeDocumentMeta } from '../components/publicSite/home/useHomeDocumentMeta'
import HomeServiceGrid from '../components/publicSite/home/HomeServiceGrid'
import { homeCopy } from '../components/publicSite/home/copy'
import { ROUTES } from '../constants/routes'

export default function EducationPage() {
  const locale = readPublicLocale(useLocation().search), es = locale === 'es'
  useHomeDocumentMeta({metaTitle: es ? 'Educación financiera | Valtoris Financial' : 'Financial Education | Valtoris Financial', metaDescription: es ? 'Explora protección, crédito, jubilación y legado con recursos educativos de Valtoris.' : 'Explore protection, credit, retirement, business, and legacy through existing Valtoris educational resources.'})
  return <div className="platform-home site-home"><section className="container" style={{paddingBlock:'3rem'}}><p className="platform-eyebrow">{es ? 'Aprende con Valtoris' : 'Learn with Valtoris'}</p><h1>{es ? 'Entiende tus opciones. Decide tu próximo paso.' : 'Understand Your Options. Choose Your Next Step.'}</h1><p>{es ? 'Explora nuestras guías por objetivo y encuentra el área que quieres entender mejor.' : 'Explore our guides by goal and find the area you want to understand better.'}</p><PublicLink className="platform-btn platform-btn-primary" to={ROUTES.reportCards}>{es ? 'Encuentra tu Report Card' : 'Find your Report Card'}</PublicLink></section><HomeServiceGrid copy={homeCopy[locale]} /><AnswerSection page="education" locale={locale} /></div>
}
