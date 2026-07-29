import type { HouseholdOnboardingAssessment } from '../types'
import type { HouseholdOnboardingAnswers } from './onboardingFormTypes'
import { normalizeOnboardingAnswers } from './onboardingSchema'
import type { OnboardingSectionId } from './onboardingSections'

/**
 * Stable JSON for dirty comparison.
 * Relies on our typed objects having consistent key insertion order from factories/normalizers.
 */
export function serializeAnswersBaseline(answers: HouseholdOnboardingAnswers): string {
  return JSON.stringify(answers)
}

export function isAnswersDirty(
  current: HouseholdOnboardingAnswers,
  baselineSerialized: string | null,
): boolean {
  if (baselineSerialized == null) return false
  return serializeAnswersBaseline(current) !== baselineSerialized
}

/**
 * Build the full answers document to persist.
 * Always includes every section; never a partial document.
 */
export function buildAnswersDocumentForSave(args: {
  answers: HouseholdOnboardingAnswers
  lastSection: OnboardingSectionId
  completedSectionIds: OnboardingSectionId[]
  now?: () => Date
}): HouseholdOnboardingAnswers {
  const nowIso = (args.now ?? (() => new Date()))().toISOString()
  const next: HouseholdOnboardingAnswers = {
    ...args.answers,
    meta: {
      ...args.answers.meta,
      version: args.answers.meta.version || 1,
      startedAt: args.answers.meta.startedAt,
      lastSavedAt: nowIso,
      lastSection: args.lastSection,
      completedSections: [...args.completedSectionIds],
    },
  }
  return normalizeOnboardingAnswers(next, { now: () => new Date(nowIso) })
}

/** Convert typed answers into the API JSON object payload (full document). */
export function answersToApiPayload(
  answers: HouseholdOnboardingAnswers,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(answers)) as Record<string, unknown>
}

export type DraftFreshnessResult =
  | { status: 'fresh' }
  | { status: 'missing' }
  | { status: 'completed_elsewhere' }
  | { status: 'stale'; remoteUpdatedAt: string }

/**
 * Practical stale-overwrite guard using assessment.updated_at.
 * The Sprint 4A.1 API has no If-Match / revision token; this is best-effort.
 */
export function evaluateDraftFreshness(args: {
  loadedAssessmentId: string
  loadedUpdatedAt: string
  latest: HouseholdOnboardingAssessment | null
}): DraftFreshnessResult {
  if (!args.latest) return { status: 'missing' }
  if (args.latest.id !== args.loadedAssessmentId) {
    return { status: 'stale', remoteUpdatedAt: args.latest.updated_at }
  }
  if (args.latest.status !== 'draft') return { status: 'completed_elsewhere' }
  if (args.latest.updated_at !== args.loadedUpdatedAt) {
    return { status: 'stale', remoteUpdatedAt: args.latest.updated_at }
  }
  return { status: 'fresh' }
}

export type PersistDraftIntent = 'save_draft' | 'save_and_continue'

export function describeDraftFreshnessFailure(result: DraftFreshnessResult): string {
  switch (result.status) {
    case 'missing':
      return 'This draft is no longer available. Reload onboarding to continue.'
    case 'completed_elsewhere':
      return 'This onboarding was completed elsewhere and can no longer be saved as a draft.'
    case 'stale':
      return 'This draft was updated elsewhere since you loaded it. Reload to avoid overwriting newer changes, or overwrite if you intend to replace them.'
    default:
      return 'Unable to verify draft freshness.'
  }
}
