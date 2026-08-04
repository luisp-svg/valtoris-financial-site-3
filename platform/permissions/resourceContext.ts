/**
 * Resource-context helpers — pure evaluation of caller-supplied facts.
 * Does not query Supabase and does not verify database truth.
 */

import type { PermissionResourceContext } from './types'

export function normalizeResourceContext(
  input: PermissionResourceContext | undefined,
): PermissionResourceContext {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return {
    resourceType: input.resourceType ?? 'unknown',
    resourceId: input.resourceId ?? null,
    householdId: input.householdId ?? null,
    assignedAdvisorUserId: input.assignedAdvisorUserId ?? null,
    currentUserId: input.currentUserId ?? null,
    createdByUserId: input.createdByUserId ?? null,
    ownerUserId: input.ownerUserId ?? null,
    moduleKey: input.moduleKey ?? null,
    caseOwnerUserId: input.caseOwnerUserId ?? null,
    taskAssigneeUserId: input.taskAssigneeUserId ?? null,
    visibility: input.visibility ?? null,
    isUnassigned: input.isUnassigned === true,
    isSoftDeleted: input.isSoftDeleted === true,
    isMerged: input.isMerged === true,
    isOwnerOnly: input.isOwnerOnly === true,
    clientPortalUserId: input.clientPortalUserId ?? null,
  }
}

/**
 * Conceptual household access for advisors (mirrors crm_can_access_household intent).
 * Task assignee alone never grants household access.
 */
export function hasHouseholdAccessContext(
  context: PermissionResourceContext,
  options: { advisorsCanViewUnassignedPool?: boolean } = {},
): boolean {
  const currentUserId = context.currentUserId
  if (!currentUserId) return false

  if (context.isSoftDeleted || context.isMerged) return false

  if (
    context.assignedAdvisorUserId &&
    context.assignedAdvisorUserId === currentUserId
  ) {
    return true
  }

  const unassigned =
    context.isUnassigned === true ||
    context.assignedAdvisorUserId == null ||
    context.assignedAdvisorUserId === ''

  if (unassigned && options.advisorsCanViewUnassignedPool === true) {
    return true
  }

  return false
}

/**
 * True when the only positive signal is task assignment (insufficient for household access).
 */
export function isTaskAssignmentAlone(
  context: PermissionResourceContext,
): boolean {
  const currentUserId = context.currentUserId
  if (!currentUserId) return false
  const taskMatch = context.taskAssigneeUserId === currentUserId
  const householdMatch = context.assignedAdvisorUserId === currentUserId
  return taskMatch && !householdMatch
}

export function isOwnerOnlyDocumentVisibility(context: PermissionResourceContext): boolean {
  if (context.isOwnerOnly === true) return true
  const visibility = (context.visibility ?? '').toLowerCase()
  // Align with DB document_visibility owner_only (not activity "internal").
  return visibility === 'owner_only'
}

export function isPortalOwnResource(context: PermissionResourceContext): boolean {
  const currentUserId = context.currentUserId
  if (!currentUserId) return false
  return context.clientPortalUserId === currentUserId
}
