import {
  PRODUCTION_STALE_DAYS_IN_STAGE,
  PRODUCTION_TERMINAL_STAGES,
  type ProductionApplicationListItem,
  type ProductionStage,
  type ProductionStageHistoryEntry,
  type ProductionTerminalStage,
} from './types'

const TERMINAL_SET = new Set<string>(PRODUCTION_TERMINAL_STAGES)

export function isProductionTerminalStage(stage: string | null | undefined): boolean {
  return stage != null && TERMINAL_SET.has(stage)
}

export function isProductionTerminalStageTyped(
  stage: ProductionStage,
): stage is ProductionTerminalStage {
  return TERMINAL_SET.has(stage)
}

/**
 * Days in the current production stage.
 * Prefer the latest stage-history row whose `to_stage` matches the current stage.
 * If no matching history exists, fall back to `updated_at` (clearly documented).
 */
export function computeDaysInStage(options: {
  productionStage: string
  stageHistory: readonly ProductionStageHistoryEntry[]
  updatedAt: string
  now?: Date
}): { days: number; source: 'stage_history' | 'updated_at_fallback' } {
  const now = options.now ?? new Date()
  const matching = options.stageHistory
    .filter((entry) => entry.to_stage === options.productionStage)
    .slice()
    .sort((a, b) => b.changed_at.localeCompare(a.changed_at))

  const anchorIso = matching[0]?.changed_at ?? options.updatedAt
  const source = matching[0] ? 'stage_history' : 'updated_at_fallback'
  const anchor = new Date(anchorIso)
  if (Number.isNaN(anchor.getTime()) || Number.isNaN(now.getTime())) {
    return { days: 0, source }
  }

  const ms = now.getTime() - anchor.getTime()
  const days = Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)))
  return { days, source }
}

/** Factual indicator: days in current stage ≥ PRODUCTION_STALE_DAYS_IN_STAGE. */
export function isStaleDaysInStage(daysInStage: number): boolean {
  return daysInStage >= PRODUCTION_STALE_DAYS_IN_STAGE
}

export function isFollowUpOverdue(
  nextFollowUpDate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!nextFollowUpDate) return false
  const followUp = parseDateOnlyUtc(nextFollowUpDate)
  if (!followUp) return false
  const today = startOfUtcDay(now)
  return followUp.getTime() < today.getTime()
}

function parseDateOnlyUtc(value: string): Date | null {
  // Accept YYYY-MM-DD or full ISO; compare on UTC calendar day.
  const day = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

export function getActiveLinkedPolicy(item: Pick<ProductionApplicationListItem, 'linked_policies'>) {
  return (
    item.linked_policies.find((policy) => policy.deleted_at == null) ??
    item.linked_policies[0] ??
    null
  )
}

export function getCurrentParticipants(
  participants: ProductionApplicationListItem['participants'],
) {
  return participants.filter((row) => row.effective_to == null)
}

export function getCurrentAllocations(allocations: ProductionApplicationListItem['allocations']) {
  return allocations.filter((row) => row.effective_to == null)
}

export function formatMemberDisplayName(member: {
  first_name: string | null
  last_name: string | null
} | null): string {
  if (!member) return '—'
  const name = [member.first_name, member.last_name].filter(Boolean).join(' ').trim()
  return name || '—'
}

/** Insured for life lines; annuitant for FIA; otherwise first useful participant. */
export function getInsuredOrAnnuitantLabel(item: ProductionApplicationListItem): string {
  const current = getCurrentParticipants(item.participants)
  const preferredRole = item.product_line === 'fia' ? 'annuitant' : 'insured'
  const preferred = current.find((row) => row.role === preferredRole)
  if (preferred) return formatMemberDisplayName(preferred.member)
  const fallback = current.find((row) => row.role === 'primary_client')
  return formatMemberDisplayName(fallback?.member ?? null)
}

export function getWritingAdvisorLabel(item: ProductionApplicationListItem): string {
  const writing = getCurrentAllocations(item.allocations).filter(
    (row) => row.allocation_role === 'writing' && row.recipient_type === 'advisor',
  )
  if (writing.length === 0) {
    const house = getCurrentAllocations(item.allocations).find(
      (row) => row.allocation_role === 'writing' && row.recipient_type === 'house',
    )
    return house ? 'House' : '—'
  }
  if (writing.length > 1) return 'Split'
  const name = writing[0]?.advisor?.display_name?.trim()
  return name || '—'
}

export function getWritingAdvisorIds(item: ProductionApplicationListItem): string[] {
  return getCurrentAllocations(item.allocations)
    .filter((row) => row.allocation_role === 'writing' && row.advisor_id)
    .map((row) => row.advisor_id as string)
}
