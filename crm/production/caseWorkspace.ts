/**
 * Case Management Phase 1 — UI-only helpers over policy_applications.
 * A Case is a legitimate submitted application. No public.cases table.
 *
 * Closed stages reuse PRODUCTION_TERMINAL_STAGES (in_force, declined,
 * withdrawn, incomplete, not_taken). Pipeline stages reuse
 * DASHBOARD_PIPELINE_STAGES so Case views cannot drift from Current Case Pipeline.
 *
 * Case views filter the already-loaded production list (default cap 200).
 * They do not fetch a second store. Above 200 rows, Case views may undercount.
 */
import { isFiaProductionLine } from './dashboardView'
import {
  computeDaysInStage,
  getWritingAdvisorIds,
  isFollowUpOverdue,
  isFollowUpToday,
  isProductionTerminalStage,
  isStaleDaysInStage,
} from './daysInStage'
import { formatOverdueRequirementLabel } from './requirementView'
import {
  formatProductionDeliveryLabel,
  formatProductionDispositionLabel,
  formatProductionStageLabel,
} from './labels'
import { annualizeProductionPremium } from './premiumAnnualize'
import { formatCents, formatProductionDate } from './productionApi'
import {
  DASHBOARD_PIPELINE_STAGES,
  isDashboardPipelineStage,
  isLegitimateSubmittedApplication,
  pipelineStageLabel,
} from './productionMetrics'
import type { ProductionApplicationListItem, ProductionStage } from './types'
import { PRODUCTION_TERMINAL_STAGES } from './types'

/** Calendar-day window on updated_at / stage-history. No new persisted field. */
export const CASE_RECENTLY_UPDATED_DAYS = 7

export const CASE_WORKSPACE_VIEWS = [
  'open',
  'my_cases',
  'all_cases',
  'needs_attention',
  'underwriting',
  'approved_client',
  'delivery_funding',
  'recently_updated',
  'all_applications',
] as const

export type CaseWorkspaceView = (typeof CASE_WORKSPACE_VIEWS)[number]

export const DEFAULT_CASE_WORKSPACE_VIEW: CaseWorkspaceView = 'open'

export type CaseWorkspaceViewer = 'owner' | 'advisor'

export type CaseWorkspaceViewOptions = {
  writingAdvisorId?: string | null
}

/** Underwriting lens: dashboard pipeline prefix plus postponed (open, not a pipeline column). */
export const CASE_UNDERWRITING_STAGES = [
  'submitted',
  'paramed',
  'in_underwriting',
  'postponed',
] as const satisfies readonly ProductionStage[]

export const CASE_APPROVED_CLIENT_STAGES = [
  'approved',
  'sent_to_draft',
  'premium_drafted',
] as const satisfies readonly ProductionStage[]

const UNDERWRITING_SET = new Set<string>(CASE_UNDERWRITING_STAGES)
const APPROVED_CLIENT_SET = new Set<string>(CASE_APPROVED_CLIENT_STAGES)

export type CaseAttentionFlags = {
  overdueFollowUp: boolean
  followUpToday: boolean
  staleInStage: boolean
  issuedDeliveryIncomplete: boolean
  overdueRequirementCount: number
}

export function isOpenPolicyCase(item: {
  production_stage: string
  submission_date: string | null | undefined
  deleted_at?: string | null
}): boolean {
  if (!isLegitimateSubmittedApplication(item)) return false
  return !isProductionTerminalStage(item.production_stage)
}

export function isClosedPolicyCase(item: {
  production_stage: string
  submission_date: string | null | undefined
  deleted_at?: string | null
}): boolean {
  if (!isLegitimateSubmittedApplication(item)) return false
  return isProductionTerminalStage(item.production_stage)
}

export function countOpenPolicyCases(
  items: readonly {
    production_stage: string
    submission_date: string | null | undefined
    deleted_at?: string | null
  }[],
): number {
  let count = 0
  for (const item of items) {
    if (isOpenPolicyCase(item)) count += 1
  }
  return count
}

export function isCaseUnderwritingStage(stage: string): boolean {
  return UNDERWRITING_SET.has(stage)
}

export function isCaseApprovedClientStage(stage: string): boolean {
  return APPROVED_CLIENT_SET.has(stage)
}

export function isDeliveryCompleteOrNotRequired(status: string | null | undefined): boolean {
  return status === 'complete' || status === 'not_required'
}

export function isIssuedDeliveryIncomplete(item: {
  production_stage: string
  delivery_status: string
}): boolean {
  return item.production_stage === 'issued' && !isDeliveryCompleteOrNotRequired(item.delivery_status)
}

/** Issued FIA stays in Delivery/Funding until in_force. Life issued only while delivery incomplete. */
export function isCaseDeliveryFundingStage(item: {
  production_stage: string
  product_line: string
  delivery_status: string
}): boolean {
  if (item.production_stage !== 'issued') return false
  if (isFiaProductionLine(item.product_line)) return true
  return !isDeliveryCompleteOrNotRequired(item.delivery_status)
}

export function caseAttentionFlags(
  item: Pick<
    ProductionApplicationListItem,
    | 'production_stage'
    | 'delivery_status'
    | 'next_follow_up_date'
    | 'stage_history'
    | 'updated_at'
    | 'submission_date'
    | 'deleted_at'
    | 'overdue_requirement_count'
  >,
  now: Date = new Date(),
): CaseAttentionFlags {
  const { days } = computeDaysInStage({
    productionStage: item.production_stage,
    stageHistory: item.stage_history,
    updatedAt: item.updated_at,
    now,
  })
  return {
    overdueFollowUp: isFollowUpOverdue(item.next_follow_up_date, now),
    followUpToday: isFollowUpToday(item.next_follow_up_date, now),
    staleInStage: isStaleDaysInStage(days),
    issuedDeliveryIncomplete: isIssuedDeliveryIncomplete(item),
    overdueRequirementCount: caseHasOverdueRequirement(item)
      ? item.overdue_requirement_count ?? 0
      : 0,
  }
}

export function caseHasOverdueRequirement(item: {
  production_stage: string
  submission_date: string | null | undefined
  deleted_at?: string | null
  overdue_requirement_count?: number
}): boolean {
  if (!isOpenPolicyCase(item)) return false
  return (item.overdue_requirement_count ?? 0) > 0
}

export function caseNeedsAttention(
  item: Pick<
    ProductionApplicationListItem,
    | 'production_stage'
    | 'delivery_status'
    | 'next_follow_up_date'
    | 'stage_history'
    | 'updated_at'
    | 'submission_date'
    | 'deleted_at'
    | 'overdue_requirement_count'
  >,
  now: Date = new Date(),
): boolean {
  if (!isOpenPolicyCase(item)) return false
  const flags = caseAttentionFlags(item, now)
  return (
    flags.overdueFollowUp ||
    flags.staleInStage ||
    flags.issuedDeliveryIncomplete ||
    flags.overdueRequirementCount > 0
  )
}

export function isCaseRecentlyUpdated(
  item: Pick<ProductionApplicationListItem, 'updated_at' | 'stage_history'>,
  now: Date = new Date(),
): boolean {
  if (isWithinRecentWindow(item.updated_at, now)) return true
  for (const entry of item.stage_history) {
    if (isWithinRecentWindow(entry.changed_at, now)) return true
  }
  return false
}

export type CaseOperationalBucket =
  | 'underwriting'
  | 'approved_client'
  | 'delivery_funding'
  | 'open_other'
  | 'closed'
  | 'not_a_case'

export function caseOperationalBucket(
  item: Pick<
    ProductionApplicationListItem,
    'production_stage' | 'product_line' | 'delivery_status' | 'submission_date' | 'deleted_at'
  >,
): CaseOperationalBucket {
  if (isClosedPolicyCase(item)) return 'closed'
  if (!isOpenPolicyCase(item)) return 'not_a_case'
  if (isCaseUnderwritingStage(item.production_stage)) return 'underwriting'
  if (isCaseApprovedClientStage(item.production_stage)) return 'approved_client'
  if (isCaseDeliveryFundingStage(item)) return 'delivery_funding'
  return 'open_other'
}

export function isOperationalPolicyCase(item: {
  production_stage: string
  submission_date: string | null | undefined
  deleted_at?: string | null
}): boolean {
  return isLegitimateSubmittedApplication(item)
}

/**
 * Client-side writing-advisor match. Uses the same live allocation ids as the
 * Production writing-advisor filter. Does not grant access to rows RLS hid.
 */
export function isLoadedWritingAdvisorCase(
  item: Pick<ProductionApplicationListItem, 'allocations'>,
  writingAdvisorId: string | null | undefined,
): boolean {
  if (!writingAdvisorId) return false
  return getWritingAdvisorIds(item).includes(writingAdvisorId)
}

export function applyCaseWorkspaceView<
  T extends Pick<
    ProductionApplicationListItem,
    | 'production_stage'
    | 'product_line'
    | 'delivery_status'
    | 'submission_date'
    | 'deleted_at'
    | 'next_follow_up_date'
    | 'stage_history'
    | 'updated_at'
    | 'overdue_requirement_count'
    | 'allocations'
  >,
>(
  items: readonly T[],
  view: CaseWorkspaceView,
  now: Date = new Date(),
  options: CaseWorkspaceViewOptions = {},
): T[] {
  if (view === 'all_applications') return [...items]
  return items.filter((item) => matchesCaseWorkspaceView(item, view, now, options))
}

export function matchesCaseWorkspaceView(
  item: Pick<
    ProductionApplicationListItem,
    | 'production_stage'
    | 'product_line'
    | 'delivery_status'
    | 'submission_date'
    | 'deleted_at'
    | 'next_follow_up_date'
    | 'stage_history'
    | 'updated_at'
    | 'overdue_requirement_count'
    | 'allocations'
  >,
  view: CaseWorkspaceView,
  now: Date = new Date(),
  options: CaseWorkspaceViewOptions = {},
): boolean {
  if (view === 'all_applications') return true
  if (view === 'open') return isOpenPolicyCase(item)
  if (view === 'all_cases') return isOperationalPolicyCase(item)
  if (view === 'my_cases') {
    return isOperationalPolicyCase(item) && isLoadedWritingAdvisorCase(item, options.writingAdvisorId)
  }
  if (view === 'needs_attention') return caseNeedsAttention(item, now)
  if (view === 'underwriting') {
    return isOpenPolicyCase(item) && isCaseUnderwritingStage(item.production_stage)
  }
  if (view === 'approved_client') {
    return isOpenPolicyCase(item) && isCaseApprovedClientStage(item.production_stage)
  }
  if (view === 'delivery_funding') {
    return isOpenPolicyCase(item) && isCaseDeliveryFundingStage(item)
  }
  return isLegitimateSubmittedApplication(item) && isCaseRecentlyUpdated(item, now)
}

export function formatCaseProductLineLabel(line: string | null | undefined): string {
  if (line === 'life_term') return 'Term'
  if (line === 'life_permanent') return 'Permanent'
  if (line === 'fia') return 'Annuity / FIA'
  return line || '—'
}

/** Current-stage label aligned with Current Case Pipeline (Submitted, not Applied). */
export function formatCaseStageLabel(stage: string | null | undefined): string {
  if (!stage) return '—'
  if (isDashboardPipelineStage(stage)) return pipelineStageLabel(stage)
  return formatProductionStageLabel(stage)
}

export function formatCaseDeliveryStatusLabel(productLine: string): string {
  return isFiaProductionLine(productLine) ? 'Funding / issue status' : 'Delivery status'
}

export function formatCaseDeliveryBucketLabel(productLine: string): string {
  return isFiaProductionLine(productLine) ? 'Funding / Issue' : 'Delivery'
}

export function formatCaseAttentionLabels(
  flags: CaseAttentionFlags,
  productLine: string,
): string[] {
  const labels: string[] = []
  if (flags.overdueFollowUp) labels.push('Overdue follow-up')
  else if (flags.followUpToday) labels.push('Follow-up today')
  if (flags.staleInStage) labels.push('Stale in stage')
  if (flags.issuedDeliveryIncomplete) {
    labels.push(
      isFiaProductionLine(productLine)
        ? 'Issued — funding incomplete'
        : 'Issued — delivery incomplete',
    )
  }
  const overdueLabel = formatOverdueRequirementLabel(flags.overdueRequirementCount)
  if (overdueLabel) labels.push(overdueLabel)
  return labels
}

export function formatCaseAmount(item: Pick<
  ProductionApplicationListItem,
  'product_line' | 'submitted_premium_cents' | 'premium_mode' | 'annuity_deposit_cents' | 'face_amount_cents'
>): string {
  if (isFiaProductionLine(item.product_line)) {
    return item.annuity_deposit_cents == null
      ? 'Deposit —'
      : `Deposit ${formatCents(item.annuity_deposit_cents)}`
  }
  const annual = annualizeProductionPremium(item.submitted_premium_cents, item.premium_mode)
  const premium = `Annual premium ${formatCents(annual)}`
  if (item.face_amount_cents == null) return premium
  return `${premium} · Face ${formatCents(item.face_amount_cents)}`
}

export function caseWorkspaceViewerFromRole(
  role: string | null | undefined,
): CaseWorkspaceViewer {
  return role === 'owner' ? 'owner' : 'advisor'
}

export function caseWorkspaceViewLabel(
  view: CaseWorkspaceView,
  viewer: CaseWorkspaceViewer = 'advisor',
): string {
  if (view === 'open') return 'Open Cases'
  if (view === 'my_cases') return 'My Cases'
  if (view === 'all_cases') return viewer === 'owner' ? 'All Cases' : 'Visible Cases'
  if (view === 'all_applications') {
    return viewer === 'owner' ? 'All Applications' : 'Visible applications'
  }
  if (view === 'needs_attention') return 'Needs Attention'
  if (view === 'underwriting') return 'Underwriting'
  if (view === 'approved_client') return 'Approved / Client Action'
  if (view === 'delivery_funding') return 'Delivery / Funding'
  return 'Recently Updated'
}

export function caseListHeading(
  view: CaseWorkspaceView,
  viewer: CaseWorkspaceViewer = 'advisor',
): string {
  return caseWorkspaceViewLabel(view, viewer)
}

export function caseWorkspaceEmptyTitle(view: CaseWorkspaceView): string {
  if (view === 'my_cases') return 'No matching cases'
  if (view === 'open') return 'No open cases'
  if (view === 'all_cases') return 'No cases in the loaded records'
  if (view === 'all_applications') return 'No matching applications'
  return 'No matching cases'
}

export function myCasesMissingAdvisorCopy(): string {
  return 'My Cases uses current writing allocations for this login. This login has no writing-advisor profile, so the view is empty.'
}

export function myCasesEmptyCopy(): string {
  return 'No loaded cases list you as a current writing advisor. Applications you cannot already see stay hidden.'
}

export function caseWorkspaceFilteredEmptyCopy(
  view: CaseWorkspaceView,
  viewer: CaseWorkspaceViewer,
  options: {
    writingAdvisorId?: string | null
    search?: string
    hasActiveFilters?: boolean
  } = {},
): string {
  if (view === 'my_cases') {
    return options.writingAdvisorId ? myCasesEmptyCopy() : myCasesMissingAdvisorCopy()
  }
  if (options.hasActiveFilters) {
    const needle = options.search?.trim()
    if (needle) {
      return viewer === 'owner'
        ? `No applications match “${needle}” with the current filters.`
        : `No visible applications match “${needle}” with the current filters.`
    }
    return viewer === 'owner'
      ? 'No applications match the selected filters.'
      : 'No visible applications match the selected filters.'
  }
  if (view === 'all_cases') {
    return viewer === 'owner'
      ? 'No cases in the currently loaded production records.'
      : 'No visible cases in the currently loaded production records.'
  }
  if (view === 'all_applications') {
    return viewer === 'owner'
      ? 'No applications in the currently loaded production records.'
      : 'No visible applications in the currently loaded production records.'
  }
  return 'No matching cases in the currently loaded production records.'
}

/** Pin Case underwriting/approved/issued to the dashboard pipeline so labels cannot drift. */
export function casePipelineStagesMatchDashboard(): ProductionStage[] {
  return [
    ...CASE_UNDERWRITING_STAGES.filter((stage) => stage !== 'postponed'),
    ...CASE_APPROVED_CLIENT_STAGES,
    'issued',
  ]
}

export const DASHBOARD_PIPELINE_STAGE_LIST = DASHBOARD_PIPELINE_STAGES

export const CLOSED_POLICY_CASE_STAGES = PRODUCTION_TERMINAL_STAGES

export function formatCaseDisposition(value: string | null | undefined): string {
  return formatProductionDispositionLabel(value)
}

export function formatCaseDelivery(value: string | null | undefined): string {
  return formatProductionDeliveryLabel(value)
}

export function formatCaseFollowUp(value: string | null | undefined): string {
  return formatProductionDate(value)
}

function isWithinRecentWindow(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false
  const days = utcCalendarDaysSince(iso, now)
  return days != null && days >= 0 && days <= CASE_RECENTLY_UPDATED_DAYS
}

function utcCalendarDaysSince(iso: string, now: Date): number | null {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime()) || Number.isNaN(now.getTime())) return null
  const start = Date.UTC(then.getUTCFullYear(), then.getUTCMonth(), then.getUTCDate())
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.floor((end - start) / (24 * 60 * 60 * 1000))
}
