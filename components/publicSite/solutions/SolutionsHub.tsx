import { useLocation } from 'react-router-dom'
import { readPublicLocale } from '../locale'
import EditorialVisual from '../../premium/EditorialVisual'
import PublicLink from '../PublicLink'
import { ROUTES } from '../../../constants/routes'
import type { SolutionsCopy } from './copy'
import { specializedFunnels } from '../../../modules/reportCard/funnelStrategy'

export default function SolutionsHub({ copy }: {copy: SolutionsCopy}) {
  const es = readPublicLocale(useLocation().search) === 'es', index = es ? 1 : 0
  return <div className="platform-home site-home site-solutions-hub">
    <section className="site-home-hero site-service-hero site-service-hero--visual" aria-labelledby="solutions-hero-heading">
      <div className="container site-service-hero-grid">
        <div className="site-home-hero-copy">
          <p className="platform-eyebrow">{es?'SOLUCIONES Y REPORT CARDS':'SOLUTIONS & REPORT CARDS'}</p>
          <h1 id="solutions-hero-heading" className="site-home-headline">{es?'Empieza con lo que más importa.':'Start With What Matters Most.'}</h1>
          <p className="site-home-hero-support">{es?'Comienza con un Report Card breve para tu prioridad. Mira resultados preliminares y reserva una consulta sin costo. La revisión integral es opcional después.':'Start with a short Report Card for the problem you want to solve. See preliminary results and book a complimentary consultation. Broader discovery is optional afterward.'}</p>
          <div className="site-home-hero-actions"><PublicLink className="platform-btn platform-btn-primary" to="/financial-assessment?focus=student_loan">{es?'Comenzar con préstamos estudiantiles':'Start With Student Loans'} ↗</PublicLink><PublicLink className="platform-btn platform-btn-secondary" to={ROUTES.schedule}>{copy.heroSecondaryCta}</PublicLink></div>
          <p className="premium-fineprint">{es?'5–10 preguntas por revisión. La revisión familiar o empresarial nunca bloquea la reserva.':'5–10 focused questions per review. Family and Business Owner discovery never blocks booking.'}</p>
        </div>
        <EditorialVisual kind="lifestyle" compact />
      </div>
    </section>
    <section className="container priority-directory" id="solutions-diagnostics" aria-labelledby="priority-directory-heading">
      <h2 id="priority-directory-heading">{es?'¿Qué te gustaría revisar?':'What Would You Like to Review?'}</h2>
      <div className="priority-directory-grid">{specializedFunnels.map(journey=><article key={journey.id}>
        <h3>{journey.title[index]}</h3><p>{es?"Una revisión breve con resultados útiles y consulta sin costo.":"A focused review with useful results and complimentary consultation booking."}</p>
        <div className="priority-directory-actions"><PublicLink className="platform-btn platform-btn-primary" aria-label={`${es ? "Comenzar Report Card" : "Begin Report Card"}: ${journey.title[index]}`} to={`/financial-assessment?focus=${journey.id}`}>{es?'Comenzar este Report Card':'Begin This Report Card'} ↗</PublicLink>
          <PublicLink className="priority-directory-detail" to={journey.path}>{es ? 'Qué incluye la revisión' : 'What the Review Covers'}</PublicLink>
        </div>
      </article>)}</div>
    </section>
    <section className="container premium-funnel-note"><h2>{es?"Después: revisión integral opcional":"Then: Optional Comprehensive Discovery"}</h2><p>{es?"Family Financial Report Card para personas y familias. Business Owner Financial Report Card para dueños de negocios. Tus respuestas se conservan en un registro y no se repiten. Abre estas revisiones desde tus resultados guardados.":"Family Financial Report Card for individuals, families and professionals. Business Owner Financial Report Card for owners and entrepreneurs. Open either from your saved results; prior answers carry forward into one advisor record."}</p><h2>{es?'Una revisión. Una conversación coordinada.':'One Review. A Coordinated Conversation.'}</h2><p>{es?'Los Report Cards organizan tus prioridades; no son solicitudes de productos. Tu consulta permite revisar los hallazgos y conversar sobre el alcance adecuado de cualquier servicio posterior.':'Report Cards organize your priorities; they are not product applications. Your consultation provides time to review the findings and discuss the appropriate scope of any later service.'}</p><p className="premium-fineprint">{copy.disclaimer}</p></section>
  </div>
}
