import type { CrmHouseholdDetail } from '../types'
import {
  FORM_SECTION_IDS,
  type FormSectionId,
  type HouseholdOnboardingAnswers,
} from './onboardingFormTypes'
import type { OnboardingSectionUiState } from './onboardingProgress'
import {
  getOnboardingSection,
  type OnboardingSectionId,
} from './onboardingSections'
import {
  validateOnboardingSection,
  type OnboardingValidationContext,
  type SectionValidationResult,
} from './onboardingValidation'

export type CompletionIssue = {
  sectionId: OnboardingSectionId | null
  code: string
  message: string
}

export type OnboardingReadiness = 'ready_to_complete' | 'incomplete' | 'needs_attention'

export type OnboardingCompletionValidation = {
  canComplete: boolean
  readiness: OnboardingReadiness
  blockingErrors: CompletionIssue[]
  warnings: CompletionIssue[]
  incompleteSections: OnboardingSectionId[]
  needsAttentionSections: OnboardingSectionId[]
  completeSections: OnboardingSectionId[]
  sectionResults: Record<FormSectionId, SectionValidationResult>
}

export function formatOnboardingReadiness(readiness: OnboardingReadiness): string {
  switch (readiness) {
    case 'ready_to_complete':
      return 'Ready to complete'
    case 'needs_attention':
      return 'Needs attention'
    case 'incomplete':
      return 'Incomplete'
    default:
      return 'Incomplete'
  }
}

function incompleteStatusLabel(status: OnboardingSectionUiState): string {
  switch (status) {
    case 'in_progress':
      return 'in progress'
    case 'not_started':
      return 'not started'
    case 'needs_attention':
      return 'needs attention'
    default:
      return status
  }
}

/**
 * Final onboarding completion validation across all form sections.
 * Does not compute financial scores or recommendations.
 */
export function validateOnboardingCompletion(
  answers: HouseholdOnboardingAnswers,
  context: OnboardingValidationContext,
): OnboardingCompletionValidation {
  const sectionResults = {} as Record<FormSectionId, SectionValidationResult>
  const incompleteSections: OnboardingSectionId[] = []
  const needsAttentionSections: OnboardingSectionId[] = []
  const completeSections: OnboardingSectionId[] = []
  const blockingErrors: CompletionIssue[] = []
  const warnings: CompletionIssue[] = []

  for (const sectionId of FORM_SECTION_IDS) {
    const result = validateOnboardingSection(sectionId, answers, context)
    sectionResults[sectionId] = result
    const title = getOnboardingSection(sectionId).title

    if (result.status === 'complete') {
      completeSections.push(sectionId)
    } else if (result.status === 'needs_attention') {
      needsAttentionSections.push(sectionId)
      for (const [code, message] of Object.entries(result.errors)) {
        blockingErrors.push({ sectionId, code, message: `${title}: ${message}` })
      }
      if (Object.keys(result.errors).length === 0) {
        blockingErrors.push({
          sectionId,
          code: 'needs_attention',
          message: `${title} needs attention before completion.`,
        })
      }
    } else {
      incompleteSections.push(sectionId)
      blockingErrors.push({
        sectionId,
        code: 'incomplete',
        message: `${title} is ${incompleteStatusLabel(result.status)} and must be complete before finishing onboarding.`,
      })
    }

    for (const [code, message] of Object.entries(result.warnings)) {
      warnings.push({ sectionId, code, message: `${title}: ${message}` })
    }
  }

  // Review itself is not a form payload section; readiness is derived from form sections.
  const canComplete =
    incompleteSections.length === 0 && needsAttentionSections.length === 0

  let readiness: OnboardingReadiness = 'incomplete'
  if (needsAttentionSections.length > 0) readiness = 'needs_attention'
  else if (canComplete) readiness = 'ready_to_complete'

  return {
    canComplete,
    readiness,
    blockingErrors,
    warnings,
    incompleteSections,
    needsAttentionSections,
    completeSections,
    sectionResults,
  }
}

/** Section UI status for the Financial Progress Review step in draft mode. */
export function reviewSectionStatusFromCompletion(
  completion: OnboardingCompletionValidation,
): OnboardingSectionUiState {
  if (completion.needsAttentionSections.length > 0) return 'needs_attention'
  if (completion.canComplete) return 'complete'
  if (completion.completeSections.length > 0) return 'in_progress'
  return 'not_started'
}

export function buildReviewContext(household: CrmHouseholdDetail): OnboardingValidationContext {
  return { household }
}
