import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import AnswerSection from './AnswerSection'
import { answerContent, type AnswerPage } from './content'
import { serializeStructuredData } from './structuredData'

const pages: AnswerPage[] = ['home', 'reportCards', 'education']

describe('visible answer content and structured data', () => {
  for (const locale of ['en', 'es'] as const) {
    for (const page of pages) {
      it(`keeps ${locale} ${page} schema answers identical to visible answers`, () => {
        const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [`/?lang=${locale}&utm_source=test`] }, createElement(AnswerSection, { page, locale })))
        const json = html.match(/<script[^>]*data-valtoris-answers[^>]*>([\s\S]*?)<\/script>/)?.[1]
        expect(json).toBeTruthy()
        const graph = JSON.parse(json!)['@graph']
        const faq = graph.find((node: Record<string, unknown>) => node['@type'] === 'FAQPage')
        const copy = answerContent[locale][page]
        expect(faq.inLanguage).toBe(locale)
        expect(faq.mainEntity).toHaveLength(copy.answers.length)
        copy.answers.forEach(({question, answer}, index) => {
          expect(html).toContain(renderToStaticMarkup(createElement('h3', {className: 'site-home-card-title'}, question)))
          expect(html).toContain(renderToStaticMarkup(createElement('p', {className: 'site-home-card-copy'}, answer)))
          expect(faq.mainEntity[index]).toMatchObject({name: question, acceptedAnswer: {text: answer}})
        })
        expect(faq['@id']).not.toContain('utm_')
        expect(faq['@id'].includes('?lang=es')).toBe(locale === 'es')
        expect(html).toContain('Valtoris Financial')
        expect(html).not.toContain('reviewedBy')
        expect(html).not.toContain('datePublished')
      })
    }
  }

  it('escapes embedded script delimiters while preserving the JSON value', () => {
    const value = {text: '</script><script>alert(1)</script> & \u2028\u2029'}
    const serialized = serializeStructuredData(value)
    expect(serialized).not.toContain('<')
    expect(serialized).not.toContain('&')
    expect(JSON.parse(serialized)).toEqual(value)
  })

  it('declares only the known publisher and website in the static document', () => {
    const html = readFileSync('index.html', 'utf8')
    const json = html.match(/<script[^>]*id="valtoris-publisher-data"[^>]*>([\s\S]*?)<\/script>/)?.[1]
    const graph = JSON.parse(json!)['@graph']
    const publisher = graph.find((node: Record<string, unknown>) => node['@type'] === 'Organization')
    expect(publisher.name).toBe('Valtoris Financial')
    expect(publisher.url).toBe('https://www.valtorisfinancial.com/')
    expect(publisher).not.toHaveProperty('aggregateRating')
    expect(publisher).not.toHaveProperty('address')
    expect(graph.find((node: Record<string, unknown>) => node['@type'] === 'WebSite').publisher['@id']).toBe(publisher['@id'])
  })
})
