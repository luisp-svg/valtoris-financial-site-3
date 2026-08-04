/**
 * Pure permission decision examples.
 * Do not change CRM runtime behavior, RLS, RPCs, routes, or UI.
 */

import { decidePermission } from './decision'
import type { PermissionDecision } from './types'

const OWNER_ID = '11111111-1111-4111-8111-111111111111'
const ADVISOR_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_ADVISOR_ID = '33333333-3333-4333-8333-333333333333'
const HOUSEHOLD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TASK_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CLIENT_USER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

/** 1. Owner reads any active household. */
export function exampleOwnerReadsHousehold(): PermissionDecision {
  return decidePermission({
    role: 'owner',
    capability: 'household.read',
    resourceContext: {
      resourceType: 'household',
      resourceId: HOUSEHOLD_ID,
      householdId: HOUSEHOLD_ID,
      currentUserId: OWNER_ID,
      assignedAdvisorUserId: ADVISOR_ID,
    },
  })
}

/** 2. Advisor reads assigned household. */
export function exampleAdvisorReadsAssignedHousehold(): PermissionDecision {
  return decidePermission({
    role: 'advisor',
    capability: 'household.read',
    resourceContext: {
      resourceType: 'household',
      resourceId: HOUSEHOLD_ID,
      householdId: HOUSEHOLD_ID,
      currentUserId: ADVISOR_ID,
      assignedAdvisorUserId: ADVISOR_ID,
    },
  })
}

/** 3. Advisor denied unassigned household when pool viewing is off. */
export function exampleAdvisorDeniedUnassignedHousehold(): PermissionDecision {
  return decidePermission({
    role: 'advisor',
    capability: 'household.read',
    resourceContext: {
      resourceType: 'household',
      resourceId: HOUSEHOLD_ID,
      householdId: HOUSEHOLD_ID,
      currentUserId: ADVISOR_ID,
      assignedAdvisorUserId: null,
      isUnassigned: true,
    },
    flags: { advisorsCanViewUnassignedPool: false },
  })
}

/** 4. Advisor completes a task in an authorized household. */
export function exampleAdvisorCompletesAuthorizedTask(): PermissionDecision {
  return decidePermission({
    role: 'advisor',
    capability: 'task.complete',
    resourceContext: {
      resourceType: 'task',
      resourceId: TASK_ID,
      householdId: HOUSEHOLD_ID,
      currentUserId: ADVISOR_ID,
      assignedAdvisorUserId: ADVISOR_ID,
      taskAssigneeUserId: ADVISOR_ID,
    },
  })
}

/** 5. Task assignment alone does not grant household access. */
export function exampleTaskAssignmentAloneDenied(): PermissionDecision {
  return decidePermission({
    role: 'advisor',
    capability: 'household.read',
    resourceContext: {
      resourceType: 'household',
      resourceId: HOUSEHOLD_ID,
      householdId: HOUSEHOLD_ID,
      currentUserId: ADVISOR_ID,
      assignedAdvisorUserId: OTHER_ADVISOR_ID,
      taskAssigneeUserId: ADVISOR_ID,
    },
  })
}

/** 6. Owner resolves duplicate. */
export function exampleOwnerResolvesDuplicate(): PermissionDecision {
  return decidePermission({
    role: 'owner',
    capability: 'intake.resolve_duplicate',
    resourceContext: {
      resourceType: 'lead',
      currentUserId: OWNER_ID,
    },
  })
}

/** 7. Advisor denied duplicate resolution. */
export function exampleAdvisorDeniedDuplicateResolution(): PermissionDecision {
  return decidePermission({
    role: 'advisor',
    capability: 'intake.resolve_duplicate',
    resourceContext: {
      resourceType: 'lead',
      currentUserId: ADVISOR_ID,
      assignedAdvisorUserId: ADVISOR_ID,
      householdId: HOUSEHOLD_ID,
    },
  })
}

/** 8. Owner manages settings. */
export function exampleOwnerManagesSettings(): PermissionDecision {
  return decidePermission({
    role: 'owner',
    capability: 'settings.manage',
    resourceContext: { resourceType: 'settings', currentUserId: OWNER_ID },
  })
}

/** 9. Future credit specialist metadata example (inactive unless flag set). */
export function exampleCreditSpecialistMetadata(options?: {
  allowInactiveRoles?: boolean
}): PermissionDecision {
  return decidePermission({
    role: 'credit_specialist',
    capability: 'credit.case.read',
    resourceContext: {
      resourceType: 'case_draft',
      householdId: HOUSEHOLD_ID,
      currentUserId: ADVISOR_ID,
      assignedAdvisorUserId: ADVISOR_ID,
      moduleKey: 'credit_repair',
    },
    flags: { allowInactiveRoles: options?.allowInactiveRoles === true },
  })
}

/** 10. Client portal own-resource example (still inactive by default). */
export function exampleClientPortalOwnResource(options?: {
  allowInactiveRoles?: boolean
}): PermissionDecision {
  return decidePermission({
    role: 'client',
    capability: 'portal.read_own',
    resourceContext: {
      resourceType: 'portal_account',
      currentUserId: CLIENT_USER_ID,
      clientPortalUserId: CLIENT_USER_ID,
      householdId: HOUSEHOLD_ID,
    },
    flags: { allowInactiveRoles: options?.allowInactiveRoles === true },
  })
}

/** 11. Owner-only document visibility. */
export function exampleOwnerOnlyDocumentVisibility(): {
  owner: PermissionDecision
  advisor: PermissionDecision
} {
  const context = {
    resourceType: 'document_definition' as const,
    householdId: HOUSEHOLD_ID,
    visibility: 'owner_only',
    isOwnerOnly: true,
    assignedAdvisorUserId: ADVISOR_ID,
  }
  return {
    owner: decidePermission({
      role: 'owner',
      capability: 'document.owner_only.read',
      resourceContext: { ...context, currentUserId: OWNER_ID },
    }),
    advisor: decidePermission({
      role: 'advisor',
      capability: 'document.read',
      resourceContext: { ...context, currentUserId: ADVISOR_ID },
    }),
  }
}

/** 12. Disabled module capability declaration does not grant access. */
export function exampleDisabledModuleDeclarationDoesNotGrantAccess(): {
  moduleDeclares: boolean
  decision: PermissionDecision
} {
  return {
    moduleDeclares: true, // credit_repair declares credit.case.read in registry
    decision: decidePermission({
      role: 'advisor',
      capability: 'credit.case.read',
      moduleKey: 'credit_repair',
      resourceContext: {
        resourceType: 'case_draft',
        householdId: HOUSEHOLD_ID,
        currentUserId: ADVISOR_ID,
        assignedAdvisorUserId: ADVISOR_ID,
        moduleKey: 'credit_repair',
      },
      flags: { enforceModuleEnabled: true },
    }),
  }
}
