import { describe, expect, it } from 'vitest'
import {
  mapHouseholdProductionPolicy,
  productionPolicyNumberDisplay,
} from './householdProductionView'
import type { ProductionApplicationDetail } from './types'

function application(
  over: Partial<ProductionApplicationDetail> = {},
): ProductionApplicationDetail {
  return {
    id: 'app-1',
    household_id: 'hh-1',
    carrier_id: 'c-1',
    product_id: 'p-1',
    product_line: 'life_term',
    state: 'TX',
    application_number: 'APP-1',
    policy_number: null,
    production_stage: 'submitted',
    underwriting_disposition: 'pending',
    delivery_status: 'pre_issue',
    submission_date: '2026-01-15',
    next_follow_up_date: null,
    updated_at: '2026-01-15T00:00:00Z',
    deleted_at: null,
    household: { id: 'hh-1', display_name: 'Rivera' },
    carrier: { id: 'c-1', name: 'National Life Group', code: 'NLG' },
    product: { id: 'p-1', name: 'LSW Term 20', product_line: 'life_term' },
    participants: [
      {
        id: 'pt-1',
        role: 'insured',
        household_member_id: 'm-1',
        effective_to: null,
        member: { id: 'm-1', first_name: 'Ana', last_name: 'Rivera' },
      },
      {
        id: 'pt-2',
        role: 'owner',
        household_member_id: 'm-1',
        effective_to: null,
        member: { id: 'm-1', first_name: 'Ana', last_name: 'Rivera' },
      },
    ],
    allocations: [
      {
        id: 'al-1',
        recipient_type: 'advisor',
        advisor_id: 'adv-1',
        allocation_role: 'writing',
        commission_bps: 10000,
        production_credit_bps: 10000,
        effective_to: null,
        advisor: { id: 'adv-1', display_name: 'Luis Perez' },
      },
    ],
    stage_history: [],
    linked_policies: [],
    expected_compensations: [],
    writing_receivable_expected: true,
    opportunity_id: null,
    is_replacement: false,
    is_exchange_or_transfer: false,
    face_amount_cents: 50000000,
    annuity_deposit_cents: null,
    premium_mode: 'annual',
    submitted_premium_cents: 120000,
    target_premium_cents: null,
    total_points_scaled: null,
    decision_date: null,
    issue_date: null,
    in_force_date: null,
    production_month: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    created_by_user_id: null,
    ...over,
  }
}

describe('household production policy view', () => {
  it('shows a real policy number and falls back to application number or Pending', () => {
    expect(productionPolicyNumberDisplay(application({ policy_number: 'POL-9' }))).toBe('POL-9')
    expect(
      productionPolicyNumberDisplay(
        application({
          policy_number: null,
          linked_policies: [{ id: 'lp-1', policy_number: 'LINK-1', status: 'issued', deleted_at: null }],
        }),
      ),
    ).toBe('LINK-1')
    expect(productionPolicyNumberDisplay(application({ policy_number: null }))).toBe('Application APP-1')
    expect(
      productionPolicyNumberDisplay(application({ policy_number: null, application_number: null })),
    ).toBe('Pending')
  })

  it('maps production data without compensation fields', () => {
    const row = mapHouseholdProductionPolicy(application())
    expect(row.carrier).toBe('National Life Group')
    expect(row.product).toBe('LSW Term 20')
    expect(row.stage).toBe('Applied')
    expect(row.roles).toMatch(/Insured/)
    expect(row.roles).toMatch(/Owner/)
    expect(row.writingAdvisors).toBe('Luis Perez')
    expect(row.premiumDisplay).toMatch(/Premium/)
    expect(JSON.stringify(row)).not.toMatch(/expected_compensation|commission_bps/)
  })
})
