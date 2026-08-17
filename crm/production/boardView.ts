/**
 * Phase B Production board — pure grouping of the already-filtered working set.
 * Does not fetch, mutate stages, or read compensation.
 */
import type { ProductionApplicationListItem, ProductionStage } from './types'
import { PRODUCTION_STAGES } from './types'

export const BOARD_PIPELINE_COLUMNS = [
  { stage: 'submitted', label: 'Applied' },
  { stage: 'paramed', label: 'Paramed' },
  { stage: 'in_underwriting', label: 'In Underwriting' },
  { stage: 'approved', label: 'Approved' },
  { stage: 'sent_to_draft', label: 'Sent to Draft' },
  { stage: 'premium_drafted', label: 'Drafted' },
  { stage: 'issued', label: 'Issued' },
  { stage: 'in_force', label: 'In Force' },
] as const satisfies ReadonlyArray<{ stage: ProductionStage; label: string }>

export const BOARD_INTAKE_COLUMNS = [
  { stage: 'draft', label: 'Application Draft' },
  { stage: 'pre_submitted', label: 'Pre-submitted' },
] as const satisfies ReadonlyArray<{ stage: ProductionStage; label: string }>

export const BOARD_EXCEPTION_COLUMNS = [
  { stage: 'declined', label: 'Declined' },
  { stage: 'postponed', label: 'Postponed' },
  { stage: 'withdrawn', label: 'Withdrawn' },
  { stage: 'incomplete', label: 'Incomplete' },
  { stage: 'not_taken', label: 'Not Taken' },
] as const satisfies ReadonlyArray<{ stage: ProductionStage; label: string }>

export type BoardPipelineStage = (typeof BOARD_PIPELINE_COLUMNS)[number]['stage']

export type ProductionBoardColumn = {
  stage: ProductionStage
  label: string
  items: ProductionApplicationListItem[]
}

export type ProductionBoardModel = {
  pipeline: ProductionBoardColumn[]
  intake: ProductionBoardColumn[]
  exceptions: ProductionBoardColumn[]
  intakeCount: number
  exceptionCount: number
}

export type MobileBoardFocus =
  | { kind: 'pipeline'; stage: BoardPipelineStage }
  | { kind: 'intake' }
  | { kind: 'exceptions' }

export type ProductionBoardLayout = 'horizontal' | 'stacked'

export const PRODUCTION_BOARD_STACKED_MAX_WIDTH = 767

const PIPELINE_STAGE_SET = new Set<string>(BOARD_PIPELINE_COLUMNS.map((column) => column.stage))
const INTAKE_STAGE_SET = new Set<string>(BOARD_INTAKE_COLUMNS.map((column) => column.stage))

export function getProductionBoardLayout(viewportWidth: number): ProductionBoardLayout {
  return viewportWidth <= PRODUCTION_BOARD_STACKED_MAX_WIDTH ? 'stacked' : 'horizontal'
}

export function isBoardPipelineStage(stage: string): stage is BoardPipelineStage {
  return PIPELINE_STAGE_SET.has(stage)
}

export function boardLaneForStage(stage: string): 'pipeline' | 'intake' | 'exceptions' {
  if (INTAKE_STAGE_SET.has(stage)) return 'intake'
  if (PIPELINE_STAGE_SET.has(stage)) return 'pipeline'
  return 'exceptions'
}

export function boardColumnLabel(stage: ProductionStage | string): string {
  const match = [...BOARD_PIPELINE_COLUMNS, ...BOARD_INTAKE_COLUMNS, ...BOARD_EXCEPTION_COLUMNS].find(
    (column) => column.stage === stage,
  )
  return match?.label ?? stage
}

function emptyColumns(
  defs: ReadonlyArray<{ stage: ProductionStage; label: string }>,
): ProductionBoardColumn[] {
  return defs.map((column) => ({ stage: column.stage, label: column.label, items: [] }))
}

function columnIndex(columns: ProductionBoardColumn[], stage: string): number {
  return columns.findIndex((column) => column.stage === stage)
}

/**
 * Groups the filtered working set into board columns.
 * Application draft (`draft`) is never placed under premium Drafted.
 * Every input row appears in exactly one column.
 */
export function groupProductionBoardItems(
  items: readonly ProductionApplicationListItem[],
): ProductionBoardModel {
  const pipeline = emptyColumns(BOARD_PIPELINE_COLUMNS)
  const intake = emptyColumns(BOARD_INTAKE_COLUMNS)
  const exceptions = emptyColumns(BOARD_EXCEPTION_COLUMNS)

  for (const item of items) {
    const lane = boardLaneForStage(item.production_stage)
    const target = lane === 'pipeline' ? pipeline : lane === 'intake' ? intake : exceptions
    const index = columnIndex(target, item.production_stage)
    if (index >= 0) {
      target[index].items.push(item)
    } else {
      exceptions[0]?.items.push(item)
    }
  }

  return {
    pipeline,
    intake,
    exceptions,
    intakeCount: intake.reduce((sum, column) => sum + column.items.length, 0),
    exceptionCount: exceptions.reduce((sum, column) => sum + column.items.length, 0),
  }
}

export function flattenBoardItems(model: ProductionBoardModel): ProductionApplicationListItem[] {
  return [
    ...model.pipeline.flatMap((column) => column.items),
    ...model.intake.flatMap((column) => column.items),
    ...model.exceptions.flatMap((column) => column.items),
  ]
}

export function boardCoversEveryProductionStage(): boolean {
  const covered = new Set<string>([
    ...BOARD_PIPELINE_COLUMNS.map((column) => column.stage),
    ...BOARD_INTAKE_COLUMNS.map((column) => column.stage),
    ...BOARD_EXCEPTION_COLUMNS.map((column) => column.stage),
  ])
  return PRODUCTION_STAGES.every((stage) => covered.has(stage)) && covered.size === PRODUCTION_STAGES.length
}

export function defaultMobileBoardFocus(
  model: ProductionBoardModel,
  stageFilter: ProductionStage[] | 'all' = 'all',
): MobileBoardFocus {
  if (stageFilter !== 'all' && stageFilter.length === 1) {
    const stage = stageFilter[0]
    if (isBoardPipelineStage(stage)) return { kind: 'pipeline', stage }
    if (INTAKE_STAGE_SET.has(stage)) return { kind: 'intake' }
    return { kind: 'exceptions' }
  }

  const populated = model.pipeline.find((column) => column.items.length > 0)
  if (populated && isBoardPipelineStage(populated.stage)) {
    return { kind: 'pipeline', stage: populated.stage }
  }
  if (model.intakeCount > 0) return { kind: 'intake' }
  if (model.exceptionCount > 0) return { kind: 'exceptions' }
  return { kind: 'pipeline', stage: 'submitted' }
}

export function mobileFocusItems(
  model: ProductionBoardModel,
  focus: MobileBoardFocus,
): ProductionApplicationListItem[] {
  if (focus.kind === 'intake') return model.intake.flatMap((column) => column.items)
  if (focus.kind === 'exceptions') return model.exceptions.flatMap((column) => column.items)
  return model.pipeline.find((column) => column.stage === focus.stage)?.items ?? []
}

export function mobileFocusHeading(focus: MobileBoardFocus): string {
  if (focus.kind === 'intake') return 'Intake / Application Drafts'
  if (focus.kind === 'exceptions') return 'Exceptions'
  return boardColumnLabel(focus.stage)
}
