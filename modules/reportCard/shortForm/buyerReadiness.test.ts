import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { scoreBuyerReadiness, isBuyerReadiness } from './buyerReadiness'
import { buildShortResult, readShortResult } from './results'
import BuyerReadinessPanel from '../../../components/reportCard/shortForm/BuyerReadinessPanel'
const strong = { credit_range: '740_plus', credit_issues: ['none'], income: '10000', debt_payment: '500', budget: '2500', purchase_funds: '20000', employment_tenure: '2_plus_years', documents: ['income', 'bank'] }
describe('buyer-readiness educational rubric', () => {
  it('scores known preparation and exposes a point breakdown adding to 100', () => {
    const grade = scoreBuyerReadiness(strong)!
    expect(grade).toMatchObject({ score: 100, grade: 'A', provisional: false })
    expect(grade.categories.reduce((sum, c) => sum + c.max, 0)).toBe(100)
    const result = buildShortResult('home_buyer', strong)
    expect(result).toMatchObject({ overallScore: 100, overallGrade: 'A', buyerReadiness: grade })
    expect(readShortResult(JSON.parse(JSON.stringify(result)))).toEqual(result)
  })
  it('does not give credit for unknown information or persist provisional grades as final', () => {
    const result = buildShortResult('home_buyer', { ...strong, credit_range: 'unknown', purchase_funds: 'unknown' })
    expect(result.buyerReadiness).toMatchObject({ score: 50, grade: 'F', provisional: true })
    expect(result.overallScore).toBeNull()
    expect(result.overallGrade).toBeNull()
    expect(readShortResult(result)).toEqual(result)
    const html = renderToStaticMarkup(createElement(BuyerReadinessPanel, { result: result.buyerReadiness!, locale: 'en' }))
    expect(html).toContain('Provisional')
    expect(html).toContain('Missing information is not evidence of a financial problem')
  })
  it('reduces points for debt pressure, lower funds, shorter employment and reported credit issues', () => {
    expect(scoreBuyerReadiness({ ...strong, debt_payment: '3000', purchase_funds: '1000', employment_tenure: 'under_2_years', documents: ['none'], credit_range: '620_699', credit_issues: ['late', 'collections', 'bankruptcy_foreclosure'] })).toMatchObject({ score: 11, grade: 'F', provisional: false })
    for (const patch of [{ income: '0' }, { budget: '0' }]) {
      expect(scoreBuyerReadiness({ ...strong, ...patch })?.categories.find(c => c.id === 'debt_budget')?.score).toBe(0)
    }
  })
  it('uses the disclosed funds and debt-ratio thresholds at their boundaries', () => {
    const category = (patch: Record<string, string>, id: string) => scoreBuyerReadiness({ ...strong, ...patch })!.categories.find(c => c.id === id)!.score
    for (const [funds, points] of [['15000',20],['7500',15],['2500',8],['2499',4],['0',0]] as const) expect(category({ purchase_funds: funds }, 'purchase_funds')).toBe(points)
    for (const [debt, points] of [['1100',25],['1800',18],['2500',8],['2501',0]] as const) expect(category({ debt_payment: debt }, 'debt_budget')).toBe(points)
  })
  it('does not change the grade based on buying intent, lender relationships or optional documents', () => {
    expect(scoreBuyerReadiness({ ...strong, timing: 'soon', lender: 'yes', occupancy: 'investment', documents: ['income', 'bank', 'tax', 'investment_retirement'] })).toEqual(scoreBuyerReadiness(strong))
    expect(scoreBuyerReadiness({ income_months: '36' })).toBeUndefined()
    expect(buildShortResult('family', strong)).not.toHaveProperty('buyerReadiness')
  })
  it('validates historical and new snapshots without trusting a fabricated grade or total', () => {
    const result = buildShortResult('home_buyer', strong)
    expect(isBuyerReadiness(result.buyerReadiness)).toBe(true)
    expect(readShortResult({ ...result, overallGrade: 'F' })).toBeUndefined()
    expect(readShortResult({ ...result, buyerReadiness: { ...result.buyerReadiness, score: Infinity } })).toBeUndefined()
    expect(readShortResult({ ...result, buyerReadiness: { ...result.buyerReadiness, categories: [] } })).toBeUndefined()
    expect(readShortResult(buildShortResult('home_buyer', { income_months: '12' }))).toBeDefined()
  })
  it('renders bilingual grades and explains the independent payment estimate', () => {
    for (const locale of ['en', 'es'] as const) {
      const html = renderToStaticMarkup(createElement(BuyerReadinessPanel, { result: scoreBuyerReadiness(strong)!, locale }))
      expect(html).toContain('100/100')
      expect(html).toContain(locale === 'en' ? 'Buyer-readiness grade' : 'Calificación de preparación')
      expect(html).toContain(locale === 'en' ? 'separate from your payment range' : 'independiente del rango de pago')
      expect(html).toContain(locale === 'en' ? 'How the grade is calculated' : 'Cómo se calcula la calificación')
    }
  })
})
