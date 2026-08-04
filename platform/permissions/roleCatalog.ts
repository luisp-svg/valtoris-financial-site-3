/**
 * Role catalog — active owner/advisor + future inactive roles (metadata only).
 */

import type { PermissionRoleDefinition, PermissionRoleKey } from './types'

export const ROLE_DEFINITIONS: readonly PermissionRoleDefinition[] = [
  {
    key: 'owner',
    displayName: 'Owner',
    description: 'Firm owner with broad operations access (compatible with current CRM auth).',
    status: 'active',
    system: true,
    futureOnly: false,
    requiresHouseholdAssignment: false,
    allowsOwnerOnlyOperations: true,
    allowedModuleScopes: ['*'],
  },
  {
    key: 'advisor',
    displayName: 'Advisor',
    description:
      'Advisor with household-scoped access according to assignment rules (compatible with current CRM auth).',
    status: 'active',
    system: true,
    futureOnly: false,
    requiresHouseholdAssignment: true,
    allowsOwnerOnlyOperations: false,
    allowedModuleScopes: ['households', 'intake', 'tasks', 'opportunities', 'cases', 'documents'],
  },
  {
    key: 'admin',
    displayName: 'Admin',
    description: 'Future firm admin role (metadata only — not runtime-enabled).',
    status: 'future_inactive',
    system: true,
    futureOnly: true,
    requiresHouseholdAssignment: false,
    allowsOwnerOnlyOperations: true,
    allowedModuleScopes: ['*'],
  },
  {
    key: 'csr',
    displayName: 'CSR',
    description: 'Future customer service role (metadata only).',
    status: 'future_inactive',
    system: true,
    futureOnly: true,
    requiresHouseholdAssignment: true,
    allowsOwnerOnlyOperations: false,
    allowedModuleScopes: ['households', 'intake', 'tasks', 'appointments'],
  },
  {
    key: 'credit_specialist',
    displayName: 'Credit Specialist',
    description: 'Future credit repair specialist (metadata only).',
    status: 'future_inactive',
    system: true,
    futureOnly: true,
    requiresHouseholdAssignment: true,
    allowsOwnerOnlyOperations: false,
    allowedModuleScopes: ['credit_repair', 'households', 'documents', 'tasks'],
  },
  {
    key: 'funding_specialist',
    displayName: 'Funding Specialist',
    description: 'Future business funding specialist (metadata only).',
    status: 'future_inactive',
    system: true,
    futureOnly: true,
    requiresHouseholdAssignment: true,
    allowsOwnerOnlyOperations: false,
    allowedModuleScopes: ['business_funding', 'households', 'documents', 'tasks'],
  },
  {
    key: 'insurance_specialist',
    displayName: 'Insurance Specialist',
    description: 'Future insurance specialist (metadata only).',
    status: 'future_inactive',
    system: true,
    futureOnly: true,
    requiresHouseholdAssignment: true,
    allowsOwnerOnlyOperations: false,
    allowedModuleScopes: ['insurance', 'households', 'documents', 'tasks'],
  },
  {
    key: 'client',
    displayName: 'Client',
    description:
      'Future client portal role (metadata only — no CRM table access implied). DB enum reserved.',
    status: 'future_inactive',
    system: true,
    futureOnly: true,
    requiresHouseholdAssignment: false,
    allowsOwnerOnlyOperations: false,
    allowedModuleScopes: ['client_portal'],
  },
  {
    key: 'partner',
    displayName: 'Partner',
    description: 'Future partner role (metadata only).',
    status: 'future_inactive',
    system: true,
    futureOnly: true,
    requiresHouseholdAssignment: true,
    allowsOwnerOnlyOperations: false,
    allowedModuleScopes: ['households'],
  },
] as const

const BY_KEY = new Map(ROLE_DEFINITIONS.map((item) => [item.key, item]))

export function listRoleDefinitions(): readonly PermissionRoleDefinition[] {
  return ROLE_DEFINITIONS
}

export function listRoleKeys(): PermissionRoleKey[] {
  return ROLE_DEFINITIONS.map((item) => item.key).sort() as PermissionRoleKey[]
}

export function getRoleDefinition(key: string): PermissionRoleDefinition | undefined {
  return BY_KEY.get(key as PermissionRoleKey)
}

export function isKnownRole(key: string): boolean {
  return BY_KEY.has(key as PermissionRoleKey)
}

export function isActivePermissionRole(key: string): boolean {
  return getRoleDefinition(key)?.status === 'active'
}

export function requireRoleDefinition(key: string): PermissionRoleDefinition {
  const definition = getRoleDefinition(key)
  if (!definition) {
    throw new Error(`Permission Engine: unknown role "${key}"`)
  }
  return definition
}

export function validateRoleCatalog(): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const keys = new Set<string>()
  for (const definition of ROLE_DEFINITIONS) {
    if (keys.has(definition.key)) {
      errors.push(`Duplicate role key "${definition.key}"`)
    }
    keys.add(definition.key)
  }
  if (!keys.has('owner') || !keys.has('advisor')) {
    errors.push('Active compatibility roles owner/advisor are required')
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}
