import type { PublicLocale } from '../locale'
import type { Answer } from './content'

export const PUBLIC_ORIGIN = 'https://www.valtorisfinancial.com'
export const PUBLISHER_ID = `${PUBLIC_ORIGIN}/#organization`

export function publicPageUrl(path: string, locale: PublicLocale): string {
  return `${PUBLIC_ORIGIN}${path}${locale === 'es' ? '?lang=es' : ''}`
}

export function buildAnswerGraph(path: string, locale: PublicLocale, title: string, summary: string, answers: readonly Answer[]) {
  const url = publicPageUrl(path, locale)
  const pageId = `${url}#webpage`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': path === '/' ? 'WebPage' : 'CollectionPage',
        '@id': pageId,
        url,
        name: title,
        description: summary,
        inLanguage: locale,
        publisher: { '@id': PUBLISHER_ID },
        isPartOf: { '@id': `${PUBLIC_ORIGIN}/#website` },
        hasPart: { '@id': `${url}#answers` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#answers`,
        inLanguage: locale,
        isPartOf: { '@id': pageId },
        publisher: { '@id': PUBLISHER_ID },
        mainEntity: answers.map(({ question, answer }) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
    ],
  }
}

/** Keep embedded JSON data from terminating its containing script element. */
export function serializeStructuredData(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}
