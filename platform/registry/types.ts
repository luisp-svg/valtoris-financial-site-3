/**
 * Module Registry types — Platform Constitution (Sprint 4B.2).
 * TypeScript-first source of truth for Advisor Operating System modules.
 * No database table required for v1; manifests are compiled into the app.
 */

/** Stable module identity (snake_case). */
export type ModuleKey = string

export type ModuleKind =
  | 'product'
  | 'diagnostic'
  | 'intelligence'
  | 'platform'
  | 'experience'
  | 'ops'
  | 'shell'

export type ModuleCategory =
  | 'advisor_os'
  | 'diagnostics'
  | 'intelligence'
  | 'insurance'
  | 'credit'
  | 'funding'
  | 'planning'
  | 'benefits'
  | 'portal'
  | 'platform_engine'
  | 'navigation'

export type ModuleLifecycleStatus = 'active' | 'placeholder' | 'registered' | 'disabled'

/** Capability keys declared for a future Permission Engine (informational in v1). */
export type ModulePermissionKey = string

export type ModuleNavPlacement = 'sidebar' | 'none'

export type ModuleNavigation = {
  /** When true, eligible for CRM sidebar (subject to enabled + featureFlag). */
  visible: boolean
  placement: ModuleNavPlacement
  /** Ascending order in sidebar. Lower appears first. */
  order: number
  /** Sidebar label. Required when visible. */
  label?: string
  /**
   * Primary route for sidebar NavLink.
   * Must remain stable — do not change existing /crm paths.
   */
  route?: string
  /** Matches legacy CrmNavItem.placeholder */
  placeholder?: boolean
}

export type ModuleFeatureFlag = {
  /** When false, module is treated as disabled for nav and feature gates. */
  enabled: boolean
  /** Optional flag name for future remote config; unused in v1 runtime. */
  flagKey?: string
}

export type ModuleActivityTypeRef = {
  eventKey: string
  description?: string
}

export type ModuleTaskWorkflowRef = {
  workflowType: string
  description?: string
}

export type ModuleDocumentTypeRef = {
  documentType: string
  description?: string
}

export type ModuleNotificationRef = {
  notificationKey: string
  channel?: 'email' | 'sms' | 'push' | 'internal'
  description?: string
}

export type ModuleAiCapabilityRef = {
  useCase: string
  description?: string
}

export type ModuleCaseTypeRef = {
  caseType: string
  description?: string
}

export type ModuleSettingsSchema = {
  /** Opaque JSON-schema-like description for future settings UI. */
  schemaVersion: number
  fields?: ReadonlyArray<{
    key: string
    label: string
    type: 'boolean' | 'string' | 'number' | 'enum'
    description?: string
  }>
}

/**
 * Full module manifest.
 * Every Valtoris capability — product or platform — should register one.
 */
export type ModuleManifest = {
  /** Stable unique key (primary identity). */
  key: ModuleKey
  displayName: string
  description: string
  kind: ModuleKind
  category: ModuleCategory
  /** Icon key for a future icon pack; unused visually in v1 sidebar. */
  icon: string
  status: ModuleLifecycleStatus
  featureFlag: ModuleFeatureFlag
  /**
   * Declared permissions this module introduces or requires.
   * Not enforced in v1 (Permission Engine not started).
   */
  permissions: ReadonlyArray<ModulePermissionKey>
  navigation: ModuleNavigation
  activityTypes: ReadonlyArray<ModuleActivityTypeRef>
  taskWorkflows: ReadonlyArray<ModuleTaskWorkflowRef>
  supportedDocuments: ReadonlyArray<ModuleDocumentTypeRef>
  supportedNotifications: ReadonlyArray<ModuleNotificationRef>
  aiCapabilities: ReadonlyArray<ModuleAiCapabilityRef>
  caseTypes: ReadonlyArray<ModuleCaseTypeRef>
  settings?: ModuleSettingsSchema
  /** Other module keys this module depends on. */
  dependencies?: ReadonlyArray<ModuleKey>
  /** Reserved bag for forward-compatible fields. */
  futureExtensions?: Readonly<Record<string, unknown>>
}

/** Legacy CRM sidebar item shape — preserved for existing consumers. */
export type CrmNavItem = {
  label: string
  path: string
  placeholder?: boolean
}
