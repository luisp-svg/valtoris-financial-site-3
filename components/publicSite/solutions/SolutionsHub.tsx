import { useLocation } from 'react-router-dom'
import { readPublicLocale } from '../locale'
import EditorialVisual from '../../premium/EditorialVisual'
import PublicLink from '../PublicLink'
import { ROUTES } from '../../../constants/routes'
import type { SolutionsCopy } from './copy'
import { mainReportCards, supportingReportCards } from '../../../modules/reportCard/funnelStrategy'

export default function SolutionsHub({ copy }: {copy: SolutionsCopy}) {
  const es = readPublicLocale(useLocation().search) === 'es', index = es ? 1 : 0
  const sections = [
    { id: 'solutions-diagnostics', title: es ? 'Report Cards principales' : 'Main Report Cards', cards: mainReportCards },
    { id: 'supporting-report-cards', title: es ? 'Report Cards complementarios' : 'Supporting Report Cards', cards: supportingReportCards },
  ]
  return <div className="platform-home site-home site-solutions-hub">
    <section className="site-home-hero site-service-hero site-service-hero--visual" aria-labelledby="solutions-hero-heading">
      <div className="container site-service-hero-grid">
        <div className="site-home-hero-copy">
          <p className="platform-eyebrow">{es?'SOLUCIONES Y REPORT CARDS':'SOLUTIONS & REPORT CARDS'}</p>
          <h1 id="solutions-hero-heading" className="site-home-headline">{es?'Empieza con lo que más importa.':'Start With What Matters Most.'}</h1>
          <p className="site-home-hero-support">{es?'Comienza con un Report Card Familiar o Empresarial para ver una calificación general y un desglose por área. Usa un Report Card complementario para profundizar en un tema.':'Start with a Family or Business Owner Report Card for an overall grade and a breakdown by area. Use a supporting card when you want a closer look at one topic.'}</p>
          <div className="site-home-hero-actions"><PublicLink className="platform-btn platform-btn-primary" to="/family-assessment">{es?'Comenzar el Report Card familiar':'Start the Family Report Card'} ↗</PublicLink><PublicLink className="platform-btn platform-btn-secondary" to={ROUTES.businessAssessment}>{es ? "Comenzar el Report Card empresarial" : "Start the Business Owner Report Card"}</PublicLink></div>
          <p className="premium-fineprint">{es?'Cada Report Card tiene sus propias preguntas y resultados.':'Each Report Card has its own questions and results.'}</p>
        </div>
        <EditorialVisual kind="lifestyle" compact />
      </div>
    </section>
    {sections.map(section => <section key={section.id} className="container priority-directory" id={section.id} aria-labelledby={`${section.id}-heading`}>
      <h2 id={`${section.id}-heading`}>{section.title}</h2>
      <div className="priority-directory-grid">{section.cards.map(journey=><article key={journey.id}>
        <h3>{journey.title[index]}</h3><p>{es?"Una revisión breve con resultados útiles y consulta sin costo.":"A dedicated assessment with preliminary results and complimentary consultation booking."}</p>
        <div className="priority-directory-actions"><PublicLink className="platform-btn platform-btn-primary" aria-label={`${es ? "Comenzar Report Card" : "Begin Report Card"}: ${journey.title[index]}`} to={`/financial-assessment?focus=${journey.id}`}>{es?'Comenzar este Report Card':'Begin This Report Card'} ↗</PublicLink>
          <PublicLink className="priority-directory-detail" to={journey.path}>{es ? 'Qué incluye la revisión' : 'What the Review Covers'}</PublicLink>
        </div>
      </article>)}</div>
    </section>)}
    <section className="container premium-funnel-note"><h2>{es?'Una revisión. Una conversación coordinada.':'One Review. A Coordinated Conversation.'}</h2><p>{es?'Los Report Cards organizan tus prioridades; no son solicitudes de productos. Tu consulta permite revisar los hallazgos y conversar sobre el alcance adecuado de cualquier servicio posterior.':'Report Cards organize your priorities; they are not product applications. Your consultation provides time to review the findings and discuss the appropriate scope of any later service.'}</p><p className="premium-fineprint">{copy.disclaimer}</p></section>
  </div>
}
