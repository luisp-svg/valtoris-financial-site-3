/**
 * Platform Module Registry — public API.
 */

export type {
  CrmNavItem,
  ModuleActivityTypeRef,
  ModuleAiCapabilityRef,
  ModuleCaseTypeRef,
  ModuleCategory,
  ModuleDocumentTypeRef,
  ModuleFeatureFlag,
  ModuleKey,
  ModuleKind,
  ModuleLifecycleStatus,
  ModuleManifest,
  ModuleNavigation,
  ModuleNavPlacement,
  ModuleNotificationRef,
  ModulePermissionKey,
  ModuleSettingsSchema,
  ModuleTaskWorkflowRef,
} from './types'

export { MODULE_CATALOG } from './catalog'

export {
  findModuleByNavPath,
  getCrmSidebarNavItems,
  getModule,
  listActivityEventKeys,
  listCaseTypes,
  listEnabledModules,
  listModules,
  listModulesByStatus,
  listTaskWorkflowTypes,
  moduleDeclaresPermission,
  requireModule,
} from './registry'
