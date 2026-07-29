import type { AssessmentLifecycleStatus, CrmHouseholdDetail } from '../types'
import {
  reviewSectionStatusFromCompletion,
  validateOnboardingCompletion,
} from './onboardingCompletion'
import type { HouseholdOnboardingAnswers } from './onboardingFormTypes'
import {
  getOrderedOnboardingSections,
  type OnboardingSectionId,
} from './onboardingSections'
import {
  validateOnboardingSection,
  type OnboardingValidationContext,
} from './onboardingValidation'

/** Advisor-facing section progress state. */
export type OnboardingSectionUiState =
  | 'not_started'
  | 'in_progress'
  | 'complete'
  | 'needs_attention'

export type OnboardingProgressSnapshot = {
  totalSections: number
  completedSectionsCount: number
  progressPercent: number
  sectionStates: Record<OnboardingSectionId, OnboardingSectionUiState>
  completedSectionIds: OnboardingSectionId[]
}

export function getSectionUiState(args: {
  sectionId: OnboardingSectionId
  answers: HouseholdOnboardingAnswers
  currentSectionId: OnboardingSectionId
  assessmentStatus: AssessmentLifecycleStatus
  household: CrmHouseholdDetail
}): OnboardingSectionUiState {
  if (args.assessmentStatus === 'completed') return 'complete'

  const context: OnboardingValidationContext = { household: args.household }
  if (args.sectionId === 'review') {
    return reviewSectionStatusFromCompletion(validateOnboardingCompletion(args.answers, context))
  }
  return validateOnboardingSection(args.sectionId, args.answers, context).status
}

export function deriveCompletedSectionIds(args: {
  answers: HouseholdOnboardingAnswers
  assessmentStatus: AssessmentLifecycleStatus
  currentSectionId: OnboardingSectionId
  household: CrmHouseholdDetail
}): OnboardingSectionId[] {
  return getOrderedOnboardingSections()
    .filter(
      (section) =>
        getSectionUiState({
          sectionId: section.id,
          answers: args.answers,
          currentSectionId: args.currentSectionId,
          assessmentStatus: args.assessmentStatus,
          household: args.household,
        }) === 'complete',
    )
    .map((section) => section.id)
}

export function buildOnboardingProgressSnapshot(args: {
  answers: HouseholdOnboardingAnswers
  currentSectionId: OnboardingSectionId
  assessmentStatus: AssessmentLifecycleStatus
  household: CrmHouseholdDetail
}): OnboardingProgressSnapshot {
  const sections = getOrderedOnboardingSections()
  const sectionStates = {} as Record<OnboardingSectionId, OnboardingSectionUiState>
  for (const section of sections) {
    sectionStates[section.id] = getSectionUiState({
      sectionId: section.id,
      answers: args.answers,
      currentSectionId: args.currentSectionId,
      assessmentStatus: args.assessmentStatus,
      household: args.household,
    })
  }

  const completedSectionIds = sections
    .filter((section) => sectionStates[section.id] === 'complete')
    .map((section) => section.id)

  const totalSections = sections.length
  const completedSectionsCount = completedSectionIds.length
  const progressPercent =
    totalSections === 0 ? 0 : Math.round((completedSectionsCount / totalSections) * 100)

  return {
    totalSections,
    completedSectionsCount,
    progressPercent,
    sectionStates,
    completedSectionIds,
  }
}

export function formatSectionUiState(state: OnboardingSectionUiState): string {
  switch (state) {
    case 'not_started':
      return 'Not started'
    case 'in_progress':
      return 'In progress'
    case 'complete':
      return 'Complete'
    case 'needs_attention':
      return 'Needs attention'
    default:
      return 'Not started'
  }
}
