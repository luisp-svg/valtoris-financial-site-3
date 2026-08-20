import { describe, expect, it } from 'vitest'
import { isClosedPolicyCase, isOpenPolicyCase } from './caseWorkspace'
import { computeCurrentActiveLifeProtection, computePlacedLifeProtection } from './dashboardView'
import {
  formatPlacedCaseLifecycleBadge,
  formatPolicyLifecycleLabel,
  isCurrentlyActiveLinkedPolicy,
  isPlacedApplication,
  isPostPlacementTerminated,
  matchesPolicyLifecycleFilter,
  POLICY_LIFECYCLE_CHARGEBACK_NOTE,
  policyLifecycleDetailModel,
  policyLifecycleDisplayForApplication,
} from './policyLifecycle'
import { computeProductionFunnel } from './productionMetrics'
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
    policy_number: null,
    underwriting_disposition: 'pending',
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
    linked_policies: [],
    expected_compensations: [],
    writing_receivable_expected: true,
    ...partial,
  }
}

describe('policy lifecycle helpers', () => {
  it('keeps placement on the application even after canceled or surrendered', () => {
    const canceled = item({
      id: 'c',
      production_stage: 'in_force',
      linked_policies: [linked('canceled')],
    })
    const surrendered = item({
      id: 's',
      production_stage: 'in_force',
      linked_policies: [linked('surrendered')],
    })
    expect(isPlacedApplication(canceled)).toBe(true)
    expect(isPlacedApplication(surrendered)).toBe(true)
    expect(isCurrentlyActiveLinkedPolicy(canceled)).toBe(false)
    expect(isCurrentlyActiveLinkedPolicy(surrendered)).toBe(false)
    expect(isPostPlacementTerminated(canceled)).toBe(true)
    expect(isPostPlacementTerminated(surrendered)).toBe(true)
  })

  it('treats linked in_force as currently active and issued as not active', () => {
    const active = item({
      id: 'a',
      production_stage: 'in_force',
      linked_policies: [linked('in_force')],
    })
    const issued = item({
      id: 'i',
      production_stage: 'in_force',
      linked_policies: [linked('issued')],
    })
    expect(isCurrentlyActiveLinkedPolicy(active)).toBe(true)
    expect(isCurrentlyActiveLinkedPolicy(issued)).toBe(false)
    expect(isPostPlacementTerminated(issued)).toBe(false)
  })

  it('uses the locked user-facing labels and never Chargeback', () => {
    expect(formatPolicyLifecycleLabel('in_force')).toBe('In Force')
    expect(formatPolicyLifecycleLabel('canceled')).toBe('Canceled / Early Termination')
    expect(formatPolicyLifecycleLabel('surrendered')).toBe('Surrendered')
    expect(formatPolicyLifecycleLabel('issued')).toBe('Issued')
    expect(formatPlacedCaseLifecycleBadge(item({
      id: 's',
      production_stage: 'in_force',
      linked_policies: [linked('surrendered')],
    }))).toBe('Placed · Surrendered')
    expect(POLICY_LIFECYCLE_CHARGEBACK_NOTE).toContain('does not indicate whether a commission chargeback occurred')
    expect(POLICY_LIFECYCLE_CHARGEBACK_NOTE.toLowerCase()).not.toContain('production')
    expect(formatPolicyLifecycleLabel('canceled')).not.toMatch(/chargeback/i)
  })

  it('hides policy status on pre-placement applications', () => {
    const submitted = item({
      id: 'sub',
      production_stage: 'submitted',
      linked_policies: [],
    })
    expect(policyLifecycleDisplayForApplication(submitted)).toBeNull()
    expect(formatPlacedCaseLifecycleBadge(submitted)).toBeNull()
    expect(matchesPolicyLifecycleFilter(submitted, 'current_in_force')).toBe(false)
    expect(matchesPolicyLifecycleFilter(submitted, 'all')).toBe(true)
  })

  it('presents Case Detail termination facts without actor ids', () => {
    const model = policyLifecycleDetailModel(
      item({
        id: 't',
        production_stage: 'in_force',
        linked_policies: [
          linked('canceled', {
            terminated_on: '2026-06-01',
            termination_reason: 'Client requested early termination',
          }),
        ],
      }),
    )
    expect(model.visible).toBe(true)
    expect(model.statusLabel).toBe('Canceled / Early Termination')
    expect(model.showTerminationFacts).toBe(true)
    expect(model.terminatedOn).toBe('2026-06-01')
    expect(model.terminationReason).toBe('Client requested early termination')
    expect(JSON.stringify(model)).not.toMatch(/changed_by|actor|user_id/i)
  })
})

describe('placement vs active protection isolation', () => {
  it('does not remove canceled or surrendered from placed counts or placement rates', () => {
    const rows = [
      item({
        id: 'active',
        production_stage: 'in_force',
        linked_policies: [linked('in_force')],
      }),
      item({
        id: 'canceled',
        production_stage: 'in_force',
        linked_policies: [linked('canceled')],
      }),
      item({
        id: 'surrendered',
        production_stage: 'in_force',
        linked_policies: [linked('surrendered')],
      }),
      item({
        id: 'pending',
        production_stage: 'in_underwriting',
        in_force_date: null,
        linked_policies: [],
      }),
    ]
    const funnel = computeProductionFunnel(rows).life
    expect(funnel.applied).toBe(4)
    expect(funnel.placed).toBe(3)
    expect(funnel.grossPlacementRate).toBe(3 / 4)
    expect(funnel.resolvedPlacementRate).toBe(1)
    expect(computePlacedLifeProtection(rows).inForceLifeCount).toBe(3)
    expect(computePlacedLifeProtection(rows).knownFaceCents).toBe(150000000)
  })

  it('counts only in_force linked policies as current active protection', () => {
    const rows = [
      item({
        id: 'active',
        production_stage: 'in_force',
        face_amount_cents: 100000,
        linked_policies: [linked('in_force')],
      }),
      item({
        id: 'canceled',
        production_stage: 'in_force',
        face_amount_cents: 200000,
        linked_policies: [linked('canceled')],
      }),
      item({
        id: 'surrendered',
        production_stage: 'in_force',
        face_amount_cents: 300000,
        linked_policies: [linked('surrendered')],
      }),
    ]
    const placed = computePlacedLifeProtection(rows)
    const active = computeCurrentActiveLifeProtection(rows)
    expect(placed.knownFaceCents).toBe(600000)
    expect(placed.inForceLifeCount).toBe(3)
    expect(active.knownFaceCents).toBe(100000)
    expect(active.inForceLifeCount).toBe(1)
  })

  it('does not subtract surrendered FIA deposits from historical submitted production', () => {
    const rows = [
      item({
        id: 'fia',
        production_stage: 'in_force',
        product_line: 'fia',
        face_amount_cents: 1,
        submitted_premium_cents: null,
        annuity_deposit_cents: 9321504,
        linked_policies: [linked('surrendered')],
      }),
    ]
    const funnel = computeProductionFunnel(rows)
    expect(funnel.fia.placed).toBe(1)
    expect(funnel.fia.applied).toBe(1)
    expect(computePlacedLifeProtection(rows).inForceLifeCount).toBe(0)
    expect(computeCurrentActiveLifeProtection(rows).inForceLifeCount).toBe(0)
  })
})

describe('household case remains closed after policy termination', () => {
  it('keeps a placed then surrendered application as a closed Case', () => {
    const surrendered = item({
      id: 'closed',
      production_stage: 'in_force',
      linked_policies: [linked('surrendered')],
    })
    expect(isOpenPolicyCase(surrendered)).toBe(false)
    expect(isClosedPolicyCase(surrendered)).toBe(true)
    expect(formatPlacedCaseLifecycleBadge(surrendered)).toBe('Placed · Surrendered')
  })
})
