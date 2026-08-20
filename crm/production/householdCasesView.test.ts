import { describe, expect, it } from 'vitest'
import { mapHouseholdCaseRow, partitionHouseholdCases } from './householdCasesView'
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
    application_number: 'A-100',
    policy_number: null,
    underwriting_disposition: 'pending',
    delivery_status: 'pre_issue',
    submission_date: '2026-06-15',
    next_follow_up_date: '2026-08-21',
    submitted_premium_cents: 5000,
    annuity_deposit_cents: null,
    face_amount_cents: 10000000,
    premium_mode: 'monthly',
    issue_date: null,
    in_force_date: null,
    updated_at: '2026-08-18T00:00:00.000Z',
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

describe('household Cases tab mapping', () => {
  const now = new Date('2026-08-20T12:00:00.000Z')

  it('separates open and closed legitimate cases and skips drafts', () => {
    const { open, closed } = partitionHouseholdCases(
      [
        item({ id: 'open', production_stage: 'issued' }),
        item({ id: 'closed', production_stage: 'withdrawn' }),
        item({ id: 'draft', production_stage: 'draft' }),
      ],
      now,
    )
    expect(open.map((row) => row.id)).toEqual(['open'])
    expect(closed.map((row) => row.id)).toEqual(['closed'])
  })

  it('uses operational stage and Life/FIA amounts without commission fields', () => {
    const row = mapHouseholdCaseRow(
      item({
        id: 'open',
        production_stage: 'submitted',
      }),
      now,
    )
    expect(row?.stage).toBe('Submitted')
    expect(row?.productLine).toBe('Term')
    expect(row?.amount).toContain('Annual premium')
    expect(row?.amount).not.toMatch(/expected|commission/i)
    expect(JSON.stringify(row)).not.toContain('expected_compensation')
  })

  it('surfaces overdue requirement flags only on the matching open Case row', () => {
    const { open, closed } = partitionHouseholdCases(
      [
        item({
          id: 'overdue',
          production_stage: 'submitted',
          overdue_requirement_count: 1,
        }),
        item({
          id: 'clear',
          production_stage: 'approved',
          overdue_requirement_count: 0,
        }),
        item({
          id: 'closed-overdue',
          production_stage: 'withdrawn',
          overdue_requirement_count: 3,
        }),
      ],
      now,
    )
    expect(open.find((row) => row.id === 'overdue')?.attentionLabels).toEqual(['Overdue requirement'])
    expect(open.find((row) => row.id === 'clear')?.attentionLabels).toEqual([])
    expect(closed.find((row) => row.id === 'closed-overdue')?.attentionLabels).toEqual([])
    expect(JSON.stringify(open)).not.toMatch(/custom_label|paramed_exam|aps|diagnosis/i)
  })
})
