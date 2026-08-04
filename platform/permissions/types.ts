/**
 * Permission Engine types — Platform Constitution (Sprint 4B.7).
 *
 * TypeScript-first foundation only. No RLS changes, no role tables,
 * no runtime auth wiring, no migrations, no UI.
 *
 * Boundaries:
 * - RBAC = role → capability matrix (general allow)
 * - ABAC = resource-context checks (household assignment, owner-only, etc.)
 * - Decisions are UX/contract helpers — Supabase RLS/RPCs remain authoritative
 * - Caller-supplied ResourceContext is NOT verified database truth
 * - Module Registry capability declarations do NOT grant roles permission
 * - Future roles are metadata only and fail closed unless explicitly enabled
 *   in example/test flags
 */

export type PermissionRoleKey =
  | 'owner'
  | 'advisor'
  | 'admin'
  | 'csr'
  | 'credit_specialist'
  | 'funding_specialist'
  | 'insurance_specialist'
  | 'client'
  | 'partner'

export type PermissionRoleStatus = 'active' | 'future_inactive'

/** Capability domains for catalog validation. */
export type PermissionCapabilityDomain =
  | 'household'
  | 'intake'
  | 'task'
  | 'case'
  | 'document'
  | 'workflow'
  | 'module'
  | 'activity'
  | 'settings'
  | 'ai'
  | 'portal'
  | 'opportunity'
  | 'crm'
  | 'diagnostic'
  | 'financial_progress'
  | 'registry'
  | 'notification'
  | 'appointment'
  | 'policy'
  | 'annual_review'
  | 'digital_identity'

export type PermissionCapabilityKey = string

export type PermissionResourceType =
  | 'household'
  | 'lead'
  | 'assessment'
  | 'task'
  | 'activity'
  | 'case_draft'
  | 'document_definition'
  | 'workflow_definition'
  | 'module'
  | 'settings'
  | 'opportunity'
  | 'portal_account'
  | 'unknown'

export type PermissionDenyReasonCode =
  | 'allowed'
  | 'unknown_role'
  | 'inactive_role'
  | 'unknown_capability'
  | 'role_lacks_capability'
  | 'missing_resource_context'
  | 'household_access_denied'
  | 'task_assignment_alone_insufficient'
  | 'owner_only'
  | 'resource_soft_deleted'
  | 'resource_merged'
  | 'document_owner_only'
  | 'portal_own_resource_only'
  | 'module_disabled'
  | 'invalid_flags'

export type PermissionCapabilityDefinition = {
  key: PermissionCapabilityKey
  domain: PermissionCapabilityDomain
  description: string
  /** When true, only owner (or future elevated roles) may receive this capability. */
  ownerOnly?: boolean
  /** When true, typically requires household assignment context for advisors. */
  requiresHouseholdAccess?: boolean
}

export type PermissionRoleDefinition = {
  key: PermissionRoleKey
  displayName: string
  description: string
  status: PermissionRoleStatus
  /** True for built-in system roles in the catalog. */
  system: boolean
  /** True when role is not usable by runtime auth today. */
  futureOnly: boolean
  /** Whether household assignment is generally required for resource access. */
  requiresHouseholdAssignment: boolean
  /** Whether owner-only operations are allowed for this role. */
  allowsOwnerOnlyOperations: boolean
  /** Metadata-only module scope hints (not runtime enablement). */
  allowedModuleScopes: readonly string[]
}

/**
 * Caller-provided resource facts for pure ABAC evaluation.
 * Not queried from Supabase and not treated as verified DB truth.
 */
export type PermissionResourceContext = {
  resourceType?: PermissionResourceType
  resourceId?: string | null
  householdId?: string | null
  assignedAdvisorUserId?: string | null
  currentUserId?: string | null
  createdByUserId?: string | null
  ownerUserId?: string | null
  moduleKey?: string | null
  caseOwnerUserId?: string | null
  taskAssigneeUserId?: string | null
  visibility?: string | null
  isUnassigned?: boolean
  isSoftDeleted?: boolean
  isMerged?: boolean
  isOwnerOnly?: boolean
  clientPortalUserId?: string | null
}

export type PermissionDecisionFlags = {
  /**
   * Mirrors app_settings.advisors_can_view_unassigned_pool.enabled.
   * Caller-supplied only — not loaded from DB by this engine.
   */
  advisorsCanViewUnassignedPool?: boolean
  /**
   * Test/example escape hatch to evaluate future_inactive roles.
   * Must never be wired into production CRM auth.
   */
  allowInactiveRoles?: boolean
  /**
   * When true, module feature-flag disabled still blocks capability use
   * if moduleKey is provided and module is disabled.
   */
  enforceModuleEnabled?: boolean
}

export type DecidePermissionInput = {
  role: string
  capability: string
  resourceContext?: PermissionResourceContext
  moduleKey?: string | null
  flags?: PermissionDecisionFlags
}

export type PermissionDecision = {
  allowed: boolean
  reasonCode: PermissionDenyReasonCode
  capability: string
  role: string
  resourceType?: PermissionResourceType
  resourceId?: string | null
  moduleKey?: string | null
  message: string
}
