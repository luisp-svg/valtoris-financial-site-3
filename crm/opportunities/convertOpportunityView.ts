/**
 * Opportunity → draft Case conversion helpers.
 * Server remains authoritative. These helpers only drive wizard eligibility/UI.
 */

import {
  dollarsToCents,
  isFiaProductLine,
  isLifeProductLine,
  isPremiumMode,
  requiredParticipantRoles,
  US_STATES,
} from '../production/applicationView'
import type {
  ProductionAllocationDraft,
  ProductionAdvisorOption,
  ProductionEntryProductOption,
  ProductionParticipantRole,
  ProductionProductLine,
} from '../production/types'
import { writingSplitError } from '../production/writingSplits'
import type { OpportunityLinkedApplication, OpportunityStatus } from './types'

export const CONVERSION_ELIGIBLE_STATUSES: readonly OpportunityStatus[] = [
  'open',
  'on_hold',
  'won',
]

export const CONVERSION_ELIGIBLE_VERTICAL_CODES = ['life', 'retirement'] as const

export type ConversionEligibleVertical = (typeof CONVERSION_ELIGIBLE_VERTICAL_CODES)[number]

export type ConversionDraftField =
  | 'carrierId'
  | 'productId'
  | 'state'
  | 'plannedPremium'
  | 'premiumMode'
  | 'faceAmount'
  | 'initialDeposit'
  | 'participants'
  | 'allocations'

export type ConversionDraftInput = {
  verticalCode: string | null
  carrierId: string
  productId: string
  productLine: ProductionProductLine | null
  state: string
  plannedPremium: string
  premiumMode: string
  faceAmount: string
  initialDeposit: string
  roleMembers: Partial<Record<ProductionParticipantRole, string>>
  allocations: ProductionAllocationDraft[]
  householdMemberIds: string[]
}

export function isConversionEligibleStatus(status: OpportunityStatus): boolean {
  return CONVERSION_ELIGIBLE_STATUSES.includes(status)
}

export function isConversionEligibleVertical(code: string | null | undefined): code is ConversionEligibleVertical {
  return code === 'life' || code === 'retirement'
}

export function conversionProductLinesForVertical(
  code: string | null | undefined,
): ProductionProductLine[] {
  if (code === 'life') return ['life_term', 'life_permanent']
  if (code === 'retirement') return ['fia']
  return []
}

export function opportunityAllowsCreateCase(opportunity: {
  status: OpportunityStatus
  service_vertical: { code: string } | null
}): boolean {
  return (
    isConversionEligibleStatus(opportunity.status) &&
    isConversionEligibleVertical(opportunity.service_vertical?.code ?? null)
  )
}

export function suggestedWritingAllocations(
  assignedAdvisorId: string | null | undefined,
  advisors: ProductionAdvisorOption[],
): ProductionAllocationDraft[] {
  const advisorId = assignedAdvisorId?.trim() ?? ''
  if (!advisorId) return []
  const eligible = advisors.some((row) => row.id === advisorId)
  if (!eligible) return []
  return [
    {
      recipient_type: 'advisor',
      advisor_id: advisorId,
      allocation_role: 'writing',
      commission_bps: 10000,
      production_credit_bps: 10000,
    },
  ]
}

export function productsForConversion(
  products: ProductionEntryProductOption[],
  carrierId: string,
  verticalCode: string | null,
): ProductionEntryProductOption[] {
  const allowed = new Set(conversionProductLinesForVertical(verticalCode))
  if (!carrierId || allowed.size === 0) return []
  return products.filter((row) => row.carrier_id === carrierId && allowed.has(row.product_line))
}

export function carriersForConversion(
  carriers: Array<{ id: string; name: string; code: string }>,
  products: ProductionEntryProductOption[],
  verticalCode: string | null,
): Array<{ id: string; name: string; code: string }> {
  const allowed = new Set(conversionProductLinesForVertical(verticalCode))
  const carrierIds = new Set(
    products.filter((row) => allowed.has(row.product_line)).map((row) => row.carrier_id),
  )
  return carriers.filter((row) => carrierIds.has(row.id))
}

export function validateConversionDraft(input: ConversionDraftInput): {
  invalid: boolean
  fieldErrors: Partial<Record<ConversionDraftField, string>>
} {
  const fieldErrors: Partial<Record<ConversionDraftField, string>> = {}
  if (!isConversionEligibleVertical(input.verticalCode)) {
    return { invalid: true, fieldErrors }
  }
  if (!input.carrierId.trim()) fieldErrors.carrierId = 'Choose a carrier'
  if (!input.productId.trim()) fieldErrors.productId = 'Choose a product'
  const state = input.state.trim().toUpperCase()
  if (!state || !(US_STATES as readonly string[]).includes(state)) {
    fieldErrors.state = 'Select a two-letter state.'
  }

  const line = input.productLine
  if (input.verticalCode === 'life' && line && !isLifeProductLine(line)) {
    fieldErrors.productId = 'Life opportunities require a life product.'
  }
  if (input.verticalCode === 'retirement' && line && !isFiaProductLine(line)) {
    fieldErrors.productId = 'Retirement conversion requires an FIA product.'
  }

  if (isLifeProductLine(line)) {
    if (input.plannedPremium.trim()) {
      const cents = dollarsToCents(input.plannedPremium)
      if (cents == null || cents <= 0) fieldErrors.plannedPremium = 'Enter a valid premium or leave it blank.'
    }
    if (input.premiumMode.trim() && !isPremiumMode(input.premiumMode)) {
      fieldErrors.premiumMode = 'Choose a premium mode.'
    }
    if (input.faceAmount.trim()) {
      const face = dollarsToCents(input.faceAmount)
      if (face == null || face <= 0) fieldErrors.faceAmount = 'Face amount must be greater than zero when entered.'
    }
  } else if (isFiaProductLine(line)) {
    if (input.initialDeposit.trim()) {
      const deposit = dollarsToCents(input.initialDeposit)
      if (deposit == null || deposit <= 0) {
        fieldErrors.initialDeposit = 'Enter a valid deposit or leave it blank.'
      }
    }
  }

  if (line) {
    const roles = requiredParticipantRoles(line)
    const household = new Set(input.householdMemberIds)
    const missing = roles.filter((role) => !input.roleMembers[role]?.trim())
    if (missing.length > 0) {
      fieldErrors.participants = 'Assign a household member to each required role.'
    } else if (roles.some((role) => !household.has(String(input.roleMembers[role])))) {
      fieldErrors.participants = 'Participants must belong to this opportunity household.'
    }
  }

  const allocationMessage = writingSplitError(input.allocations)
  if (allocationMessage) fieldErrors.allocations = allocationMessage

  return { invalid: Object.keys(fieldErrors).length > 0, fieldErrors }
}

export function linkedApplicationLabel(application: OpportunityLinkedApplication): string {
  const product = [application.carrier_name, application.product_name].filter(Boolean).join(' ')
  return product || application.application_number || 'Production application'
}
