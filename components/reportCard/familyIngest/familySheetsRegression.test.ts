import { describe, expect, it, vi } from 'vitest'
import { submitFamilyLeadFormLead, submitFamilyReportCardLead } from '../submitReportCardLead'
import { submitLeadToGoogleSheets } from '../../../utils/submitLeadToGoogleSheets'

vi.mock('../../../utils/submitLeadToGoogleSheets', async () => {
  const actual = await vi.importActual<typeof import('../../../utils/submitLeadToGoogleSheets')>(
    '../../../utils/submitLeadToGoogleSheets',
  )
  return {
    ...actual,
    submitLeadToGoogleSheets: vi.fn(async () => ({ ok: true as const })),
  }
})

describe('Sheets regression — Family assessment vs other Family LeadForm path', () => {
  it('LeadForm thin lead still uses browser Google Sheets', async () => {
    vi.mocked(submitLeadToGoogleSheets).mockClear()
    await submitFamilyLeadFormLead('family-financial-report-card', {
      name: 'Jamie Rivera',
      email: 'jamie@example.com',
      phone: '555-111-2222',
      notes: '',
    })
    expect(submitLeadToGoogleSheets).toHaveBeenCalledTimes(1)
    expect(submitLeadToGoogleSheets).toHaveBeenCalledWith(
      'Family Report Card',
      expect.objectContaining({ email: 'jamie@example.com' }),
    )
  })

  it('retired full Family assessment helper does not call Google Sheets', async () => {
    vi.mocked(submitLeadToGoogleSheets).mockClear()
    const result = await submitFamilyReportCardLead({
      family: {
        firstName: 'Jamie',
        lastName: 'Rivera',
        email: 'jamie@example.com',
        phone: '555-111-2222',
        age: '38',
        state: 'TX',
        maritalStatus: 'married',
        numberOfChildren: '1',
      },
      financial: {
        householdIncome: '100000',
        monthlyHousingPayment: '2000',
        totalDebt: '10000',
        emergencyFundMonths: '3',
        monthlyCashFlow: 'break-even',
        retirementContribution: '6-10',
      },
      protection: {
        currentLifeInsurance: '100000',
        hasDisabilityProtection: 'yes',
        hasWill: 'no',
        hasTrust: 'no',
        beneficiariesReviewed: 'yes',
        guardianDocumented: 'yes',
      },
      goals: { selected: ['protect-family'] },
    })
    expect(result.ok).toBe(false)
    expect(submitLeadToGoogleSheets).not.toHaveBeenCalled()
  })
})
