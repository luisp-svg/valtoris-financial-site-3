/**
 * Module Registry service — query helpers over the compiled catalog.
 */

import { MODULE_CATALOG } from './catalog'
import type { CrmNavItem, ModuleKey, ModuleManifest, ModuleLifecycleStatus } from './types'

function isFeatureEnabled(module: ModuleManifest): boolean {
  return module.featureFlag.enabled !== false
}

/** All registered manifests (including disabled / registered-only). */
export function listModules(): readonly ModuleManifest[] {
  return MODULE_CATALOG
}

export function getModule(key: ModuleKey): ModuleManifest | undefined {
  return MODULE_CATALOG.find((module) => module.key === key)
}

export function requireModule(key: ModuleKey): ModuleManifest {
  const module = getModule(key)
  if (!module) {
    throw new Error(`Module Registry: unknown module key "${key}"`)
  }
  return module
}

export function listModulesByStatus(
  status: ModuleLifecycleStatus,
): readonly ModuleManifest[] {
  return MODULE_CATALOG.filter((module) => module.status === status)
}

/** Modules with featureFlag.enabled (includes placeholders still shown in nav). */
export function listEnabledModules(): readonly ModuleManifest[] {
  return MODULE_CATALOG.filter(isFeatureEnabled)
}

/**
 * CRM sidebar items derived from the registry.
 * Preserves legacy order, labels, paths, and placeholder flags.
 */
export function getCrmSidebarNavItems(): CrmNavItem[] {
  return MODULE_CATALOG.filter(
    (module) =>
      isFeatureEnabled(module) &&
      module.navigation.visible &&
      module.navigation.placement === 'sidebar' &&
      typeof module.navigation.route === 'string' &&
      typeof module.navigation.label === 'string',
  )
    .slice()
    .sort((a, b) => a.navigation.order - b.navigation.order)
    .map((module) => {
      const item: CrmNavItem = {
        label: module.navigation.label as string,
        path: module.navigation.route as string,
      }
      if (module.navigation.placeholder) {
        item.placeholder = true
      }
      return item
    })
}

export function findModuleByNavPath(pathname: string): ModuleManifest | undefined {
  return MODULE_CATALOG.find(
    (module) =>
      module.navigation.visible &&
      module.navigation.route === pathname &&
      isFeatureEnabled(module),
  )
}

export function listTaskWorkflowTypes(): string[] {
  const set = new Set<string>()
  for (const module of MODULE_CATALOG) {
    for (const workflow of module.taskWorkflows) {
      set.add(workflow.workflowType)
    }
  }
  return [...set].sort()
}

export function listActivityEventKeys(): string[] {
  const set = new Set<string>()
  for (const module of MODULE_CATALOG) {
    for (const activity of module.activityTypes) {
      set.add(activity.eventKey)
    }
  }
  return [...set].sort()
}

export function listCaseTypes(): string[] {
  const set = new Set<string>()
  for (const module of MODULE_CATALOG) {
    for (const caseType of module.caseTypes) {
      set.add(caseType.caseType)
    }
  }
  return [...set].sort()
}

/**
 * Returns whether the module *manifest declares* a capability key.
 * This is NOT runtime authorization. Do not use it to grant access.
 * Permission Engine will evaluate actual user authorization later.
 */
export function moduleDeclaresPermission(
  key: ModuleKey,
  permission: string,
): boolean {
  const module = getModule(key)
  if (!module) return false
  return module.permissions.includes(permission)
}
