/**
 * Central capability catalog — no arbitrary capability strings outside this list.
 */

import type { PermissionCapabilityDefinition, PermissionCapabilityKey } from './types'

function defineCapability(
  key: PermissionCapabilityKey,
  domain: PermissionCapabilityDefinition['domain'],
  description: string,
  extras: Partial<
    Pick<PermissionCapabilityDefinition, 'ownerOnly' | 'requiresHouseholdAccess'>
  > = {},
): PermissionCapabilityDefinition {
  return { key, domain, description, ...extras }
}

/**
 * Canonical Permission Engine capabilities (resource.action).
 * Includes sprint keys plus Module Registry compatibility keys.
 */
export const CAPABILITY_DEFINITIONS: readonly PermissionCapabilityDefinition[] = [
  // Household
  defineCapability('household.read', 'household', 'Read household records', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('household.create', 'household', 'Create households', { ownerOnly: true }),
  defineCapability('household.update', 'household', 'Update household fields', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('household.assign', 'household', 'Assign household advisors', {
    ownerOnly: true,
  }),
  defineCapability('household.delete', 'household', 'Hard-delete households', { ownerOnly: true }),

  // Intake
  defineCapability('intake.read', 'intake', 'Read intake queue / leads', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('intake.view', 'intake', 'Registry-compatible intake view alias'),
  defineCapability('intake.resolve_duplicate', 'intake', 'Resolve duplicate reviews', {
    ownerOnly: true,
  }),

  // Tasks
  defineCapability('task.read', 'task', 'Read tasks', { requiresHouseholdAccess: true }),
  defineCapability('task.create', 'task', 'Create tasks', { requiresHouseholdAccess: true }),
  defineCapability('task.update', 'task', 'Update tasks', { requiresHouseholdAccess: true }),
  defineCapability('task.complete', 'task', 'Complete tasks', { requiresHouseholdAccess: true }),
  defineCapability('task.reassign_any', 'task', 'Reassign any task assignee', { ownerOnly: true }),

  // Cases
  defineCapability('case.read', 'case', 'Read cases / case drafts', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('case.create', 'case', 'Create cases', { requiresHouseholdAccess: true }),
  defineCapability('case.update', 'case', 'Update cases', { requiresHouseholdAccess: true }),
  defineCapability('case.write', 'case', 'Registry-compatible case write alias', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('case.transition', 'case', 'Transition case status/stage', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('case.reassign', 'case', 'Reassign case ownership', { ownerOnly: true }),

  // Documents
  defineCapability('document.read', 'document', 'Read documents', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('document.write', 'document', 'Registry-compatible document write alias', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('document.upload', 'document', 'Upload documents (future)', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('document.review', 'document', 'Review documents', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('document.owner_only.read', 'document', 'Read owner-only documents', {
    ownerOnly: true,
  }),

  // Workflow
  defineCapability('workflow.read', 'workflow', 'Read workflow definitions'),
  defineCapability('workflow.publish', 'workflow', 'Publish workflow definitions', {
    ownerOnly: true,
  }),

  // Module / settings / registry
  defineCapability('module.configure', 'module', 'Configure module settings', { ownerOnly: true }),
  defineCapability('settings.manage', 'settings', 'Manage firm settings', { ownerOnly: true }),
  defineCapability('settings.view', 'settings', 'View settings navigation'),
  defineCapability('registry.read', 'registry', 'Read module registry metadata'),

  // Activity
  defineCapability('activity.read', 'activity', 'Read activities', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('activity.create', 'activity', 'Create activities', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('activity.write', 'activity', 'Registry-compatible activity write alias', {
    requiresHouseholdAccess: true,
  }),

  // AI / portal / notifications
  defineCapability('ai.run.internal', 'ai', 'Run internal AI use-cases', { ownerOnly: true }),
  defineCapability('portal.read_own', 'portal', 'Client portal read of own resources'),
  defineCapability('portal.access', 'portal', 'Registry-compatible portal access alias'),
  defineCapability('notification.send.internal', 'notification', 'Send internal notifications', {
    ownerOnly: true,
  }),

  // CRM shell / opportunities / misc registry compatibility
  defineCapability('crm.nav.view', 'crm', 'View CRM navigation'),
  defineCapability('dashboard.view', 'crm', 'View CRM dashboard'),
  defineCapability('opportunity.read', 'opportunity', 'Read opportunities', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('appointment.read', 'appointment', 'Read appointments', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('policy.read', 'policy', 'Read policies', { requiresHouseholdAccess: true }),
  defineCapability('annual_review.read', 'annual_review', 'Read annual reviews', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('diagnostic.ifd.read', 'diagnostic', 'Read IFD diagnostics'),
  defineCapability('diagnostic.ifd.ingest', 'diagnostic', 'Ingest IFD submissions', {
    ownerOnly: true,
  }),
  defineCapability('financial_progress.read', 'financial_progress', 'Read Financial Progress'),
  defineCapability(
    'financial_progress.compute',
    'financial_progress',
    'Compute Financial Progress',
  ),
  defineCapability('insurance.case.read', 'case', 'Read insurance cases', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('insurance.case.write', 'case', 'Write insurance cases', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('credit.case.read', 'case', 'Read credit cases', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('credit.case.write', 'case', 'Write credit cases', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('funding.case.read', 'case', 'Read funding cases', {
    requiresHouseholdAccess: true,
  }),
  defineCapability('funding.case.write', 'case', 'Write funding cases', {
    requiresHouseholdAccess: true,
  }),

  // Digital Identity (Sprint 5.2 declarations — not runtime-wired)
  defineCapability('digital_identity.read_own', 'digital_identity', 'Read own digital identity surfaces'),
  defineCapability('digital_identity.write_own', 'digital_identity', 'Edit allowed own digital identity fields'),
  defineCapability(
    'digital_identity.publish_own',
    'digital_identity',
    'Publish or request publish for own surfaces',
  ),
  defineCapability('digital_identity.admin', 'digital_identity', 'Manage all digital identity surfaces', {
    ownerOnly: true,
  }),
  defineCapability(
    'digital_identity.campaigns.manage_own',
    'digital_identity',
    'Manage own digital identity campaigns',
  ),
  defineCapability(
    'digital_identity.campaigns.admin',
    'digital_identity',
    'Admin all digital identity campaigns',
    { ownerOnly: true },
  ),
  defineCapability(
    'digital_identity.analytics.read_own',
    'digital_identity',
    'Read own digital identity analytics',
  ),
  defineCapability(
    'digital_identity.analytics.read_all',
    'digital_identity',
    'Read agency digital identity analytics',
    { ownerOnly: true },
  ),
  defineCapability('digital_identity.lead.read', 'digital_identity', 'Read digital identity leads', {
    requiresHouseholdAccess: true,
  }),
] as const

const BY_KEY = new Map(CAPABILITY_DEFINITIONS.map((item) => [item.key, item]))

export function listCapabilityDefinitions(): readonly PermissionCapabilityDefinition[] {
  return CAPABILITY_DEFINITIONS
}

export function listCapabilityKeys(): string[] {
  return CAPABILITY_DEFINITIONS.map((item) => item.key).sort()
}

export function getCapabilityDefinition(
  key: string,
): PermissionCapabilityDefinition | undefined {
  return BY_KEY.get(key)
}

export function isKnownCapability(key: string): boolean {
  return BY_KEY.has(key)
}

export function requireCapabilityDefinition(key: string): PermissionCapabilityDefinition {
  const definition = getCapabilityDefinition(key)
  if (!definition) {
    throw new Error(`Permission Engine: unknown capability "${key}"`)
  }
  return definition
}

export function validateCapabilityCatalog(): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const keys = new Set<string>()
  for (const definition of CAPABILITY_DEFINITIONS) {
    if (keys.has(definition.key)) {
      errors.push(`Duplicate capability key "${definition.key}"`)
    }
    keys.add(definition.key)
    if (!definition.key.includes('.')) {
      errors.push(`Capability "${definition.key}" must use resource.action form`)
    }
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}
