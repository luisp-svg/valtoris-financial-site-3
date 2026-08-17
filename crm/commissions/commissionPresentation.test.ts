import { describe, expect, it } from 'vitest'
import {
  commissionClientLabel,
  commissionListCapWarning,
  commissionProductServiceLabel,
  commissionProviderLabel,
  commissionReferenceLabel,
} from './commissionPresentation'
import type { ProductionApplicationListItem } from '../production/types'

function item(
  partial: Partial<ProductionApplicationListItem> = {},
): ProductionApplicationListItem {
  return {
    id: 'app-1',
    household_id: 'hh1',
    carrier_id: 'c1',
    product_id: 'p1',
    product_line: 'life_term',
    state: 'TX',
    application_number: 'APP-9',
    policy_number: null,
    production_stage: 'submitted',
    underwriting_disposition: 'pending',
    delivery_status: 'pre_issue',
    submission_date: '2026-08-05',
    next_follow_up_date: null,
    submitted_premium_cents: 10000,
    annuity_deposit_cents: null,
    face_amount_cents: null,
    premium_mode: 'annual',
    issue_date: null,
    in_force_date: null,
    updated_at: '2026-08-01T00:00:00.000Z',
    deleted_at: null,
    household: { id: 'hh1', display_name: 'Rivera Household' },
    carrier: { id: 'c1', name: 'Acme Life', code: 'ACME' },
    product: { id: 'p1', name: 'Term 20', product_line: 'life_term' },
    participants: [],
    allocations: [],
    stage_history: [],
    linked_policies: [],
    expected_compensations: [],
    ...partial,
  }
}

describe('commission presentation adapters', () => {
  it('maps current insurance facts onto generic labels without requiring face amount', () => {
    expect(commissionClientLabel(item())).toBe('Rivera Household')
    expect(commissionReferenceLabel(item())).toBe('APP-9')
    expect(commissionReferenceLabel(item({ policy_number: 'POL-88' }))).toBe('POL-88')
    expect(commissionProviderLabel(item())).toBe('Acme Life')
    expect(commissionProductServiceLabel(item())).toBe('Term 20')
  })

  it('warns when the production list cap is hit', () => {
    expect(commissionListCapWarning(200, 200)).toMatch(/Commission totals may be incomplete/)
    expect(commissionListCapWarning(12, 200)).toBeNull()
  })
})
