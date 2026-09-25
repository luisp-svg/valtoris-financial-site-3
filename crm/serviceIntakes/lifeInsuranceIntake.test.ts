import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { emptyIntakeRow, type IntakeAnswers } from './studentLoanSchema'
import { LIFE_INTAKE_SECTIONS, emptyLifeInsuranceIntake, validateLifeInsuranceIntake, calculateLifeNeeds } from './lifeInsuranceSchema'
import LifeInsuranceIntakeForm from './LifeInsuranceIntakeForm'
import { createServiceIntakeApi } from './serviceIntakeApi'
import { lifeInsuranceIntakePath, parseIntakeOrigin } from './intakeSource'
const household = '11111111-1111-4111-8111-111111111111'
const contact = '22222222-2222-4222-8222-222222222222'
const origin = { kind: 'contact' as const, id: contact, householdId: household }
const addRow = (a: IntakeAnswers, section: string, values: Record<string,string>) => {
  const row = { ...emptyIntakeRow(LIFE_INTAKE_SECTIONS.find(s => s.id === section)!), ...values }
  a.sections[section].push(row)
  return row
}
function completeAnswers() {
  const a = emptyLifeInsuranceIntake()
  for (const s of LIFE_INTAKE_SECTIONS.filter(s => !s.repeatable)) for (const f of s.fields.filter(f => f.required)) {
    a.sections[s.id][0][f.id] = f.kind === 'select' ? f.options![0] : f.kind === 'email' ? 'qa@example.invalid' : f.kind === 'date' ? '2000-01-01' : 'Synthetic QA'
  }
  Object.assign(a.sections.review[0], { coverageStatus: 'No existing coverage', beneficiaryStatus: 'Recorded' })
  addRow(a, 'beneficiaries', { type: 'Person', name: 'Synthetic Beneficiary', relationship: 'Spouse', role: 'Primary', percent: '100' })
  return a
}
describe('Life Insurance planning intake', () => {
  it('starts from a contact or report and preserves the ten-year assumption explicitly', () => {
    expect(parseIntakeOrigin(household, new URLSearchParams({ contact }))).toEqual(origin)
    expect(lifeInsuranceIntakePath(origin)).toContain('life-insurance-intake?contact=')
    expect(lifeInsuranceIntakePath({ ...origin, kind: 'report_card' })).toContain('?report=')
    const a = emptyLifeInsuranceIntake()
    expect(a.sections.needs[0].years).toBe('10')
    expect(validateLifeInsuranceIntake(a)).toEqual([])
    expect(validateLifeInsuranceIntake(a, true).length).toBeGreaterThan(0)
    expect(validateLifeInsuranceIntake(completeAnswers(), true)).toEqual([])
  })
  it('validates each beneficiary group independently, with exact hundredth-percent totals', () => {
    const a = completeAnswers()
    a.sections.beneficiaries[0].percent = '50'
    expect(validateLifeInsuranceIntake(a)).toEqual([])
    expect(validateLifeInsuranceIntake(a, true)).toContain('Primary beneficiary allocations must total 100%.')
    addRow(a, 'beneficiaries', { ...a.sections.beneficiaries[0], name: 'Second Primary' })
    const contingent = addRow(a, 'beneficiaries', { ...a.sections.beneficiaries[0], name: 'Contingent', role: 'Contingent', percent: '100' })
    expect(validateLifeInsuranceIntake(a, true)).toEqual([])
    contingent.percent = '90'
    expect(validateLifeInsuranceIntake(a, true)).toContain('Contingent beneficiary allocations must total 100%.')
    a.sections.beneficiaries = []
    for (const percent of ['33.33','33.33','33.34']) addRow(a, 'beneficiaries', { type: 'Person', name: 'Synthetic', relationship: 'Child', role: 'Primary', percent })
    expect(validateLifeInsuranceIntake(a, true)).toEqual([])
    a.sections.beneficiaries[0].percent = '0'
    expect(validateLifeInsuranceIntake(a).some(e => e.includes('allowed range'))).toBe(true)
  })
  it('requires separate owner/payer information and rejects contradictory roles', () => {
    const a = completeAnswers()
    a.sections.owner[0].sameAsInsured = 'No'
    expect(validateLifeInsuranceIntake(a, true).some(e => e.startsWith('Owner:'))).toBe(true)
    Object.assign(a.sections.owner[0], { entityType: 'Person', name: 'Owner', relationship: 'Spouse', reason: 'Owns the policy' })
    expect(validateLifeInsuranceIntake(a, true)).toEqual([])
    a.sections.owner[0].sameAsInsured = 'Yes'
    expect(validateLifeInsuranceIntake(a, true).some(e => e.includes('clear the different-person'))).toBe(true)
  })
  it('requires explicit follow-up instead of treating undecided information as complete', () => {
    const a = completeAnswers()
    a.sections.beneficiaries = []
    a.sections.review[0].beneficiaryStatus = 'To be decided'
    expect(validateLifeInsuranceIntake(a, true)).toContain('Record follow-up for undecided beneficiaries or unconfirmed coverage.')
    a.sections.review[0].unresolved = 'Confirm proposed beneficiaries at next meeting.'
    expect(validateLifeInsuranceIntake(a, true)).toEqual([])
    a.sections.review[0].coverageStatus = 'Policies recorded'
    expect(validateLifeInsuranceIntake(a, true)).toContain('Add the existing coverage records.')
  })
  it('rejects extra sensitive fields, invalid birth dates, and secret-bearing links', () => {
    const a = emptyLifeInsuranceIntake()
    a.sections.client[0].ssn = 'not-allowed'
    expect(validateLifeInsuranceIntake(a)).toContain('Client and request: invalid fields.')
    delete a.sections.client[0].ssn
    a.sections.insured[0].birthDate = '2999-01-01'
    expect(validateLifeInsuranceIntake(a).some(e => e.includes('Birth dates'))).toBe(true)
    a.sections.insured[0].birthDate = '2025-02-30'
    expect(validateLifeInsuranceIntake(a).some(e => e.includes('valid date'))).toBe(true)
    a.sections.insured[0].birthDate = ''
    a.sections.handoff[0].evidenceReference = 'https://carrier.example/token=secret'
    expect(validateLifeInsuranceIntake(a).some(e => e.includes('not an application link'))).toBe(true)
  })
  it('supports negative net worth, bounded amounts, and whole replacement years', () => {
    const a = emptyLifeInsuranceIntake()
    a.sections.finances[0].netWorth = '-25000.50'
    expect(validateLifeInsuranceIntake(a)).toEqual([])
    a.sections.finances[0].liquidNetWorth = '1,000'
    expect(validateLifeInsuranceIntake(a).some(e => e.includes('Net-worth'))).toBe(true)
    a.sections.finances[0].liquidNetWorth = ''
    a.sections.needs[0].years = '10.5'
    expect(validateLifeInsuranceIntake(a).some(e => e.includes('allowed range'))).toBe(true)
  })
  it('keeps unknown amounts distinct from zero and does not double-count mortgage', () => {
    const a = emptyLifeInsuranceIntake()
    expect(calculateLifeNeeds(a)).toBeNull()
    Object.assign(a.sections.needs[0], { debt: '50000', annualIncome: '100000', years: '10', mortgage: '200000', education: '30000', otherNeeds: '10000', existingCoverage: '300000', availableAssets: '100000', requestedCoverage: '1000000' })
    expect(calculateLifeNeeds(a)).toEqual({ grossCents: 129000000, coverageCents: 30000000, assetsCents: 10000000, gapCents: 89000000, requestedCents: 100000000, differenceCents: -11000000 })
    a.sections.needs[0].years = '5'
    expect(calculateLifeNeeds(a)?.gapCents).toBe(39000000)
    a.sections.needs[0].availableAssets = ''
    expect(calculateLifeNeeds(a)).toBeNull()
    for (const key of Object.keys(a.sections.needs[0])) a.sections.needs[0][key] = '0'
    expect(calculateLifeNeeds(a)?.gapCents).toBe(0)
  })
  it('requires a saved draft, preserves completion, and validates acknowledgment type', async () => {
    const api = createServiceIntakeApi('life_insurance_intake', 'save_life_insurance_intake', validateLifeInsuranceIntake)
    const row = { id: contact, household_id: household, assessment_type: 'life_insurance_intake', capture_channel: 'advisor_onboarding', status: 'draft', updated_at: '2026-09-25T00:00:00Z', completed_at: null, answers: emptyLifeInsuranceIntake() }
    const rpc = vi.fn().mockResolvedValue({ data: row, error: null })
    const client = { rpc } as unknown as SupabaseClient
    const saved = await api.saveIntake(client, origin, row.answers, null, false)
    expect(rpc).toHaveBeenCalledWith('save_life_insurance_intake', expect.objectContaining({ p_origin_kind: 'contact' }))
    await expect(api.saveIntake(client, origin, completeAnswers(), null, true)).rejects.toThrow('Save a draft')
    expect(() => api.normalizeSavedIntake({ ...row, assessment_type: 'student_loan_intake' }, household)).toThrow()
    expect(() => api.normalizeSavedIntake({ ...row, status: 'completed', completed_at: row.updated_at }, household)).toThrow('completed intake')
    await expect(api.saveIntake(client, origin, completeAnswers(), { ...saved, status: 'completed' }, true)).rejects.toThrow('Completed intakes are preserved')
  })
  it('renders planning roles and secure handoff without sensitive application fields', () => {
    const html = renderToStaticMarkup(createElement(LifeInsuranceIntakeForm, { answers: completeAnswers(), onChange: () => {} }))
    expect(html).toContain('Policy owner')
    expect(html).toContain('Premium payer')
    expect(html).toContain('Contingent')
    expect(html).toContain('selected carrier’s secure application')
    expect(html).not.toContain('name="intake-client-0-ssn"')
    expect(html).not.toContain('name="intake-payer-0-routingNumber"')
    expect(html).toContain('ten years of income')
  })
})
