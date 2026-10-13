import PublicLink from './PublicLink'
import { REVIEW_TOPICS } from './reportCardTopics'
import type { ReviewAudience } from './reportCardTopics'
import './reportCardTopics.css'

export default function ReportCardTopicChooser({ audience, locale }: { audience: ReviewAudience; locale: string }) {
  const language = locale === 'es' ? 1 : 0
  return <section id="review-topics" className="platform-section review-topics" aria-labelledby="review-topics-heading">
    <div className="container">
      <p className="platform-kicker">{language ? 'TU PUNTO DE PARTIDA' : 'YOUR STARTING POINT'}</p>
      <h2 id="review-topics-heading" className="platform-section-title">{language ? '¿Qué te gustaría revisar?' : 'What would you like to review?'}</h2>
      <p className="platform-section-lead">{language ? 'Empieza con el panorama general o elige un tema. Cada opción abre una evaluación específica, una solicitud de cotización o una página de servicios. Puedes volver para explorar otro tema.' : 'Start with the big picture or choose a topic. Each option opens a focused assessment, quote request, or service review. You can return here to explore another topic.'}</p>
      <div className="review-topic-grid">{REVIEW_TOPICS[audience].map(topic => <article key={topic.id} className="platform-card review-topic-card">
        <h3>{topic.title[language]}</h3><p>{topic.description[language]}</p>
        <PublicLink className="platform-btn platform-btn-outline" to={topic.to}>{topic.action[language]}<span aria-hidden="true"> →</span></PublicLink>
      </article>)}</div>
      <p className="review-topic-note">{language ? 'Los temas que no completes no reciben una puntuación. Las evaluaciones son educativas; las solicitudes de cotización no activan cobertura.' : 'Topics you do not complete are not scored. Assessments are educational; quote requests do not bind coverage.'}</p>
    </div>
  </section>
}
