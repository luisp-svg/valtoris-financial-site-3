import { useLocation } from 'react-router-dom'
import PublicLink from '../PublicLink'
import { ROUTES } from '../../../constants/routes'
import type { HomeCopy } from './copy'
import SiteHomeSection from './SiteHomeSection'
import { readPublicLocale } from '../locale'

export default function HomeServiceGrid({ copy }: { copy: HomeCopy }) {
  const es = readPublicLocale(useLocation().search) === 'es'
  const groups = [
    { title: es ? 'Proteger' : 'Protect', body: es ? 'Revisa la protección de tu familia, ingresos y negocio.' : 'Review protection for your family, income, and business.', links: [[ROUTES.protectionAnalysis, es ? 'Revisión de protección' : 'Protection review'], [ROUTES.insurance, es ? 'Seguros' : 'Insurance'], [ROUTES.healthDisability, es ? 'Salud e ingresos' : 'Health & income protection']] },
    { title: es ? 'Fortalecer' : 'Strengthen', body: es ? 'Identifica prioridades de crédito y préstamos estudiantiles.' : 'Identify priorities in your credit and student loan picture.', links: [[ROUTES.credit, es ? 'Crédito' : 'Credit'], [ROUTES.studentLoans, es ? 'Préstamos estudiantiles' : 'Student loans']] },
    { title: es ? 'Construir' : 'Build', body: es ? 'Explora tus metas de jubilación, vivienda y negocio.' : 'Explore retirement, homeownership, and business goals.', links: [[ROUTES.retirementReportCard, es ? 'Jubilación' : 'Retirement readiness'], [ROUTES.homeBuyerReportCard, es ? 'Compra de vivienda' : 'Homebuyer readiness'], [ROUTES.businessFormation, es ? 'Formación de negocios' : 'Business formation']] },
    { title: es ? 'Preservar' : 'Preserve', body: es ? 'Coordina tu legado y planificación fiscal con profesionales.' : 'Coordinate legacy and tax planning with qualified professionals.', links: [[ROUTES.estateLegacy, es ? 'Legado' : 'Estate & legacy'], [ROUTES.taxStrategy, es ? 'Estrategia fiscal' : 'Tax strategy']] },
  ]
  return <SiteHomeSection tone="white" titleId="home-services-heading" title={copy.servicesHeading} lead={copy.servicesLead}>
    <div className="site-home-card-grid site-home-card-grid--4">{groups.map(group => <article key={group.title} className="site-home-card site-home-card--service">
      <h3 className="site-home-card-title">{group.title}</h3><p className="site-home-card-copy">{group.body}</p>
      <ul>{group.links.map(([to, label]) => <li key={to}><PublicLink className="site-home-card-link" to={to}>{label}</PublicLink></li>)}</ul>
    </article>)}</div>
  </SiteHomeSection>
}
