import { describe, expect, it } from 'vitest'
import { isCrmSupportedRole } from '../../crm/types'
import { CRM_NAV_ITEMS } from '../../crm/nav'
import {
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
} from './index'

/** Exact legacy sidebar contract before Module Registry. */
const LEGACY_CRM_NAV = [
  { label: 'Home', path: '/crm' },
  { label: 'Intake', path: '/crm/intake' },
  { label: 'Contacts', path: '/crm/contacts' },
  { label: 'Campaigns', path: '/crm/campaigns' },
  { label: 'Households', path: '/crm/households' },
  { label: 'Pipeline', path: '/crm/pipeline' },
  { label: 'Tasks', path: '/crm/tasks' },
  { label: 'Appointments', path: '/crm/appointments', placeholder: true },
  { label: 'Policies', path: '/crm/policies', placeholder: true },
  { label: 'Annual Reviews', path: '/crm/annual-reviews', placeholder: true },
  { label: 'Documents', path: '/crm/documents', placeholder: true },
  { label: 'Settings', path: '/crm/settings', placeholder: true },
] as const

describe('Module Registry', () => {
  it('registers unique module keys', () => {
    const keys = listModules().map((module) => module.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('enforces unique sidebar navigation paths', () => {
    const paths = getCrmSidebarNavItems().map((item) => item.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('enforces unique activity keys and workflow types within each module', () => {
    for (const module of listModules()) {
      const activityKeys = module.activityTypes.map((item) => item.eventKey)
      expect(new Set(activityKeys).size).toBe(activityKeys.length)

      const workflowTypes = module.taskWorkflows.map((item) => item.workflowType)
      expect(new Set(workflowTypes).size).toBe(workflowTypes.length)
    }
  })

  it('preserves legacy CRM sidebar labels, paths, order, and placeholders', () => {
    const nav = getCrmSidebarNavItems()
    expect(nav).toEqual([...LEGACY_CRM_NAV])
  })

  it('orders sidebar navigation deterministically by navigation.order', () => {
    const ordered = listModules()
      .filter(
        (module) =>
          module.featureFlag.enabled &&
          module.navigation.visible &&
          module.navigation.placement === 'sidebar',
      )
      .slice()
      .sort((a, b) => a.navigation.order - b.navigation.order)

    const orders = ordered.map((module) => module.navigation.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    expect(getCrmSidebarNavItems().map((item) => item.path)).toEqual(
      ordered.map((module) => module.navigation.route),
    )
  })

  it('exposes the same sidebar via crm/nav CRM_NAV_ITEMS compatibility export', () => {
    expect(CRM_NAV_ITEMS).toEqual([...LEGACY_CRM_NAV])
    expect(CRM_NAV_ITEMS).toEqual(getCrmSidebarNavItems())
  })

  it('does not put future product modules into the sidebar', () => {
    const paths = new Set(getCrmSidebarNavItems().map((item) => item.path))
    expect(paths.has('/crm/credit')).toBe(false)
    expect(getModule('credit_repair')?.navigation.visible).toBe(false)
    expect(getModule('business_funding')?.featureFlag.enabled).toBe(false)
    expect(getModule('digital_identity')?.navigation.visible).toBe(false)
    expect(getModule('digital_identity')?.featureFlag.enabled).toBe(false)
  })

  it('registers Family diagnostic task workflows for intake/tasks', () => {
    const workflows = listTaskWorkflowTypes()
    expect(workflows).toContain('review_initial_diagnostic')
    expect(workflows).toContain('resolve_possible_duplicate')
  })

  it('registers IFD and platform module keys used by the constitution', () => {
    expect(requireModule('initial_financial_diagnostic').kind).toBe('diagnostic')
    expect(requireModule('financial_progress').kind).toBe('intelligence')
    expect(requireModule('module_registry').kind).toBe('platform')
    expect(requireModule('cases').status).toBe('active')
    expect(requireModule('workflows').status).toBe('active')
    expect(requireModule('documents').status).toBe('active')
    expect(requireModule('permissions').status).toBe('active')
    expect(requireModule('ai').status).toBe('registered')
  })

  it('resolves placeholder pages by nav path', () => {
    const documents = findModuleByNavPath('/crm/documents')
    expect(documents?.navigation.label).toBe('Documents')
    expect(documents?.navigation.placeholder).toBe(true)
    expect(findModuleByNavPath('/crm/not-a-route')).toBeUndefined()
  })

  it('aggregates activity event keys and case types from manifests', () => {
    expect(listActivityEventKeys()).toContain('diagnostic.ifd.submitted')
    expect(listCaseTypes()).toContain('insurance_case')
    expect(listCaseTypes()).toContain('credit_repair_case')
  })

  it('throws for unknown module keys via requireModule', () => {
    expect(() => requireModule('not_a_real_module')).toThrow(/unknown module key/)
    expect(getModule('not_a_real_module')).toBeUndefined()
  })
})

describe('Module Registry semantics: registered vs enabled vs visible vs declared capability', () => {
  it('keeps disabled modules queryable as registered metadata', () => {
    const credit = requireModule('credit_repair')
    expect(credit.status).toBe('registered')
    expect(credit.featureFlag.enabled).toBe(false)
    expect(listModules().some((module) => module.key === 'credit_repair')).toBe(true)
    expect(listModulesByStatus('registered').some((module) => module.key === 'credit_repair')).toBe(
      true,
    )
  })

  it('excludes disabled modules from enabled-module helpers', () => {
    const enabledKeys = new Set(listEnabledModules().map((module) => module.key))
    expect(enabledKeys.has('intake')).toBe(true)
    expect(enabledKeys.has('appointments')).toBe(true) // placeholder but feature-enabled for nav
    expect(enabledKeys.has('credit_repair')).toBe(false)
    expect(enabledKeys.has('ai')).toBe(false)
    // Platform engine foundations are enabled as services (no sidebar nav).
    expect(enabledKeys.has('cases')).toBe(true)
    expect(enabledKeys.has('workflows')).toBe(true)
    expect(enabledKeys.has('documents')).toBe(true)
    expect(enabledKeys.has('permissions')).toBe(true)
  })

  it('excludes invisible modules from sidebar helpers even when registered', () => {
    const sidebarKeys = new Set(
      listModules()
        .filter((module) =>
          getCrmSidebarNavItems().some((item) => item.path === module.navigation.route),
        )
        .map((module) => module.key),
    )
    const sidebarPaths = getCrmSidebarNavItems().map((item) => item.path)

    expect(sidebarPaths).toHaveLength(LEGACY_CRM_NAV.length)
    expect(getModule('financial_progress')?.navigation.visible).toBe(false)
    expect(sidebarPaths.includes('/crm')).toBe(true)
    expect(findModuleByNavPath('/crm/intake')?.key).toBe('intake')

    // Registered-only modules never surface as sidebar destinations.
    for (const key of [
      'credit_repair',
      'business_funding',
      'digital_identity',
      'ai',
      'workflows',
      'cases',
      'documents',
      'permissions',
    ] as const) {
      const module = requireModule(key)
      expect(module.navigation.visible).toBe(false)
      expect(sidebarKeys.has(key)).toBe(false)
      // Registered/disabled modules have no sidebar route; active platform engines
      // like `cases` also stay out of the CRM sidebar.
      if (module.navigation.route) {
        expect(getCrmSidebarNavItems().some((item) => item.path === module.navigation.route)).toBe(
          false,
        )
      }
    }
  })

  it('treats capability keys as declarations only — not runtime authorization', () => {
    // Registry metadata may list capabilities for the future Permission Engine.
    expect(moduleDeclaresPermission('intake', 'intake.view')).toBe(true)
    expect(moduleDeclaresPermission('credit_repair', 'credit.case.write')).toBe(true)
    expect(moduleDeclaresPermission('digital_identity', 'digital_identity.admin')).toBe(true)

    // Declaring a capability does not mean the current user is authorized.
    // Runtime auth remains owner/advisor role checks (unchanged).
    expect(isCrmSupportedRole('owner')).toBe(true)
    expect(isCrmSupportedRole('advisor')).toBe(true)
    expect(isCrmSupportedRole('client')).toBe(false)

    // Disabled modules can still declare capabilities without being enabled or visible.
    expect(moduleDeclaresPermission('ai', 'ai.run.internal')).toBe(true)
    expect(listEnabledModules().some((module) => module.key === 'ai')).toBe(false)
    expect(getCrmSidebarNavItems().some((item) => item.label === 'AI')).toBe(false)

    // Unknown module → not declared (safe failure; not an auth grant).
    expect(moduleDeclaresPermission('not_a_real_module', 'intake.view')).toBe(false)
  })

  it('does not use registry permissions to filter sidebar (auth unchanged)', () => {
    // Sidebar includes every legacy item for any authenticated CRM user.
    // Role-based gating remains in CrmAuth / RLS — not Module Registry.
    expect(getCrmSidebarNavItems()).toEqual([...LEGACY_CRM_NAV])
  })
})
