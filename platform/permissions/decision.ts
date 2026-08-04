/**
 * Authorization decision engine — pure RBAC + resource-context ABAC.
 *
 * Not wired into CrmShell, route gates, RLS, or RPCs.
 * Decisions improve UX/contracts only; database remains authoritative.
 */

import { getCapabilityDefinition, isKnownCapability } from './capabilityCatalog'
import { getModule } from '../registry'
import { roleHasCapability } from './roleCapabilities'
import { getRoleDefinition, isKnownRole } from './roleCatalog'
import {
  hasHouseholdAccessContext,
  isOwnerOnlyDocumentVisibility,
  isPortalOwnResource,
  isTaskAssignmentAlone,
  normalizeResourceContext,
} from './resourceContext'
import type {
  DecidePermissionInput,
  PermissionDecision,
  PermissionDenyReasonCode,
} from './types'

function decision(
  input: DecidePermissionInput,
  allowed: boolean,
  reasonCode: PermissionDenyReasonCode,
  message: string,
): PermissionDecision {
  const context = normalizeResourceContext(input.resourceContext)
  return {
    allowed,
    reasonCode,
    capability: input.capability,
    role: input.role,
    resourceType: context.resourceType,
    resourceId: context.resourceId ?? null,
    moduleKey: input.moduleKey ?? context.moduleKey ?? null,
    message,
  }
}

/**
 * Decide whether a role may use a capability in an optional resource context.
 * Normal denials return `{ allowed: false }` — they do not throw.
 */
export function decidePermission(input: DecidePermissionInput): PermissionDecision {
  const role = input.role
  const capability = input.capability
  const flags = input.flags ?? {}
  const context = normalizeResourceContext(input.resourceContext)
  const moduleKey = input.moduleKey ?? context.moduleKey ?? null

  if (!isKnownRole(role)) {
    return decision(input, false, 'unknown_role', `Unknown role "${role}"`)
  }

  const roleDefinition = getRoleDefinition(role)!
  if (roleDefinition.status !== 'active' && flags.allowInactiveRoles !== true) {
    return decision(
      input,
      false,
      'inactive_role',
      `Role "${role}" is future_inactive and not enabled for runtime evaluation`,
    )
  }

  if (!isKnownCapability(capability)) {
    return decision(
      input,
      false,
      'unknown_capability',
      `Unknown capability "${capability}"`,
    )
  }

  const capabilityDefinition = getCapabilityDefinition(capability)!

  if (!roleHasCapability(role, capability)) {
    return decision(
      input,
      false,
      'role_lacks_capability',
      `Role "${role}" is not assigned capability "${capability}"`,
    )
  }

  if (context.isSoftDeleted === true) {
    return decision(
      input,
      false,
      'resource_soft_deleted',
      'Resource is soft-deleted',
    )
  }

  if (context.isMerged === true) {
    return decision(input, false, 'resource_merged', 'Resource is merged')
  }

  if (flags.enforceModuleEnabled === true && moduleKey) {
    const module = getModule(moduleKey)
    if (!module) {
      return decision(
        input,
        false,
        'module_disabled',
        `Unknown module "${moduleKey}"`,
      )
    }
    if (module.featureFlag.enabled !== true) {
      return decision(
        input,
        false,
        'module_disabled',
        `Module "${moduleKey}" is not enabled`,
      )
    }
  }

  // Document owner-only visibility / capability (specific reason code).
  if (
    capability === 'document.owner_only.read' ||
    (capability === 'document.read' && isOwnerOnlyDocumentVisibility(context))
  ) {
    if (!roleDefinition.allowsOwnerOnlyOperations) {
      return decision(
        input,
        false,
        'document_owner_only',
        'Owner-only document access denied',
      )
    }
  }

  // Owner-only capability or generic owner-only resource flag.
  if (capabilityDefinition.ownerOnly || context.isOwnerOnly === true) {
    if (!roleDefinition.allowsOwnerOnlyOperations) {
      return decision(
        input,
        false,
        'owner_only',
        `Capability "${capability}" requires owner-only operations`,
      )
    }
  }

  // Client portal own-resource only.
  if (role === 'client') {
    if (capability === 'portal.read_own' || capability === 'portal.access') {
      if (!isPortalOwnResource(context)) {
        return decision(
          input,
          false,
          'portal_own_resource_only',
          'Client may only access own portal resources',
        )
      }
      return decision(input, true, 'allowed', 'Client own-resource access allowed')
    }
    return decision(
      input,
      false,
      'role_lacks_capability',
      'Client role cannot access CRM capabilities',
    )
  }

  // Owner broad allow after hard denials above.
  if (role === 'owner') {
    return decision(input, true, 'allowed', 'Owner capability allowed')
  }

  // Advisor ABAC: household-scoped capabilities require access context.
  if (role === 'advisor' || roleDefinition.requiresHouseholdAssignment) {
    if (capabilityDefinition.requiresHouseholdAccess) {
      if (isTaskAssignmentAlone(context) && context.resourceType === 'household') {
        return decision(
          input,
          false,
          'task_assignment_alone_insufficient',
          'Task assignment alone does not grant household access',
        )
      }

      // If resource is household-scoped (or unknown with householdId), require access.
      const needsHouseholdCheck =
        context.resourceType === 'household' ||
        context.resourceType === 'task' ||
        context.resourceType === 'case_draft' ||
        context.resourceType === 'activity' ||
        context.resourceType === 'lead' ||
        context.resourceType === 'assessment' ||
        context.resourceType === 'opportunity' ||
        context.resourceType === 'document_definition' ||
        Boolean(context.householdId)

      if (needsHouseholdCheck) {
        if (!context.currentUserId) {
          return decision(
            input,
            false,
            'missing_resource_context',
            'currentUserId is required for household-scoped advisor checks',
          )
        }
        if (
          !hasHouseholdAccessContext(context, {
            advisorsCanViewUnassignedPool: flags.advisorsCanViewUnassignedPool,
          })
        ) {
          // Distinguish task-only signal when present.
          if (isTaskAssignmentAlone(context)) {
            return decision(
              input,
              false,
              'task_assignment_alone_insufficient',
              'Task assignment alone does not grant household access',
            )
          }
          return decision(
            input,
            false,
            'household_access_denied',
            'Advisor lacks household access context',
          )
        }
      }
    }

    // Explicit owner-only capability denials already handled; keep workflow.publish blocked.
    if (capability === 'workflow.publish' || capability === 'intake.resolve_duplicate') {
      return decision(input, false, 'owner_only', `Advisor denied "${capability}"`)
    }
  }

  return decision(input, true, 'allowed', 'Capability allowed')
}

export function isPermissionAllowed(input: DecidePermissionInput): boolean {
  return decidePermission(input).allowed
}
