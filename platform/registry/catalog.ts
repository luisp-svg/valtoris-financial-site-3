/**
 * Compiled Module Registry catalog.
 * Sidebar order and labels for active CRM nav MUST match legacy crm/nav.ts behavior.
 */

import type { ModuleManifest } from './types'

function shellNav(partial: {
  key: string
  displayName: string
  description: string
  icon: string
  order: number
  route: string
  placeholder?: boolean
  status?: ModuleManifest['status']
  category?: ModuleManifest['category']
  permissions?: ModuleManifest['permissions']
  activityTypes?: ModuleManifest['activityTypes']
  taskWorkflows?: ModuleManifest['taskWorkflows']
  supportedDocuments?: ModuleManifest['supportedDocuments']
  caseTypes?: ModuleManifest['caseTypes']
  dependencies?: ModuleManifest['dependencies']
}): ModuleManifest {
  const placeholder = partial.placeholder === true
  return {
    key: partial.key,
    displayName: partial.displayName,
    description: partial.description,
    kind: 'shell',
    category: partial.category ?? 'navigation',
    icon: partial.icon,
    status: partial.status ?? (placeholder ? 'placeholder' : 'active'),
    featureFlag: { enabled: true },
    permissions: partial.permissions ?? ['crm.nav.view'],
    navigation: {
      visible: true,
      placement: 'sidebar',
      order: partial.order,
      label: partial.displayName,
      route: partial.route,
      placeholder: placeholder || undefined,
    },
    activityTypes: partial.activityTypes ?? [],
    taskWorkflows: partial.taskWorkflows ?? [],
    supportedDocuments: partial.supportedDocuments ?? [],
    supportedNotifications: [],
    aiCapabilities: [],
    caseTypes: partial.caseTypes ?? [],
    dependencies: partial.dependencies,
  }
}

function registeredModule(partial: {
  key: string
  displayName: string
  description: string
  kind: ModuleManifest['kind']
  category: ModuleManifest['category']
  icon: string
  permissions?: ModuleManifest['permissions']
  activityTypes?: ModuleManifest['activityTypes']
  taskWorkflows?: ModuleManifest['taskWorkflows']
  supportedDocuments?: ModuleManifest['supportedDocuments']
  supportedNotifications?: ModuleManifest['supportedNotifications']
  aiCapabilities?: ModuleManifest['aiCapabilities']
  caseTypes?: ModuleManifest['caseTypes']
  dependencies?: ModuleManifest['dependencies']
  futureExtensions?: ModuleManifest['futureExtensions']
}): ModuleManifest {
  return {
    key: partial.key,
    displayName: partial.displayName,
    description: partial.description,
    kind: partial.kind,
    category: partial.category,
    icon: partial.icon,
    status: 'registered',
    featureFlag: { enabled: false },
    permissions: partial.permissions ?? [],
    navigation: {
      visible: false,
      placement: 'none',
      order: 1000,
    },
    activityTypes: partial.activityTypes ?? [],
    taskWorkflows: partial.taskWorkflows ?? [],
    supportedDocuments: partial.supportedDocuments ?? [],
    supportedNotifications: partial.supportedNotifications ?? [],
    aiCapabilities: partial.aiCapabilities ?? [],
    caseTypes: partial.caseTypes ?? [],
    dependencies: partial.dependencies,
    futureExtensions: partial.futureExtensions,
  }
}

/**
 * Canonical module list.
 * CRM sidebar items (orders 10–100) preserve exact legacy labels and paths.
 */
export const MODULE_CATALOG: readonly ModuleManifest[] = [
  // ----- CRM sidebar (legacy-compatible) -----
  shellNav({
    key: 'aos_home',
    displayName: 'Home',
    description: 'Advisor home — owner ops or advisor dashboard.',
    icon: 'home',
    order: 10,
    route: '/crm',
    category: 'advisor_os',
    permissions: ['crm.nav.view', 'dashboard.view'],
  }),
  shellNav({
    key: 'intake',
    displayName: 'Intake',
    description: 'Public Family diagnostic intake queue and duplicate review.',
    icon: 'inbox',
    order: 20,
    route: '/crm/intake',
    category: 'diagnostics',
    permissions: ['crm.nav.view', 'intake.view'],
    activityTypes: [
      { eventKey: 'crm.lead.created', description: 'Public Family lead created' },
      { eventKey: 'diagnostic.ifd.submitted', description: 'Initial Financial Diagnostic submitted' },
      { eventKey: 'crm.duplicate.resolved', description: 'Duplicate review resolved' },
    ],
    taskWorkflows: [
      {
        workflowType: 'review_initial_diagnostic',
        description: 'Review public Initial Financial Diagnostic',
      },
      {
        workflowType: 'resolve_possible_duplicate',
        description: 'Resolve possible household duplicate',
      },
    ],
    dependencies: ['initial_financial_diagnostic', 'tasks'],
  }),
  shellNav({
    key: 'households',
    displayName: 'Households',
    description: 'Household list and client workspace.',
    icon: 'households',
    order: 30,
    route: '/crm/households',
    category: 'advisor_os',
    permissions: ['crm.nav.view', 'household.read'],
    activityTypes: [
      { eventKey: 'crm.household.assigned' },
      { eventKey: 'crm.household.stage_changed' },
      { eventKey: 'onboarding.completed' },
      { eventKey: 'notes.added' },
    ],
    dependencies: ['activities'],
  }),
  shellNav({
    key: 'pipeline',
    displayName: 'Pipeline',
    description: 'Opportunity pipeline and workspace.',
    icon: 'pipeline',
    order: 40,
    route: '/crm/pipeline',
    category: 'advisor_os',
    permissions: ['crm.nav.view', 'opportunity.read'],
  }),
  shellNav({
    key: 'tasks',
    displayName: 'Tasks',
    description: 'Advisor task queue (manual + automated Family follow-ups).',
    icon: 'tasks',
    order: 50,
    route: '/crm/tasks',
    category: 'platform_engine',
    permissions: ['crm.nav.view', 'task.read'],
    taskWorkflows: [
      { workflowType: 'review_initial_diagnostic' },
      { workflowType: 'resolve_possible_duplicate' },
    ],
    activityTypes: [
      { eventKey: 'tasks.manual.created' },
      { eventKey: 'tasks.automated.created' },
      { eventKey: 'tasks.completed' },
    ],
    dependencies: ['activities'],
  }),
  shellNav({
    key: 'appointments',
    displayName: 'Appointments',
    description: 'Appointment scheduling (placeholder).',
    icon: 'appointments',
    order: 60,
    route: '/crm/appointments',
    placeholder: true,
    permissions: ['crm.nav.view', 'appointment.read'],
  }),
  shellNav({
    key: 'policies_nav',
    displayName: 'Policies',
    description: 'Policy book navigation placeholder (insurance module forthcoming).',
    icon: 'policies',
    order: 70,
    route: '/crm/policies',
    placeholder: true,
    category: 'insurance',
    permissions: ['crm.nav.view', 'policy.read'],
    dependencies: ['insurance'],
  }),
  shellNav({
    key: 'annual_reviews',
    displayName: 'Annual Reviews',
    description: 'Annual review workflows (placeholder).',
    icon: 'annual-reviews',
    order: 80,
    route: '/crm/annual-reviews',
    placeholder: true,
    permissions: ['crm.nav.view', 'annual_review.read'],
  }),
  shellNav({
    key: 'documents_nav',
    displayName: 'Documents',
    description: 'Documents library navigation placeholder.',
    icon: 'documents',
    order: 90,
    route: '/crm/documents',
    placeholder: true,
    category: 'platform_engine',
    permissions: ['crm.nav.view', 'document.read'],
    dependencies: ['documents'],
  }),
  shellNav({
    key: 'settings',
    displayName: 'Settings',
    description: 'Agency and module settings (placeholder).',
    icon: 'settings',
    order: 100,
    route: '/crm/settings',
    placeholder: true,
    category: 'advisor_os',
    permissions: ['crm.nav.view', 'settings.view'],
  }),

  // ----- Product / diagnostic / intelligence modules (registered, not yet nav-driven) -----
  registeredModule({
    key: 'initial_financial_diagnostic',
    displayName: 'Initial Financial Diagnostic',
    description: 'Public Family Report Card → CRM Initial Financial Diagnostic capture and history.',
    kind: 'diagnostic',
    category: 'diagnostics',
    icon: 'diagnostic',
    permissions: ['diagnostic.ifd.read', 'diagnostic.ifd.ingest'],
    activityTypes: [
      { eventKey: 'diagnostic.ifd.submitted' },
      { eventKey: 'crm.lead.created' },
    ],
    taskWorkflows: [
      { workflowType: 'review_initial_diagnostic' },
      { workflowType: 'resolve_possible_duplicate' },
    ],
    caseTypes: [{ caseType: 'diagnostic_review_case', description: 'Optional future review Case' }],
    dependencies: ['tasks', 'households'],
    futureExtensions: {
      publicRoute: '/family-assessment',
      resultsRoute: '/results',
      captureChannel: 'public_self_report',
    },
  }),
  registeredModule({
    key: 'financial_progress',
    displayName: 'Financial Progress',
    description: 'Advisor-reviewed Household Financial Progress scoring engine.',
    kind: 'intelligence',
    category: 'intelligence',
    icon: 'progress',
    permissions: ['financial_progress.read', 'financial_progress.compute'],
    aiCapabilities: [{ useCase: 'household.progress.explain' }],
    dependencies: ['households'],
    futureExtensions: {
      evidencePolicy: 'advisor_reviewed_only',
      distinctFrom: 'initial_financial_diagnostic',
    },
  }),
  registeredModule({
    key: 'insurance',
    displayName: 'Insurance',
    description: 'Personal insurance CRM and Insurance Cases.',
    kind: 'product',
    category: 'insurance',
    icon: 'insurance',
    permissions: ['insurance.case.read', 'insurance.case.write'],
    caseTypes: [{ caseType: 'insurance_case' }],
    supportedDocuments: [{ documentType: 'insurance_summary' }],
    dependencies: ['cases', 'tasks', 'documents'],
  }),
  registeredModule({
    key: 'credit_repair',
    displayName: 'Credit Repair',
    description: 'Credit repair Cases, disputes, and specialist queues.',
    kind: 'product',
    category: 'credit',
    icon: 'credit',
    permissions: ['credit.case.read', 'credit.case.write'],
    caseTypes: [{ caseType: 'credit_repair_case' }],
    supportedDocuments: [{ documentType: 'credit_dispute_letter' }],
    aiCapabilities: [{ useCase: 'credit.dispute.draft' }],
    dependencies: ['cases', 'tasks', 'documents', 'ai'],
  }),
  registeredModule({
    key: 'business_funding',
    displayName: 'Business Funding',
    description: 'Business funding Cases and application packages.',
    kind: 'product',
    category: 'funding',
    icon: 'funding',
    permissions: ['funding.case.read', 'funding.case.write'],
    caseTypes: [{ caseType: 'funding_case' }],
    supportedDocuments: [{ documentType: 'funding_package' }],
    aiCapabilities: [{ useCase: 'funding.analysis' }],
    dependencies: ['cases', 'tasks', 'documents', 'ai'],
  }),
  registeredModule({
    key: 'estate_planning',
    displayName: 'Estate Planning',
    description: 'Estate planning Cases and documents.',
    kind: 'product',
    category: 'planning',
    icon: 'estate',
    caseTypes: [{ caseType: 'estate_case' }],
    dependencies: ['cases', 'documents'],
  }),
  registeredModule({
    key: 'tax_planning',
    displayName: 'Tax Planning',
    description: 'Tax strategy Cases.',
    kind: 'product',
    category: 'planning',
    icon: 'tax',
    caseTypes: [{ caseType: 'tax_strategy_case' }],
    dependencies: ['cases', 'documents'],
  }),
  registeredModule({
    key: 'commercial_insurance',
    displayName: 'Commercial Insurance',
    description: 'Commercial insurance Cases.',
    kind: 'product',
    category: 'insurance',
    icon: 'commercial-insurance',
    caseTypes: [{ caseType: 'commercial_insurance_case' }],
    dependencies: ['cases', 'insurance'],
  }),
  registeredModule({
    key: 'employee_benefits',
    displayName: 'Employee Benefits',
    description: 'Employee benefits Cases.',
    kind: 'product',
    category: 'benefits',
    icon: 'benefits',
    caseTypes: [{ caseType: 'employee_benefits_case' }],
    dependencies: ['cases'],
  }),
  registeredModule({
    key: 'client_portal',
    displayName: 'Client Portal',
    description: 'Client-facing portal experience.',
    kind: 'experience',
    category: 'portal',
    icon: 'portal',
    permissions: ['portal.access'],
    dependencies: ['documents', 'notifications'],
  }),

  // ----- Platform engines -----
  {
    key: 'activities',
    displayName: 'Activity Engine',
    description:
      'Universal household timeline and activity publish/normalize services for all AOS modules.',
    kind: 'platform',
    category: 'platform_engine',
    icon: 'activities',
    status: 'active',
    featureFlag: { enabled: true },
    permissions: ['activity.read', 'activity.write'],
    navigation: { visible: false, placement: 'none', order: 1000 },
    activityTypes: [
      { eventKey: 'crm.lead.created' },
      { eventKey: 'diagnostic.ifd.submitted' },
      { eventKey: 'crm.duplicate.resolved' },
      { eventKey: 'tasks.automated.created' },
      { eventKey: 'tasks.manual.created' },
      { eventKey: 'tasks.completed' },
      { eventKey: 'crm.household.stage_changed' },
      { eventKey: 'crm.opportunity.stage_changed' },
      { eventKey: 'crm.household.assigned' },
      { eventKey: 'crm.recommendation.converted' },
      { eventKey: 'onboarding.completed' },
      { eventKey: 'notes.added' },
    ],
    taskWorkflows: [],
    supportedDocuments: [],
    supportedNotifications: [],
    aiCapabilities: [{ useCase: 'activity.summarize', description: 'Future AI timeline summary' }],
    caseTypes: [],
    futureExtensions: {
      engine: 'activity_engine',
      sprint: '4B.3',
      caseIdSupport: 'metadata.caseId',
      schemaStrategy: 'reuse_public_activities_plus_metadata',
    },
  },
  {
    key: 'cases',
    displayName: 'Case Engine',
    description:
      'Universal Case container for multi-step module engagements (TypeScript foundation in 4B.4; no DB table yet).',
    kind: 'platform',
    category: 'platform_engine',
    icon: 'cases',
    status: 'active',
    featureFlag: { enabled: true },
    permissions: ['case.read', 'case.write'],
    navigation: { visible: false, placement: 'none', order: 1000 },
    activityTypes: [],
    taskWorkflows: [],
    supportedDocuments: [],
    supportedNotifications: [],
    aiCapabilities: [{ useCase: 'case.summarize', description: 'Future Case AI summary' }],
    caseTypes: [
      { caseType: 'diagnostic_review_case' },
      { caseType: 'household_onboarding_case' },
      { caseType: 'insurance_case' },
      { caseType: 'credit_repair_case' },
      { caseType: 'funding_case' },
      { caseType: 'estate_case' },
      { caseType: 'tax_strategy_case' },
      { caseType: 'commercial_insurance_case' },
      { caseType: 'employee_benefits_case' },
    ],
    dependencies: ['tasks', 'activities'],
    futureExtensions: {
      engine: 'case_engine',
      sprint: '4B.4',
      persistence: 'typescript_only_no_public_cases_table',
      activityLink: 'metadata.caseId',
    },
  },
  registeredModule({
    key: 'workflows',
    displayName: 'Workflow Engine',
    description: 'Declarative triggers, conditions, actions, delays, and approvals.',
    kind: 'platform',
    category: 'platform_engine',
    icon: 'workflows',
    permissions: ['workflow.read', 'workflow.publish'],
    dependencies: ['tasks', 'cases'],
  }),
  registeredModule({
    key: 'documents',
    displayName: 'Document Engine',
    description: 'Shared upload, generation, versioning, and visibility for files.',
    kind: 'platform',
    category: 'platform_engine',
    icon: 'document-engine',
    permissions: ['document.read', 'document.write'],
    supportedDocuments: [
      { documentType: 'uploaded_file' },
      { documentType: 'ifd_report' },
      { documentType: 'action_plan' },
    ],
  }),
  registeredModule({
    key: 'notifications',
    displayName: 'Notifications',
    description: 'Email, SMS, push, and internal notification delivery with consent gates.',
    kind: 'platform',
    category: 'platform_engine',
    icon: 'notifications',
    permissions: ['notification.send.internal'],
    supportedNotifications: [
      { notificationKey: 'task.reminder', channel: 'internal' },
      { notificationKey: 'automation.update', channel: 'internal' },
    ],
  }),
  registeredModule({
    key: 'ai',
    displayName: 'AI',
    description: 'Shared AI service gateway for summaries, drafts, and analysis.',
    kind: 'platform',
    category: 'platform_engine',
    icon: 'ai',
    permissions: ['ai.run.internal'],
    aiCapabilities: [
      { useCase: 'case.summarize' },
      { useCase: 'household.executive_summary' },
    ],
    dependencies: ['documents'],
  }),
  registeredModule({
    key: 'module_registry',
    displayName: 'Module Registry',
    description: 'Platform Module Registry — source of truth for module manifests.',
    kind: 'platform',
    category: 'platform_engine',
    icon: 'registry',
    permissions: ['registry.read'],
    futureExtensions: { engine: 'first_platform_engine', sprint: '4B.2' },
  }),
]
