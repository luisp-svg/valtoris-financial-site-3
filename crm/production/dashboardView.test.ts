import { describe, expect, it } from 'vitest'
import {
  aggregateActivePaidCommission,
  buildProductionDashboard,
  computeActiveLifeProtection,
  summarizeLifeAndAnnuity,
  type PaidCommissionListEvent,
} from './dashboardView'
import { defaultProductionQueueFilters, filterProductionQueueItems } from './queueView'
import type { ProductionApplicationListItem } from './types'

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
    application_number: null,
    policy_number: null,
    underwriting_disposition: 'pending',
    delivery_status: 'pre_issue',
    submission_date: '2026-06-15',
    next_follow_up_date: null,
    submitted_premium_cents: null,
    annuity_deposit_cents: null,
    face_amount_cents: null,
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

function paidEvent(
  partial: Partial<PaidCommissionListEvent> & Pick<PaidCommissionListEvent, 'id' | 'application_id'>,
): PaidCommissionListEvent {
  return {
    event_type: 'paid',
    amount_cents: 10000,
    reversed_event_id: null,
    ...partial,
  }
}

describe('production dashboard aggregation', () => {
  it('counts submitted under Applied and premium_drafted under Drafted', () => {
    const model = buildProductionDashboard([
      item({
        id: 'applied',
        production_stage: 'submitted',
        submitted_premium_cents: 428000,
      }),
      item({
        id: 'drafted',
        production_stage: 'premium_drafted',
        submitted_premium_cents: 100000,
      }),
      item({
        id: 'app-draft',
        production_stage: 'draft',
        submitted_premium_cents: 999999,
      }),
    ])
    expect(model.pipeline.submitted.caseCount).toBe(1)
    expect(model.pipeline.submitted.lifePremiumCents).toBe(428000)
    expect(model.pipeline.premium_drafted.caseCount).toBe(1)
    expect(model.pipeline.premium_drafted.lifePremiumCents).toBe(100000)
    expect(model.pipeline.paramed.caseCount).toBe(0)
  })

  it('keeps paramed separate from in underwriting', () => {
    const model = buildProductionDashboard([
      item({ id: 'p', production_stage: 'paramed', submitted_premium_cents: 50000 }),
      item({
        id: 'uw',
        production_stage: 'in_underwriting',
        submitted_premium_cents: 80000,
      }),
    ])
    expect(model.pipeline.paramed.caseCount).toBe(1)
    expect(model.pipeline.paramed.lifePremiumCents).toBe(50000)
    expect(model.pipeline.in_underwriting.caseCount).toBe(1)
    expect(model.pipeline.in_underwriting.lifePremiumCents).toBe(80000)
  })

  it('separates life premium from FIA deposits and never adds face to premium', () => {
    const rows = [
      item({
        id: 'life',
        production_stage: 'approved',
        product_line: 'life_permanent',
        submitted_premium_cents: 200000,
        annuity_deposit_cents: 99999999,
        face_amount_cents: 500000000,
      }),
      item({
        id: 'fia',
        production_stage: 'approved',
        product_line: 'fia',
        submitted_premium_cents: 888888,
        annuity_deposit_cents: 18072611,
        face_amount_cents: 1,
      }),
    ]
    const model = buildProductionDashboard(rows)
    expect(model.pipeline.approved.caseCount).toBe(2)
    expect(model.pipeline.approved.lifePremiumCents).toBe(200000)
    expect(model.pipeline.approved.annuityDepositCents).toBe(18072611)
    expect(summarizeLifeAndAnnuity(rows)).toEqual({
      lifePremiumCents: 200000,
      annuityDepositCents: 18072611,
    })
  })

  it('excludes NULL money from sums and does not treat missing values as stored zeros', () => {
    const model = buildProductionDashboard([
      item({
        id: 'known',
        production_stage: 'submitted',
        submitted_premium_cents: 1000,
      }),
      item({
        id: 'unknown',
        production_stage: 'submitted',
        submitted_premium_cents: null,
      }),
    ])
    expect(model.pipeline.submitted.caseCount).toBe(2)
    expect(model.pipeline.submitted.lifePremiumCents).toBe(1000)
  })

  it('computes Active Life Protection from in-force life only, excluding issued and NULL face from dollars', () => {
    const rows = [
      item({
        id: 'in-force-known',
        production_stage: 'in_force',
        product_line: 'life_permanent',
        face_amount_cents: 1247609400,
      }),
      item({
        id: 'in-force-null',
        production_stage: 'in_force',
        product_line: 'life_term',
        face_amount_cents: null,
      }),
      item({
        id: 'issued-life',
        production_stage: 'issued',
        product_line: 'life_term',
        face_amount_cents: 999999999,
      }),
      item({
        id: 'approved-life',
        production_stage: 'approved',
        product_line: 'life_term',
        face_amount_cents: 888888888,
      }),
      item({
        id: 'fia-in-force',
        production_stage: 'in_force',
        product_line: 'fia',
        face_amount_cents: 777777777,
        annuity_deposit_cents: 100,
      }),
    ]
    const protection = computeActiveLifeProtection(rows)
    expect(protection.knownFaceCents).toBe(1247609400)
    expect(protection.unknownFaceCount).toBe(1)
    expect(protection.inForceLifeCount).toBe(2)
    expect(buildProductionDashboard(rows).protection).toEqual(protection)
    expect(buildProductionDashboard(rows).pipeline.approved.caseCount).toBe(1)
    expect(buildProductionDashboard(rows).pipeline.submitted.caseCount).toBe(0)
  })

  it('counts commission paid from active paid events and excludes reversals', () => {
    const events: PaidCommissionListEvent[] = [
      paidEvent({ id: 'p1', application_id: 'a1', amount_cents: 25000 }),
      paidEvent({ id: 'p2', application_id: 'a2', amount_cents: 40000 }),
      paidEvent({
        id: 'rev',
        application_id: 'a2',
        event_type: 'reversal',
        amount_cents: -40000,
        reversed_event_id: 'p2',
      }),
    ]
    const visible = new Set(['a1', 'a2', 'a3'])
    expect(aggregateActivePaidCommission(events, visible)).toEqual({
      applicationCount: 1,
      paidCents: 25000,
    })
    expect(aggregateActivePaidCommission([], visible)).toEqual({
      applicationCount: 0,
      paidCents: 0,
    })
  })

  it('scopes Paid and pipeline KPIs to the same filtered working set', () => {
    const rows = [
      item({
        id: 'jazmin-tx',
        production_stage: 'in_underwriting',
        state: 'TX',
        submitted_premium_cents: 50000,
        allocations: [
          {
            id: 'al1',
            recipient_type: 'advisor',
            advisor_id: 'jazmin',
            allocation_role: 'writing',
            commission_bps: 10000,
            production_credit_bps: 10000,
            effective_to: null,
            advisor: { id: 'jazmin', display_name: 'Jazmin Perez' },
          },
        ],
      }),
      item({
        id: 'other-fl',
        production_stage: 'in_underwriting',
        state: 'FL',
        submitted_premium_cents: 90000,
        allocations: [
          {
            id: 'al2',
            recipient_type: 'advisor',
            advisor_id: 'other',
            allocation_role: 'writing',
            commission_bps: 10000,
            production_credit_bps: 10000,
            effective_to: null,
            advisor: { id: 'other', display_name: 'Other' },
          },
        ],
      }),
    ]
    const filtered = filterProductionQueueItems(rows, {
      ...defaultProductionQueueFilters(),
      writingAdvisorId: 'jazmin',
      writtenState: 'TX',
    })
    const model = buildProductionDashboard(filtered, [
      paidEvent({ id: 'pay-j', application_id: 'jazmin-tx', amount_cents: 1200 }),
      paidEvent({ id: 'pay-o', application_id: 'other-fl', amount_cents: 8800 }),
    ])
    expect(filtered.map((row) => row.id)).toEqual(['jazmin-tx'])
    expect(model.pipeline.in_underwriting.caseCount).toBe(1)
    expect(model.pipeline.in_underwriting.lifePremiumCents).toBe(50000)
    expect(model.commissionPaid).toEqual({ applicationCount: 1, paidCents: 1200 })
  })
})
