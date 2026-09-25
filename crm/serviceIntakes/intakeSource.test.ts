import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchManualContactDetail } from '../contacts/contactsApi'
import { fetchPublicFamilyDiagnosticDetail } from '../households/assessments/householdAssessmentsApi'
import { loadClientIntakeSource } from './intakeSource'
import { emptyLifeInsuranceIntake } from './lifeInsuranceSchema'
vi.mock('../contacts/contactsApi', () => ({ fetchManualContactDetail: vi.fn() }))
vi.mock('../households/assessments/householdAssessmentsApi', () => ({ fetchPublicFamilyDiagnosticDetail: vi.fn() }))
const household = '11111111-1111-4111-8111-111111111111'
const id = '22222222-2222-4222-8222-222222222222'
function browserClient(available = true) {
  const chain = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: available ? { id: household, state: 'TX' } : null, error: null }) }
  chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.is.mockReturnValue(chain)
  return { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient
}
describe('Existing-client intake sources', () => {
  it('prefills the source contact while requiring the insured to be identified separately', async () => {
    vi.mocked(fetchManualContactDetail).mockResolvedValue({ detail: { householdId: household, fullName: 'Synthetic Client', dateEntered: null }, formSeed: { first_name: 'Synthetic', last_name: 'Client', email: 'qa@example.invalid', phone: '2025550181' } } as Awaited<ReturnType<typeof fetchManualContactDetail>>)
    const loaded = await loadClientIntakeSource(browserClient(), { householdId: household, id, kind: 'contact' }, emptyLifeInsuranceIntake)
    expect(loaded.answers.sections.client[0]).toMatchObject({ firstName: 'Synthetic', lastName: 'Client', state: 'TX' })
    expect(loaded.answers.sections.insured[0].name).toBe('')
    expect(loaded.answers.sections.owner[0].sameAsInsured).toBe('')
  })
  it('does not allow a contact from another household or an unavailable household', async () => {
    vi.mocked(fetchManualContactDetail).mockResolvedValue({ detail: { householdId: id }, formSeed: {} } as Awaited<ReturnType<typeof fetchManualContactDetail>>)
    const origin = { householdId: household, id, kind: 'contact' as const }
    await expect(loadClientIntakeSource(browserClient(), origin, emptyLifeInsuranceIntake)).rejects.toThrow('available contact')
    await expect(loadClientIntakeSource(browserClient(false), origin, emptyLifeInsuranceIntake)).rejects.toThrow('available contact')
  })
  it('shows dated prior report answers without turning financial bands into exact values', async () => {
    vi.mocked(fetchPublicFamilyDiagnosticDetail).mockResolvedValue({ productLabel: 'Family Report Card', completedAt: '2026-01-01T00:00:00Z', submittedSnapshot: { firstName: 'Synthetic', lastName: 'Client', email: 'qa@example.invalid', phone: null }, lead: null, submittedAnswers: [{ id: 'income', label: 'Income band', value: '$50,000–$75,000' }] } as Awaited<ReturnType<typeof fetchPublicFamilyDiagnosticDetail>>)
    const loaded = await loadClientIntakeSource(browserClient(), { householdId: household, id, kind: 'report_card' }, emptyLifeInsuranceIntake)
    expect(loaded.priorResponses[0].value).toBe('$50,000–$75,000')
    expect(loaded.sourceDate).toBe('2026-01-01T00:00:00Z')
    expect(loaded.answers.sections.finances[0].annualIncome).toBe('')
    expect(loaded.answers.sections.needs[0].annualIncome).toBe('')
    vi.mocked(fetchPublicFamilyDiagnosticDetail).mockResolvedValue(null)
    await expect(loadClientIntakeSource(browserClient(), { householdId: household, id, kind: 'report_card' }, emptyLifeInsuranceIntake)).rejects.toThrow('completed report card')
  })
})
