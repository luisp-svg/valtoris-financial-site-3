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
    key: 'contacts',
    displayName: 'Contacts',
    description: 'Networking contacts captured via Quick Add (Manual Contact leads).',
    icon: 'contacts',
    order: 22,
    route: '/crm/contacts',
    category: 'advisor_os',
    permissions: ['crm.nav.view', 'household.read'],
    dependencies: ['tasks'],
  }),
  shellNav({
    key: 'campaigns',
    displayName: 'Campaigns',
    description: 'Digital Identity campaign and event attribution links.',
    icon: 'campaigns',
    order: 25,
    route: '/crm/campaigns',
    category: 'advisor_os',
    permissions: [
      'crm.nav.view',
      'digital_identity.campaigns.manage_own',
      'digital_identity.campaigns.admin',
    ],
    dependencies: ['digital_identity'],
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
    key: 'production_nav',
    displayName: 'Production',
    description: 'Life, IUL, and FIA production applications queue.',
    icon: 'policies',
    order: 70,
    route: '/crm/production',
    category: 'insurance',
    permissions: ['crm.nav.view', 'policy.read'],
    dependencies: ['insurance'],
  }),
  shellNav({
    key: 'commissions_nav',
    displayName: 'Commissions',
    description: 'Writing-advisor expected and actual commission workspace.',
    icon: 'commissions',
    order: 75,
    route: '/crm/commissions',
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
  registeredModule({
    key: 'digital_identity',
    displayName: 'Digital Identity',
    description:
      "Public relationship entry into the Advisor Operating System (advisor cards, campaigns, Let's Connect capture).",
    kind: 'experience',
    category: 'advisor_os',
    icon: 'digital-identity',
    permissions: [
      'digital_identity.read_own',
      'digital_identity.write_own',
      'digital_identity.publish_own',
      'digital_identity.admin',
      'digital_identity.campaigns.manage_own',
      'digital_identity.campaigns.admin',
      'digital_identity.analytics.read_own',
      'digital_identity.analytics.read_all',
      'digital_identity.lead.read',
    ],
    activityTypes: [
      { eventKey: 'digital_identity.lead_created', description: 'Digital identity lead created' },
      { eventKey: 'digital_identity.lead_matched', description: 'Digital identity lead matched existing household' },
      {
        eventKey: 'digital_identity.lead_possible_match',
        description: 'Digital identity lead flagged as possible duplicate',
      },
      {
        eventKey: 'digital_identity.contact_shared',
        description: "Visitor completed Let's Connect relationship capture",
      },
      {
        eventKey: 'digital_identity.duplicate_resolved',
        description: 'Digital identity duplicate review resolved',
      },
      {
        eventKey: 'digital_identity.relationship_photo_added',
        description: 'Optional Relationship Photo added after Let’s Connect',
      },
      {
        eventKey: 'digital_identity.relationship_photo_removed',
        description: 'Relationship Photo removed from CRM',
      },
      {
        eventKey: 'digital_identity.relationship_photo_replaced',
        description: 'Relationship Photo replaced in CRM',
      },
      {
        eventKey: 'digital_identity.campaign_attributed',
        description: 'Digital Identity relationship attributed to a trusted campaign',
      },
      {
        eventKey: 'digital_identity.event_attributed',
        description: 'Digital Identity relationship attributed to a trusted event',
      },
      {
        eventKey: 'digital_identity.relationship_connected_at_event',
        description: 'Relationship connected in the context of a Digital Identity event',
      },
    ],
    taskWorkflows: [
      {
        workflowType: 'review_digital_identity_lead',
        description: "Review digital identity / Let's Connect lead",
      },
      {
        workflowType: 'resolve_digital_identity_duplicate',
        description: 'Resolve possible duplicate digital identity submission',
      },
    ],
    dependencies: ['households', 'intake', 'tasks', 'activities', 'documents'],
    futureExtensions: {
      module: 'digital_identity',
      sprint: '5.9',
      v1Experience: 'advisor_card',
      primaryCtaLabel: "Let's Connect",
      reservedSurfaceKinds: [
        'team_card',
        'company_card',
        'public_profile',
        'referral_portal',
        'partner_portal',
      ],
      anonymousAnalytics: 'separate_from_household_activities',
      caseCreation: 'never_automatic_on_contact_exchange',
      selfieCapture: 'relationship_photo_optional_no_biometrics',
      persistence: 'migration_025_027_028_campaign_attribution',
    },
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
  {
    key: 'workflows',
    displayName: 'Workflow Engine',
    description:
      'Declarative case-stage state machines (TypeScript foundation in 4B.5; no persistence or execution yet).',
    kind: 'platform',
    category: 'platform_engine',
    icon: 'workflows',
    status: 'active',
    featureFlag: { enabled: true },
    permissions: ['workflow.read', 'workflow.publish'],
    navigation: { visible: false, placement: 'none', order: 1001 },
    activityTypes: [],
    taskWorkflows: [],
    supportedDocuments: [],
    supportedNotifications: [],
    aiCapabilities: [{ useCase: 'workflow.suggest_next_action', description: 'Future stage guidance' }],
    caseTypes: [],
    dependencies: ['tasks', 'cases'],
    futureExtensions: {
      engine: 'workflow_engine',
      sprint: '4B.5',
      persistence: 'typescript_only_no_workflow_runs_table',
      execution: 'not_started',
      automations: 'out_of_scope_for_foundation',
    },
  },
  {
    key: 'documents',
    displayName: 'Document Engine',
    description:
      'Shared document type registry, requirements, and lifecycle metadata (TypeScript foundation in 4B.6; no storage or uploads yet).',
    kind: 'platform',
    category: 'platform_engine',
    icon: 'document-engine',
    status: 'active',
    featureFlag: { enabled: true },
    permissions: ['document.read', 'document.write'],
    navigation: { visible: false, placement: 'none', order: 1002 },
    activityTypes: [],
    taskWorkflows: [],
    supportedDocuments: [
      { documentType: 'uploaded_file' },
      { documentType: 'ifd_report' },
      { documentType: 'action_plan' },
      { documentType: 'driver_license' },
      { documentType: 'insurance_application' },
      { documentType: 'credit_report' },
      { documentType: 'funding_application' },
    ],
    supportedNotifications: [],
    aiCapabilities: [
      { useCase: 'document.extract_identity', description: 'Future extraction hint only' },
    ],
    caseTypes: [],
    dependencies: ['cases', 'workflows'],
    futureExtensions: {
      engine: 'document_engine',
      sprint: '4B.6',
      persistence: 'typescript_only_no_documents_table',
      storage: 'not_started',
      uploads: 'out_of_scope_for_foundation',
    },
  },
  {
    key: 'permissions',
    displayName: 'Permission Engine',
    description:
      'RBAC + resource-context ABAC decision contracts (TypeScript foundation in 4B.7; RLS/RPCs remain authoritative).',
    kind: 'platform',
    category: 'platform_engine',
    icon: 'permissions',
    status: 'active',
    featureFlag: { enabled: true },
    permissions: ['registry.read'],
    navigation: { visible: false, placement: 'none', order: 1003 },
    activityTypes: [],
    taskWorkflows: [],
    supportedDocuments: [],
    supportedNotifications: [],
    aiCapabilities: [],
    caseTypes: [],
    dependencies: ['module_registry'],
    futureExtensions: {
      engine: 'permission_engine',
      sprint: '4B.7',
      persistence: 'typescript_only_no_role_capability_tables',
      runtimeWiring: 'not_started',
      databaseAuthority: 'supabase_rls_and_rpcs',
    },
  },
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
