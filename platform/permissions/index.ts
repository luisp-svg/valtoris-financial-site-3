/**
 * Platform Permission Engine — public API (Sprint 4B.7 foundation).
 *
 * TypeScript contracts only:
 * - no RLS / RPC / profiles.role changes
 * - no CrmShell / route / nav wiring
 * - no role tables or migrations
 * - Supabase remains authoritative for row access
 */

export type {
  DecidePermissionInput,
  PermissionCapabilityDefinition,
  PermissionCapabilityDomain,
  PermissionCapabilityKey,
  PermissionDecision,
  PermissionDecisionFlags,
  PermissionDenyReasonCode,
  PermissionResourceContext,
  PermissionResourceType,
  PermissionRoleDefinition,
  PermissionRoleKey,
  PermissionRoleStatus,
} from './types'

export {
  CAPABILITY_DEFINITIONS,
  getCapabilityDefinition,
  isKnownCapability,
  listCapabilityDefinitions,
  listCapabilityKeys,
  requireCapabilityDefinition,
  validateCapabilityCatalog,
} from './capabilityCatalog'

export {
  ROLE_DEFINITIONS,
  getRoleDefinition,
  isActivePermissionRole,
  isKnownRole,
  listRoleDefinitions,
  listRoleKeys,
  requireRoleDefinition,
  validateRoleCatalog,
} from './roleCatalog'

export {
  listCapabilitiesForRole,
  roleHasCapability,
  validateRoleCapabilityMappings,
} from './roleCapabilities'

export {
  hasHouseholdAccessContext,
  isOwnerOnlyDocumentVisibility,
  isPortalOwnResource,
  isTaskAssignmentAlone,
  normalizeResourceContext,
} from './resourceContext'

export { decidePermission, isPermissionAllowed } from './decision'

export {
  decideMany,
  getRoleDisplayName,
  moduleDeclarationGrantsAccess,
  selectActiveRoles,
  selectAllowedCapabilitiesForRole,
  selectCapabilitiesByDomain,
  selectFutureInactiveRoles,
  selectModulesDeclaringCapability,
  selectOwnerOnlyCapabilities,
  selectRoleCapabilityMatrix,
} from './selectors'

export {
  exampleAdvisorCompletesAuthorizedTask,
  exampleAdvisorDeniedDuplicateResolution,
  exampleAdvisorDeniedUnassignedHousehold,
  exampleAdvisorReadsAssignedHousehold,
  exampleClientPortalOwnResource,
  exampleCreditSpecialistMetadata,
  exampleDisabledModuleDeclarationDoesNotGrantAccess,
  exampleOwnerManagesSettings,
  exampleOwnerOnlyDocumentVisibility,
  exampleOwnerReadsHousehold,
  exampleOwnerResolvesDuplicate,
  exampleTaskAssignmentAloneDenied,
} from './examples'

import { validateCapabilityCatalog } from './capabilityCatalog'
import { validateRoleCatalog } from './roleCatalog'
import { validateRoleCapabilityMappings } from './roleCapabilities'
import { listModules, moduleDeclaresPermission } from '../registry'
import { isKnownCapability } from './capabilityCatalog'

/**
 * Validate catalogs + ensure Module Registry declarations reference known capabilities.
 * Declarations still do not grant authorization.
 */
export function validatePermissionEngine():
  | { ok: true }
  | { ok: false; errors: string[] } {
  const errors: string[] = []
  const capability = validateCapabilityCatalog()
  if (!capability.ok) errors.push(...capability.errors)
  const roles = validateRoleCatalog()
  if (!roles.ok) errors.push(...roles.errors)
  const mappings = validateRoleCapabilityMappings()
  if (!mappings.ok) errors.push(...mappings.errors)

  for (const module of listModules()) {
    for (const permission of module.permissions) {
      if (!isKnownCapability(permission)) {
        errors.push(
          `Module "${module.key}" declares unknown capability "${permission}"`,
        )
      }
      // Touch helper to keep declaration semantics explicit in validation surface.
      void moduleDeclaresPermission(module.key, permission)
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}
