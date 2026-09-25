import { MemoryRouter } from 'react-router-dom'
import HomeBuyerReportCardResults from '../../../pages/HomeBuyerReportCardResults'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { initialV2Answers, HOME_BUYER_V2_QUESTIONS, V2_FIELDS, pruneV2Answers, validateV2Answers } from './v2Questions'
import { projectV2Diagnostic } from './v2Projection'
import { calculateAffordability, DEFAULT_AFFORDABILITY_ASSUMPTIONS, monthlyIncome, readAffordabilitySnapshot } from './affordability'
import { scoreHomeBuyerAssessment } from './scoreHomeBuyerAssessment'
import { homeBuyerCopy } from './copy'
import { buildHomeBuyerResultsSession, getHomeBuyerResultsModel } from './resultsModel'
import AffordabilityPanel from './AffordabilityPanel'
import type { SpecializedAnswerMap } from '../specialized/types'
import { validateHomeBuyerAnswers } from '../../../server/ingest/familyReportCard/validateHomeBuyerAnswers'
import { validateFamilyReportCardIngestRequest } from '../../../server/ingest/familyReportCard/validation'
import { validHomeBuyerIngestRequestBodyFixture, validHomeBuyerAnswersFixture } from '../../../server/ingest/familyReportCard/testFixtures'
import { ingestPublicReportCard } from '../../../server/ingest/familyReportCard/ingestFamilyReportCard'
import PublicFamilyDiagnosticDetailView from '../../../crm/households/assessments/PublicFamilyDiagnosticDetailView'
import { extractHomeBuyerSubmittedAnswers, mapPublicFamilyDiagnosticDetail } from '../../../crm/households/assessments/diagnosticFormatters'

function fixture(overrides: SpecializedAnswerMap = {}): SpecializedAnswerMap {
  const v = initialV2Answers()
  for (const f of V2_FIELDS) {
    if (f.input === 'single') v[f.id] = f.options[0].value
    if (f.input === 'multi') v[f.id] = [f.options[0].value]
    if (f.input === 'short_text' && f.numeric) v[f.id] = '0'
  }
  return pruneV2Answers({ ...v, primary_sources: ['w2'], primary_period: 'monthly', primary_w2: '8000',
    industry_years: '5_plus', applicants: 'self', intended_occupancy: 'primary', current_housing: 'renting',
    debt_auto: '400', debt_student: '200', debt_cards: '100', current_housing_payment: '1800',
    liquid_savings: '35000', retirement: '100000', available_funds: '30000', protected_reserves: '5000',
    target_price: '400000', credit_risk_flags: ['none'], has_agent: 'no', ...overrides })
}
const answers = (v = fixture()) => ({ ...validHomeBuyerAnswersFixture(), diagnostic: projectV2Diagnostic(v) })

describe('V2 contracts and compatibility', () => {
  it('accepts complete V2 evidence and all labels exist in English and Spanish', () => {
    expect(HOME_BUYER_V2_QUESTIONS).toHaveLength(10)
    expect(validateV2Answers(fixture())).toBe(true)
    expect(validateHomeBuyerAnswers(answers()).ok).toBe(true)
    for (const locale of ['en', 'es'] as const) for (const q of HOME_BUYER_V2_QUESTIONS) {
      expect(homeBuyerCopy[locale]?.questions[q.labelKey]).toBeTruthy()
      for (const f of q.fields) {
        expect(homeBuyerCopy[locale]?.fields[f.labelKey]).toBeTruthy()
        if (f.input !== 'short_text') for (const o of f.options) expect(homeBuyerCopy[locale]?.answers[o.labelKey]).toBeTruthy()
      }
    }
  })
  it('accepts V1 and V2 only with their matching wire versions', () => {
    expect(validateFamilyReportCardIngestRequest(validHomeBuyerIngestRequestBodyFixture()).ok).toBe(true)
    for (const version of [0, 1, 2.5, 3]) expect(validateFamilyReportCardIngestRequest(validHomeBuyerIngestRequestBodyFixture({ assessmentVersion: version, answers: answers() })).ok).toBe(false)
    expect(validateFamilyReportCardIngestRequest(validHomeBuyerIngestRequestBodyFixture({ assessmentVersion: 2, answers: answers() })).ok).toBe(true)
    expect(getHomeBuyerResultsModel(validHomeBuyerAnswersFixture()).scoringVersion).toBe(1)
    expect(getHomeBuyerResultsModel(answers()).scoringVersion).toBe(2)
  })
  it('rejects unknown fields, malformed numbers, stale branches, and contradictory multi-selects', () => {
    expect(validateV2Answers({ ...fixture(), mystery: 'value' })).toBe(false)
    for (const value of ['-1', 'NaN', 'Infinity', '1e4', '1,000', '100000001', '1.234', ' 1', 100]) {
      expect(validateV2Answers({ ...fixture(), primary_w2: value })).toBe(false)
    }
    expect(validateV2Answers({ ...fixture(), co_w2: '5000' })).toBe(false)
    expect(validateV2Answers(fixture({ hoa: '100001' }))).toBe(false)
    expect(validateV2Answers({ ...fixture(), primary_sources: ['w2', 'none'] })).toBe(false)
    expect(validateV2Answers({ ...fixture(), primary_sources: ['w2', 'w2'] })).toBe(false)
    expect(validateV2Answers({ ...fixture(), barriers: 'x'.repeat(201) })).toBe(false)
    expect(validateV2Answers(fixture({ has_agent: 'yes', agent_email: 'invalid' }))).toBe(false)
    expect(validateV2Answers(fixture({ has_agent: 'yes', agent_phone: '-------' }))).toBe(false)
  })
  it('prunes another applicant, deselected sources and professional contacts', () => {
    const original = fixture({ applicants: 'self_spouse', co_applying: 'yes', co_sources: ['w2'], co_w2: '3000', has_agent: 'yes', agent_name: 'Example Agent' })
    const pruned = pruneV2Answers({ ...original, applicants: 'self', has_agent: 'no', primary_sources: ['none'] })
    expect(pruned.co_sources).toEqual([])
    expect(pruned.co_w2).toBe('')
    expect(pruned.primary_w2).toBe('')
    expect(pruned.agent_name).toBe('')
  })
  it('rebuilds the legacy projection from V2 evidence rather than trusting fabricated bands', () => {
    const a = answers()
    a.diagnostic.household_income_band = 'under_50k'
    const checked = validateHomeBuyerAnswers(a)
    expect(checked.ok).toBe(true)
    if (checked.ok) expect(checked.value.diagnostic.household_income_band).toBe('75_100k')
    expect(scoreHomeBuyerAssessment(a.diagnostic)).toEqual(scoreHomeBuyerAssessment(answers().diagnostic))
  })
  it('keeps relationship, price goal, and calculator assumptions separate from readiness', () => {
    const base = scoreHomeBuyerAssessment(answers().diagnostic)
    const altered = answers(fixture({ has_agent: 'yes', loan_officer: 'yes', approval_stage: 'preapproved', target_price: '900000', home_type: 'resale' }))
    expect(scoreHomeBuyerAssessment(altered.diagnostic).overallScore).toBe(base.overallScore)
  })
})

describe('Educational affordability calculations', () => {
  it('normalizes annual and monthly income and adds only active applicant sources once', () => {
    expect(monthlyIncome(fixture({ primary_w2: '96000', primary_period: 'annual' }), 'primary')).toBe(8000)
    const v = fixture({ primary_sources: ['w2', 'commission', 'bonus', 'net_business', 'other'], primary_w2: '5000', primary_commission: '1000', primary_bonus: '500', primary_net_business: '1000', primary_other: '500' })
    expect(monthlyIncome(v, 'primary')).toBe(8000)
    expect(monthlyIncome({ ...v, primary_net_business: '-1000' }, 'primary')).toBe(6000)
    expect(validateV2Answers({ ...v, primary_net_business: '-1000' })).toBe(true)
    expect(calculateAffordability(fixture({ primary_sources: ['net_business'], primary_net_business: '-1000' })).status).toBe('no_income')
    const co = fixture({ applicants: 'self_spouse', co_applying: 'yes', co_sources: ['w2'], co_w2: '24000', co_period: 'annual' })
    expect(calculateAffordability(co).monthlyIncome).toBe(10000)
    expect(calculateAffordability(fixture({ applicants: 'self_spouse', co_applying: 'no' })).monthlyIncome).toBe(8000)
    expect(calculateAffordability(fixture({ applicants: 'self_spouse', co_applying: 'not_sure' })).status).toBe('insufficient_data')
  })
  it('has a hand-checkable zero-interest scenario and exact DTI definitions', () => {
    const v = fixture({ primary_w2: '10000', debt_auto: '1000', debt_student: '0', debt_cards: '0', available_funds: '1000000', target_price: '500000' })
    const result = calculateAffordability(v, { ...DEFAULT_AFFORDABILITY_ASSUMPTIONS, termYears: 10, annualTaxRate: 0, annualInsuranceRate: 0, annualMortgageInsuranceRate: 0, downPaymentRate: 0.2, closingCostRate: 0, reserveFloor: 0, scenarios: [{ annualInterestRate: 0, housingRatio: 0.2, totalDebtRatio: 0.3 }, { annualInterestRate: 0, housingRatio: 0.2, totalDebtRatio: 0.3 }] })
    expect(result.status).toBe('available')
    expect(result.scenarios[0].homePrice).toBe(300000)
    expect(result.scenarios[0].monthlyPayment).toBeCloseTo(2000)
    expect(result.currentDti).toBe(0.1)
    expect(result.scenarios[0].projectedDti).toBeCloseTo(0.3)
    expect(result.targetGap).toBe(200000)
  })
  it('replaces current rent and retains explicitly continuing obligations', () => {
    const base = calculateAffordability(fixture())
    expect(calculateAffordability(fixture({ current_housing_payment: '9999' })).scenarios).toEqual(base.scenarios)
    const retained = calculateAffordability(fixture({ retained_housing_payment: '1500' }))
    expect(retained.scenarios[1].homePrice).toBeLessThan(base.scenarios[1].homePrice)
    expect(calculateAffordability(fixture({ current_housing: 'own' })).currentDti).toBeCloseTo((700 + 1800) / 8000)
  })
  it('does not spend retirement, double-count reserves, or exceed the purchase funds', () => {
    const base = calculateAffordability(fixture({ available_funds: '10000' }))
    expect(calculateAffordability(fixture({ available_funds: '10000', retirement: '900000' })).scenarios).toEqual(base.scenarios)
    expect(base.reserveTopUp).toBe(0)
    expect(base.scenarios.every(s => s.cashToClose <= 10000)).toBe(true)
    const shortReserve = calculateAffordability(fixture({ available_funds: '10000', protected_reserves: '1000' }))
    expect(shortReserve.reserveTopUp).toBe(2000)
    expect(shortReserve.scenarios.every(s => s.cashToClose <= 8000)).toBe(true)
  })
  it('handles unknown, zero, unsupported occupancy, omitted target, and invalid assumptions honestly', () => {
    expect(calculateAffordability(fixture({ primary_w2: '' })).status).toBe('insufficient_data')
    expect(calculateAffordability(fixture({ debt_auto: '' })).status).toBe('insufficient_data')
    expect(calculateAffordability(fixture({ primary_sources: ['none'] })).status).toBe('no_income')
    expect(calculateAffordability(fixture({ available_funds: '0' })).status).toBe('no_capacity')
    expect(calculateAffordability(fixture({ debt_auto: '99000' })).status).toBe('no_capacity')
    expect(calculateAffordability(fixture({ intended_occupancy: 'investment' })).status).toBe('unsupported')
    expect(calculateAffordability(fixture({ target_price: '' })).targetGap).toBeNull()
    expect(calculateAffordability(fixture(), { ...DEFAULT_AFFORDABILITY_ASSUMPTIONS, termYears: 0 }).status).toBe('invalid_assumptions')
  })
  it('responds monotonically to income, debt, and rate changes; snapshots assumptions', () => {
    const v = fixture({ available_funds: '1000000' })
    const base = calculateAffordability(v)
    expect(calculateAffordability({ ...v, primary_w2: '10000' }).scenarios[1].homePrice).toBeGreaterThan(base.scenarios[1].homePrice)
    expect(calculateAffordability({ ...v, debt_auto: '2000' }).scenarios[1].homePrice).toBeLessThan(base.scenarios[1].homePrice)
    const a = { ...DEFAULT_AFFORDABILITY_ASSUMPTIONS, scenarios: [{ annualInterestRate: 0.12, housingRatio: 0.28, totalDebtRatio: 0.36 }, { annualInterestRate: 0.12, housingRatio: 0.32, totalDebtRatio: 0.43 }] as const }
    const expensive = calculateAffordability(v, a)
    expect(expensive.scenarios[1].homePrice).toBeLessThan(base.scenarios[1].homePrice)
    a.termYears = 20
    expect(expensive.assumptions.termYears).toBe(30)
    expect(readAffordabilitySnapshot(base)).toEqual(base)
    expect(readAffordabilitySnapshot({ ...base, scenarios: [{}] })).toBeUndefined()
  })
})

describe('V2 persistence, presentation, and privacy', () => {
  it('removes professional contacts and free text from the browser session while preserving the estimate', () => {
    const a = answers(fixture({ has_agent: 'yes', agent_name: 'Example Agent', agent_email: 'agent@example.com', barriers: 'Example private concern' }))
    const session = buildHomeBuyerResultsSession(a)
    expect(JSON.stringify(session)).not.toContain('Example Agent')
    expect(JSON.stringify(session)).not.toContain('agent@example.com')
    expect(JSON.stringify(session)).not.toContain('Example private concern')
    expect(getHomeBuyerResultsModel(session).affordability).toEqual(calculateAffordability(a.diagnostic.v2!))
  })
  it('retains valid saved results at the largest supported HOA amount', () => {
    const result = calculateAffordability(fixture({ hoa: '100000' }))
    expect(readAffordabilitySnapshot(result)).toEqual(result)
  })
  it('renders bilingual estimates, assumptions and educational disclosures', () => {
    for (const locale of ['en', 'es'] as const) {
      const html = renderToStaticMarkup(createElement(AffordabilityPanel, { result: calculateAffordability(fixture()), locale }))
      expect(html).toContain('home-buyer-affordability')
      expect(html).toContain(locale === 'en' ? 'not a loan offer' : 'no es oferta')
      expect(html).toContain(locale === 'en' ? 'Planning assumptions' : 'Supuestos de planificación')
      expect(html).not.toContain('NaN')
    }
  })
  it('renders V2 results without obsolete no-DTI or negative-strength wording', () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [{ pathname: '/home-buyer-results', state: { answers: buildHomeBuyerResultsSession(answers()) } }] }, createElement(HomeBuyerReportCardResults)))
    expect(html).toContain('Your estimated home-buying range')
    expect(html).not.toContain('does not calculate a precise debt-to-income ratio')
    expect(html).not.toContain('not a calculated ratio')
    expect(html).toContain('separate from the educational affordability scenarios')
  })
  it('uses existing ingest with server-calculated snapshots and minimized Sheets export', async () => {
    const rpc = vi.fn(async (fn: string) => fn === 'ingest_public_report_card' ? { data: { created: true, lead_id: 'lead-v2', household_id: 'hh-v2', assessment_id: 'assessment-v2', match_status: 'new_prospect' }, error: null } : { data: null, error: null })
    const writer = vi.fn().mockResolvedValue({ status: 'succeeded' })
    const a = answers(fixture({ has_agent: 'yes', agent_email: 'agent@example.com' }))
    const result = await ingestPublicReportCard(validHomeBuyerIngestRequestBodyFixture({ assessmentVersion: 2, answers: a, clientReportedScore: 0 }), { admin: { rpc } as unknown as SupabaseClient, findCandidates: async () => [], sheetsWriter: writer })
    expect(result.ok).toBe(true)
    const payload = (rpc.mock.calls as unknown as [string, { p_payload: Record<string, unknown> }][]).find(c => c[0] === 'ingest_public_report_card')![1].p_payload
    expect(payload.scoring_version).toBe(2)
    expect(payload.answers).toEqual({ diagnostic: a.diagnostic })
    expect(payload.overall_score).toBe(scoreHomeBuyerAssessment(a.diagnostic).overallScore)
    expect(payload.derived_metrics).toMatchObject({ creditDataSource: 'public_self_report', affordability: calculateAffordability(a.diagnostic.v2!) })
    expect(JSON.stringify(writer.mock.calls)).not.toContain('agent@example.com')
    expect(JSON.stringify(writer.mock.calls)).not.toContain('primary_w2')
    expect(extractHomeBuyerSubmittedAnswers(payload.answers).find(f => f.id === 'agent_email')?.value).toBe('agent@example.com')
    const detail = mapPublicFamilyDiagnosticDetail({ id: 'assessment-v2', assessment_type: 'home_buyer', capture_channel: 'public_self_report', status: 'completed', completed_at: '2026-09-23T12:00:00Z', answers: payload.answers, derived_metrics: payload.derived_metrics }, 'hh-v2', null)
    expect(detail?.affordability?.status).toBe('available')
    const html = renderToStaticMarkup(createElement(PublicFamilyDiagnosticDetailView, { detail: detail!, variant: 'embedded' }))
    expect(html).toContain('Your estimated home-buying range')
    expect(html).toContain('Submitted questions and answers')
    expect(html).toContain('agent@example.com')
    expect(html).toContain('8,000'.replace(',', ''))

  })
})
