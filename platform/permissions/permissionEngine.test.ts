import { describe, expect, it } from 'vitest'
import {
  getCrmSidebarNavItems,
  getModule,
  listEnabledModules,
  moduleDeclaresPermission,
} from '../registry'
import {
  decidePermission,
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
  getCapabilityDefinition,
  isActivePermissionRole,
  isKnownCapability,
  isKnownRole,
  listCapabilityKeys,
  listCapabilitiesForRole,
  listRoleKeys,
  moduleDeclarationGrantsAccess,
  roleHasCapability,
  selectActiveRoles,
  selectFutureInactiveRoles,
  selectModulesDeclaringCapability,
  selectRoleCapabilityMatrix,
  validatePermissionEngine,
} from './index'

const ADVISOR_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_ID = '33333333-3333-4333-8333-333333333333'
const HOUSEHOLD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

describe('Permission Engine catalogs', () => {
  it('validates unique capabilities, roles, and mappings against Module Registry', () => {
    const result = validatePermissionEngine()
    expect(result).toEqual({ ok: true })

    const capabilities = listCapabilityKeys()
    expect(new Set(capabilities).size).toBe(capabilities.length)
    expect(capabilities).toEqual([...capabilities].sort())
    expect(capabilities).toEqual(
      expect.arrayContaining([
        'household.read',
        'intake.resolve_duplicate',
        'task.complete',
        'case.transition',
        'document.owner_only.read',
        'workflow.publish',
        'settings.manage',
        'portal.read_own',
      ]),
    )

    const roles = listRoleKeys()
    expect(new Set(roles).size).toBe(roles.length)
    expect(roles).toEqual(
      expect.arrayContaining([
        'owner',
        'advisor',
        'admin',
        'csr',
        'credit_specialist',
        'funding_specialist',
        'insurance_specialist',
        'client',
        'partner',
      ]),
    )

    for (const capability of capabilities) {
      expect(getCapabilityDefinition(capability)?.domain).toBeTruthy()
    }
  })

  it('keeps owner/advisor active and future roles inactive', () => {
    expect(isActivePermissionRole('owner')).toBe(true)
    expect(isActivePermissionRole('advisor')).toBe(true)
    expect(selectActiveRoles().map((item) => item.key).sort()).toEqual(['advisor', 'owner'])
    expect(selectFutureInactiveRoles().every((item) => item.futureOnly)).toBe(true)
    expect(isActivePermissionRole('credit_specialist')).toBe(false)
    expect(isActivePermissionRole('client')).toBe(false)
  })

  it('registers Permission Engine as enabled platform module without nav/auth grants', () => {
    const module = getModule('permissions')
    expect(module?.status).toBe('active')
    expect(module?.featureFlag.enabled).toBe(true)
    expect(module?.navigation.visible).toBe(false)
    expect(listEnabledModules().some((item) => item.key === 'permissions')).toBe(true)
    expect(moduleDeclaresPermission('permissions', 'registry.read')).toBe(true)
    expect(getCrmSidebarNavItems().some((item) => item.label === 'Permission Engine')).toBe(
      false,
    )
  })
})

describe('Permission Engine decisions', () => {
  it('fails closed for unknown roles and capabilities without throwing', () => {
    expect(isKnownRole('not_a_role')).toBe(false)
    expect(isKnownCapability('not.a.capability')).toBe(false)
    expect(
      decidePermission({ role: 'not_a_role', capability: 'household.read' }),
    ).toMatchObject({ allowed: false, reasonCode: 'unknown_role' })
    expect(
      decidePermission({ role: 'owner', capability: 'not.a.capability' }),
    ).toMatchObject({ allowed: false, reasonCode: 'unknown_capability' })
  })

  it('preserves owner/advisor compatibility behavior', () => {
    expect(exampleOwnerReadsHousehold()).toMatchObject({
      allowed: true,
      reasonCode: 'allowed',
    })
    expect(exampleAdvisorReadsAssignedHousehold()).toMatchObject({
      allowed: true,
      reasonCode: 'allowed',
    })
    expect(exampleAdvisorDeniedUnassignedHousehold()).toMatchObject({
      allowed: false,
      reasonCode: 'household_access_denied',
    })
    expect(exampleAdvisorCompletesAuthorizedTask()).toMatchObject({
      allowed: true,
      reasonCode: 'allowed',
    })
    expect(exampleTaskAssignmentAloneDenied()).toMatchObject({
      allowed: false,
      reasonCode: 'task_assignment_alone_insufficient',
    })
    expect(exampleOwnerResolvesDuplicate()).toMatchObject({ allowed: true })
    expect(exampleAdvisorDeniedDuplicateResolution()).toMatchObject({
      allowed: false,
      reasonCode: 'role_lacks_capability',
    })
    expect(exampleOwnerManagesSettings()).toMatchObject({ allowed: true })
    expect(
      decidePermission({
        role: 'advisor',
        capability: 'settings.manage',
      }),
    ).toMatchObject({ allowed: false, reasonCode: 'role_lacks_capability' })
    expect(
      decidePermission({
        role: 'advisor',
        capability: 'workflow.publish',
      }),
    ).toMatchObject({ allowed: false })
    expect(
      decidePermission({
        role: 'advisor',
        capability: 'task.reassign_any',
      }),
    ).toMatchObject({ allowed: false })
  })

  it('denies soft-deleted and merged resources', () => {
    expect(
      decidePermission({
        role: 'owner',
        capability: 'household.read',
        resourceContext: {
          resourceType: 'household',
          householdId: HOUSEHOLD_ID,
          isSoftDeleted: true,
        },
      }),
    ).toMatchObject({ allowed: false, reasonCode: 'resource_soft_deleted' })

    expect(
      decidePermission({
        role: 'advisor',
        capability: 'household.read',
        resourceContext: {
          resourceType: 'household',
          householdId: HOUSEHOLD_ID,
          currentUserId: ADVISOR_ID,
          assignedAdvisorUserId: ADVISOR_ID,
          isMerged: true,
        },
      }),
    ).toMatchObject({ allowed: false, reasonCode: 'resource_merged' })
  })

  it('keeps future roles inactive and client portal metadata-only', () => {
    expect(exampleCreditSpecialistMetadata()).toMatchObject({
      allowed: false,
      reasonCode: 'inactive_role',
    })
    expect(exampleCreditSpecialistMetadata({ allowInactiveRoles: true })).toMatchObject({
      allowed: true,
      reasonCode: 'allowed',
    })
    expect(exampleClientPortalOwnResource()).toMatchObject({
      allowed: false,
      reasonCode: 'inactive_role',
    })
    expect(exampleClientPortalOwnResource({ allowInactiveRoles: true })).toMatchObject({
      allowed: true,
      reasonCode: 'allowed',
    })
    expect(
      decidePermission({
        role: 'client',
        capability: 'portal.read_own',
        resourceContext: {
          currentUserId: ADVISOR_ID,
          clientPortalUserId: OTHER_ID,
        },
        flags: { allowInactiveRoles: true },
      }),
    ).toMatchObject({ allowed: false, reasonCode: 'portal_own_resource_only' })
  })

  it('handles owner-only documents and module declaration non-grants', () => {
    const docs = exampleOwnerOnlyDocumentVisibility()
    expect(docs.owner).toMatchObject({ allowed: true })
    expect(docs.advisor).toMatchObject({
      allowed: false,
      reasonCode: 'document_owner_only',
    })

    expect(moduleDeclaresPermission('credit_repair', 'credit.case.read')).toBe(true)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(moduleDeclarationGrantsAccess('credit_repair', 'advisor', 'credit.case.read')).toBe(
      false,
    )
    const disabled = exampleDisabledModuleDeclarationDoesNotGrantAccess()
    expect(disabled.decision).toMatchObject({
      allowed: false,
      reasonCode: 'module_disabled',
    })
    // Without enforceModuleEnabled, role capability + household access may still allow
    // the capability — declarations themselves still do not grant access.
    expect(
      decidePermission({
        role: 'advisor',
        capability: 'credit.case.read',
        moduleKey: 'credit_repair',
        resourceContext: {
          resourceType: 'case_draft',
          householdId: HOUSEHOLD_ID,
          currentUserId: ADVISOR_ID,
          assignedAdvisorUserId: ADVISOR_ID,
        },
      }).allowed,
    ).toBe(true)
  })
})

describe('Permission Engine selectors', () => {
  it('is pure, deterministic, and does not mutate role capability lists', () => {
    const first = listCapabilitiesForRole('advisor')
    const snapshot = [...first]
    const second = listCapabilitiesForRole('advisor')
    expect(first).toEqual(snapshot)
    expect(second).toEqual(snapshot)
    expect(roleHasCapability('owner', 'intake.resolve_duplicate')).toBe(true)
    expect(roleHasCapability('advisor', 'intake.resolve_duplicate')).toBe(false)

    const matrix = selectRoleCapabilityMatrix()
    expect(matrix.map((item) => item.role)).toEqual([...matrix.map((item) => item.role)].sort())
    expect(selectModulesDeclaringCapability('document.read')).toEqual(
      expect.arrayContaining(['documents', 'documents_nav']),
    )
  })
})
