/**
 * Example Document requirement draft builders.
 *
 * Metadata / shape examples only:
 * - do NOT upload or store files
 * - do NOT create Cases, Tasks, Activities, or Workflows
 * - do NOT alter IFD / onboarding / insurance / credit / funding runtime behavior
 * - IFD report is not generated; action plan is metadata only
 * - onboarding identity docs are not treated as verified
 * - insurance application is not treated as submitted
 * - funding checklist does not imply lender approval
 * - public IFD remains separate from Financial Progress
 * - AI extraction hints do not invoke AI
 */

import { createDocumentRequirementDraft } from './selectors'
import { buildRequiredDocumentChecklist } from './requirements'
import type { DocumentRequirementDraft } from './types'

export type IfdDocumentExampleInput = {
  caseDraftId?: string | null
  id?: string
  openedAt?: string
}

/** Example: IFD report requirement draft (advisor-generated artifact metadata). */
export function buildIfdReportDocumentExample(
  input: IfdDocumentExampleInput = {},
): DocumentRequirementDraft {
  return createDocumentRequirementDraft({
    id: input.id,
    documentTypeKey: 'ifd_report',
    caseDraftId: input.caseDraftId ?? null,
    caseType: 'diagnostic_review_case',
    status: 'requested',
    openedAt: input.openedAt,
    metadata: {
      source: 'ifd_review_example',
      notes: 'Example only — no PDF generated or stored',
      idempotencyKey: input.caseDraftId ? `ifd_report:${input.caseDraftId}` : undefined,
    },
  })
}

export type OnboardingDocumentExampleInput = {
  caseDraftId?: string | null
  id?: string
}

/** Example: driver license requirement for household onboarding. */
export function buildOnboardingIdentityDocumentExample(
  input: OnboardingDocumentExampleInput = {},
): DocumentRequirementDraft {
  return createDocumentRequirementDraft({
    id: input.id,
    documentTypeKey: 'driver_license',
    caseType: 'household_onboarding_case',
    caseDraftId: input.caseDraftId ?? null,
    metadata: {
      source: 'onboarding_example',
      notes: 'Example only — not a verified identity document; onboarding runtime unchanged',
    },
  })
}

export type InsuranceDocumentExampleInput = {
  caseDraftId?: string | null
  id?: string
}

/** Example: insurance application requirement draft. */
export function buildInsuranceApplicationDocumentExample(
  input: InsuranceDocumentExampleInput = {},
): DocumentRequirementDraft {
  return createDocumentRequirementDraft({
    id: input.id,
    documentTypeKey: 'insurance_application',
    caseType: 'insurance_case',
    caseDraftId: input.caseDraftId ?? null,
    metadata: {
      source: 'insurance_module_example',
      notes: 'Example only — not a submitted application; insurance runtime unchanged',
    },
  })
}

export type FundingDocumentChecklistExampleInput = {
  caseType?: string
}

/**
 * Example: required document checklist metadata for funding.
 * Checklist only — no uploads and no lender approval implication.
 */
export function buildFundingRequiredDocumentsExample(
  input: FundingDocumentChecklistExampleInput = {},
) {
  return buildRequiredDocumentChecklist(input.caseType ?? 'funding_case')
}
