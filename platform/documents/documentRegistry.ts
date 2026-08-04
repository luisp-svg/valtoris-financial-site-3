/**
 * Document type registry — compiled catalog only.
 * No storage, uploads, persistence, or file I/O.
 */

import { isKnownCaseType } from '../cases/caseTypeRegistry'
import { getModule } from '../registry'
import {
  getWorkflowDefinition,
  isKnownWorkflowKey,
} from '../workflows/workflowRegistry'
import { DOCUMENT_CATEGORIES, isKnownDocumentCategory } from './categories'
import { isKnownDocumentValidationRule } from './validationRules'
import type {
  DocumentCategoryKeyCanonical,
  DocumentTypeDefinition,
  DocumentTypeKey,
  DocumentValidationRuleKey,
  DocumentVisibility,
} from './types'

/**
 * Injected workflow lookups keep document ↔ workflow validation cycle-safe.
 * Defaults use the Workflow Engine registry (workflows does not import documents).
 */
export type DocumentWorkflowLookup = {
  isKnownWorkflowKey: (workflowKey: string) => boolean
  getWorkflowStageKeys: (workflowKey: string) => readonly string[] | undefined
}

function defaultWorkflowLookup(): DocumentWorkflowLookup {
  return {
    isKnownWorkflowKey,
    getWorkflowStageKeys: (workflowKey) =>
      getWorkflowDefinition(workflowKey)?.stages.map((stage) => stage.key),
  }
}

/**
 * Validate document workflowDependencies against a workflow lookup.
 * Pure helper — used by validateDocumentRegistry and unit tests.
 */
export function collectDocumentWorkflowDependencyErrors(
  definitions: readonly DocumentTypeDefinition[],
  lookup: DocumentWorkflowLookup = defaultWorkflowLookup(),
): string[] {
  const errors: string[] = []
  for (const definition of definitions) {
    for (const dependency of definition.workflowDependencies ?? []) {
      const workflowKey = dependency.workflowKey
      if (!workflowKey) continue
      if (!lookup.isKnownWorkflowKey(workflowKey)) {
        errors.push(
          `Document "${definition.key}" references unknown workflowKey "${workflowKey}"`,
        )
        continue
      }
      const stageKey = dependency.stageKey
      if (!stageKey) continue
      const stageKeys = lookup.getWorkflowStageKeys(workflowKey)
      if (!stageKeys || !stageKeys.includes(stageKey)) {
        errors.push(
          `Document "${definition.key}" references unknown stage "${stageKey}" for workflow "${workflowKey}"`,
        )
      }
    }
  }
  return errors
}

const PDF_IMAGE = ['application/pdf', 'image/jpeg', 'image/png'] as const
const PDF_ONLY = ['application/pdf'] as const
const OFFICE_PDF = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const

type DocSeed = {
  key: DocumentTypeKey
  title: string
  description: string
  category: DocumentCategoryKeyCanonical
  moduleKey: string
  caseType?: string | null
  visibility?: DocumentVisibility
  required?: boolean
  expires?: boolean
  renewalIntervalDays?: number | null
  defaultValidityDays?: number | null
  versionable?: boolean
  allowMultiple?: boolean
  reviewRequired?: boolean
  reviewRoles?: readonly string[]
  validationRules?: readonly DocumentValidationRuleKey[]
  supportedMimeTypes?: readonly string[]
  maxSizeMB?: number
  retentionPolicy?: DocumentTypeDefinition['retentionPolicy']
  activityEvents?: readonly string[]
  workflowDependencies?: DocumentTypeDefinition['workflowDependencies']
  aiExtractionHints?: DocumentTypeDefinition['aiExtractionHints']
  alsoUsedByModules?: readonly string[]
  alsoUsedByCaseTypes?: readonly string[]
}

function defineDocument(seed: DocSeed): DocumentTypeDefinition {
  const expires = seed.expires ?? false
  return {
    key: seed.key,
    title: seed.title,
    description: seed.description,
    category: seed.category,
    moduleKey: seed.moduleKey,
    caseType: seed.caseType ?? null,
    visibility: seed.visibility ?? 'advisor',
    required: seed.required ?? false,
    expiration: {
      expires,
      renewalIntervalDays: expires ? (seed.renewalIntervalDays ?? null) : null,
      defaultValidityDays: expires ? (seed.defaultValidityDays ?? null) : null,
    },
    version: {
      versionable: seed.versionable ?? true,
      initialVersionLabel: 'v1',
    },
    allowMultiple: seed.allowMultiple ?? false,
    review: {
      reviewRequired: seed.reviewRequired ?? false,
      reviewRoles: seed.reviewRoles ?? (seed.reviewRequired ? ['advisor'] : []),
    },
    validationRules: seed.validationRules ?? [
      'has_file_reference',
      'mime_type_allowed',
      'size_within_limit',
    ],
    supportedMimeTypes: seed.supportedMimeTypes ?? PDF_IMAGE,
    maxSizeMB: seed.maxSizeMB ?? 25,
    retentionPolicy: seed.retentionPolicy ?? 'engagement',
    activityEvents: seed.activityEvents ?? [],
    workflowDependencies: seed.workflowDependencies ?? [],
    aiExtractionHints: seed.aiExtractionHints ?? [],
    alsoUsedByModules: seed.alsoUsedByModules ?? [],
    alsoUsedByCaseTypes: seed.alsoUsedByCaseTypes ?? [],
  }
}

/**
 * Foundation document types used across Advisor Operating System modules.
 */
export const DOCUMENT_TYPE_DEFINITIONS: readonly DocumentTypeDefinition[] = [
  // Identity
  defineDocument({
    key: 'driver_license',
    title: 'Driver License',
    description: 'Government-issued driver license for identity verification.',
    category: 'identity',
    moduleKey: 'households',
    caseType: 'household_onboarding_case',
    visibility: 'both',
    required: true,
    expires: true,
    renewalIntervalDays: 365,
    defaultValidityDays: 365,
    reviewRequired: true,
    alsoUsedByModules: ['credit_repair', 'insurance', 'business_funding'],
    alsoUsedByCaseTypes: ['credit_repair_case', 'insurance_case', 'funding_case'],
    aiExtractionHints: [
      { useCase: 'document.extract_identity', fields: ['fullName', 'expirationDate'] },
    ],
    workflowDependencies: [
      { workflowKey: 'household_onboarding_workflow', stageKey: 'in_progress', required: true },
    ],
  }),
  defineDocument({
    key: 'passport',
    title: 'Passport',
    description: 'Passport used as alternate identity document.',
    category: 'identity',
    moduleKey: 'households',
    caseType: 'household_onboarding_case',
    visibility: 'both',
    expires: true,
    renewalIntervalDays: 365,
    defaultValidityDays: 365,
    reviewRequired: true,
  }),
  defineDocument({
    key: 'social_security_card',
    title: 'Social Security Card',
    description:
      'Identity document type for SSN-card imagery in future storage (type metadata only — no sample numbers or card contents).',
    category: 'identity',
    moduleKey: 'credit_repair',
    caseType: 'credit_repair_case',
    visibility: 'internal',
    required: true,
    reviewRequired: true,
    reviewRoles: ['advisor', 'owner'],
    retentionPolicy: 'seven_years',
    alsoUsedByModules: ['households'],
  }),
  defineDocument({
    key: 'utility_bill',
    title: 'Utility Bill',
    description: 'Recent utility bill for address verification.',
    category: 'identity',
    moduleKey: 'households',
    caseType: 'household_onboarding_case',
    visibility: 'advisor',
    expires: true,
    defaultValidityDays: 90,
    alsoUsedByModules: ['credit_repair', 'business_funding'],
  }),

  // Financial
  defineDocument({
    key: 'bank_statement',
    title: 'Bank Statement',
    description: 'Personal bank statement for financial review.',
    category: 'financial',
    moduleKey: 'households',
    caseType: 'household_onboarding_case',
    visibility: 'advisor',
    required: false,
    expires: true,
    defaultValidityDays: 90,
    allowMultiple: true,
    alsoUsedByModules: ['business_funding', 'initial_financial_diagnostic'],
    alsoUsedByCaseTypes: ['funding_case', 'diagnostic_review_case'],
    aiExtractionHints: [
      { useCase: 'document.extract_financial_summary', fields: ['endingBalance'] },
    ],
  }),
  defineDocument({
    key: 'pay_stub',
    title: 'Pay Stub',
    description: 'Recent pay stub for income verification.',
    category: 'financial',
    moduleKey: 'households',
    caseType: 'household_onboarding_case',
    visibility: 'advisor',
    expires: true,
    defaultValidityDays: 60,
    allowMultiple: true,
    alsoUsedByModules: ['insurance', 'business_funding'],
  }),
  defineDocument({
    key: 'tax_return',
    title: 'Tax Return',
    description: 'Personal income tax return.',
    category: 'tax',
    moduleKey: 'tax_planning',
    caseType: 'tax_strategy_case',
    visibility: 'advisor',
    allowMultiple: true,
    alsoUsedByModules: ['households', 'business_funding', 'estate_planning'],
    alsoUsedByCaseTypes: ['funding_case', 'estate_case', 'household_onboarding_case'],
    supportedMimeTypes: PDF_ONLY,
    maxSizeMB: 40,
  }),

  // Credit
  defineDocument({
    key: 'credit_report',
    title: 'Credit Report',
    description: 'Imported or uploaded credit report.',
    category: 'credit',
    moduleKey: 'credit_repair',
    caseType: 'credit_repair_case',
    visibility: 'advisor',
    required: true,
    allowMultiple: true,
    reviewRequired: true,
    activityEvents: ['credit.report.imported'],
    workflowDependencies: [
      {
        workflowKey: 'credit_repair_workflow',
        stageKey: 'credit_reports_imported',
        required: true,
      },
    ],
    aiExtractionHints: [{ useCase: 'document.extract_credit_summary' }],
  }),
  defineDocument({
    key: 'credit_authorization',
    title: 'Credit Authorization',
    description: 'Signed authorization to pull / work credit.',
    category: 'compliance',
    moduleKey: 'credit_repair',
    caseType: 'credit_repair_case',
    visibility: 'both',
    required: true,
    reviewRequired: true,
    supportedMimeTypes: PDF_ONLY,
    workflowDependencies: [
      { workflowKey: 'credit_repair_workflow', stageKey: 'enrollment', required: true },
    ],
  }),
  defineDocument({
    key: 'credit_dispute_letter',
    title: 'Credit Dispute Letter',
    description: 'Advisor-generated or client dispute letter.',
    category: 'credit',
    moduleKey: 'credit_repair',
    caseType: 'credit_repair_case',
    visibility: 'advisor',
    allowMultiple: true,
    versionable: true,
  }),

  // Insurance
  defineDocument({
    key: 'insurance_illustration',
    title: 'Insurance Illustration',
    description: 'Carrier illustration for a proposed policy.',
    category: 'insurance',
    moduleKey: 'insurance',
    caseType: 'insurance_case',
    visibility: 'both',
    allowMultiple: true,
    reviewRequired: true,
    supportedMimeTypes: PDF_ONLY,
  }),
  defineDocument({
    key: 'insurance_application',
    title: 'Insurance Application',
    description: 'Completed insurance application packet.',
    category: 'insurance',
    moduleKey: 'insurance',
    caseType: 'insurance_case',
    visibility: 'advisor',
    required: true,
    reviewRequired: true,
    supportedMimeTypes: PDF_ONLY,
    workflowDependencies: [
      { workflowKey: 'insurance_case_workflow', stageKey: 'submitted', required: true },
    ],
  }),
  defineDocument({
    key: 'replacement_form',
    title: 'Replacement Form',
    description: 'Policy replacement disclosure / form.',
    category: 'compliance',
    moduleKey: 'insurance',
    caseType: 'insurance_case',
    visibility: 'both',
    reviewRequired: true,
    supportedMimeTypes: PDF_ONLY,
  }),
  defineDocument({
    key: 'id_verification',
    title: 'ID Verification Packet',
    description: 'Identity packet commonly required before insurance submission.',
    category: 'identity',
    moduleKey: 'insurance',
    caseType: 'insurance_case',
    visibility: 'advisor',
    required: true,
    workflowDependencies: [
      { workflowKey: 'insurance_case_workflow', stageKey: 'needs_documents', required: true },
    ],
  }),
  defineDocument({
    key: 'application_packet',
    title: 'Application Packet',
    description: 'Bundled application documents for insurance underwriting.',
    category: 'insurance',
    moduleKey: 'insurance',
    caseType: 'insurance_case',
    visibility: 'advisor',
    required: true,
    supportedMimeTypes: PDF_ONLY,
    maxSizeMB: 50,
  }),
  defineDocument({
    key: 'policy_document',
    title: 'Policy Document',
    description: 'Issued policy contract / declarations.',
    category: 'insurance',
    moduleKey: 'insurance',
    caseType: 'insurance_case',
    visibility: 'both',
    versionable: true,
    supportedMimeTypes: PDF_ONLY,
    alsoUsedByModules: ['commercial_insurance'],
    alsoUsedByCaseTypes: ['commercial_insurance_case'],
  }),
  defineDocument({
    key: 'insurance_summary',
    title: 'Insurance Summary',
    description: 'Advisor-generated insurance coverage summary.',
    category: 'advisor_generated',
    moduleKey: 'insurance',
    caseType: 'insurance_case',
    visibility: 'both',
    versionable: true,
  }),

  // Legal / Estate
  defineDocument({
    key: 'trust',
    title: 'Trust',
    description: 'Trust instrument.',
    category: 'legal',
    moduleKey: 'estate_planning',
    caseType: 'estate_case',
    visibility: 'advisor',
    reviewRequired: true,
    supportedMimeTypes: PDF_ONLY,
    retentionPolicy: 'permanent',
  }),
  defineDocument({
    key: 'will',
    title: 'Will',
    description: 'Last will and testament.',
    category: 'legal',
    moduleKey: 'estate_planning',
    caseType: 'estate_case',
    visibility: 'advisor',
    reviewRequired: true,
    supportedMimeTypes: PDF_ONLY,
    retentionPolicy: 'permanent',
  }),
  defineDocument({
    key: 'estate_questionnaire',
    title: 'Estate Questionnaire',
    description: 'Client estate planning questionnaire.',
    category: 'client_generated',
    moduleKey: 'estate_planning',
    caseType: 'estate_case',
    visibility: 'both',
    required: true,
    supportedMimeTypes: OFFICE_PDF,
    workflowDependencies: [
      { workflowKey: 'estate_planning_workflow', stageKey: 'intake', required: true },
    ],
  }),
  defineDocument({
    key: 'estate_draft',
    title: 'Estate Draft Packet',
    description: 'Draft estate planning documents pending review.',
    category: 'advisor_generated',
    moduleKey: 'estate_planning',
    caseType: 'estate_case',
    visibility: 'advisor',
    versionable: true,
    supportedMimeTypes: OFFICE_PDF,
  }),

  // Business / Funding
  defineDocument({
    key: 'operating_agreement',
    title: 'Operating Agreement',
    description: 'Business operating agreement.',
    category: 'business',
    moduleKey: 'business_funding',
    caseType: 'funding_case',
    visibility: 'advisor',
    supportedMimeTypes: PDF_ONLY,
    alsoUsedByModules: ['commercial_insurance', 'employee_benefits'],
  }),
  defineDocument({
    key: 'articles_of_organization',
    title: 'Articles of Organization',
    description: 'Formation articles / certificate.',
    category: 'business',
    moduleKey: 'business_funding',
    caseType: 'funding_case',
    visibility: 'advisor',
    supportedMimeTypes: PDF_ONLY,
  }),
  defineDocument({
    key: 'profit_and_loss',
    title: 'P&L',
    description: 'Profit and loss statement.',
    category: 'financial',
    moduleKey: 'business_funding',
    caseType: 'funding_case',
    visibility: 'advisor',
    allowMultiple: true,
    supportedMimeTypes: OFFICE_PDF,
    aiExtractionHints: [{ useCase: 'document.extract_financial_summary', fields: ['netIncome'] }],
  }),
  defineDocument({
    key: 'balance_sheet',
    title: 'Balance Sheet',
    description: 'Business balance sheet.',
    category: 'financial',
    moduleKey: 'business_funding',
    caseType: 'funding_case',
    visibility: 'advisor',
    allowMultiple: true,
    supportedMimeTypes: OFFICE_PDF,
  }),
  defineDocument({
    key: 'business_tax_return',
    title: 'Business Tax Return',
    description: 'Business entity tax return.',
    category: 'tax',
    moduleKey: 'business_funding',
    caseType: 'funding_case',
    visibility: 'advisor',
    allowMultiple: true,
    supportedMimeTypes: PDF_ONLY,
    maxSizeMB: 40,
    alsoUsedByModules: ['tax_planning'],
  }),
  defineDocument({
    key: 'business_bank_statement',
    title: 'Business Bank Statement',
    description: 'Business bank statement for funding underwriting.',
    category: 'financial',
    moduleKey: 'business_funding',
    caseType: 'funding_case',
    visibility: 'advisor',
    required: true,
    expires: true,
    defaultValidityDays: 90,
    allowMultiple: true,
  }),
  defineDocument({
    key: 'loan_package',
    title: 'Loan Package',
    description: 'Assembled funding / loan package.',
    category: 'business',
    moduleKey: 'business_funding',
    caseType: 'funding_case',
    visibility: 'advisor',
    versionable: true,
    supportedMimeTypes: PDF_ONLY,
    maxSizeMB: 75,
  }),
  defineDocument({
    key: 'funding_application',
    title: 'Funding Application',
    description: 'Business funding application form.',
    category: 'business',
    moduleKey: 'business_funding',
    caseType: 'funding_case',
    visibility: 'both',
    required: true,
    reviewRequired: true,
    supportedMimeTypes: OFFICE_PDF,
    workflowDependencies: [
      { workflowKey: 'business_funding_workflow', stageKey: 'application', required: true },
    ],
  }),
  defineDocument({
    key: 'funding_package',
    title: 'Funding Package',
    description: 'Advisor-assembled funding package artifact.',
    category: 'advisor_generated',
    moduleKey: 'business_funding',
    caseType: 'funding_case',
    visibility: 'advisor',
    versionable: true,
    supportedMimeTypes: PDF_ONLY,
  }),
  defineDocument({
    key: 'financials',
    title: 'Financials Bundle',
    description: 'Bundled financial statements for funding workflows.',
    category: 'financial',
    moduleKey: 'business_funding',
    caseType: 'funding_case',
    visibility: 'advisor',
    required: true,
    supportedMimeTypes: OFFICE_PDF,
    maxSizeMB: 50,
  }),

  // Benefits / commercial
  defineDocument({
    key: 'census',
    title: 'Employee Census',
    description: 'Employee census for benefits enrollment.',
    category: 'business',
    moduleKey: 'employee_benefits',
    caseType: 'employee_benefits_case',
    visibility: 'advisor',
    required: true,
    supportedMimeTypes: OFFICE_PDF,
  }),
  defineDocument({
    key: 'plan_docs',
    title: 'Plan Documents',
    description: 'Benefits plan documents.',
    category: 'compliance',
    moduleKey: 'employee_benefits',
    caseType: 'employee_benefits_case',
    visibility: 'both',
    required: true,
    supportedMimeTypes: PDF_ONLY,
  }),

  // Advisor / diagnostic generated
  defineDocument({
    key: 'ifd_report',
    title: 'IFD Report',
    description: 'Initial Financial Diagnostic report artifact (metadata example).',
    category: 'advisor_generated',
    moduleKey: 'initial_financial_diagnostic',
    caseType: 'diagnostic_review_case',
    visibility: 'both',
    required: true,
    versionable: true,
    supportedMimeTypes: PDF_ONLY,
    activityEvents: ['diagnostic.ifd.report_ready'],
    workflowDependencies: [
      {
        workflowKey: 'ifd_review_workflow',
        stageKey: 'recommendation_prepared',
        required: true,
      },
    ],
  }),
  defineDocument({
    key: 'action_plan',
    title: 'Action Plan',
    description: 'Advisor action plan generated from diagnostic review.',
    category: 'advisor_generated',
    moduleKey: 'initial_financial_diagnostic',
    caseType: 'diagnostic_review_case',
    visibility: 'both',
    required: true,
    versionable: true,
    supportedMimeTypes: PDF_ONLY,
  }),
  defineDocument({
    key: 'uploaded_file',
    title: 'Generic File Placeholder',
    description:
      'Generic client-provided file type key reserved for a future upload pipeline (metadata only — not a stored file in 4B.6).',
    category: 'client_generated',
    moduleKey: 'documents',
    visibility: 'advisor',
    allowMultiple: true,
    retentionPolicy: 'module_default',
  }),
  defineDocument({
    key: 'relationship_photo',
    title: 'Relationship Photo',
    description:
      'Optional private photo from when an advisor and contact connected. It is a memory aid only and must not be used for facial recognition, biometric identification, identity verification, embeddings, or matching.',
    category: 'client_generated',
    moduleKey: 'digital_identity',
    caseType: null,
    visibility: 'internal',
    required: false,
    allowMultiple: false,
    reviewRequired: false,
    supportedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSizeMB: 5,
    retentionPolicy: 'engagement',
    aiExtractionHints: [],
    activityEvents: [
      'digital_identity.relationship_photo_added',
      'digital_identity.relationship_photo_removed',
      'digital_identity.relationship_photo_replaced',
    ],
    workflowDependencies: [],
  }),
] as const

const BY_KEY = new Map(
  DOCUMENT_TYPE_DEFINITIONS.map((definition) => [definition.key, definition]),
)

export function listDocumentTypeDefinitions(): readonly DocumentTypeDefinition[] {
  return DOCUMENT_TYPE_DEFINITIONS
}

export function listDocumentTypeKeys(): string[] {
  return DOCUMENT_TYPE_DEFINITIONS.map((definition) => definition.key).sort()
}

export function getDocumentTypeDefinition(
  key: DocumentTypeKey,
): DocumentTypeDefinition | undefined {
  return BY_KEY.get(key)
}

export function requireDocumentTypeDefinition(key: DocumentTypeKey): DocumentTypeDefinition {
  const definition = getDocumentTypeDefinition(key)
  if (!definition) {
    throw new Error(`Document Engine: unknown document type "${key}"`)
  }
  return definition
}

export function isKnownDocumentType(key: string): boolean {
  return BY_KEY.has(key)
}

/**
 * Validate registry integrity. Pure test/helper — does not grant authorization
 * and does not touch storage.
 *
 * Optional workflowLookup supports cycle-safe unit tests; production/default
 * validation uses the Workflow Engine registry.
 */
export function validateDocumentRegistry(options?: {
  workflowLookup?: DocumentWorkflowLookup
}): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const keys = new Set<string>()
  const categoryKeys = DOCUMENT_CATEGORIES.map((item) => item.key)
  if (new Set(categoryKeys).size !== categoryKeys.length) {
    errors.push('Duplicate document category keys')
  }

  for (const definition of DOCUMENT_TYPE_DEFINITIONS) {
    if (keys.has(definition.key)) {
      errors.push(`Duplicate document type key "${definition.key}"`)
    }
    keys.add(definition.key)

    if (!isKnownDocumentCategory(definition.category)) {
      errors.push(`Document "${definition.key}" has unknown category "${definition.category}"`)
    }
    if (!getModule(definition.moduleKey)) {
      errors.push(`Document "${definition.key}" references unknown module "${definition.moduleKey}"`)
    }
    if (definition.caseType && !isKnownCaseType(definition.caseType)) {
      errors.push(
        `Document "${definition.key}" references unknown caseType "${definition.caseType}"`,
      )
    }
    for (const moduleKey of definition.alsoUsedByModules ?? []) {
      if (!getModule(moduleKey)) {
        errors.push(`Document "${definition.key}" alsoUsedByModules unknown "${moduleKey}"`)
      }
    }
    for (const caseType of definition.alsoUsedByCaseTypes ?? []) {
      if (!isKnownCaseType(caseType)) {
        errors.push(`Document "${definition.key}" alsoUsedByCaseTypes unknown "${caseType}"`)
      }
    }
    if (definition.maxSizeMB <= 0 || definition.maxSizeMB > 200) {
      errors.push(`Document "${definition.key}" has invalid maxSizeMB`)
    }
    if (definition.supportedMimeTypes.length === 0) {
      errors.push(`Document "${definition.key}" has empty supportedMimeTypes`)
    }
    for (const rule of definition.validationRules) {
      if (!isKnownDocumentValidationRule(rule)) {
        errors.push(`Document "${definition.key}" has unknown validation rule "${rule}"`)
      }
    }
    if (definition.expiration.expires) {
      const days = definition.expiration.defaultValidityDays
      if (days != null && days <= 0) {
        errors.push(`Document "${definition.key}" has invalid defaultValidityDays`)
      }
    } else if (
      definition.expiration.renewalIntervalDays != null ||
      definition.expiration.defaultValidityDays != null
    ) {
      // Allow nulls only; non-null intervals without expires are inconsistent.
      if (
        definition.expiration.renewalIntervalDays != null ||
        definition.expiration.defaultValidityDays != null
      ) {
        // already handled by defineDocument setting nulls when expires=false
      }
    }
    for (const hint of definition.aiExtractionHints ?? []) {
      if (!hint.useCase || typeof hint.useCase !== 'string') {
        errors.push(`Document "${definition.key}" has invalid aiExtractionHints.useCase`)
      }
    }
  }

  errors.push(
    ...collectDocumentWorkflowDependencyErrors(
      DOCUMENT_TYPE_DEFINITIONS,
      options?.workflowLookup ?? defaultWorkflowLookup(),
    ),
  )

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}
