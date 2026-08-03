/**
 * Example Case draft builders for IFD and Household Onboarding.
 *
 * Metadata / shape examples only:
 * - do NOT persist
 * - do NOT create activities, tasks, or cases in the database
 * - do NOT alter IFD / onboarding runtime behavior
 * - public IFD remains separate from Financial Progress
 * - onboarding remains an assessment lifecycle (not auto-converted to a Case)
 */

import { createCaseDraft } from './selectors'
import type { PlatformCase } from './types'

export type IfdCaseExampleInput = {
  householdId: string
  leadId?: string | null
  assessmentId?: string | null
  captureChannel?: string
  id?: string
  openedAt?: string
}

/**
 * Example: shape an Initial Financial Diagnostic review Case from known ids.
 * Does not read or write the database.
 */
export function buildIfdCaseExample(input: IfdCaseExampleInput): PlatformCase {
  return createCaseDraft({
    id: input.id,
    caseType: 'diagnostic_review_case',
    householdId: input.householdId,
    leadId: input.leadId ?? null,
    assessmentId: input.assessmentId ?? null,
    title: 'Initial Financial Diagnostic review',
    status: 'intake',
    stage: 'needs_review',
    priority: 'high',
    openedAt: input.openedAt,
    metadata: {
      source: 'public_family_report_card',
      captureChannel: input.captureChannel ?? 'public_self_report',
      assessmentType: 'family',
      idempotencyKey: input.assessmentId
        ? `diagnostic_review_case:${input.assessmentId}`
        : undefined,
      workflowHint: 'review_initial_diagnostic',
    },
  })
}

export type OnboardingCaseExampleInput = {
  householdId: string
  assessmentId?: string | null
  id?: string
  openedAt?: string
  status?: 'draft' | 'active' | 'completed'
}

/**
 * Example: shape a Household Onboarding Case from known ids.
 * Does not read or write the database.
 */
export function buildOnboardingCaseExample(input: OnboardingCaseExampleInput): PlatformCase {
  const status = input.status ?? 'draft'
  return createCaseDraft({
    id: input.id,
    caseType: 'household_onboarding_case',
    householdId: input.householdId,
    assessmentId: input.assessmentId ?? null,
    title: 'Household Onboarding',
    status,
    stage: status === 'completed' ? 'completed' : 'in_progress',
    priority: 'medium',
    openedAt: input.openedAt,
    metadata: {
      source: 'advisor_onboarding',
      assessmentType: 'household_onboarding',
      idempotencyKey: input.assessmentId
        ? `household_onboarding_case:${input.assessmentId}`
        : undefined,
      workflowHint: 'household_onboarding',
    },
  })
}
