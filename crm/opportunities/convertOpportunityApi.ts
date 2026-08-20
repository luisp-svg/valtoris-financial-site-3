/**
 * Opportunity → draft Case conversion API.
 * Writes: convert_opportunity_to_policy_application only.
 * Never table INSERT/UPDATE and never call the generic create RPC from the browser.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { extractCrmPpCode } from '../production/catalogErrors'
import { formatApplicationUserError } from '../production/applicationErrors'
import type {
  ProductionAllocationDraft,
  ProductionParticipantRole,
  ProductionProductLine,
} from '../production/types'
import { dollarsToCents, isFiaProductLine, isLifeProductLine, isPremiumMode } from '../production/applicationView'
import { toWritingAllocationRpcPayload } from '../production/writingSplits'

export const CONVERT_OPPORTUNITY_RPC = 'convert_opportunity_to_policy_application'

export type ConvertOpportunityResult = {
  ok: true
  created: boolean
  applicationId: string
  householdId: string
  opportunityId: string
}

export type ConvertOpportunityInput = {
  carrierId: string
  productId: string
  productLine: ProductionProductLine
  state: string
  plannedPremium?: string
  premiumMode?: string
  faceAmount?: string
  initialDeposit?: string
  roleMembers: Partial<Record<ProductionParticipantRole, string>>
  allocations: ProductionAllocationDraft[]
}

const CONVERT_ERROR_MESSAGES: Record<string, string> = {
  invalid_transition: 'This opportunity cannot be converted to a production case.',
  household_mismatch: 'The case must stay on this opportunity household.',
  not_found: 'This opportunity was not found or you do not have access.',
  not_authorized: 'You do not have permission to convert this opportunity.',
  invalid_payload: 'That case cannot be created. Check the highlighted fields and try again.',
}

export function formatConvertOpportunityUserError(err: unknown): string {
  const code = extractCrmPpCode(err)
  if (code && CONVERT_ERROR_MESSAGES[code]) return CONVERT_ERROR_MESSAGES[code]
  return formatApplicationUserError(err)
}

export function buildConvertOpportunityPayload(input: ConvertOpportunityInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    carrier_id: input.carrierId,
    product_id: input.productId,
    product_line: input.productLine,
    state: input.state.trim().toUpperCase(),
    participants: Object.entries(input.roleMembers)
      .filter(([, memberId]) => Boolean(memberId?.trim()))
      .map(([role, memberId]) => ({
        household_member_id: String(memberId),
        role,
      })),
    allocations: toWritingAllocationRpcPayload(input.allocations),
  }

  if (isLifeProductLine(input.productLine)) {
    const premium = dollarsToCents(input.plannedPremium ?? '')
    if (premium != null) payload.submitted_premium_cents = premium
    if (isPremiumMode(input.premiumMode ?? '')) payload.premium_mode = input.premiumMode
    const face = dollarsToCents(input.faceAmount ?? '')
    if (face != null) payload.face_amount_cents = face
  }
  if (isFiaProductLine(input.productLine)) {
    const deposit = dollarsToCents(input.initialDeposit ?? '')
    if (deposit != null) payload.annuity_deposit_cents = deposit
  }

  return payload
}

export async function convertOpportunityToPolicyApplication(
  supabase: SupabaseClient,
  opportunityId: string,
  input: ConvertOpportunityInput,
): Promise<ConvertOpportunityResult> {
  const { data, error } = await supabase.rpc(CONVERT_OPPORTUNITY_RPC, {
    p_opportunity_id: opportunityId,
    p_payload: buildConvertOpportunityPayload(input),
  })
  if (error) throw error

  const row = data as {
    ok?: boolean
    created?: boolean
    application_id?: string
    household_id?: string
    opportunity_id?: string
  } | null
  const applicationId = typeof row?.application_id === 'string' ? row.application_id : ''
  const householdId = typeof row?.household_id === 'string' ? row.household_id : ''
  if (!row?.ok || !applicationId) {
    throw new Error('CRM_PP:invalid_payload')
  }
  return {
    ok: true,
    created: row.created === true,
    applicationId,
    householdId,
    opportunityId: typeof row.opportunity_id === 'string' ? row.opportunity_id : opportunityId,
  }
}
