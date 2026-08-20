/**
 * Case requirement catalog matching Migration 044.
 * Single source for codes, statuses, labels, product-line eligibility, and common sets.
 * UI eligibility is advisory; RPC authorization remains authoritative.
 */

import type { ProductionProductLine } from './types'

export const REQUIREMENT_CODES = [
  'signature',
  'replacement_form',
  'delivery',
  'other',
  'paramed_exam',
  'aps',
  'illustration',
  'initial_premium',
  'suitability',
  'exchange_1035',
  'funds',
] as const
export type RequirementCode = (typeof REQUIREMENT_CODES)[number]

export const UNIVERSAL_REQUIREMENT_CODES = [
  'signature',
  'replacement_form',
  'delivery',
  'other',
] as const satisfies readonly RequirementCode[]

export const LIFE_ONLY_REQUIREMENT_CODES = [
  'paramed_exam',
  'aps',
  'illustration',
  'initial_premium',
] as const satisfies readonly RequirementCode[]

export const FIA_ONLY_REQUIREMENT_CODES = [
  'suitability',
  'exchange_1035',
  'funds',
] as const satisfies readonly RequirementCode[]

export const REQUIREMENT_STATUSES = [
  'open',
  'scheduled',
  'complete',
  'waived',
  'cancelled',
] as const
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number]

export const REQUIREMENT_CUSTOM_LABEL_MAX = 80
export const REQUIREMENT_REOPEN_REASON_MAX = 500

export const REQUIREMENT_CODE_LABELS: Record<RequirementCode, string> = {
  signature: 'Signature',
  replacement_form: 'Replacement form',
  delivery: 'Delivery / funding acknowledgement',
  other: 'Other',
  paramed_exam: 'Paramed exam',
  aps: 'APS / medical records',
  illustration: 'Illustration',
  initial_premium: 'Initial premium',
  suitability: 'Suitability review',
  exchange_1035: '1035 / transfer paperwork',
  funds: 'Funds',
}

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  open: 'Open',
  scheduled: 'Scheduled',
  complete: 'Complete',
  waived: 'Waived',
  cancelled: 'Cancelled',
}

export const COMMON_LIFE_REQUIREMENT_CODES = [
  'signature',
  'paramed_exam',
  'illustration',
  'initial_premium',
] as const satisfies readonly RequirementCode[]

export const COMMON_FIA_REQUIREMENT_CODES = [
  'signature',
  'suitability',
  'exchange_1035',
  'funds',
] as const satisfies readonly RequirementCode[]

export const OTHER_LABEL_HINT = 'Short carrier ask — no medical details.'
export const REOPEN_REASON_HINT = 'Operational reason only — no medical details.'
export const REQUIREMENTS_EMPTY_COPY =
  'No requirements tracked yet. This does not mean the carrier has none.'

export function isRequirementCode(value: unknown): value is RequirementCode {
  return typeof value === 'string' && (REQUIREMENT_CODES as readonly string[]).includes(value)
}

export function isRequirementStatus(value: unknown): value is RequirementStatus {
  return typeof value === 'string' && (REQUIREMENT_STATUSES as readonly string[]).includes(value)
}

export function isLifeProductLine(productLine: ProductionProductLine): boolean {
  return productLine === 'life_term' || productLine === 'life_permanent'
}

export function requirementCodeEligible(
  code: RequirementCode,
  productLine: ProductionProductLine,
): boolean {
  if ((UNIVERSAL_REQUIREMENT_CODES as readonly RequirementCode[]).includes(code)) return true
  if ((LIFE_ONLY_REQUIREMENT_CODES as readonly RequirementCode[]).includes(code)) {
    return isLifeProductLine(productLine)
  }
  if ((FIA_ONLY_REQUIREMENT_CODES as readonly RequirementCode[]).includes(code)) {
    return productLine === 'fia'
  }
  return false
}

export function requirementCodesForProductLine(
  productLine: ProductionProductLine,
): RequirementCode[] {
  return REQUIREMENT_CODES.filter((code) => requirementCodeEligible(code, productLine))
}

export function commonRequirementCodesForProductLine(
  productLine: ProductionProductLine,
): readonly RequirementCode[] {
  if (isLifeProductLine(productLine)) return COMMON_LIFE_REQUIREMENT_CODES
  if (productLine === 'fia') return COMMON_FIA_REQUIREMENT_CODES
  return []
}

export function formatRequirementCodeLabel(code: RequirementCode): string {
  return REQUIREMENT_CODE_LABELS[code]
}

export function formatRequirementStatusLabel(status: RequirementStatus): string {
  return REQUIREMENT_STATUS_LABELS[status]
}
