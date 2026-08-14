import { describe, expect, it } from 'vitest'
import {
  computeDaysInStage,
  getInsuredOrAnnuitantLabel,
  getWritingAdvisorLabel,
  isFollowUpOverdue,
  isProductionTerminalStage,
  isStaleDaysInStage,
} from './daysInStage'
import { PRODUCTION_STALE_DAYS_IN_STAGE } from './types'
import type { ProductionApplicationListItem, ProductionStageHistoryEntry } from './types'

function history(
  partial: Partial<ProductionStageHistoryEntry> &
    Pick<ProductionStageHistoryEntry, 'to_stage' | 'changed_at'>,
): ProductionStageHistoryEntry {
  return {
    id: partial.id ?? 'h1',
    from_stage: partial.from_stage ?? null,
    to_stage: partial.to_stage,
    from_disposition: null,
    to_disposition: null,
    from_delivery_status: null,
    to_delivery_status: null,
    reason: null,
    changed_by_user_id: null,
    changed_at: partial.changed_at,
  }
}

describe('days in stage', () => {
  it('uses the latest matching stage-history entry', () => {
    const result = computeDaysInStage({
      productionStage: 'in_underwriting',
      stageHistory: [
        history({ to_stage: 'submitted', changed_at: '2026-08-01T00:00:00.000Z' }),
        history({ to_stage: 'in_underwriting', changed_at: '2026-08-10T00:00:00.000Z' }),
        history({
          id: 'older',
          to_stage: 'in_underwriting',
          changed_at: '2026-08-05T00:00:00.000Z',
        }),
      ],
      updatedAt: '2026-08-01T00:00:00.000Z',
      now: new Date('2026-08-13T12:00:00.000Z'),
    })
    expect(result.source).toBe('stage_history')
    expect(result.days).toBe(3)
  })

  it('falls back to updated_at when history is missing for the current stage', () => {
    const result = computeDaysInStage({
      productionStage: 'draft',
      stageHistory: [],
      updatedAt: '2026-08-01T00:00:00.000Z',
      now: new Date('2026-08-11T00:00:00.000Z'),
    })
    expect(result.source).toBe('updated_at_fallback')
    expect(result.days).toBe(10)
  })

  it('marks 14+ days in stage without calling it a risk score', () => {
    expect(PRODUCTION_STALE_DAYS_IN_STAGE).toBe(14)
    expect(isStaleDaysInStage(13)).toBe(false)
    expect(isStaleDaysInStage(14)).toBe(true)
    expect(isProductionTerminalStage('in_force')).toBe(true)
    expect(isProductionTerminalStage('submitted')).toBe(false)
  })

  it('detects follow-up overdue on UTC calendar days', () => {
    expect(isFollowUpOverdue('2026-08-12', new Date('2026-08-13T15:00:00.000Z'))).toBe(true)
    expect(isFollowUpOverdue('2026-08-13', new Date('2026-08-13T15:00:00.000Z'))).toBe(false)
    expect(isFollowUpOverdue(null)).toBe(false)
  })

  it('handles null participant and allocation relationships', () => {
    const item = {
      product_line: 'life_term',
      participants: [],
      allocations: [],
    } as unknown as ProductionApplicationListItem
    expect(getInsuredOrAnnuitantLabel(item)).toBe('—')
    expect(getWritingAdvisorLabel(item)).toBe('—')
  })

  it('prefers annuitant for FIA and writing advisor display', () => {
    const item = {
      product_line: 'fia',
      participants: [
        {
          id: 'p1',
          role: 'annuitant',
          household_member_id: 'm1',
          effective_to: null,
          member: { id: 'm1', first_name: 'Ann', last_name: 'Nuity' },
        },
      ],
      allocations: [
        {
          id: 'a1',
          recipient_type: 'advisor',
          advisor_id: 'adv1',
          allocation_role: 'writing',
          commission_bps: 10000,
          production_credit_bps: 10000,
          effective_to: null,
          advisor: { id: 'adv1', display_name: 'Alex Advisor' },
        },
      ],
    } as unknown as ProductionApplicationListItem
    expect(getInsuredOrAnnuitantLabel(item)).toBe('Ann Nuity')
    expect(getWritingAdvisorLabel(item)).toBe('Alex Advisor')
  })
})
