import { useLocation } from 'react-router-dom'
import { readPublicLocale } from '../locale'
import EditorialVisual from '../../premium/EditorialVisual'
import PublicLink from '../PublicLink'
import { ROUTES } from '../../../constants/routes'
import type { SolutionsCopy } from './copy'
import { priorityJourneys } from './priorityJourneys'

const serviceNames: Record<string, [string, string]> = {
  '/business-owners': ['Business Owner Protection', 'Protección para dueños de negocios'],
  '/estate-legacy': ['Estate & Legacy Services', 'Servicios de patrimonio y legado'],
  '/business-formation': ['Business Setup Services', 'Servicios de constitución de negocio'],
  '/employee-benefits-report-card': ['Employer Benefits Services', 'Servicios de beneficios para empleadores'],
  '/health-disability': ['Health & Benefits Services', 'Servicios de salud y beneficios'],
  '/student-loans': ['Student Loan Services', 'Servicios de préstamos estudiantiles'],
  '/credit': ['Credit Services', 'Servicios de crédito'],
  '/insurance': ['Property & Lifestyle Insurance', 'Seguros de propiedad y estilo de vida'],
  '/tax-strategy': ['Tax Coordination Services', 'Servicios de coordinación fiscal'],
}

export default function SolutionsHub({ copy }: {copy: SolutionsCopy}) {
  const es = readPublicLocale(useLocation().search) === 'es', index = es ? 1 : 0
  return <div className="platform-home site-home site-solutions-hub">
    <section className="site-home-hero site-service-hero site-service-hero--visual" aria-labelledby="solutions-hero-heading">
      <div className="container site-service-hero-grid">
        <div className="site-home-hero-copy">
          <p className="platform-eyebrow">{es?'SOLUCIONES Y REPORT CARDS':'SOLUTIONS & REPORT CARDS'}</p>
          <h1 id="solutions-hero-heading" className="site-home-headline">{es?'Empieza con lo que más importa.':'Start With What Matters Most.'}</h1>
          <p className="site-home-hero-support">{es?'Elige un área abajo para comenzar su Report Card o conocer los servicios relacionados. Si varias áreas te importan, combínalas en una sola evaluación.':'Choose an area below to begin its Report Card or learn about the related services. If several areas matter to you, combine them in one assessment.'}</p>
          <div className="site-home-hero-actions"><PublicLink className="platform-btn platform-btn-primary" to="/financial-assessment">{es?'Combinar varias prioridades':'Combine Several Priorities'} ↗</PublicLink><PublicLink className="platform-btn platform-btn-secondary" to={ROUTES.schedule}>{copy.heroSecondaryCta}</PublicLink></div>
          <p className="premium-fineprint">{es?'Completa la evaluación y reserva tu consulta para desbloquear los resultados preliminares. La información adicional se completa durante la consulta.':'Complete your assessment and book your consultation to unlock preliminary results. Supporting intake stays within your consultation.'}</p>
        </div>
        <EditorialVisual kind="lifestyle" compact />
      </div>
    </section>
    <section className="container priority-directory" id="solutions-diagnostics" aria-labelledby="priority-directory-heading">
      <h2 id="priority-directory-heading">{es?'¿Qué te gustaría revisar?':'What Would You Like to Review?'}</h2>
      <div className="priority-directory-grid">{priorityJourneys.map(journey=><article key={journey.id}>
        <h3>{journey.title[index]}</h3><p>{journey.body[index]}</p>
        <div className="priority-directory-actions"><PublicLink className="platform-btn platform-btn-primary" aria-label={`${es ? "Comenzar Report Card" : "Begin Report Card"}: ${journey.title[index]}`} to={`/financial-assessment?priorities=${journey.id}`}>{es?'Comenzar este Report Card':'Begin This Report Card'} ↗</PublicLink>
          <PublicLink className="priority-directory-detail" to={journey.service ?? journey.report}>{journey.service ? serviceNames[journey.service][index] : es ? 'Qué incluye la revisión' : 'What the Review Covers'}</PublicLink>
        </div>
      </article>)}</div>
    </section>
    <section className="container premium-funnel-note"><h2>{es?'Una revisión. Una conversación coordinada.':'One Review. A Coordinated Conversation.'}</h2><p>{es?'Los Report Cards organizan tus prioridades; no son solicitudes de productos. Tu consulta permite revisar los hallazgos y conversar sobre el alcance adecuado de cualquier servicio posterior.':'Report Cards organize your priorities; they are not product applications. Your consultation provides time to review the findings and discuss the appropriate scope of any later service.'}</p><p className="premium-fineprint">{copy.disclaimer}</p></section>
  </div>
}
