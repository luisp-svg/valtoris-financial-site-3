import { describe, expect, it } from 'vitest'
import {
  findModuleByNavPath,
  getCrmSidebarNavItems,
  getModule,
  listEnabledModules,
  moduleDeclaresPermission,
} from '../registry'
import { DOCUMENT_CATEGORIES } from './categories'
import {
  buildFundingRequiredDocumentsExample,
  buildIfdReportDocumentExample,
  buildInsuranceApplicationDocumentExample,
  buildOnboardingIdentityDocumentExample,
  collectDocumentWorkflowDependencyErrors,
  createDocumentRequirementDraft,
  DOCUMENT_TYPE_DEFINITIONS,
  getDocumentTypeDefinition,
  isKnownDocumentCategory,
  isKnownDocumentType,
  isMimeTypeAllowed,
  listDocumentCategories,
  listDocumentTypeDefinitions,
  listDocumentTypeKeys,
  listExpiringDocuments,
  listOptionalDocumentsForCaseType,
  listOptionalDocumentsForModule,
  listRequiredDocumentsForCaseType,
  listRequiredDocumentsForModule,
  listReviewRequiredDocuments,
  selectDocumentCategorySummary,
  selectDocumentsByCaseType,
  selectDocumentsByCategory,
  selectDocumentsByModule,
  selectDocumentsForEnabledModules,
  validateCreateDocumentRequirementDraftInput,
  validateDocumentMetadata,
  validateDocumentRegistry,
} from './index'

const CASE_DRAFT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const DOC_DRAFT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const SENSITIVE_KEYS = [
  'social_security_card',
  'passport',
  'driver_license',
  'tax_return',
  'bank_statement',
  'business_bank_statement',
  'credit_report',
  'insurance_application',
  'trust',
  'will',
] as const

describe('Document Engine registry', () => {
  it('registers unique document types with valid categories and modules', () => {
    expect(validateDocumentRegistry()).toEqual({ ok: true })

    const keys = listDocumentTypeKeys()
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toEqual([...keys].sort())
    expect(keys).toEqual(
      expect.arrayContaining([
        'driver_license',
        'passport',
        'social_security_card',
        'utility_bill',
        'bank_statement',
        'pay_stub',
        'tax_return',
        'credit_report',
        'insurance_illustration',
        'insurance_application',
        'replacement_form',
        'trust',
        'will',
        'operating_agreement',
        'articles_of_organization',
        'profit_and_loss',
        'balance_sheet',
        'business_tax_return',
        'business_bank_statement',
        'loan_package',
        'estate_questionnaire',
        'funding_application',
        'ifd_report',
        'action_plan',
      ]),
    )

    for (const key of keys) {
      const definition = getDocumentTypeDefinition(key)
      expect(definition).toBeTruthy()
      expect(isKnownDocumentCategory(definition!.category)).toBe(true)
      expect(getModule(definition!.moduleKey)).toBeTruthy()
      expect(definition!.maxSizeMB).toBeGreaterThan(0)
      expect(definition!.supportedMimeTypes.length).toBeGreaterThan(0)
    }
  })

  it('registers unique categories in deterministic order', () => {
    const categoryKeys = DOCUMENT_CATEGORIES.map((item) => item.key)
    expect(new Set(categoryKeys).size).toBe(categoryKeys.length)

    const categories = listDocumentCategories()
    expect(categories.map((item) => item.key)).toEqual([
      'identity',
      'financial',
      'insurance',
      'legal',
      'tax',
      'business',
      'medical',
      'property',
      'credit',
      'compliance',
      'advisor_generated',
      'client_generated',
    ])
    expect(isKnownDocumentCategory('not_a_category')).toBe(false)
  })

  it('allows disabled modules to declare document types without enabling runtime nav', () => {
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(isKnownDocumentType('credit_report')).toBe(true)
    expect(getDocumentTypeDefinition('credit_report')?.moduleKey).toBe('credit_repair')
    expect(getModule('credit_repair')?.navigation.visible).toBe(false)
  })

  it('registers Document Engine as enabled platform module without auth grants or nav label', () => {
    const module = getModule('documents')
    expect(module?.status).toBe('active')
    expect(module?.featureFlag.enabled).toBe(true)
    expect(module?.navigation.visible).toBe(false)
    expect(listEnabledModules().some((item) => item.key === 'documents')).toBe(true)
    // Declared capability / reviewRoles ≠ authorization.
    expect(moduleDeclaresPermission('documents', 'document.read')).toBe(true)
    expect(getDocumentTypeDefinition('social_security_card')?.review.reviewRoles).toEqual([
      'advisor',
      'owner',
    ])
    // CRM Documents nav remains the placeholder documents_nav route.
    expect(getCrmSidebarNavItems().some((item) => item.path === '/crm/documents')).toBe(true)
    expect(getCrmSidebarNavItems().some((item) => item.label === 'Document Engine')).toBe(false)
    expect(findModuleByNavPath('/crm/documents')?.key).toBe('documents_nav')
  })

  it('fails unknown document types safely', () => {
    expect(isKnownDocumentType('not_a_document')).toBe(false)
    expect(getDocumentTypeDefinition('not_a_document')).toBeUndefined()
    expect(
      validateCreateDocumentRequirementDraftInput({ documentTypeKey: 'not_a_document' }),
    ).toEqual({ ok: false, error: 'Unknown documentTypeKey' })
  })

  it('validates all current workflowDependencies against the Workflow Engine', () => {
    expect(validateDocumentRegistry()).toEqual({ ok: true })

    const deps = DOCUMENT_TYPE_DEFINITIONS.flatMap((definition) =>
      (definition.workflowDependencies ?? [])
        .filter((item) => item.workflowKey)
        .map((item) => ({
          doc: definition.key,
          workflowKey: item.workflowKey!,
          stageKey: item.stageKey,
        })),
    )
    expect(deps).toHaveLength(8)
    expect(deps).toEqual(
      expect.arrayContaining([
        {
          doc: 'driver_license',
          workflowKey: 'household_onboarding_workflow',
          stageKey: 'in_progress',
        },
        {
          doc: 'credit_report',
          workflowKey: 'credit_repair_workflow',
          stageKey: 'credit_reports_imported',
        },
        {
          doc: 'credit_authorization',
          workflowKey: 'credit_repair_workflow',
          stageKey: 'enrollment',
        },
        {
          doc: 'insurance_application',
          workflowKey: 'insurance_case_workflow',
          stageKey: 'submitted',
        },
        {
          doc: 'id_verification',
          workflowKey: 'insurance_case_workflow',
          stageKey: 'needs_documents',
        },
        {
          doc: 'estate_questionnaire',
          workflowKey: 'estate_planning_workflow',
          stageKey: 'intake',
        },
        {
          doc: 'funding_application',
          workflowKey: 'business_funding_workflow',
          stageKey: 'application',
        },
        {
          doc: 'ifd_report',
          workflowKey: 'ifd_review_workflow',
          stageKey: 'recommendation_prepared',
        },
      ]),
    )
    expect(collectDocumentWorkflowDependencyErrors(DOCUMENT_TYPE_DEFINITIONS)).toEqual([])
  })

  it('fails clearly for unknown workflow keys and unknown stages', () => {
    const sample = [
      {
        ...getDocumentTypeDefinition('driver_license')!,
        key: 'workflow_dep_probe',
        workflowDependencies: [
          { workflowKey: 'not_a_real_workflow', stageKey: 'in_progress' },
        ],
      },
    ]
    expect(collectDocumentWorkflowDependencyErrors(sample)).toEqual([
      'Document "workflow_dep_probe" references unknown workflowKey "not_a_real_workflow"',
    ])

    const unknownStageLookup = {
      isKnownWorkflowKey: (key: string) => key === 'household_onboarding_workflow',
      getWorkflowStageKeys: (key: string) =>
        key === 'household_onboarding_workflow' ? (['in_progress'] as const) : undefined,
    }
    expect(
      collectDocumentWorkflowDependencyErrors(
        [
          {
            ...getDocumentTypeDefinition('driver_license')!,
            key: 'stage_dep_probe',
            workflowDependencies: [
              {
                workflowKey: 'household_onboarding_workflow',
                stageKey: 'not_a_real_stage',
              },
            ],
          },
        ],
        unknownStageLookup,
      ),
    ).toEqual([
      'Document "stage_dep_probe" references unknown stage "not_a_real_stage" for workflow "household_onboarding_workflow"',
    ])

    // Valid dependency via injected lookup.
    expect(
      collectDocumentWorkflowDependencyErrors(
        [
          {
            ...getDocumentTypeDefinition('driver_license')!,
            key: 'valid_dep_probe',
            workflowDependencies: [
              {
                workflowKey: 'household_onboarding_workflow',
                stageKey: 'in_progress',
              },
            ],
          },
        ],
        unknownStageLookup,
      ),
    ).toEqual([])
  })
})

describe('Document Engine selectors + requirements', () => {
  it('looks up by category, module, and case type deterministically without mutation', () => {
    const source = listDocumentTypeDefinitions()
    const snapshot = source.map((item) => item.key)
    const identity = selectDocumentsByCategory('identity')
    expect(source.map((item) => item.key)).toEqual(snapshot)
    expect(identity.every((item) => item.category === 'identity')).toBe(true)
    expect(identity.map((item) => item.key)).toEqual(
      [...identity.map((item) => item.key)].sort(),
    )

    const insurance = selectDocumentsByModule('insurance')
    expect(insurance.some((item) => item.key === 'insurance_application')).toBe(true)

    const fundingCase = selectDocumentsByCaseType('funding_case')
    expect(fundingCase.some((item) => item.key === 'funding_application')).toBe(true)

    const summary = selectDocumentCategorySummary()
    expect(summary.find((item) => item.category === 'identity')?.documentCount).toBeGreaterThan(0)
    expect(summary.find((item) => item.category === 'medical')?.documentCount).toBe(0)
  })

  it('keeps required/optional/review/expiration semantics consistent and deterministic', () => {
    const requiredIfd = listRequiredDocumentsForCaseType('diagnostic_review_case')
    const optionalIfd = listOptionalDocumentsForCaseType('diagnostic_review_case')
    const requiredKeys = new Set(requiredIfd.map((item) => item.key))
    const optionalKeys = new Set(optionalIfd.map((item) => item.key))
    for (const key of requiredKeys) expect(optionalKeys.has(key)).toBe(false)
    expect(requiredIfd.map((item) => item.key)).toEqual(
      expect.arrayContaining(['ifd_report', 'action_plan']),
    )
    expect(requiredIfd.map((item) => item.key)).toEqual(
      [...requiredIfd.map((item) => item.key)].sort(),
    )

    // reviewRequired is independent of required.
    const license = getDocumentTypeDefinition('driver_license')
    expect(license?.required).toBe(true)
    expect(license?.review.reviewRequired).toBe(true)
    const utility = getDocumentTypeDefinition('utility_bill')
    expect(utility?.required).toBe(false)
    // versionable / allowMultiple remain metadata flags only.
    expect(typeof getDocumentTypeDefinition('bank_statement')?.allowMultiple).toBe('boolean')
    expect(typeof getDocumentTypeDefinition('ifd_report')?.version.versionable).toBe('boolean')

    const requiredCredit = listRequiredDocumentsForModule('credit_repair')
    expect(requiredCredit.some((item) => item.key === 'credit_report')).toBe(true)
    expect(listOptionalDocumentsForModule('credit_repair').every((item) => !item.required)).toBe(
      true,
    )

    const reviewRequired = listReviewRequiredDocuments({ moduleKey: 'insurance' })
    expect(reviewRequired.every((item) => item.review.reviewRequired)).toBe(true)

    const expiring = listExpiringDocuments({ moduleKey: 'households' })
    expect(expiring.every((item) => item.expiration.expires)).toBe(true)
    // Expiration metadata is not a running timer.
    expect(expiring.every((item) => typeof item.expiration.defaultValidityDays !== 'function')).toBe(
      true,
    )
  })

  it('excludes disabled-module primary documents from enabled-module helper', () => {
    const enabled = selectDocumentsForEnabledModules()
    expect(enabled.some((item) => item.moduleKey === 'credit_repair')).toBe(false)
    expect(enabled.some((item) => item.moduleKey === 'households')).toBe(true)
  })
})

describe('Document Engine validation + drafts', () => {
  it('evaluates validation metadata fail-closed without claiming verification', () => {
    const pass = validateDocumentMetadata('driver_license', {
      hasFileReference: true,
      mimeType: 'application/pdf',
      sizeMB: 2,
    })
    expect(pass.ok).toBe(true)
    // Passing only means caller flags matched metadata rules — not authenticity.
    expect(JSON.stringify(pass)).not.toMatch(/authentic|malware|legal|verified identity/i)

    expect(
      validateDocumentMetadata('driver_license', {
        hasFileReference: false,
        mimeType: 'text/plain',
        sizeMB: 999,
      }).ok,
    ).toBe(false)

    expect(isMimeTypeAllowed('ifd_report', 'application/pdf')).toBe(true)
    expect(isMimeTypeAllowed('ifd_report', 'image/gif')).toBe(false)
    expect(validateDocumentMetadata('not_a_document', {}).ok).toBe(false)
  })

  it('creates non-persistent requirement drafts with sanitized metadata', () => {
    const draft = createDocumentRequirementDraft({
      id: DOC_DRAFT_ID,
      documentTypeKey: 'ifd_report',
      caseDraftId: CASE_DRAFT_ID,
      metadata: {
        source: 'test',
        answers: { income: 1 },
        nested: { x: true },
        ssn: '000-00-0000',
      } as never,
    })
    expect(draft.isDraft).toBe(true)
    expect(draft.id).toBe(DOC_DRAFT_ID)
    expect(draft.caseDraftId).toBe(CASE_DRAFT_ID)
    expect(draft.status).toBe('requested')
    expect(draft.metadata.source).toBe('test')
    expect(draft.metadata.answers).toBeUndefined()
    expect(draft.metadata.nested).toBeUndefined()
    expect(draft.metadata.ssn).toBeUndefined()
  })

  it('rejects malformed draft ids', () => {
    expect(
      validateCreateDocumentRequirementDraftInput({
        documentTypeKey: 'driver_license',
        caseDraftId: 'bad',
      }).ok,
    ).toBe(false)
  })
})

describe('Document Engine sensitive metadata + examples', () => {
  it('keeps sensitive document definitions free of embedded PII or sample contents', () => {
    for (const key of SENSITIVE_KEYS) {
      const definition = getDocumentTypeDefinition(key)
      expect(definition).toBeTruthy()
      const blob = JSON.stringify(definition)
      expect(blob).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/)
      expect(blob).not.toMatch(/\b\d{9}\b/)
      expect(blob.toLowerCase()).not.toContain('sample ssn')
      expect(blob.toLowerCase()).not.toContain('account number')
      expect(blob).not.toMatch(/\$\d{1,3}(,\d{3})*/)
      // Visibility / retention are metadata, not encryption or compliance promises.
      expect(definition!.visibility).toBeTruthy()
      expect(definition!.retentionPolicy).toBeTruthy()
      expect(blob.toLowerCase()).not.toContain('encrypt')
      expect(blob.toLowerCase()).not.toContain('guaranteed retention')
    }
    expect(selectDocumentsByCategory('medical')).toEqual([])
  })

  it('builds IFD / onboarding / insurance / funding examples as metadata only', () => {
    const ifd = buildIfdReportDocumentExample({
      id: DOC_DRAFT_ID,
      caseDraftId: CASE_DRAFT_ID,
    })
    expect(ifd.isDraft).toBe(true)
    expect(ifd.documentTypeKey).toBe('ifd_report')
    expect(ifd.status).toBe('requested')
    expect(ifd.metadata.notes).toMatch(/no PDF generated/i)

    const onboarding = buildOnboardingIdentityDocumentExample()
    expect(onboarding.documentTypeKey).toBe('driver_license')
    expect(onboarding.metadata.notes).toMatch(/not a verified identity/i)

    const insurance = buildInsuranceApplicationDocumentExample()
    expect(insurance.documentTypeKey).toBe('insurance_application')
    expect(insurance.metadata.notes).toMatch(/not a submitted application/i)

    const funding = buildFundingRequiredDocumentsExample()
    expect(funding.every((item) => item.required)).toBe(true)
    expect(funding.some((item) => item.documentTypeKey === 'funding_application')).toBe(true)
    expect(JSON.stringify(funding).toLowerCase()).not.toContain('lender approved')

    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(getDocumentTypeDefinition('credit_report')?.aiExtractionHints?.[0]?.useCase).toBe(
      'document.extract_credit_summary',
    )
    expect(getDocumentTypeDefinition('action_plan')?.category).toBe('advisor_generated')
  })
})
