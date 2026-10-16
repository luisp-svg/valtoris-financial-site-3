import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateHomePaymentRange, isHomePaymentRange } from './homePaymentRange'
import { buildShortResult, readShortResult } from './results'
import { SHORT_CARDS, SHORT_FORM_FORMAT } from './catalog'
import type { ShortAnswers } from './contract'
import HomePaymentRangePanel from '../../../components/reportCard/shortForm/HomePaymentRangePanel'
import { ShortResultBody } from '../../../components/reportCard/shortForm/ShortResults'
import { ingestFamilyReportCard } from '../../../server/ingest/familyReportCard/ingestFamilyReportCard'
import { validIngestRequestBodyFixture } from '../../../server/ingest/familyReportCard/testFixtures'
import { mapPublicFamilyDiagnosticDetail } from '../../../crm/households/assessments/diagnosticFormatters'

const input = { income: '8000', debt_payment: '600', budget: '3000', occupancy: 'primary' }
describe('home-payment planning range', () => {
  it('calculates both scenarios from gross income and debt and caps them at the stated budget', () => {
    expect(calculateHomePaymentRange(input)).toMatchObject({ status: 'available', lowerMonthlyPayment: 2240, upperMonthlyPayment: 2560 })
    expect(calculateHomePaymentRange({ ...input, budget: '1800' })).toMatchObject({ lowerMonthlyPayment: 1800, upperMonthlyPayment: 1800 })
    expect(calculateHomePaymentRange({ ...input, debt_payment: '2000' })).toMatchObject({ lowerMonthlyPayment: 880, upperMonthlyPayment: 1440 })
    const cents = calculateHomePaymentRange({ ...input, budget: '1999.99' })
    expect(cents.lowerMonthlyPayment).toBe(1999)
    expect(cents.upperMonthlyPayment).toBe(1999)
  })
  it('does not substitute zero for missing, malformed or out-of-range inputs', () => {
    for (const key of ['income', 'debt_payment', 'budget']) for (const value of ['unknown', '', '-1', 'Infinity', '1e9', '1000000001', '1.234']) {
      expect(calculateHomePaymentRange({ ...input, [key]: value })).toMatchObject({ status: 'insufficient_data', lowerMonthlyPayment: null, upperMonthlyPayment: null })
    }
    expect(calculateHomePaymentRange({ ...input, debt_payment: '0' }).status).toBe('available')
    expect(calculateHomePaymentRange({ ...input, occupancy: 'unknown' }).status).toBe('insufficient_data')
  })
  it('handles zero budgets, no income, excessive debt and unsupported occupancy without a false positive', () => {
    for (const patch of [{ income: '0' }, { budget: '0' }, { debt_payment: '5000' }]) {
      expect(calculateHomePaymentRange({ ...input, ...patch })).toMatchObject({ status: 'no_capacity', lowerMonthlyPayment: 0, upperMonthlyPayment: 0 })
    }
    expect(calculateHomePaymentRange({ ...input, debt_payment: '3100' })).toMatchObject({ status: 'available', lowerMonthlyPayment: 0, upperMonthlyPayment: 340 })
    for (const occupancy of ['second', 'investment']) expect(calculateHomePaymentRange({ ...input, occupancy }).status).toBe('unsupported')
  })
  it('does not infer qualification from credit, tenure or purchase funds', () => {
    const base = calculateHomePaymentRange(input)
    expect(calculateHomePaymentRange({ ...input, credit_range: 'below_620', employment_tenure: 'under_2_years', purchase_funds: '0' })).toEqual(base)
    const changed = calculateHomePaymentRange({ ...input, income: '10000' })
    expect(changed.upperMonthlyPayment).toBeGreaterThan(base.upperMonthlyPayment!)
  })
  it('validates saved snapshots and retains old reviews without estimates', () => {
    const result = buildShortResult('home_buyer', input)
    expect(readShortResult(JSON.parse(JSON.stringify(result)))).toEqual(result)
    for (const bad of [null, {}, { ...result.homePaymentRange, upperMonthlyPayment: Infinity }, { ...result.homePaymentRange, upperMonthlyPayment: 9999 }, { ...result.homePaymentRange, assumptions: {} }, { ...result.homePaymentRange, status: 'unsupported' }]) {
      expect(isHomePaymentRange(bad)).toBe(false)
      expect(readShortResult({ ...result, homePaymentRange: bad })).toBeUndefined()
    }
    const { homePaymentRange: _range, ...old } = result
    expect(readShortResult(old)).toEqual(old)
    expect(buildShortResult('family', input)).not.toHaveProperty('homePaymentRange')
  })
  it('renders bilingual results, known inputs, scenarios and total-payment disclosures', () => {
    for (const locale of ['en', 'es'] as const) {
      const html = renderToStaticMarkup(createElement(ShortResultBody, { result: buildShortResult('home_buyer', input), locale }))
      expect(html).toContain('$2,240')
      expect(html).toContain('$2,560')
      expect(html).toContain(locale === 'en' ? 'Not a preapproval' : 'No es preaprobación')
      expect(html).toContain(locale === 'en' ? 'homeowners insurance' : 'seguro de vivienda')
      expect(html).toContain('28%')
      expect(html).toContain('43%')
      expect(html).not.toContain('NaN')
    }
    const html = renderToStaticMarkup(createElement(HomePaymentRangePanel, { result: calculateHomePaymentRange({ ...input, budget: 'unknown' }), locale: 'en' }))
    expect(html).toContain('Unknown amounts are not treated as zero')
    expect(html).not.toContain('home-payment-range-value')
  })
  it('saves the server-calculated range in CRM and renders the persisted snapshot', async () => {
    let payload: Record<string, unknown> = {}
    const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'ingest_public_report_card') {
        payload = args.p_payload as Record<string, unknown>
        return { data: { created: true, lead_id: 'lead-1', household_id: 'hh-1', member_id: 'member-1', assessment_id: 'assessment-1', match_status: 'new_prospect', sheets_sync_status: 'pending', duplicate_review_id: null }, error: null }
      }
      return { data: null, error: null }
    })
    const diagnostic = Object.fromEntries(SHORT_CARDS.home_buyer.questions.map(q => [q.id, q.kind === 'multi' ? ['unknown'] : q.options?.[0].value ?? '0']))
    const answers: ShortAnswers = { format: SHORT_FORM_FORMAT, assessmentType: 'home_buyer', diagnostic: { ...diagnostic, ...input }, contact: { fullName: 'QA Rivera', email: 'qa@example.invalid', phone: '' } }
    const body = validIngestRequestBodyFixture({ assessmentType: 'home_buyer', assessmentVersion: 3, answers, clientReportedScore: 100, clientReportedGrade: 'A+' })
    body.consent = { ...(body.consent as object), contactPermission: false, emailMarketingConsent: false, smsMarketingConsent: false }
    const result = await ingestFamilyReportCard(body, { admin: { rpc } as unknown as SupabaseClient, findCandidates: async () => [], sheetsWriter: vi.fn().mockResolvedValue({ status: 'succeeded' }), orchestrateFollowUpTask: vi.fn().mockResolvedValue({ status: 'not_required' }) })
    expect(result.ok).toBe(true)
    const detail = mapPublicFamilyDiagnosticDetail({ ...payload, id: 'assessment-1', completed_at: '2026-10-16T06:00:00Z', capture_channel: 'public_self_report', status: 'completed' }, 'hh-1', null)
    expect(detail?.shortFormResult?.homePaymentRange).toEqual(calculateHomePaymentRange(input))
    expect(payload.overall_score).toBeNull()
    expect(payload.overall_grade).toBeNull()
    expect(JSON.stringify(payload.answers)).not.toContain('qa@example.invalid')
  })
})
