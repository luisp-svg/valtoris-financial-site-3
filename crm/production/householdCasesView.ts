import {
  formatCaseAmount,
  formatCaseAttentionLabels,
  formatCaseProductLineLabel,
  formatCaseStageLabel,
  isClosedPolicyCase,
  isOpenPolicyCase,
  caseAttentionFlags,
  caseNeedsAttention,
} from './caseWorkspace'
import {
  computeDaysInStage,
  getInsuredOrAnnuitantLabel,
  getWritingAdvisorLabel,
} from './daysInStage'
import { formatProductionDate } from './productionApi'
import { formatPlacedCaseLifecycleBadge } from './policyLifecycle'
import type { ProductionApplicationDetail, ProductionApplicationListItem } from './types'

export type HouseholdCaseRow = {
  id: string
  section: 'open' | 'closed'
  householdName: string
  insuredOrAnnuitant: string
  carrier: string
  product: string
  productLine: string
  applicationNumber: string | null
  policyNumber: string | null
  stage: string
  lifecycleBadge: string | null
  followUp: string
  submitted: string
  writingAdvisors: string
  amount: string
  attentionLabels: string[]
  daysInStage: number
  opportunityId: string | null
}

export function partitionHouseholdCases(
  applications: readonly ProductionApplicationListItem[],
  now: Date = new Date(),
): { open: HouseholdCaseRow[]; closed: HouseholdCaseRow[] } {
  const open: HouseholdCaseRow[] = []
  const closed: HouseholdCaseRow[] = []
  for (const application of applications) {
    const row = mapHouseholdCaseRow(application, now)
    if (!row) continue
    if (row.section === 'open') open.push(row)
    else closed.push(row)
  }
  return { open, closed }
}

export function mapHouseholdCaseRow(
  application: ProductionApplicationListItem | ProductionApplicationDetail,
  now: Date = new Date(),
): HouseholdCaseRow | null {
  const open = isOpenPolicyCase(application)
  const closed = isClosedPolicyCase(application)
  if (!open && !closed) return null
  const flags = caseAttentionFlags(application, now)
  const { days } = computeDaysInStage({
    productionStage: application.production_stage,
    stageHistory: application.stage_history,
    updatedAt: application.updated_at,
    now,
  })
  return {
    id: application.id,
    section: open ? 'open' : 'closed',
    householdName: application.household?.display_name?.trim() || 'Household',
    insuredOrAnnuitant: getInsuredOrAnnuitantLabel(application),
    carrier: application.carrier?.name?.trim() || '—',
    product: application.product?.name?.trim() || '—',
    productLine: formatCaseProductLineLabel(application.product_line),
    applicationNumber: application.application_number,
    policyNumber: application.policy_number,
    stage: formatCaseStageLabel(application.production_stage),
    lifecycleBadge: formatPlacedCaseLifecycleBadge(application),
    followUp: formatProductionDate(application.next_follow_up_date),
    submitted: formatProductionDate(application.submission_date),
    writingAdvisors: getWritingAdvisorLabel(application),
    amount: formatCaseAmount(application),
    attentionLabels: open && caseNeedsAttention(application, now)
      ? formatCaseAttentionLabels(flags, application.product_line)
      : [],
    daysInStage: days,
    opportunityId: application.opportunity_id ?? null,
  }
}
