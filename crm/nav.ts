/**
 * CRM navigation — derived from the Platform Module Registry.
 * Public shape preserved for existing CrmShell / placeholder consumers.
 */

import { getCrmSidebarNavItems, type CrmNavItem } from '../platform/registry'

export type { CrmNavItem }

/**
 * Sidebar items — same labels, paths, order, and placeholders as pre-registry nav.
 * Source of truth: platform/registry/catalog.ts
 */
export const CRM_NAV_ITEMS: CrmNavItem[] = getCrmSidebarNavItems()
