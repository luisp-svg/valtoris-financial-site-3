/** P1B-1 Production queue + read-only detail types (Migration 032 read models). */

export const PRODUCTION_PRODUCT_LINES = ['life_term', 'life_permanent', 'fia'] as const
export type ProductionProductLine = (typeof PRODUCTION_PRODUCT_LINES)[number]

export const PRODUCTION_STAGES = [
  'draft',
  'pre_submitted',
  'submitted',
  'paramed',
  'in_underwriting',
  'approved',
  'sent_to_draft',
  'premium_drafted',
  'declined',
  'postponed',
  'withdrawn',
  'incomplete',
  'not_taken',
  'issued',
  'in_force',
] as const
export type ProductionStage = (typeof PRODUCTION_STAGES)[number]

/** Stages with no outgoing edges in Migration 032. */
export const PRODUCTION_TERMINAL_STAGES = [
  'declined',
  'withdrawn',
  'incomplete',
  'not_taken',
  'in_force',
] as const satisfies readonly ProductionStage[]

export type ProductionTerminalStage = (typeof PRODUCTION_TERMINAL_STAGES)[number]

export const PRODUCTION_DISPOSITIONS = [
  'pending',
  'approved_as_applied',
  'approved_other_than_applied',
  'approved_with_amendment',
  'declined',
  'postponed',
] as const
export type ProductionDisposition = (typeof PRODUCTION_DISPOSITIONS)[number]

export const PRODUCTION_DELIVERY_STATUSES = [
  'pre_issue',
  'not_started',
  'with_agent',
  'with_client',
  'requirements_pending',
  'complete',
  'not_required',
] as const
export type ProductionDeliveryStatus = (typeof PRODUCTION_DELIVERY_STATUSES)[number]

export const PRODUCTION_PARTICIPANT_ROLES = [
  'primary_client',
  'insured',
  'owner',
  'joint_owner',
  'annuitant',
  'payor',
] as const
export type ProductionParticipantRole = (typeof PRODUCTION_PARTICIPANT_ROLES)[number]

export const PRODUCTION_ALLOCATION_ROLES = ['writing', 'servicing'] as const
export type ProductionAllocationRole = (typeof PRODUCTION_ALLOCATION_ROLES)[number]

export const PRODUCTION_RECIPIENT_TYPES = ['advisor', 'house'] as const
export type ProductionRecipientType = (typeof PRODUCTION_RECIPIENT_TYPES)[number]

export const PRODUCTION_PREMIUM_MODES = [
  'monthly',
  'quarterly',
  'semi_annual',
  'annual',
  'single',
  'other',
] as const
export type ProductionPremiumMode = (typeof PRODUCTION_PREMIUM_MODES)[number]

/** Stages new-business entry may target. Catch-up cannot skip submitted. */
export const PRODUCTION_ENTRY_STAGES = ['draft', 'submitted', 'in_underwriting'] as const
export type ProductionEntryStage = (typeof PRODUCTION_ENTRY_STAGES)[number]

export const PRODUCTION_ENTRY_MODES = ['new_business', 'existing_business'] as const
export type ProductionEntryMode = (typeof PRODUCTION_ENTRY_MODES)[number]

/**
 * 037 operational stages now in the backend enum.
 * `draft` remains application draft, not premium drafted.
 * Not added to PRODUCTION_ENTRY_STAGES — new-application UI does not target them yet.
 */
export const PROPOSED_PRODUCTION_STAGES = ['paramed', 'sent_to_draft', 'premium_drafted'] as const
export type ProposedProductionStage = (typeof PROPOSED_PRODUCTION_STAGES)[number]

export const PRODUCTION_ENTRY_WRITING_BPS_TOTAL = 10000

export type ProductionHouseholdOption = {
  id: string
  display_name: string
}

export type ProductionMemberOption = {
  id: string
  first_name: string | null
  last_name: string | null
  is_primary_contact: boolean
}

export type ProductionEntryProductOption = {
  id: string
  carrier_id: string
  name: string
  product_line: ProductionProductLine
}

export type ProductionParticipantDraft = {
  household_member_id: string
  role: ProductionParticipantRole
}

export type ProductionAllocationDraft = {
  recipient_type: 'advisor'
  advisor_id: string
  allocation_role: 'writing'
  commission_bps: number
  production_credit_bps: number
}

/** Named UI constant — factual stale indicator, not a risk/priority score. */
export const PRODUCTION_STALE_DAYS_IN_STAGE = 14

export type ProductionHouseholdSummary = {
  id: string
  display_name: string | null
}

export type ProductionCarrierSummary = {
  id: string
  name: string
  code: string
}

export type ProductionProductSummary = {
  id: string
  name: string
  product_line: ProductionProductLine
}

export type ProductionAdvisorSummary = {
  id: string
  display_name: string | null
}

export type ProductionMemberSummary = {
  id: string
  first_name: string | null
  last_name: string | null
}

export type ProductionParticipant = {
  id: string
  role: ProductionParticipantRole
  household_member_id: string
  effective_to: string | null
  member: ProductionMemberSummary | null
}

export type ProductionAllocation = {
  id: string
  recipient_type: ProductionRecipientType
  advisor_id: string | null
  allocation_role: ProductionAllocationRole
  commission_bps: number
  production_credit_bps: number
  effective_to: string | null
  advisor: ProductionAdvisorSummary | null
}

export type ProductionStageHistoryEntry = {
  id: string
  from_stage: ProductionStage | null
  to_stage: ProductionStage
  from_disposition: ProductionDisposition | null
  to_disposition: ProductionDisposition | null
  from_delivery_status: ProductionDeliveryStatus | null
  to_delivery_status: ProductionDeliveryStatus | null
  reason: string | null
  changed_by_user_id: string | null
  changed_at: string
}

export type ProductionLinkedPolicy = {
  id: string
  policy_number: string | null
  status: string | null
  deleted_at: string | null
}

export const EXPECTED_CALCULATION_STATUSES = [
  'resolved',
  'review_required',
  'unavailable',
] as const
export type ExpectedCalculationStatus = (typeof EXPECTED_CALCULATION_STATUSES)[number]

export const WRITING_CONTRACT_LEVELS = ['FA', 'SFA', 'SM', 'ED'] as const
export type WritingContractLevel = (typeof WRITING_CONTRACT_LEVELS)[number]

export const EXPECTED_REVIEW_REASONS = [
  'missing_writing_contract_level',
  'missing_lookup_date',
  'missing_compensation_base',
  'premium_mode_not_annualizable',
  'no_rate_card',
  'no_rate_card_for_lookup_date',
  'age_sensitive_rate_card',
] as const
export type ExpectedReviewReason = (typeof EXPECTED_REVIEW_REASONS)[number]

/** Live (non-superseded) expected-compensation row visible to the current viewer. */
export type LiveExpectedCompensationRow = {
  id: string
  application_id: string
  allocation_id: string
  advisor_id: string
  advisor_display_name: string | null
  writing_contract_level: WritingContractLevel | null
  writing_rate: string | null
  compensation_base_cents: number | null
  commission_bps: number | null
  expected_compensation_cents: number | null
  calculation_status: ExpectedCalculationStatus
  review_reason: ExpectedReviewReason | null
  calculated_at: string
}

export type CompensationViewer = 'owner' | 'advisor'

export type ProductionApplicationListItem = {
  id: string
  household_id: string
  carrier_id: string
  product_id: string
  product_line: ProductionProductLine
  state: string
  application_number: string | null
  policy_number: string | null
  production_stage: ProductionStage
  underwriting_disposition: ProductionDisposition
  delivery_status: ProductionDeliveryStatus
  submission_date: string | null
  next_follow_up_date: string | null
  updated_at: string
  deleted_at: string | null
  household: ProductionHouseholdSummary | null
  carrier: ProductionCarrierSummary | null
  product: ProductionProductSummary | null
  participants: ProductionParticipant[]
  allocations: ProductionAllocation[]
  stage_history: ProductionStageHistoryEntry[]
  linked_policies: ProductionLinkedPolicy[]
  /** Live 034 rows visible under RLS. Never a second-writer leak for advisors. */
  expected_compensations: LiveExpectedCompensationRow[]
}

export type ProductionApplicationDetail = ProductionApplicationListItem & {
  opportunity_id: string | null
  is_replacement: boolean
  is_exchange_or_transfer: boolean
  face_amount_cents: number | null
  annuity_deposit_cents: number | null
  premium_mode: string | null
  submitted_premium_cents: number | null
  target_premium_cents: number | null
  total_points_scaled: number | null
  decision_date: string | null
  issue_date: string | null
  in_force_date: string | null
  production_month: string | null
  notes: string | null
  created_at: string
  created_by_user_id: string | null
}

export type ProductionQueueFilters = {
  search: string
  stages: ProductionStage[] | 'all'
  productLine: ProductionProductLine | 'all'
  carrierId: string | 'all'
  writingAdvisorId: string | 'all'
  followUpOverdueOnly: boolean
  staleOnly: boolean
  /** When false (default), soft-deleted rows are excluded from the queue. */
  includeDeleted: boolean
}

export type ProductionAdvisorOption = {
  id: string
  display_name: string
  /** Present when loaded for application entry; used only as a licensing warning. */
  states_licensed?: string[]
}

export type ProductionCarrierOption = {
  id: string
  name: string
}

/** Owner catalog row — includes inactive carriers (RLS). */
export type CatalogCarrier = {
  id: string
  code: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

/** Owner catalog product row — includes inactive products (RLS). */
export type CatalogProduct = {
  id: string
  carrier_id: string
  name: string
  product_line: ProductionProductLine
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CatalogCarrierFilter = string | 'all'
