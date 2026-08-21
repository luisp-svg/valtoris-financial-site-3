import { describe, expect, it } from 'vitest'
import {
  canRecordPostPlacementForApplication,
  canRecordPostPlacementOutcome,
  defaultPostPlacementDraft,
  POST_PLACEMENT_OUTCOMES,
  POST_PLACEMENT_REASON_MAX,
  validatePostPlacementDraft,
} from './policyLifecycleView'
import type { ProductionApplicationListItem, ProductionLinkedPolicy } from './types'

function linked(
  status: string,
  extra: Partial<ProductionLinkedPolicy> = {},
): ProductionLinkedPolicy {
  return {
    id: extra.id ?? `pol-${status}`,
    policy_number: extra.policy_number ?? 'P-1',
    status,
    deleted_at: extra.deleted_at ?? null,
    terminated_on: extra.terminated_on ?? null,
    termination_reason: extra.termination_reason ?? null,
  }
}

function item(
  partial: Partial<ProductionApplicationListItem> &
    Pick<ProductionApplicationListItem, 'id' | 'production_stage'>,
): ProductionApplicationListItem {
  return {
    household_id: 'hh1',
    carrier_id: 'c1',
    product_id: 'p1',
    product_line: 'life_term',
    state: 'TX',
    application_number: 'A-1',
    policy_number: 'P-1',
    underwriting_disposition: 'approved_as_applied',
    delivery_status: 'complete',
    submission_date: '2026-01-15',
    next_follow_up_date: null,
    submitted_premium_cents: 120000,
    annuity_deposit_cents: null,
    face_amount_cents: 50000000,
    premium_mode: 'annual',
    issue_date: '2026-03-01',
    in_force_date: '2026-03-15',
    updated_at: '2026-03-15T00:00:00.000Z',
    deleted_at: null,
    household: { id: 'hh1', display_name: 'Rivera Household' },
    carrier: { id: 'c1', name: 'Acme Life', code: 'ACME' },
    product: { id: 'p1', name: 'Term 20', product_line: 'life_term' },
    participants: [],
    allocations: [],
    stage_history: [],
    linked_policies: [linked('in_force')],
    expected_compensations: [],
    writing_receivable_expected: true,
    ...partial,
  }
}

const eligible = item({ id: 'eligible', production_stage: 'in_force' })

describe('post-placement recording eligibility', () => {
  it('allows owner recording only for a linked in_force policy on an in_force application', () => {
    expect(canRecordPostPlacementForApplication('owner', eligible)).toBe(true)
    expect(
      canRecordPostPlacementOutcome({
        role: 'owner',
        productionStage: 'in_force',
        deletedAt: null,
        linkedPolicyStatus: 'in_force',
      }),
    ).toBe(true)
  })

  it('keeps advisors read-only even on an eligible in_force policy', () => {
    expect(canRecordPostPlacementForApplication('advisor', eligible)).toBe(false)
    expect(
      canRecordPostPlacementOutcome({
        role: 'advisor',
        productionStage: 'in_force',
        deletedAt: null,
        linkedPolicyStatus: 'in_force',
      }),
    ).toBe(false)
  })

  it('rejects ineligible policy and application states', () => {
    expect(
      canRecordPostPlacementForApplication(
        'owner',
        item({ id: 'submitted', production_stage: 'submitted', linked_policies: [] }),
      ),
    ).toBe(false)
    expect(
      canRecordPostPlacementForApplication(
        'owner',
        item({
          id: 'issued-app',
          production_stage: 'issued',
          linked_policies: [linked('issued')],
        }),
      ),
    ).toBe(false)
    expect(
      canRecordPostPlacementForApplication(
        'owner',
        item({ id: 'no-policy', production_stage: 'in_force', linked_policies: [] }),
      ),
    ).toBe(false)
    expect(
      canRecordPostPlacementForApplication(
        'owner',
        item({
          id: 'canceled',
          production_stage: 'in_force',
          linked_policies: [linked('canceled')],
        }),
      ),
    ).toBe(false)
    expect(
      canRecordPostPlacementForApplication(
        'owner',
        item({
          id: 'surrendered',
          production_stage: 'in_force',
          linked_policies: [linked('surrendered')],
        }),
      ),
    ).toBe(false)
    expect(
      canRecordPostPlacementForApplication(
        'owner',
        item({
          id: 'deleted',
          production_stage: 'in_force',
          deleted_at: '2026-08-01T00:00:00.000Z',
        }),
      ),
    ).toBe(false)
  })
})

describe('post-placement draft validation', () => {
  it('builds a canceled submission with a required reason and optional blank date', () => {
    const result = validatePostPlacementDraft({
      applicationId: 'app-1',
      draft: { outcome: 'canceled', terminatedOn: '', reason: 'Client requested early termination' },
    })
    expect(result).toEqual({
      ok: true,
      args: {
        p_application_id: 'app-1',
        p_status: 'canceled',
        p_reason: 'Client requested early termination',
        p_terminated_on: null,
      },
    })
  })

  it('builds a surrendered submission with an optional termination date', () => {
    const result = validatePostPlacementDraft({
      applicationId: 'app-2',
      draft: {
        outcome: 'surrendered',
        terminatedOn: '2027-04-01',
        reason: 'Annuitant surrendered after the first year',
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.args.p_status).toBe('surrendered')
    expect(result.args.p_terminated_on).toBe('2027-04-01')
    expect(result.args.p_reason).toBe('Annuitant surrendered after the first year')
  })

  it('requires a termination reason and does not invent an outcome', () => {
    const missingReason = validatePostPlacementDraft({
      applicationId: 'app-3',
      draft: { outcome: 'canceled', terminatedOn: '2026-06-01', reason: '   ' },
    })
    expect(missingReason).toEqual({
      ok: false,
      errors: { reason: 'Enter a termination reason.' },
    })
    const missingOutcome = validatePostPlacementDraft({
      applicationId: 'app-3',
      draft: defaultPostPlacementDraft(),
    })
    expect(missingOutcome.ok).toBe(false)
    if (missingOutcome.ok) return
    expect(missingOutcome.errors.outcome).toMatch(/Canceled \/ Early Termination or Surrendered/)
    expect(missingOutcome.errors.reason).toBe('Enter a termination reason.')
  })

  it('rejects invalid dates and overlong reasons without classifying 12-month outcomes', () => {
    const badDate = validatePostPlacementDraft({
      applicationId: 'app-4',
      draft: { outcome: 'canceled', terminatedOn: '06/01/2026', reason: 'Early termination' },
    })
    expect(badDate).toEqual({
      ok: false,
      errors: { terminatedOn: 'Enter a valid termination date, or leave it blank.' },
    })
    const longReason = validatePostPlacementDraft({
      applicationId: 'app-4',
      draft: {
        outcome: 'surrendered',
        terminatedOn: '',
        reason: 'x'.repeat(POST_PLACEMENT_REASON_MAX + 1),
      },
    })
    expect(longReason.ok).toBe(false)
    if (longReason.ok) return
    expect(longReason.errors.reason).toMatch(String(POST_PLACEMENT_REASON_MAX))
    expect(POST_PLACEMENT_OUTCOMES).toEqual(['canceled', 'surrendered'])
  })
})
