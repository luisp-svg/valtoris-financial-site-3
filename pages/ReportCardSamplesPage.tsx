import { useLocation } from 'react-router-dom'
import PublicLink from '../components/publicSite/PublicLink'
import { readPublicLocale } from '../components/publicSite/locale'
import ReportResultsOverview from '../components/premium/ReportResultsOverview'
import { specializedFunnels } from '../modules/reportCard/funnelStrategy'
import { mainReportCard } from '../modules/reportCard/combined/cardProfiles'
import { adaptiveReportCard, combinedResults } from '../modules/reportCard/combined/results'
import { sampleReportAnswers } from '../modules/reportCard/combined/samples'
import '../components/premium/premium.css'
import './reportCardSamples.css'

export default function ReportCardSamplesPage() {
  const location = useLocation(), locale = readPublicLocale(location.search), es = locale === 'es'
  const focus = new URLSearchParams(location.search).get('type') ?? 'family'
  const cards = specializedFunnels.filter(card => !card.directOnly && card.id === focus)
  return <main className="container premium-results-inner">
    <p className="premium-kicker">{es ? 'EJEMPLOS DE REPORT CARDS' : 'SAMPLE REPORT CARDS'}</p>
    <h1>{es ? 'Mira lo que recibirás' : 'See what you will receive'}</h1>
    <p className="premium-lead">{es ? 'Ejemplos ficticios con el mismo formato de resultados de nuestras evaluaciones. Tus resultados dependerán de tus respuestas.' : 'Fictional examples using the same results format as our assessments. Your results will depend on your answers.'}</p>
    <p>{es ? 'Son ejemplos educativos, no asesoría personalizada ni aprobación de productos. Ver estos ejemplos no envía información ni crea registros.' : 'These are educational examples, not personalized advice or product approval. Viewing them does not submit information or create records.'}</p>
    <nav className="report-sample-navigation" aria-label={es ? 'Tipos de Report Card' : 'Report card types'}>{specializedFunnels.filter(card => !card.directOnly).map(card => <PublicLink key={card.id} to={`/report-card-samples?type=${card.id}`} aria-current={card.id === focus ? 'page' : undefined} className="premium-secondary">{card.title[es ? 1 : 0]}</PublicLink>)}</nav>
    {!cards.length && <p>{es ? 'Elige un Report Card de la lista.' : 'Choose a report card from the list.'}</p>}
    {cards.map(card => {
      const answers = sampleReportAnswers(card.selected, locale, mainReportCard(card.selected) ? 1 : undefined)
      const reports = combinedResults(answers)
      return <section key={card.id} aria-labelledby={`sample-${card.id}`}>
        <h2 id={`sample-${card.id}`}>{card.title[es ? 1 : 0]}</h2>
        <p>{es ? 'EJEMPLO • Información ficticia' : 'SAMPLE • Fictional information'}</p>
        <ReportResultsOverview card={adaptiveReportCard(answers)} selected={answers.selected} locale={locale} strategyVersion={1} mainCard={Boolean(mainReportCard(answers.selected))} protectionReviews={reports.filter(review => review.kind === 'protection-estimate')} />
        <PublicLink className="platform-btn platform-btn-primary" to={`/financial-assessment?focus=${card.id}`}>{es ? 'Comenzar mi Report Card' : 'Start my report card'}</PublicLink>
      </section>
    })}
  </main>
}
