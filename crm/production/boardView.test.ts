import { describe, expect, it } from 'vitest'
import { crmProductionPath } from '../../constants/routes'
import {
  BOARD_PIPELINE_COLUMNS,
  boardCoversEveryProductionStage,
  boardLaneForStage,
  defaultMobileBoardFocus,
  flattenBoardItems,
  getProductionBoardLayout,
  groupProductionBoardItems,
  mobileFocusHeading,
  mobileFocusItems,
} from './boardView'
import { applyProductionQueueView, defaultProductionQueueFilters } from './queueView'
import type { ProductionApplicationListItem } from './types'
import { PRODUCTION_STAGES } from './types'

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
    submitted_premium_cents: 10000,
    annuity_deposit_cents: null,
    face_amount_cents: 50000000,
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
    writing_receivable_expected: true,
    ...partial,
  }
}

describe('production board grouping', () => {
  it('covers every production stage exactly once across lanes', () => {
    expect(boardCoversEveryProductionStage()).toBe(true)
    expect(PRODUCTION_STAGES.map(boardLaneForStage)).toHaveLength(PRODUCTION_STAGES.length)
    expect(BOARD_PIPELINE_COLUMNS.map((column) => column.stage)).not.toContain('draft')
    expect(boardLaneForStage('draft')).toBe('intake')
    expect(boardLaneForStage('premium_drafted')).toBe('pipeline')
  })

  it('places one item per production stage exactly once', () => {
    const rows = PRODUCTION_STAGES.map((stage) => item({ id: stage, production_stage: stage }))
    const model = groupProductionBoardItems(rows)
    const flat = flattenBoardItems(model)
    expect(flat).toHaveLength(PRODUCTION_STAGES.length)
    expect(new Set(flat.map((row) => row.id)).size).toBe(PRODUCTION_STAGES.length)
    expect(model.pipeline.reduce((sum, column) => sum + column.items.length, 0)).toBe(8)
    expect(model.intakeCount).toBe(2)
    expect(model.exceptionCount).toBe(5)
  })

  it('maps submitted to Submitted and premium_drafted to Drafted, never draft under Drafted', () => {
    const model = groupProductionBoardItems([
      item({ id: 'applied', production_stage: 'submitted' }),
      item({ id: 'drafted', production_stage: 'premium_drafted' }),
      item({ id: 'app-draft', production_stage: 'draft' }),
    ])
    expect(model.pipeline.find((column) => column.label === 'Submitted')?.items.map((row) => row.id)).toEqual([
      'applied',
    ])
    expect(model.pipeline.find((column) => column.label === 'Drafted')?.items.map((row) => row.id)).toEqual([
      'drafted',
    ])
    expect(model.intake.find((column) => column.stage === 'draft')?.items.map((row) => row.id)).toEqual([
      'app-draft',
    ])
    expect(
      model.pipeline.find((column) => column.stage === 'premium_drafted')?.items.some((row) => row.id === 'app-draft'),
    ).toBe(false)
  })

  it('places pre_submitted in Intake and in_force in In Force', () => {
    const model = groupProductionBoardItems([
      item({ id: 'pre', production_stage: 'pre_submitted' }),
      item({ id: 'live', production_stage: 'in_force' }),
    ])
    expect(model.intake.find((column) => column.stage === 'pre_submitted')?.items.map((row) => row.id)).toEqual([
      'pre',
    ])
    expect(model.pipeline.find((column) => column.label === 'In Force')?.items.map((row) => row.id)).toEqual([
      'live',
    ])
  })

  it('moves canceled and surrendered placed policies off the active In Force column', () => {
    const model = groupProductionBoardItems([
      item({
        id: 'active',
        production_stage: 'in_force',
        linked_policies: [{ id: 'p1', policy_number: 'A', status: 'in_force', deleted_at: null }],
      }),
      item({
        id: 'canceled',
        production_stage: 'in_force',
        linked_policies: [{ id: 'p2', policy_number: 'B', status: 'canceled', deleted_at: null }],
      }),
      item({
        id: 'surrendered',
        production_stage: 'in_force',
        linked_policies: [{ id: 'p3', policy_number: 'C', status: 'surrendered', deleted_at: null }],
      }),
      item({
        id: 'issued-book',
        production_stage: 'in_force',
        linked_policies: [{ id: 'p4', policy_number: 'D', status: 'issued', deleted_at: null }],
      }),
    ])
    expect(model.pipeline.find((column) => column.stage === 'in_force')?.items.map((row) => row.id).sort()).toEqual(
      ['active', 'issued-book'],
    )
    const terminated = model.exceptions.find((column) => column.stage === 'terminated_placed')
    expect(terminated?.items.map((row) => row.id).sort()).toEqual(['canceled', 'surrendered'])
    expect(terminated?.items.every((row) => row.production_stage === 'in_force')).toBe(true)
    expect(flattenBoardItems(model)).toHaveLength(4)
  })

  it('places declined and postponed in Exceptions', () => {
    const model = groupProductionBoardItems([
      item({ id: 'dec', production_stage: 'declined' }),
      item({ id: 'post', production_stage: 'postponed' }),
    ])
    expect(model.exceptions.find((column) => column.stage === 'declined')?.items.map((row) => row.id)).toEqual([
      'dec',
    ])
    expect(model.exceptions.find((column) => column.stage === 'postponed')?.items.map((row) => row.id)).toEqual([
      'post',
    ])
  })

  it('places every loaded application exactly once, including two apps for one household', () => {
    const rows = [
      item({ id: 'a1', household_id: 'same', production_stage: 'submitted' }),
      item({ id: 'a2', household_id: 'same', production_stage: 'approved' }),
    ]
    const model = groupProductionBoardItems(rows)
    const flat = flattenBoardItems(model)
    expect(flat.map((row) => row.id).sort()).toEqual(['a1', 'a2'])
    expect(new Set(flat.map((row) => row.id)).size).toBe(2)
    expect(model.pipeline.find((column) => column.stage === 'submitted')?.items).toHaveLength(1)
    expect(model.pipeline.find((column) => column.stage === 'approved')?.items).toHaveLength(1)
  })

  it('uses the filtered working set for grouping and column counts', () => {
    const rows = [
      item({ id: 'tx', production_stage: 'approved', state: 'TX' }),
      item({ id: 'fl', production_stage: 'approved', state: 'FL' }),
      item({ id: 'uw', production_stage: 'in_underwriting', state: 'TX' }),
    ]
    const filtered = applyProductionQueueView(rows, {
      ...defaultProductionQueueFilters(),
      writtenState: 'TX',
    })
    const model = groupProductionBoardItems(filtered)
    expect(flattenBoardItems(model).map((row) => row.id).sort()).toEqual(['tx', 'uw'])
    expect(model.pipeline.find((column) => column.stage === 'approved')?.items).toHaveLength(1)
    expect(model.pipeline.find((column) => column.stage === 'in_underwriting')?.items).toHaveLength(1)
    expect(BOARD_PIPELINE_COLUMNS).toHaveLength(8)
  })

  it('focuses a filtered stage on stacked mobile and keeps Intake/Exceptions reachable', () => {
    const model = groupProductionBoardItems([
      item({ id: 'uw', production_stage: 'in_underwriting' }),
      item({ id: 'draft', production_stage: 'draft' }),
      item({ id: 'dec', production_stage: 'declined' }),
    ])
    expect(defaultMobileBoardFocus(model, ['in_underwriting'])).toEqual({
      kind: 'pipeline',
      stage: 'in_underwriting',
    })
    expect(defaultMobileBoardFocus(model, ['draft'])).toEqual({ kind: 'intake' })
    expect(defaultMobileBoardFocus(model, ['declined'])).toEqual({ kind: 'exceptions' })
    expect(mobileFocusHeading({ kind: 'intake' })).toBe('Intake / Application Drafts')
    expect(mobileFocusHeading({ kind: 'exceptions' })).toBe('Exceptions')
    expect(mobileFocusItems(model, { kind: 'intake' }).map((row) => row.id)).toEqual(['draft'])
    expect(mobileFocusItems(model, { kind: 'exceptions' }).map((row) => row.id)).toEqual(['dec'])
    expect(mobileFocusItems(model, { kind: 'pipeline', stage: 'in_underwriting' }).map((row) => row.id)).toEqual([
      'uw',
    ])
  })

  it('uses stacked layout on mobile and horizontal layout on tablet/desktop', () => {
    expect(getProductionBoardLayout(767)).toBe('stacked')
    expect(getProductionBoardLayout(768)).toBe('horizontal')
    expect(getProductionBoardLayout(1200)).toBe('horizontal')
  })

  it('keeps card identity as application id and detail path', () => {
    expect(crmProductionPath('app-99')).toBe('/crm/production/app-99')
  })
})
