import type { CrmSupportedRole } from '../types'
import {
  buildParticipantPayload,
  dollarsToCents,
  isFiaProductLine,
  isLifeProductLine,
  isPremiumMode,
  participantPayloadOmitsInsuredForFia,
  requiredParticipantRoles,
} from './applicationView'
import { writingSplitError } from './writingSplits'
import { getCurrentAllocations, getCurrentParticipants } from './daysInStage'
import type {
  ProductionAllocation,
  ProductionAllocationDraft,
  ProductionApplicationDetail,
  ProductionParticipant,
  ProductionParticipantDraft,
  ProductionParticipantRole,
  ProductionProductLine,
  ProductionStage,
} from './types'
import { PRODUCTION_PREMIUM_MODES } from './types'

export const PRODUCTION_EDIT_STAGES: ProductionStage[] = [
  'draft',
  'pre_submitted',
  'submitted',
  'in_underwriting',
]

export type ApplicationNumberMode = 'locked_pre_submit' | 'set' | 'correct' | 'locked_set'
export type ApplicationEditIntent = 'save' | 'submitted' | 'in_underwriting'
export type ApplicationEditPhase =
  | 'fields'
  | 'participants'
  | 'allocations'
  | 'application_number'
  | 'transition'

export const EDIT_PHASE_LABELS: Record<ApplicationEditPhase, string> = {
  fields: 'application fields',
  participants: 'participants',
  allocations: 'writing allocations',
  application_number: 'application number',
  transition: 'stage change',
}

export function canShowProductionEditAction(options: {
  role: CrmSupportedRole | null
  stage: ProductionStage | string | null | undefined
  deletedAt: string | null | undefined
}): boolean {
  if (options.deletedAt) return false
  if (options.role !== 'owner' && options.role !== 'advisor') return false
  return PRODUCTION_EDIT_STAGES.includes(options.stage as ProductionStage)
}

export function isPreSubmitStage(stage: ProductionStage | string | null | undefined): boolean {
  return stage === 'draft' || stage === 'pre_submitted'
}

export function canEditCatalogFields(stage: ProductionStage): boolean {
  return isPreSubmitStage(stage)
}

export function canEditMoneyAndDates(stage: ProductionStage): boolean {
  return PRODUCTION_EDIT_STAGES.includes(stage)
}

export function canEditPolicyNumber(stage: ProductionStage): boolean {
  return stage === 'submitted' || stage === 'in_underwriting'
}

export function canReplaceParticipants(options: {
  stage: ProductionStage
  isOwner: boolean
}): boolean {
  if (isPreSubmitStage(options.stage)) return true
  if (options.stage === 'submitted' || options.stage === 'in_underwriting') return options.isOwner
  return false
}

export function canReplaceAllocations(options: {
  stage: ProductionStage
  isOwner: boolean
}): boolean {
  return canReplaceParticipants(options)
}

export function participantReasonRequired(stage: ProductionStage): boolean {
  return !isPreSubmitStage(stage)
}

export function applicationNumberMode(options: {
  stage: ProductionStage
  applicationNumber: string | null | undefined
  isOwner: boolean
}): ApplicationNumberMode {
  if (isPreSubmitStage(options.stage)) return 'locked_pre_submit'
  if (!options.applicationNumber?.trim()) return 'set'
  return options.isOwner ? 'correct' : 'locked_set'
}

export function applicationNumberLockExplanation(mode: ApplicationNumberMode): string | null {
  if (mode === 'locked_pre_submit') {
    return 'Application number can be assigned after the case is submitted. It cannot be edited here in draft.'
  }
  if (mode === 'locked_set') {
    return 'An assigned application number can only be corrected by an owner, with a reason recorded in the audit log.'
  }
  return null
}

export function catalogLockExplanation(stage: ProductionStage): string | null {
  if (canEditCatalogFields(stage)) return null
  return 'Carrier, product, and state cannot be changed after submission.'
}

export function participantLockExplanation(options: {
  stage: ProductionStage
  isOwner: boolean
}): string | null {
  if (canReplaceParticipants(options)) return null
  return 'Participants can be replaced after submission only by an owner, with a reason.'
}

export function allocationLockExplanation(options: {
  stage: ProductionStage
  isOwner: boolean
}): string | null {
  if (canReplaceAllocations(options)) return null
  return 'Writing allocations can be replaced after submission only by an owner, with a reason.'
}

export function isIncompleteDraft(application: {
  production_stage: ProductionStage | string
  product_line: ProductionProductLine
  participants: ProductionParticipant[]
  allocations: ProductionAllocation[]
}): boolean {
  if (!isPreSubmitStage(application.production_stage)) return false
  const roles = requiredParticipantRoles(application.product_line)
  const current = getCurrentParticipants(application.participants)
  const missingRole = roles.some((role) => !current.some((row) => row.role === role))
  const writing = writingDraftsFromAllocations(getCurrentAllocations(application.allocations))
  return missingRole || Boolean(writingSplitError(writing))
}

export function centsToDollarsInput(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(Number(cents))) return ''
  const dollars = Number(cents) / 100
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2)
}

export function writingDraftsFromAllocations(
  rows: ProductionAllocation[],
): ProductionAllocationDraft[] {
  return rows
    .filter((row) => row.allocation_role === 'writing' && row.recipient_type === 'advisor' && row.advisor_id)
    .map((row) => ({
      recipient_type: 'advisor' as const,
      advisor_id: String(row.advisor_id),
      allocation_role: 'writing' as const,
      commission_bps: Number(row.commission_bps),
      production_credit_bps: Number(row.production_credit_bps),
    }))
}

export function roleMembersFromParticipants(
  rows: ProductionParticipant[],
): Partial<Record<ProductionParticipantRole, string>> {
  const next: Partial<Record<ProductionParticipantRole, string>> = {}
  for (const row of getCurrentParticipants(rows)) {
    next[row.role] = row.household_member_id
  }
  return next
}

export function participantsEqual(
  left: ProductionParticipantDraft[],
  right: ProductionParticipantDraft[],
): boolean {
  if (left.length !== right.length) return false
  const key = (row: ProductionParticipantDraft) => `${row.household_member_id}|${row.role}`
  const a = left.map(key).sort()
  const b = right.map(key).sort()
  return a.every((value, index) => value === b[index])
}

export function allocationsEqual(
  left: ProductionAllocationDraft[],
  right: ProductionAllocationDraft[],
): boolean {
  if (left.length !== right.length) return false
  const key = (row: ProductionAllocationDraft) =>
    `${row.advisor_id}|${row.commission_bps}|${row.production_credit_bps}`
  const a = left.map(key).sort()
  const b = right.map(key).sort()
  return a.every((value, index) => value === b[index])
}

export function recoveryTransitionPlan(
  from: ProductionStage,
  intent: ApplicationEditIntent,
): ProductionStage[] {
  if (intent === 'save') return []
  if (from === intent) return []
  if (from === 'draft' || from === 'pre_submitted') {
    if (intent === 'submitted') return ['submitted']
    if (intent === 'in_underwriting') return ['submitted', 'in_underwriting']
  }
  if (from === 'submitted' && intent === 'in_underwriting') return ['in_underwriting']
  return []
}

export function neverJumpsDraftToUnderwriting(from: ProductionStage, plan: ProductionStage[]): boolean {
  if (from === 'draft' || from === 'pre_submitted') {
    return !(plan.length === 1 && plan[0] === 'in_underwriting')
  }
  return true
}

export function availableEditIntents(stage: ProductionStage): ApplicationEditIntent[] {
  if (stage === 'draft' || stage === 'pre_submitted') {
    return ['save', 'submitted', 'in_underwriting']
  }
  if (stage === 'submitted') return ['save', 'in_underwriting']
  if (stage === 'in_underwriting') return ['save']
  return []
}

export type ApplicationEditDraft = {
  carrierId: string
  productId: string
  productLine: ProductionProductLine | ''
  state: string
  premiumMode: string
  plannedPremium: string
  faceAmount: string
  initialDeposit: string
  submissionDate: string
  nextFollowUpDate: string
  applicationNumber: string
  policyNumber: string
  applicationNumberReason: string
  participantReason: string
  allocationReason: string
  roleMembers: Partial<Record<ProductionParticipantRole, string>>
  allocations: ProductionAllocationDraft[]
}

export type ApplicationEditOriginal = {
  carrierId: string
  productId: string
  productLine: ProductionProductLine
  state: string
  premiumMode: string
  plannedPremium: string
  faceAmount: string
  initialDeposit: string
  submissionDate: string
  nextFollowUpDate: string
  applicationNumber: string
  policyNumber: string
  participants: ProductionParticipantDraft[]
  allocations: ProductionAllocationDraft[]
}

export function originalFromApplication(application: ProductionApplicationDetail): ApplicationEditOriginal {
  return {
    carrierId: application.carrier_id,
    productId: application.product_id,
    productLine: application.product_line,
    state: application.state,
    premiumMode: application.premium_mode ?? '',
    plannedPremium: centsToDollarsInput(application.submitted_premium_cents),
    faceAmount: centsToDollarsInput(application.face_amount_cents),
    initialDeposit: centsToDollarsInput(application.annuity_deposit_cents),
    submissionDate: application.submission_date?.slice(0, 10) ?? '',
    nextFollowUpDate: application.next_follow_up_date?.slice(0, 10) ?? '',
    applicationNumber: application.application_number ?? '',
    policyNumber: application.policy_number ?? '',
    participants: getCurrentParticipants(application.participants).map((row) => ({
      household_member_id: row.household_member_id,
      role: row.role,
    })),
    allocations: writingDraftsFromAllocations(getCurrentAllocations(application.allocations)),
  }
}

export function draftFromOriginal(original: ApplicationEditOriginal): ApplicationEditDraft {
  const roleMembers: Partial<Record<ProductionParticipantRole, string>> = {}
  for (const row of original.participants) roleMembers[row.role] = row.household_member_id
  return {
    carrierId: original.carrierId,
    productId: original.productId,
    productLine: original.productLine,
    state: original.state,
    premiumMode: original.premiumMode,
    plannedPremium: original.plannedPremium,
    faceAmount: original.faceAmount,
    initialDeposit: original.initialDeposit,
    submissionDate: original.submissionDate,
    nextFollowUpDate: original.nextFollowUpDate,
    applicationNumber: original.applicationNumber,
    policyNumber: original.policyNumber,
    applicationNumberReason: '',
    participantReason: '',
    allocationReason: '',
    roleMembers,
    allocations: original.allocations.map((row) => ({ ...row })),
  }
}

export type ApplicationEditFieldErrors = {
  carrierId?: string
  productId?: string
  state?: string
  premiumMode?: string
  plannedPremium?: string
  faceAmount?: string
  initialDeposit?: string
  submissionDate?: string
  nextFollowUpDate?: string
  applicationNumber?: string
  policyNumber?: string
  applicationNumberReason?: string
  participants?: string
  participantReason?: string
  allocations?: string
  allocationReason?: string
  intent?: string
}

export function validateApplicationEdit(options: {
  stage: ProductionStage
  isOwner: boolean
  original: ApplicationEditOriginal
  draft: ApplicationEditDraft
  intent: ApplicationEditIntent
}): { invalid: boolean; fieldErrors: ApplicationEditFieldErrors } {
  const fieldErrors: ApplicationEditFieldErrors = {}
  const { stage, isOwner, original, draft, intent } = options
  const line = draft.productLine || original.productLine

  if (canEditCatalogFields(stage)) {
    if (!draft.carrierId.trim()) fieldErrors.carrierId = 'Choose a carrier'
    if (!draft.productId.trim()) fieldErrors.productId = 'Choose a product'
    const state = draft.state.trim().toUpperCase()
    if (!/^[A-Z]{2}$/.test(state)) fieldErrors.state = 'Select a two-letter state.'
  }

  if (canEditMoneyAndDates(stage)) {
    if (isLifeProductLine(line)) {
      const cents = dollarsToCents(draft.plannedPremium)
      if (intent !== 'save' && (cents == null || cents <= 0)) {
        fieldErrors.plannedPremium = 'Premium information is incomplete'
      } else if (draft.plannedPremium.trim() && (cents == null || cents <= 0)) {
        fieldErrors.plannedPremium = 'Premium information is incomplete'
      }
      if (draft.premiumMode && !(PRODUCTION_PREMIUM_MODES as readonly string[]).includes(draft.premiumMode)) {
        fieldErrors.premiumMode = 'Premium information is incomplete'
      }
      if (intent !== 'save' && !isPremiumMode(draft.premiumMode)) {
        fieldErrors.premiumMode = 'Premium information is incomplete'
      }
      if (draft.faceAmount.trim()) {
        const face = dollarsToCents(draft.faceAmount)
        if (face == null || face <= 0) fieldErrors.faceAmount = 'Face amount must be greater than zero when entered.'
      }
    } else if (isFiaProductLine(line)) {
      const deposit = dollarsToCents(draft.initialDeposit)
      if (intent !== 'save' && (deposit == null || deposit <= 0)) {
        fieldErrors.initialDeposit = 'Premium information is incomplete'
      } else if (draft.initialDeposit.trim() && (deposit == null || deposit <= 0)) {
        fieldErrors.initialDeposit = 'Premium information is incomplete'
      }
    }
    if (draft.submissionDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(draft.submissionDate.trim())) {
      fieldErrors.submissionDate = 'Enter a valid submission date.'
    }
    if (draft.nextFollowUpDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(draft.nextFollowUpDate.trim())) {
      fieldErrors.nextFollowUpDate = 'Enter a valid follow-up date.'
    }
  }

  const nextParticipants = buildParticipantPayload({ productLine: line, roleMembers: draft.roleMembers })
  const originalParticipants = original.participants
  const participantsChanged = !participantsEqual(nextParticipants, originalParticipants)
  if (canReplaceParticipants({ stage, isOwner }) && (participantsChanged || intent !== 'save')) {
    const missing = requiredParticipantRoles(line).filter((role) => !draft.roleMembers[role]?.trim())
    if (intent !== 'save' && (missing.length > 0 || nextParticipants.length !== requiredParticipantRoles(line).length)) {
      fieldErrors.participants = 'Assign a household member to each required role.'
    } else if (participantsChanged && missing.length > 0) {
      fieldErrors.participants = 'Assign a household member to each required role.'
    } else if (!participantPayloadOmitsInsuredForFia(line, nextParticipants)) {
      fieldErrors.participants = 'FIA applications cannot include an insured participant.'
    }
    if (participantsChanged && participantReasonRequired(stage) && !draft.participantReason.trim()) {
      fieldErrors.participantReason = 'Enter a reason to replace participants after submission.'
    }
  }

  const allocationsChanged = !allocationsEqual(draft.allocations, original.allocations)
  if (canReplaceAllocations({ stage, isOwner }) && (allocationsChanged || intent !== 'save')) {
    const allocationMessage = writingSplitError(draft.allocations)
    if (intent !== 'save' && allocationMessage) {
      fieldErrors.allocations = allocationMessage
    } else if (allocationsChanged && allocationMessage) {
      fieldErrors.allocations = allocationMessage
    }
    if (allocationsChanged && participantReasonRequired(stage) && !draft.allocationReason.trim()) {
      fieldErrors.allocationReason = 'Enter a reason to replace writing allocations after submission.'
    }
  }

  const numberMode = applicationNumberMode({
    stage,
    applicationNumber: original.applicationNumber,
    isOwner,
  })
  const nextNumber = draft.applicationNumber.trim()
  if (numberMode === 'set' && nextNumber && nextNumber.length > 60) {
    fieldErrors.applicationNumber = 'Application number must be 60 characters or fewer.'
  }
  if (numberMode === 'correct' && nextNumber !== original.applicationNumber.trim()) {
    if (!nextNumber) fieldErrors.applicationNumber = 'Enter the corrected application number.'
    if (nextNumber.length > 60) fieldErrors.applicationNumber = 'Application number must be 60 characters or fewer.'
    if (!draft.applicationNumberReason.trim()) {
      fieldErrors.applicationNumberReason = 'Enter a reason. Corrections are written to the audit log.'
    }
  }

  if (canEditPolicyNumber(stage)) {
    const policyNumber = draft.policyNumber.trim()
    if (policyNumber.length > 60) {
      fieldErrors.policyNumber = 'Policy number must be 60 characters or fewer.'
    }
  }

  if (intent !== 'save' && recoveryTransitionPlan(stage, intent).length === 0) {
    fieldErrors.intent = 'That stage change is not allowed from the current stage.'
  }

  return { invalid: Object.keys(fieldErrors).length > 0, fieldErrors }
}

export function buildUpdatePayload(options: {
  stage: ProductionStage
  original: ApplicationEditOriginal
  draft: ApplicationEditDraft
}): Record<string, unknown> | null {
  const payload: Record<string, unknown> = {}
  const { stage, original, draft } = options
  const line = (draft.productLine || original.productLine) as ProductionProductLine

  if (canEditCatalogFields(stage)) {
    if (draft.carrierId !== original.carrierId) payload.carrier_id = draft.carrierId
    if (draft.productId !== original.productId) payload.product_id = draft.productId
    if (draft.productId !== original.productId && draft.productLine) {
      payload.product_line = draft.productLine
    }
    const state = draft.state.trim().toUpperCase()
    if (state !== original.state.trim().toUpperCase()) payload.state = state
  }

  if (canEditMoneyAndDates(stage)) {
    if (isLifeProductLine(line)) {
      const premium = dollarsToCents(draft.plannedPremium)
      const originalPremium = dollarsToCents(original.plannedPremium)
      if (premium !== originalPremium && premium != null) payload.submitted_premium_cents = premium
      if (draft.premiumMode !== original.premiumMode && isPremiumMode(draft.premiumMode)) {
        payload.premium_mode = draft.premiumMode
      }
      const face = dollarsToCents(draft.faceAmount)
      const originalFace = dollarsToCents(original.faceAmount)
      if (face !== originalFace) payload.face_amount_cents = face
    }
    if (isFiaProductLine(line)) {
      const deposit = dollarsToCents(draft.initialDeposit)
      const originalDeposit = dollarsToCents(original.initialDeposit)
      if (deposit !== originalDeposit && deposit != null) payload.annuity_deposit_cents = deposit
    }
    const submission = draft.submissionDate.trim()
    if (submission !== original.submissionDate.trim()) {
      payload.submission_date = submission || null
    }
    const followUp = draft.nextFollowUpDate.trim()
    if (followUp !== original.nextFollowUpDate.trim()) {
      payload.next_follow_up_date = followUp || null
    }
  }

  if (canEditPolicyNumber(stage)) {
    const policyNumber = draft.policyNumber.trim()
    if (policyNumber !== original.policyNumber.trim()) {
      payload.policy_number = policyNumber || null
    }
  }

  return Object.keys(payload).length > 0 ? payload : null
}

export function formatPartialSaveMessage(saved: ApplicationEditPhase[], failed: ApplicationEditPhase): string {
  if (saved.length === 0) {
    return `Nothing was saved. ${EDIT_PHASE_LABELS[failed]} failed. Nothing was rolled back.`
  }
  const savedText = saved.map((phase) => EDIT_PHASE_LABELS[phase]).join(', ')
  return `Saved: ${savedText}. ${EDIT_PHASE_LABELS[failed]} was not saved. The page reloaded from the server. Nothing was rolled back.`
}

export function isApplicationEditDirty(original: ApplicationEditOriginal, draft: ApplicationEditDraft): boolean {
  if (draft.carrierId !== original.carrierId) return true
  if (draft.productId !== original.productId) return true
  if (draft.state !== original.state) return true
  if (draft.premiumMode !== original.premiumMode) return true
  if (draft.plannedPremium !== original.plannedPremium) return true
  if (draft.faceAmount !== original.faceAmount) return true
  if (draft.initialDeposit !== original.initialDeposit) return true
  if (draft.submissionDate !== original.submissionDate) return true
  if (draft.nextFollowUpDate !== original.nextFollowUpDate) return true
  if (draft.applicationNumber !== original.applicationNumber) return true
  if (draft.policyNumber !== original.policyNumber) return true
  const nextParticipants = buildParticipantPayload({
    productLine: (draft.productLine || original.productLine) as ProductionProductLine,
    roleMembers: draft.roleMembers,
  })
  if (!participantsEqual(nextParticipants, original.participants)) return true
  if (!allocationsEqual(draft.allocations, original.allocations)) return true
  return false
}
