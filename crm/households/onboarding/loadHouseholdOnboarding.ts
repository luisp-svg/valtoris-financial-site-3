import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createHouseholdOnboardingDraft,
  fetchLatestCompletedHouseholdOnboarding,
  fetchLatestHouseholdOnboardingDraft,
  formatOnboardingError,
} from '../onboardingApi'
import { fetchHouseholdById } from '../householdsApi'
import type { CrmHouseholdDetail, HouseholdOnboardingAssessment } from '../types'
import { normalizeOnboardingAnswers } from './onboardingSchema'
import type { HouseholdOnboardingAnswers } from './onboardingFormTypes'

export type OnboardingSessionMode = 'draft' | 'completed'

export type LoadHouseholdOnboardingResult =
  | {
      ok: true
      household: CrmHouseholdDetail
      assessment: HouseholdOnboardingAssessment
      answers: HouseholdOnboardingAnswers
      mode: OnboardingSessionMode
    }
  | {
      ok: false
      reason: 'not_found' | 'load_error'
      message: string
    }

/** In-flight load dedupe (React Strict Mode / concurrent mounts). */
const inFlightLoads = new Map<string, Promise<LoadHouseholdOnboardingResult>>()

async function loadHouseholdOnboardingSessionOnce(
  supabase: SupabaseClient,
  householdId: string,
): Promise<LoadHouseholdOnboardingResult> {
  try {
    const household = await fetchHouseholdById(supabase, householdId)
    if (!household) {
      return {
        ok: false,
        reason: 'not_found',
        message:
          'This household is unavailable or you do not have access. Return to the households list to continue.',
      }
    }

    const completed = await fetchLatestCompletedHouseholdOnboarding(supabase, household.id)
    if (completed) {
      return {
        ok: true,
        household,
        assessment: completed,
        answers: normalizeOnboardingAnswers(completed.answers),
        mode: 'completed',
      }
    }

    // Prefer explicit draft fetch before create so tests/callers can observe resume
    // without insert. createHouseholdOnboardingDraft still get-or-creates safely.
    const existingDraft = await fetchLatestHouseholdOnboardingDraft(supabase, household.id)
    const assessment =
      existingDraft ??
      (await createHouseholdOnboardingDraft(supabase, { household_id: household.id }))

    return {
      ok: true,
      household,
      assessment,
      answers: normalizeOnboardingAnswers(assessment.answers),
      mode: 'draft',
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'load_error',
      message: formatOnboardingError('load_onboarding', error),
    }
  }
}

/**
 * Load onboarding session for an accessible household.
 *
 * Order:
 * 1. Household (RLS-scoped) — missing → not_found
 * 2. Latest completed onboarding — if present, read-only (no draft create)
 * 3. Otherwise get-or-create active draft
 *
 * Concurrent calls for the same household share one in-flight promise to avoid
 * duplicate draft inserts under React Strict Mode.
 */
export async function loadHouseholdOnboardingSession(
  supabase: SupabaseClient,
  householdId: string,
): Promise<LoadHouseholdOnboardingResult> {
  const existing = inFlightLoads.get(householdId)
  if (existing) return existing

  const promise = loadHouseholdOnboardingSessionOnce(supabase, householdId).finally(() => {
    inFlightLoads.delete(householdId)
  })
  inFlightLoads.set(householdId, promise)
  return promise
}

/** Lightweight status for workspace entry CTA labels. */
export type OnboardingEntryStatus =
  | { kind: 'none' }
  | { kind: 'draft' }
  | { kind: 'completed' }
  | { kind: 'error'; message: string }

export async function fetchOnboardingEntryStatus(
  supabase: SupabaseClient,
  householdId: string,
): Promise<OnboardingEntryStatus> {
  try {
    const draft = await fetchLatestHouseholdOnboardingDraft(supabase, householdId)
    if (draft) return { kind: 'draft' }
    const completed = await fetchLatestCompletedHouseholdOnboarding(supabase, householdId)
    if (completed) return { kind: 'completed' }
    return { kind: 'none' }
  } catch (error) {
    return { kind: 'error', message: formatOnboardingError('onboarding_entry_status', error) }
  }
}

export function onboardingEntryLabel(status: OnboardingEntryStatus): string {
  switch (status.kind) {
    case 'draft':
      return 'Resume Household Onboarding'
    case 'completed':
      return 'View Household Onboarding'
    case 'none':
    case 'error':
    default:
      return 'Start Household Onboarding'
  }
}
