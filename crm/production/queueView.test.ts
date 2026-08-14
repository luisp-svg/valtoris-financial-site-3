import { describe, expect, it } from 'vitest'
import {
  applyProductionQueueView,
  defaultProductionQueueFilters,
  filterProductionQueueItems,
  sortProductionQueueItems,
} from './queueView'
import type { ProductionApplicationListItem } from './types'

function item(
  partial: Partial<ProductionApplicationListItem> &
    Pick<ProductionApplicationListItem, 'id' | 'production_stage' | 'updated_at'>,
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
    submission_date: null,
    next_follow_up_date: null,
    deleted_at: null,
    household: { id: 'hh1', display_name: 'Rivera Household' },
    carrier: { id: 'c1', name: 'Acme Life', code: 'ACME' },
    product: { id: 'p1', name: 'Term 20', product_line: 'life_term' },
    participants: [],
    allocations: [],
    stage_history: [],
    linked_policies: [],
    ...partial,
  }
}

describe('production queue view', () => {
  it('sorts active first, then follow-up ascending null last, then updated_at desc', () => {
    const sorted = sortProductionQueueItems([
      item({
        id: 'terminal',
        production_stage: 'in_force',
        next_follow_up_date: '2026-08-01',
        updated_at: '2026-08-20T00:00:00.000Z',
      }),
      item({
        id: 'null-follow',
        production_stage: 'submitted',
        next_follow_up_date: null,
        updated_at: '2026-08-19T00:00:00.000Z',
      }),
      item({
        id: 'soon',
        production_stage: 'in_underwriting',
        next_follow_up_date: '2026-08-05',
        updated_at: '2026-08-10T00:00:00.000Z',
      }),
      item({
        id: 'later-follow-newer',
        production_stage: 'submitted',
        next_follow_up_date: '2026-08-05',
        updated_at: '2026-08-18T00:00:00.000Z',
      }),
    ])

    expect(sorted.map((row) => row.id)).toEqual([
      'later-follow-newer',
      'soon',
      'null-follow',
      'terminal',
    ])
  })

  it('searches household, numbers, carrier, and product', () => {
    const rows = [
      item({
        id: '1',
        production_stage: 'draft',
        updated_at: '2026-08-01T00:00:00.000Z',
        application_number: 'APP-100',
        linked_policies: [
          { id: 'pol1', policy_number: 'POL-999', status: 'in_force', deleted_at: null },
        ],
      }),
      item({
        id: '2',
        production_stage: 'draft',
        updated_at: '2026-08-01T00:00:00.000Z',
        household: { id: 'hh2', display_name: 'Other Home' },
        carrier: { id: 'c2', name: 'Other Carrier', code: 'OTH' },
        product: { id: 'p2', name: 'Other Product', product_line: 'fia' },
        product_line: 'fia',
      }),
    ]

    const filters = {
      ...defaultProductionQueueFilters(),
      search: 'pol-999',
    }
    expect(filterProductionQueueItems(rows, filters).map((r) => r.id)).toEqual(['1'])
    expect(
      filterProductionQueueItems(rows, { ...filters, search: 'acme' }).map((r) => r.id),
    ).toEqual(['1'])
    expect(
      filterProductionQueueItems(rows, { ...filters, search: 'term 20' }).map((r) => r.id),
    ).toEqual(['1'])
  })

  it('filters stage, product line, carrier, writing advisor, overdue, and 14+ days', () => {
    const now = new Date('2026-08-20T00:00:00.000Z')
    const rows = [
      item({
        id: 'match',
        production_stage: 'in_underwriting',
        updated_at: '2026-08-01T00:00:00.000Z',
        next_follow_up_date: '2026-08-01',
        stage_history: [
          {
            id: 'h1',
            from_stage: 'submitted',
            to_stage: 'in_underwriting',
            from_disposition: null,
            to_disposition: null,
            from_delivery_status: null,
            to_delivery_status: null,
            reason: null,
            changed_by_user_id: null,
            changed_at: '2026-08-01T00:00:00.000Z',
          },
        ],
        allocations: [
          {
            id: 'a1',
            recipient_type: 'advisor',
            advisor_id: 'adv-1',
            allocation_role: 'writing',
            commission_bps: 10000,
            production_credit_bps: 10000,
            effective_to: null,
            advisor: { id: 'adv-1', display_name: 'A' },
          },
        ],
      }),
      item({
        id: 'other',
        production_stage: 'draft',
        updated_at: '2026-08-19T00:00:00.000Z',
        next_follow_up_date: '2026-08-25',
        product_line: 'fia',
        carrier_id: 'c-other',
      }),
    ]

    const filtered = applyProductionQueueView(
      rows,
      {
        ...defaultProductionQueueFilters(),
        stages: ['in_underwriting'],
        productLine: 'life_term',
        carrierId: 'c1',
        writingAdvisorId: 'adv-1',
        followUpOverdueOnly: true,
        staleOnly: true,
      },
      now,
    )
    expect(filtered.map((r) => r.id)).toEqual(['match'])
  })

  it('excludes soft-deleted rows from the default queue', () => {
    const rows = [
      item({
        id: 'live',
        production_stage: 'draft',
        updated_at: '2026-08-01T00:00:00.000Z',
      }),
      item({
        id: 'gone',
        production_stage: 'draft',
        updated_at: '2026-08-02T00:00:00.000Z',
        deleted_at: '2026-08-03T00:00:00.000Z',
      }),
    ]
    expect(
      filterProductionQueueItems(rows, defaultProductionQueueFilters()).map((r) => r.id),
    ).toEqual(['live'])
  })
})
