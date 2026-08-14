import type {
  ProductionAllocationDraft,
  ProductionEntryProductOption,
  ProductionEntryStage,
  ProductionMemberOption,
  ProductionParticipantDraft,
  ProductionParticipantRole,
  ProductionPremiumMode,
  ProductionProductLine,
  ProductionStage,
} from './types'
import { PRODUCTION_ENTRY_WRITING_BPS_TOTAL, PRODUCTION_PREMIUM_MODES } from './types'

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const

export const LIFE_REQUIRED_ROLES: ProductionParticipantRole[] = [
  'primary_client',
  'insured',
  'owner',
]

export const FIA_REQUIRED_ROLES: ProductionParticipantRole[] = [
  'primary_client',
  'annuitant',
  'owner',
]

export const SUBMITTED_ENTRY_REASON = 'Initial production entry — recorded as submitted.'
export const UNDERWRITING_ENTRY_REASON =
  'Initial production entry — catch-up to in underwriting.'

export function requiredParticipantRoles(
  productLine: ProductionProductLine | null | undefined,
): ProductionParticipantRole[] {
  if (productLine === 'fia') return [...FIA_REQUIRED_ROLES]
  if (productLine === 'life_term' || productLine === 'life_permanent') {
    return [...LIFE_REQUIRED_ROLES]
  }
  return []
}

export function isLifeProductLine(line: string | null | undefined): line is 'life_term' | 'life_permanent' {
  return line === 'life_term' || line === 'life_permanent'
}

export function isFiaProductLine(line: string | null | undefined): line is 'fia' {
  return line === 'fia'
}

export function canSubmitApplicationForm(options: {
  submitting: boolean
  invalid: boolean
}): boolean {
  return !options.submitting && !options.invalid
}

export function catalogReadyForApplications(options: {
  activeCarrierCount: number
  activeProductCount: number
}): boolean {
  return options.activeCarrierCount > 0 && options.activeProductCount > 0
}

export function productsForCarrier(
  products: ProductionEntryProductOption[],
  carrierId: string,
): ProductionEntryProductOption[] {
  if (!carrierId) return []
  return products.filter((row) => row.carrier_id === carrierId)
}

export function dollarsToCents(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const cents = Math.round(Number(trimmed) * 100)
  if (!Number.isFinite(cents) || cents < 0) return null
  return cents
}

export function writingBpsTotals(rows: Array<{ commission_bps: number; production_credit_bps: number }>): {
  commission: number
  productionCredit: number
  valid: boolean
} {
  const commission = rows.reduce((sum, row) => sum + Number(row.commission_bps || 0), 0)
  const productionCredit = rows.reduce((sum, row) => sum + Number(row.production_credit_bps || 0), 0)
  return {
    commission,
    productionCredit,
    valid:
      rows.length > 0 &&
      commission === PRODUCTION_ENTRY_WRITING_BPS_TOTAL &&
      productionCredit === PRODUCTION_ENTRY_WRITING_BPS_TOTAL,
  }
}

export function defaultWritingAllocations(advisorId: string): ProductionAllocationDraft[] {
  if (!advisorId) return []
  return [
    {
      recipient_type: 'advisor',
      advisor_id: advisorId,
      allocation_role: 'writing',
      commission_bps: PRODUCTION_ENTRY_WRITING_BPS_TOTAL,
      production_credit_bps: PRODUCTION_ENTRY_WRITING_BPS_TOTAL,
    },
  ]
}

export function splitWritingEvenly(advisorIds: string[]): ProductionAllocationDraft[] {
  const unique = [...new Set(advisorIds.filter(Boolean))]
  if (unique.length === 0) return []
  if (unique.length === 1) return defaultWritingAllocations(unique[0])
  const base = Math.floor(PRODUCTION_ENTRY_WRITING_BPS_TOTAL / unique.length)
  const remainder = PRODUCTION_ENTRY_WRITING_BPS_TOTAL - base * unique.length
  return unique.map((id, index) => ({
    recipient_type: 'advisor' as const,
    advisor_id: id,
    allocation_role: 'writing' as const,
    commission_bps: base + (index === 0 ? remainder : 0),
    production_credit_bps: base + (index === 0 ? remainder : 0),
  }))
}

export function catchUpTransitionPlan(target: ProductionEntryStage): ProductionStage[] {
  if (target === 'draft') return []
  if (target === 'submitted') return ['submitted']
  return ['submitted', 'in_underwriting']
}

export function transitionReasonForStage(stage: ProductionStage): string {
  if (stage === 'submitted') return SUBMITTED_ENTRY_REASON
  if (stage === 'in_underwriting') return UNDERWRITING_ENTRY_REASON
  return 'Initial production entry.'
}

export function neverJumpsDraftToUnderwriting(plan: ProductionStage[]): boolean {
  return !(plan.length === 1 && plan[0] === 'in_underwriting')
}

export function buildParticipantPayload(options: {
  productLine: ProductionProductLine
  roleMembers: Partial<Record<ProductionParticipantRole, string>>
}): ProductionParticipantDraft[] {
  const roles = requiredParticipantRoles(options.productLine)
  const rows: ProductionParticipantDraft[] = []
  const seen = new Set<string>()
  for (const role of roles) {
    const memberId = options.roleMembers[role]?.trim()
    if (!memberId) continue
    const key = `${memberId}|${role}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ household_member_id: memberId, role })
  }
  return rows
}

export function participantPayloadOmitsInsuredForFia(
  productLine: ProductionProductLine,
  rows: ProductionParticipantDraft[],
): boolean {
  if (productLine !== 'fia') return true
  return rows.every((row) => row.role !== 'insured')
}

export type ApplicationDraftFieldErrors = {
  householdId?: string
  carrierId?: string
  productId?: string
  state?: string
  targetStage?: string
  premiumMode?: string
  plannedPremium?: string
  faceAmount?: string
  initialDeposit?: string
  participants?: string
  allocations?: string
  applicationNumber?: string
  submissionDate?: string
}

export type ApplicationDraftInput = {
  householdId: string
  carrierId: string
  productId: string
  productLine: ProductionProductLine | ''
  state: string
  targetStage: ProductionEntryStage | ''
  premiumMode: string
  plannedPremium: string
  faceAmount: string
  initialDeposit: string
  applicationNumber: string
  submissionDate: string
  roleMembers: Partial<Record<ProductionParticipantRole, string>>
  allocations: ProductionAllocationDraft[]
}

export function validateApplicationDraft(input: ApplicationDraftInput): {
  invalid: boolean
  fieldErrors: ApplicationDraftFieldErrors
} {
  const fieldErrors: ApplicationDraftFieldErrors = {}
  if (!input.householdId.trim()) fieldErrors.householdId = 'Select a household.'
  if (!input.carrierId.trim()) fieldErrors.carrierId = 'Select a carrier.'
  if (!input.productId.trim()) fieldErrors.productId = 'Select a product.'
  const state = input.state.trim().toUpperCase()
  if (!state || !(US_STATES as readonly string[]).includes(state)) {
    fieldErrors.state = 'Select a two-letter state.'
  }
  if (!input.targetStage) fieldErrors.targetStage = 'Select the current stage.'

  const line = input.productLine
  if (isLifeProductLine(line)) {
    const cents = dollarsToCents(input.plannedPremium)
    if (cents == null || cents <= 0) fieldErrors.plannedPremium = 'Enter a planned premium greater than zero.'
    if (!(PRODUCTION_PREMIUM_MODES as readonly string[]).includes(input.premiumMode)) {
      fieldErrors.premiumMode = 'Select a premium mode.'
    }
    if (input.faceAmount.trim()) {
      const face = dollarsToCents(input.faceAmount)
      if (face == null || face <= 0) fieldErrors.faceAmount = 'Face amount must be greater than zero when entered.'
    }
  } else if (isFiaProductLine(line)) {
    const deposit = dollarsToCents(input.initialDeposit)
    if (deposit == null || deposit <= 0) {
      fieldErrors.initialDeposit = 'Enter an initial deposit greater than zero.'
    }
  }

  if (input.applicationNumber.trim().length > 60) {
    fieldErrors.applicationNumber = 'Application number must be 60 characters or fewer.'
  }
  if (input.submissionDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(input.submissionDate.trim())) {
    fieldErrors.submissionDate = 'Enter a valid submission date.'
  }

  if (line) {
    const rows = buildParticipantPayload({
      productLine: line,
      roleMembers: input.roleMembers,
    })
    const missing = requiredParticipantRoles(line).filter((role) => !input.roleMembers[role]?.trim())
    if (missing.length > 0 || rows.length !== requiredParticipantRoles(line).length) {
      fieldErrors.participants = 'Assign a household member to each required role.'
    } else if (!participantPayloadOmitsInsuredForFia(line, rows)) {
      fieldErrors.participants = 'FIA applications cannot include an insured participant.'
    }
  }

  const totals = writingBpsTotals(input.allocations)
  const advisorIds = input.allocations.map((row) => row.advisor_id)
  if (input.allocations.length === 0 || advisorIds.some((id) => !id)) {
    fieldErrors.allocations = 'Select at least one writing advisor.'
  } else if (new Set(advisorIds).size !== advisorIds.length) {
    fieldErrors.allocations = 'Each writing advisor can appear only once.'
  } else if (!totals.valid) {
    fieldErrors.allocations =
      'Writing commission and production credit must each total exactly 10,000 bps.'
  }

  return { invalid: Object.keys(fieldErrors).length > 0, fieldErrors }
}

export function defaultRoleMembers(
  members: ProductionMemberOption[],
): Partial<Record<ProductionParticipantRole, string>> {
  if (members.length === 0) return {}
  const primary = members.find((row) => row.is_primary_contact) ?? members[0]
  return {
    primary_client: primary.id,
    insured: primary.id,
    owner: primary.id,
    annuitant: primary.id,
  }
}

export function isPremiumMode(value: string): value is ProductionPremiumMode {
  return (PRODUCTION_PREMIUM_MODES as readonly string[]).includes(value)
}
