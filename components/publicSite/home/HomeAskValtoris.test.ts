import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import HomeAskValtoris from './HomeAskValtoris'
import { SPECIALTY_CARDS } from '../../../modules/reportCard/specialtyPreview/catalog'
import { describe,expect,it } from 'vitest'
import { ASK_TOPICS,matchAskTopics } from './HomeAskValtoris'
import { ROUTES } from '../../../constants/routes'
describe('Ask Valtoris resource routing',()=>{
 it('links every card to an existing route',()=>{for(const topic of ASK_TOPICS) expect([...Object.values(ROUTES),...Object.values(SPECIALTY_CARDS).map(card=>card.path)]).toContain(topic.path)})
 it('recognizes English and Spanish topics',()=>{expect(matchAskTopics('student loans')[0].id).toBe('student');expect(matchAskTopics('mi jubilación')[0].id).toBe('retirement')})
 it('leaves unrelated questions for the fallback',()=>{expect(matchAskTopics('what is the weather?')).toEqual([])})
 it('routes the four new topics to existing resources',()=>{expect(matchAskTopics('health insurance')[0].path).toBe('/health-insurance-report-card');expect(matchAskTopics('TSP')[0].id).toBe('tsp');expect(matchAskTopics('employee benefits')[0].id).toBe('benefits');expect(matchAskTopics('lower taxes')[0].path).toBe('/tax-review-report-card')})
 it('limits multi-topic responses',()=>{expect(matchAskTopics('family business retirement credit student home').length).toBe(3)})
})

it('keeps Spanish and referral parameters valid on every homepage tile',()=>{
 const html=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:['/?lang=es&utm_source=release&card=advisor']},createElement(HomeAskValtoris,{locale:'es'})))
 for(const topic of ASK_TOPICS)expect(html).toContain(`href="${topic.path}?lang=es&amp;utm_source=release&amp;card=advisor"`)
 expect(html).not.toContain('?lang=es?')
})
