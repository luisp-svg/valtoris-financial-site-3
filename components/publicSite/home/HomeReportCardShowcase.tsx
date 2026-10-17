import type { PublicLocale } from '../locale'
import { ROUTES } from '../../../constants/routes'
import PublicLink from '../PublicLink'
import type { HomeCopy } from './copy'

type HomeReportCardShowcaseProps = {
  copy: HomeCopy
  locale: PublicLocale
}

export default function HomeReportCardShowcase({ copy, locale }: HomeReportCardShowcaseProps) {
  return (
    <section className="site-home-showcase" aria-labelledby="home-showcase-heading">
      <div className="container site-home-showcase-grid">
        <div className="site-home-showcase-copy">
          <p className="site-home-kicker">{copy.showcaseKicker}</p>
          <h2 id="home-showcase-heading" className="platform-section-title">
            {copy.showcaseHeading}
          </h2>
          <p className="site-home-showcase-lead">{copy.showcaseLead}</p>
          <ul className="site-home-showcase-list">
            <li>{copy.showcaseBenefitOne}</li>
            <li>{copy.showcaseBenefitTwo}</li>
            <li>{copy.showcaseBenefitThree}</li>
          </ul>
          <div className="site-home-hero-actions">
            <PublicLink className="platform-btn platform-btn-primary" to={ROUTES.reportCards}>
              {copy.showcaseCta}
            </PublicLink>
            <PublicLink className="site-home-text-link" to={ROUTES.reportCards}>
              {copy.showcaseSecondaryCta}
            </PublicLink>
          </div>
        </div>
        <aside className="sample-results-preview" aria-label={copy.showcasePreviewLabel}>
          <p className="sample-results-badge">{copy.showcasePreviewBadge}</p>
          <h3>{locale === 'es' ? 'Ejemplo de preparación para una revisión' : 'Example review preparedness'}</h3>
          <div className="sample-results-score-panel">
            <div className="sample-results-score-block">
              <p className="sample-results-score-label">{locale === 'es' ? 'Puntaje ilustrativo' : 'Illustrative score'}</p>
              <p className="sample-results-score-value">80<span>/100</span></p>
            </div>
            <div className="sample-results-grade-block">
              <p className="sample-results-score-label">{locale === 'es' ? 'Calificación' : 'Grade'}</p>
              <p className="sample-results-grade-value">B</p>
            </div>
          </div>
          <ol className="site-home-showcase-list">
            <li><strong>{locale === 'es' ? 'Lo que va bien: ' : 'What is working: '}</strong>{locale === 'es' ? 'Los registros actuales están organizados.' : 'Current records are organized.'}</li>
            <li><strong>{locale === 'es' ? 'Por confirmar: ' : 'What to confirm: '}</strong>{locale === 'es' ? 'Algunos detalles aún necesitan revisión.' : 'Some details still need review.'}</li>
            <li><strong>{locale === 'es' ? 'Próximo paso: ' : 'Next step: '}</strong>{locale === 'es' ? 'Lleve sus preguntas a una conversación de estrategia.' : 'Bring your questions to a strategy conversation.'}</li>
          </ol>
          <p className="sample-results-disclaimer">{copy.showcasePreviewDisclaimer}</p>
        </aside>
      </div>
    </section>
  )
}
