import { homeCopy } from '../home/copy'
import type { PublicLocale } from '../locale'
import SiteHomeSection from '../home/SiteHomeSection'
import PublicLink from '../PublicLink'
import { answerContent, type AnswerPage } from './content'
import { buildAnswerGraph, serializeStructuredData } from './structuredData'

const paths: Record<AnswerPage, string> = { home: '/', reportCards: '/report-cards', education: '/education' }

export default function AnswerSection({ page, locale }: { page: AnswerPage; locale: PublicLocale }) {
  const copy = answerContent[locale][page]
  const names: Record<AnswerPage, string> = {
    home: homeCopy[locale].heroTitle,
    reportCards: locale === 'es' ? 'Elige tu Report Card' : 'Choose Your Report Card',
    education: locale === 'es' ? 'Entiende tus opciones. Decide tu próximo paso.' : 'Understand Your Options. Choose Your Next Step.',
  }
  return (
    <SiteHomeSection id="answers" tone="gray" titleId="answers-heading" title={copy.heading} lead={copy.summary}>
      <div className="site-home-card-grid site-home-card-grid--2">
        {copy.answers.map(({ question, answer }) => (
          <article className="site-home-card" key={question}>
            <h3 className="site-home-card-title">{question}</h3>
            <p className="site-home-card-copy">{answer}</p>
          </article>
        ))}
      </div>
      <p className="site-home-answer-attribution">
        {locale === 'es' ? 'Publicado por Valtoris Financial. Información educativa basada en los recursos y revisiones de este sitio.' : 'Published by Valtoris Financial. Educational information about the resources and reviews on this site.'}{' '}
        <PublicLink to="/#home-founder-heading">{locale === 'es' ? 'Conoce al fundador' : 'Meet the founder'}</PublicLink>
      </p>
      <script type="application/ld+json" data-valtoris-answers={page} dangerouslySetInnerHTML={{ __html: serializeStructuredData(buildAnswerGraph(paths[page], locale, names[page], copy.summary, copy.answers)) }} />
    </SiteHomeSection>
  )
}
