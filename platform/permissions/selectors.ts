/**
 * Permission selectors — pure / deterministic helpers.
 * Do not mutate source arrays and do not query Supabase.
 */

import { listCapabilityDefinitions, listCapabilityKeys } from './capabilityCatalog'
import { decidePermission } from './decision'
import { getModule, listModules, moduleDeclaresPermission } from '../registry'
import { listCapabilitiesForRole, roleHasCapability } from './roleCapabilities'
import {
  getRoleDefinition,
  isActivePermissionRole,
  listRoleDefinitions,
  listRoleKeys,
} from './roleCatalog'
import type {
  DecidePermissionInput,
  PermissionCapabilityDefinition,
  PermissionDecision,
  PermissionRoleDefinition,
} from './types'

export function selectActiveRoles(): PermissionRoleDefinition[] {
  return listRoleDefinitions()
    .filter((role) => role.status === 'active')
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key))
}

export function selectFutureInactiveRoles(): PermissionRoleDefinition[] {
  return listRoleDefinitions()
    .filter((role) => role.status === 'future_inactive')
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key))
}

export function selectCapabilitiesByDomain(
  domain: string,
): PermissionCapabilityDefinition[] {
  return listCapabilityDefinitions()
    .filter((item) => item.domain === domain)
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key))
}

export function selectOwnerOnlyCapabilities(): PermissionCapabilityDefinition[] {
  return listCapabilityDefinitions()
    .filter((item) => item.ownerOnly === true)
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key))
}

export function selectRoleCapabilityMatrix(): Array<{
  role: string
  capabilities: string[]
  active: boolean
}> {
  return listRoleKeys().map((role) => ({
    role,
    capabilities: listCapabilitiesForRole(role),
    active: isActivePermissionRole(role),
  }))
}

/**
 * Module Registry may declare capabilities, but declarations never grant access.
 * Returns modules that declare a capability without implying authorization.
 */
export function selectModulesDeclaringCapability(capability: string): string[] {
  return listModules()
    .filter((module) => moduleDeclaresPermission(module.key, capability))
    .map((module) => module.key)
    .sort()
}

/**
 * Disabled-module capability declaration does not grant access.
 */
export function moduleDeclarationGrantsAccess(
  moduleKey: string,
  role: string,
  capability: string,
): boolean {
  const module = getModule(moduleKey)
  if (!module) return false
  if (!moduleDeclaresPermission(moduleKey, capability)) return false
  // Declarations never grant — even if role also has the capability, this helper
  // answers the "declaration alone" question as false.
  void role
  return false
}

export function decideMany(
  inputs: readonly DecidePermissionInput[],
): PermissionDecision[] {
  return inputs.map((input) => decidePermission(input))
}

export function selectAllowedCapabilitiesForRole(
  role: string,
  capabilities: readonly string[] = listCapabilityKeys(),
): string[] {
  return capabilities
    .filter((capability) => roleHasCapability(role, capability))
    .slice()
    .sort()
}

export function getRoleDisplayName(role: string): string | undefined {
  return getRoleDefinition(role)?.displayName
}
