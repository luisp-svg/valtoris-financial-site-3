/**
 * Role → capability RBAC matrix (compiled metadata).
 * Does not grant runtime authorization by itself.
 */

import { isKnownCapability } from './capabilityCatalog'
import { listRoleKeys } from './roleCatalog'
import type { PermissionRoleKey } from './types'

const OWNER_CAPABILITIES = [
  'household.read',
  'household.create',
  'household.update',
  'household.assign',
  'household.delete',
  'intake.read',
  'intake.view',
  'intake.resolve_duplicate',
  'task.read',
  'task.create',
  'task.update',
  'task.complete',
  'task.reassign_any',
  'case.read',
  'case.create',
  'case.update',
  'case.write',
  'case.transition',
  'case.reassign',
  'document.read',
  'document.write',
  'document.upload',
  'document.review',
  'document.owner_only.read',
  'workflow.read',
  'workflow.publish',
  'module.configure',
  'settings.manage',
  'settings.view',
  'registry.read',
  'activity.read',
  'activity.create',
  'activity.write',
  'ai.run.internal',
  'notification.send.internal',
  'crm.nav.view',
  'dashboard.view',
  'opportunity.read',
  'appointment.read',
  'policy.read',
  'annual_review.read',
  'diagnostic.ifd.read',
  'diagnostic.ifd.ingest',
  'financial_progress.read',
  'financial_progress.compute',
  'insurance.case.read',
  'insurance.case.write',
  'credit.case.read',
  'credit.case.write',
  'funding.case.read',
  'funding.case.write',
] as const

const ADVISOR_CAPABILITIES = [
  'household.read',
  'household.update',
  'intake.read',
  'intake.view',
  'task.read',
  'task.create',
  'task.update',
  'task.complete',
  'case.read',
  'case.create',
  'case.update',
  'case.write',
  'case.transition',
  'document.read',
  'document.write',
  'document.upload',
  'document.review',
  'workflow.read',
  'settings.view',
  'registry.read',
  'activity.read',
  'activity.create',
  'activity.write',
  'crm.nav.view',
  'dashboard.view',
  'opportunity.read',
  'appointment.read',
  'policy.read',
  'annual_review.read',
  'diagnostic.ifd.read',
  'financial_progress.read',
  'financial_progress.compute',
  'insurance.case.read',
  'insurance.case.write',
  'credit.case.read',
  'credit.case.write',
  'funding.case.read',
  'funding.case.write',
] as const

/** Future roles — metadata capability sets for examples/tests only. */
const CREDIT_SPECIALIST_CAPABILITIES = [
  'crm.nav.view',
  'household.read',
  'task.read',
  'task.create',
  'task.update',
  'task.complete',
  'case.read',
  'case.update',
  'case.transition',
  'document.read',
  'document.upload',
  'document.review',
  'activity.read',
  'activity.create',
  'credit.case.read',
  'credit.case.write',
] as const

const CLIENT_CAPABILITIES = ['portal.read_own', 'portal.access'] as const

const ROLE_CAPABILITY_MAP: Record<PermissionRoleKey, readonly string[]> = {
  owner: OWNER_CAPABILITIES,
  advisor: ADVISOR_CAPABILITIES,
  admin: OWNER_CAPABILITIES,
  csr: [
    'crm.nav.view',
    'household.read',
    'intake.read',
    'intake.view',
    'task.read',
    'task.create',
    'task.update',
    'appointment.read',
    'activity.read',
  ],
  credit_specialist: CREDIT_SPECIALIST_CAPABILITIES,
  funding_specialist: [
    'crm.nav.view',
    'household.read',
    'task.read',
    'task.create',
    'task.update',
    'case.read',
    'document.read',
    'document.upload',
    'funding.case.read',
    'funding.case.write',
  ],
  insurance_specialist: [
    'crm.nav.view',
    'household.read',
    'task.read',
    'task.create',
    'task.update',
    'case.read',
    'document.read',
    'document.upload',
    'insurance.case.read',
    'insurance.case.write',
  ],
  client: CLIENT_CAPABILITIES,
  partner: ['household.read', 'crm.nav.view'],
}

export function listCapabilitiesForRole(role: string): string[] {
  const capabilities = ROLE_CAPABILITY_MAP[role as PermissionRoleKey]
  if (!capabilities) return []
  return [...capabilities].sort()
}

export function roleHasCapability(role: string, capability: string): boolean {
  const capabilities = ROLE_CAPABILITY_MAP[role as PermissionRoleKey]
  if (!capabilities) return false
  return capabilities.includes(capability)
}

export function validateRoleCapabilityMappings():
  | { ok: true }
  | { ok: false; errors: string[] } {
  const errors: string[] = []
  for (const role of listRoleKeys()) {
    const capabilities = ROLE_CAPABILITY_MAP[role]
    if (!capabilities) {
      errors.push(`Role "${role}" has no capability mapping`)
      continue
    }
    const unique = new Set(capabilities)
    if (unique.size !== capabilities.length) {
      errors.push(`Role "${role}" has duplicate capability assignments`)
    }
    for (const capability of capabilities) {
      if (!isKnownCapability(capability)) {
        errors.push(`Role "${role}" maps unknown capability "${capability}"`)
      }
    }
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}
