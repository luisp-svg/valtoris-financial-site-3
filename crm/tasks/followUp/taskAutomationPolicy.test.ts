import { describe, expect, it } from 'vitest'
import {
  computeTaskDueDateIso,
  decidePublicFamilyTaskAutomation,
  planPublicFamilyTask,
} from './taskAutomationPolicy'
import {
  generatePublicFamilyTaskLanguage,
  taskLanguageImpliesUnauthorizedOutreach,
} from './taskLanguage'
import { PROPOSED_MIGRATION_022_REQUIRED } from './proposedMigration022'
import { buildPublicFamilyTaskIdempotencyKey } from './workflowTypes'

describe('Phase 6 migration gate', () => {
  it('marks migration 022 as present (no longer a schema gate)', () => {
    expect(PROPOSED_MIGRATION_022_REQUIRED).toBe(false)
  })
})

describe('consent-aware task language', () => {
  it('uses follow-up wording when contact permission is true', () => {
    const language = generatePublicFamilyTaskLanguage({
      matchStatus: 'new_prospect',
      consent: {
        contactPermission: true,
        emailMarketingConsent: false,
        smsMarketingConsent: false,
      },
      workflowType: 'review_initial_diagnostic',
    })
    expect(language.title).toBe('Review Initial Financial Diagnostic and follow up')
    expect(language.description).toMatch(/Contact permission was granted/i)
    expect(language.description).toMatch(/Email marketing consent was not granted/i)
    expect(language.description).toMatch(/SMS marketing consent was not granted/i)
    expect(taskLanguageImpliesUnauthorizedOutreach(language, { contactPermission: true })).toBe(
      false,
    )
  })

  it('prohibits inferred outreach when contact permission is false', () => {
    const language = generatePublicFamilyTaskLanguage({
      matchStatus: 'new_prospect',
      consent: { contactPermission: false, smsMarketingConsent: false },
      workflowType: 'review_initial_diagnostic',
    })
    expect(language.title).toMatch(/no contact permission/i)
    expect(language.description).toMatch(/do not initiate outreach/i)
    expect(language.description).not.toMatch(/call the prospect|text the client|sms approved/i)
    expect(
      taskLanguageImpliesUnauthorizedOutreach(language, { contactPermission: false }),
    ).toBe(false)
  })

  it('asks to verify permission when contact permission is missing', () => {
    const language = generatePublicFamilyTaskLanguage({
      matchStatus: 'exact_trusted_match',
      consent: {},
      workflowType: 'review_initial_diagnostic',
    })
    expect(language.title).toMatch(/verify contact permission/i)
    expect(language.description).toMatch(/could not be determined/i)
  })

  it('does not treat storage acknowledgment as contact approval', () => {
    const language = generatePublicFamilyTaskLanguage({
      matchStatus: 'new_prospect',
      consent: {
        contactPermission: false,
        assessmentStorageAcknowledged: true,
        emailMarketingConsent: false,
        smsMarketingConsent: false,
      },
      workflowType: 'review_initial_diagnostic',
    })
    expect(language.description).toMatch(/Contact permission was not granted/i)
    expect(language.description).not.toMatch(/email approved|sms approved|contact approved/i)
  })

  it('separates email/SMS marketing claims from general contact permission', () => {
    const language = generatePublicFamilyTaskLanguage({
      matchStatus: 'new_prospect',
      consent: {
        contactPermission: true,
        emailMarketingConsent: true,
        smsMarketingConsent: false,
      },
      workflowType: 'review_initial_diagnostic',
    })
    expect(language.description).toMatch(/Email marketing consent was granted/i)
    expect(language.description).toMatch(/SMS marketing consent was not granted/i)
    expect(language.description).not.toMatch(/sms approved/i)
  })

  it('uses owner duplicate-resolution wording for possible matches', () => {
    const language = generatePublicFamilyTaskLanguage({
      matchStatus: 'possible_match',
      consent: { contactPermission: true },
      workflowType: 'resolve_possible_duplicate',
    })
    expect(language.title).toMatch(/possible duplicate/i)
    expect(language.description).toMatch(/Do not initiate outreach before identity review/i)
  })
})

describe('automation policy', () => {
  it('creates duplicate-review task only for pending possible matches', () => {
    const decision = decidePublicFamilyTaskAutomation({
      matchStatus: 'possible_match',
      consent: { contactPermission: true },
      assignedAdvisorUserId: 'user-advisor',
      resolutionAction: null,
    })
    expect(decision.shouldCreate).toBe(true)
    if (decision.shouldCreate) {
      expect(decision.workflowType).toBe('resolve_possible_duplicate')
      expect(decision.priority).toBe('high')
      expect(decision.dueInDays).toBe(1)
      expect(decision.assignToUserId).toBeNull()
    }
  })

  it('creates review_initial_diagnostic for new prospects and reuses assignment', () => {
    const decision = decidePublicFamilyTaskAutomation({
      matchStatus: 'new_prospect',
      consent: { contactPermission: true },
      assignedAdvisorUserId: 'user-advisor',
    })
    expect(decision.shouldCreate).toBe(true)
    if (decision.shouldCreate) {
      expect(decision.workflowType).toBe('review_initial_diagnostic')
      expect(decision.assignToUserId).toBe('user-advisor')
      expect(decision.dueInDays).toBe(1)
      expect(decision.priority).toBe('high')
    }
  })

  it('creates review-only task with longer due window when contact denied', () => {
    const decision = decidePublicFamilyTaskAutomation({
      matchStatus: 'exact_trusted_match',
      consent: { contactPermission: false },
      assignedAdvisorUserId: null,
    })
    expect(decision.shouldCreate).toBe(true)
    if (decision.shouldCreate) {
      expect(decision.workflowType).toBe('review_initial_diagnostic')
      expect(decision.dueInDays).toBe(3)
      expect(decision.priority).toBe('medium')
      expect(decision.assignToUserId).toBeNull()
    }
  })

  it('does not create automatic tasks for merged or soft-deleted households', () => {
    expect(
      decidePublicFamilyTaskAutomation({
        matchStatus: 'new_prospect',
        consent: { contactPermission: true },
        assignedAdvisorUserId: null,
        householdMergedIntoId: 'hh-canonical',
      }).shouldCreate,
    ).toBe(false)
    expect(
      decidePublicFamilyTaskAutomation({
        matchStatus: 'new_prospect',
        consent: { contactPermission: true },
        assignedAdvisorUserId: null,
        householdDeletedAt: '2026-07-28T00:00:00.000Z',
      }).shouldCreate,
    ).toBe(false)
  })

  it('plans idempotent keys per assessment + workflow', () => {
    const planned = planPublicFamilyTask({
      assessmentId: 'assess-1',
      automation: {
        matchStatus: 'new_prospect',
        consent: { contactPermission: true },
        assignedAdvisorUserId: null,
      },
    })
    expect(planned?.idempotencyKey).toBe(
      buildPublicFamilyTaskIdempotencyKey('assess-1', 'review_initial_diagnostic'),
    )
    expect(planned?.language.title).toMatch(/follow up/i)
  })

  it('computes simple calendar-day due dates', () => {
    expect(computeTaskDueDateIso('2026-07-28T15:00:00.000Z', 1)).toBe('2026-07-29')
    expect(computeTaskDueDateIso('2026-07-28T15:00:00.000Z', 3)).toBe('2026-07-31')
  })
})
