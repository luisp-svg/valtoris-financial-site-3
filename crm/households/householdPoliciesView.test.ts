import { describe, expect, it } from 'vitest'
import { crmProductionPath } from '../../constants/routes'
import {
  annuityDepositCentsFromDetails,
  formatHouseholdPolicyStatus,
  formatHouseholdPolicyWriters,
  isFiaHouseholdPolicy,
  mapHouseholdPolicyCard,
  type HouseholdPolicyRecord,
} from './householdPoliciesView'
import { isActiveHouseholdPolicy } from './activePolicyStatus'

function policy(over: Partial<HouseholdPolicyRecord> = {}): HouseholdPolicyRecord {
  return {
    id: 'pol-1',
    householdId: 'hh-1',
    sourceApplicationId: 'app-1',
    opportunityId: 'opp-1',
    policyNumber: 'LN-100',
    status: 'issued',
    carrier: 'National Life Group',
    policyType: 'LSW Term 20',
    coverageAmount: 500000,
    premium: 1200,
    paymentFrequency: 'annual',
    effectiveDate: '2026-04-01',
    details: { product_line: 'life_term' },
    insuredName: 'Ana Rivera',
    ownerName: 'Ana Rivera',
    servicingAdvisorName: 'Pat Servicing',
    terminatedOn: null,
    terminationReason: null,
    ...over,
  }
}

describe('household policy book view', () => {
  it('labels policies.status without using production_stage', () => {
    expect(formatHouseholdPolicyStatus('issued')).toBe('Issued')
    expect(formatHouseholdPolicyStatus('in_force')).toBe('In Force')
    expect(formatHouseholdPolicyStatus('canceled')).toBe('Canceled')
    expect(formatHouseholdPolicyStatus('surrendered')).toBe('Surrendered')
    expect(formatHouseholdPolicyStatus('pending')).toBe('pending')
    expect(JSON.stringify(mapHouseholdPolicyCard(policy({ status: 'issued' })))).not.toMatch(
      /production_stage/,
    )
  })

  it('maps an issued Life policy with face, premium, View Case, and writers', () => {
    const card = mapHouseholdPolicyCard(policy(), [
      { advisorId: 'adv-1', displayName: 'Luis Perez', commissionBps: 10000 },
    ])
    expect(card.policyNumberDisplay).toBe('LN-100')
    expect(card.statusLabel).toBe('Issued')
    expect(card.moneyLines.some((line) => line.startsWith('Face'))).toBe(true)
    expect(card.moneyLines.some((line) => line.startsWith('Premium'))).toBe(true)
    expect(card.moneyLines.join(' ')).not.toMatch(/Deposit/)
    expect(card.insuredLine).toMatch(/Insured: Ana Rivera/)
    expect(card.writingAdvisorsLine).toBe('Luis Perez')
    expect(card.servicingAdvisorLine).toBe('Servicing Pat Servicing')
    expect(card.viewCaseHref).toBe(crmProductionPath('app-1'))
  })

  it('maps FIA deposit from details.annuity_deposit_cents and does not call it premium', () => {
    const card = mapHouseholdPolicyCard(
      policy({
        policyType: 'FIA Plus',
        coverageAmount: null,
        premium: null,
        insuredName: null,
        details: { product_line: 'fia', annuity_deposit_cents: 10000000 },
      }),
    )
    expect(isFiaHouseholdPolicy(policy({ details: { product_line: 'fia' } }))).toBe(true)
    expect(annuityDepositCentsFromDetails({ annuity_deposit_cents: 10000000 })).toBe(10000000)
    expect(card.moneyLines).toEqual([expect.stringMatching(/^Deposit /)])
    expect(card.moneyLines.join(' ')).not.toMatch(/Premium/)
  })

  it('keeps canceled and surrendered rows in the book with termination facts', () => {
    const canceled = mapHouseholdPolicyCard(
      policy({
        status: 'canceled',
        terminatedOn: '2026-08-01',
        terminationReason: 'Client canceled within 12 months',
      }),
    )
    expect(canceled.statusLabel).toBe('Canceled')
    expect(canceled.terminationLine).toMatch(/Terminated/)
    expect(canceled.terminationLine).toMatch(/Client canceled/)

    const surrendered = mapHouseholdPolicyCard(policy({ status: 'surrendered' }))
    expect(surrendered.statusLabel).toBe('Surrendered')
  })

  it('shows historical imported policies without View Case and without fabricated writers', () => {
    const card = mapHouseholdPolicyCard(
      policy({
        sourceApplicationId: null,
        opportunityId: null,
        status: 'in_force',
        policyNumber: 'IMP-9',
      }),
      [{ advisorId: 'adv-1', displayName: 'Should Not Appear', commissionBps: 10000 }],
    )
    expect(card.viewCaseHref).toBeNull()
    expect(card.writingAdvisorsLine).toBeNull()
    expect(card.policyNumberDisplay).toBe('IMP-9')
    expect(card.statusLabel).toBe('In Force')
  })

  it('renders split writing advisors from batched allocation data', () => {
    expect(
      formatHouseholdPolicyWriters([
        { advisorId: 'a', displayName: 'Luis Perez', commissionBps: 7500 },
        { advisorId: 'b', displayName: 'Jane Advisor', commissionBps: 2500 },
      ]),
    ).toBe('Luis Perez (75%), Jane Advisor (25%)')
  })

  it('does not treat book visibility as active protection', () => {
    expect(isActiveHouseholdPolicy({ status: 'issued', source_application_id: 'app-1' })).toBe(false)
    expect(isActiveHouseholdPolicy({ status: 'canceled', source_application_id: 'app-1' })).toBe(
      false,
    )
    expect(isActiveHouseholdPolicy({ status: 'surrendered', source_application_id: 'app-1' })).toBe(
      false,
    )
    expect(isActiveHouseholdPolicy({ status: 'in_force', source_application_id: 'app-1' })).toBe(
      true,
    )
  })
})
