import { describe, expect, it } from 'vitest'
import {
  CREDIT_REPAIR_VERTICAL_ID,
  STUDENT_LOANS_VERTICAL_ID,
} from '../security/migration047Contract'
import { parseConsentSnapshot } from './intakeFormatters'
import {
  buildIntakeOpportunityPrefill,
  suggestIntakeOpportunityVertical,
  suggestedIntakeOpportunityTitle,
} from './intakeOpportunityPrefill'
import {
  canPresentIntakeCreateOpportunityAction,
  INTAKE_CREATE_OPPORTUNITY_ACTION_LABEL,
  INTAKE_CREATE_OPPORTUNITY_SUCCESS_COPY,
  intakeCreateOpportunityVisibilityForItem,
} from './intakeOpportunityUi'
import type { IntakeQueueItem } from './types'
import { INTAKE_WORKFLOW_DUPLICATE_BLOCK_COPY } from './intakeAssignmentUi'

function makeItem(overrides: Partial<IntakeQueueItem> = {}): IntakeQueueItem {
  return {
    leadId: 'lead-1',
    householdId: 'hh-1',
    leadType: 'Family Report Card',
    leadStatus: 'unassigned',
    ingestMatchStatus: 'new_prospect',
    duplicateReviewStatus: 'none',
    submittedAt: '2026-07-28T18:00:00.000Z',
    sourcePage: '/family-assessment',
    overallScore: 72,
    overallGrade: 'C',
    submittedFirstName: 'Jamie',
    submittedLastName: 'Rivera',
    submittedFullName: 'Jamie Rivera',
    submittedEmail: 'jamie@example.com',
    submittedPhone: '555-111-2222',
    normalizedEmail: 'jamie@example.com',
    normalizedPhone: '+15551112222',
    sheetsSyncStatus: 'succeeded',
    consent: parseConsentSnapshot({
      assessmentStorageAcknowledged: true,
      contactPermission: true,
      emailMarketingConsent: false,
      smsMarketingConsent: false,
      privacyAcknowledged: true,
      consentVersion: 'family-report-card-consent-v1',
      consentedAt: '2026-07-28T18:00:00.000Z',
    }),
    household: {
      id: 'hh-1',
      displayName: 'Jamie Rivera',
      status: 'lead',
      primaryEmail: 'jamie@example.com',
      primaryPhone: '555-111-2222',
      assignedAdvisor: { id: 'adv-1', displayName: 'Advisor A' },
      duplicateReviewStatus: 'none',
      mergedIntoHouseholdId: null,
      deletedAt: null,
    },
    assignedAdvisor: { id: 'adv-1', displayName: 'Advisor A' },
    diagnostic: {
      assessmentId: 'assess-1',
      overallScore: 72,
      overallGrade: 'C',
      categories: [],
      topPriorities: [],
      captureChannel: 'public_self_report',
      scoringVersion: 1,
      completedAt: '2026-07-28T18:00:00.000Z',
      productLabel: 'Initial Financial Diagnostic',
      assessmentType: 'family',
      protectionGapFormatted: null,
      netProtectionGap: null,
      totalNeed: null,
      currentProtection: null,
    },
    digitalIdentity: null,
    duplicateReview: null,
    originalCampaign: null,
    originalAdvisorSlug: null,
    sourceMetadata: {},
    followUpTaskAutomationStatus: null,
    followUpTask: null,
    taskIndicators: [],
    taskCreationIssueMessage: null,
    assessmentDetail: null,
    ...overrides,
  }
}

describe('intake create opportunity visibility', () => {
  it('allows owner and assigned household advisor, not unassigned-pool', () => {
    expect(INTAKE_CREATE_OPPORTUNITY_ACTION_LABEL).toBe('Create Opportunity')
    expect(
      canPresentIntakeCreateOpportunityAction({
        isOwner: true,
        currentAdvisorProfileId: null,
        householdId: 'hh-1',
        householdAssignedAdvisorId: null,
      }),
    ).toBe(true)
    expect(
      canPresentIntakeCreateOpportunityAction({
        isOwner: false,
        currentAdvisorProfileId: 'adv-1',
        householdId: 'hh-1',
        householdAssignedAdvisorId: 'adv-1',
      }),
    ).toBe(true)
    expect(
      canPresentIntakeCreateOpportunityAction({
        isOwner: false,
        currentAdvisorProfileId: 'adv-pool',
        householdId: 'hh-1',
        householdAssignedAdvisorId: null,
      }),
    ).toBe(false)
    expect(
      canPresentIntakeCreateOpportunityAction({
        isOwner: false,
        currentAdvisorProfileId: 'adv-1',
        householdId: 'hh-1',
        householdAssignedAdvisorId: 'adv-other',
      }),
    ).toBe(false)
    expect(
      canPresentIntakeCreateOpportunityAction({
        isOwner: false,
        currentAdvisorProfileId: 'adv-1',
        householdId: null,
        householdAssignedAdvisorId: 'adv-1',
      }),
    ).toBe(false)
  })

  it('blocks create when duplicate review is pending', () => {
    expect(
      intakeCreateOpportunityVisibilityForItem(makeItem({ leadStatus: 'duplicate_review' }), {
        isOwner: true,
        currentAdvisorProfileId: null,
      }),
    ).toEqual({ canPresent: true, blockedByDuplicate: true })
    expect(INTAKE_WORKFLOW_DUPLICATE_BLOCK_COPY).toMatch(/creating an Opportunity/i)
    expect(INTAKE_CREATE_OPPORTUNITY_SUCCESS_COPY).toBe(
      'Opportunity created and added to Pipeline.',
    )
  })
})

describe('intake opportunity prefill mapping', () => {
  it('suggests student_loans for Student Loan Report Card', () => {
    const item = makeItem({ leadType: 'Student Loan Report Card' })
    expect(suggestIntakeOpportunityVertical(item.leadType)).toEqual({
      serviceVerticalId: STUDENT_LOANS_VERTICAL_ID,
      titlePrefix: 'Student Loans',
    })
    expect(suggestedIntakeOpportunityTitle(item)).toBe('Student Loans — Jamie Rivera')
    expect(buildIntakeOpportunityPrefill(item).serviceVerticalId).toBe(STUDENT_LOANS_VERTICAL_ID)
    expect(buildIntakeOpportunityPrefill(item).includeSourceLeadId).toBe(false)
  })

  it('suggests credit_repair sales vertical for Credit Report Card', () => {
    const item = makeItem({ leadType: 'Credit Report Card' })
    expect(suggestIntakeOpportunityVertical(item.leadType)).toEqual({
      serviceVerticalId: CREDIT_REPAIR_VERTICAL_ID,
      titlePrefix: 'Credit Repair',
    })
    expect(suggestedIntakeOpportunityTitle(item)).toBe('Credit Repair — Jamie Rivera')
    expect(buildIntakeOpportunityPrefill(item).serviceVerticalId).toBe(CREDIT_REPAIR_VERTICAL_ID)
  })

  it('does not force a vertical for generic Intake lead types', () => {
    for (const leadType of [
      'Family Report Card',
      'Business Report Card',
      'Retirement Report Card',
      'Protection Gap',
      'Digital Identity',
    ]) {
      expect(suggestIntakeOpportunityVertical(leadType)).toBeNull()
      const prefill = buildIntakeOpportunityPrefill(makeItem({ leadType }))
      expect(prefill.serviceVerticalId).toBeNull()
      expect(prefill.title).toContain('Jamie Rivera')
      expect(prefill.includeSourceLeadId).toBe(false)
    }
  })

  it('locks household and reuses current household assignment when present', () => {
    const prefill = buildIntakeOpportunityPrefill(makeItem())
    expect(prefill.householdId).toBe('hh-1')
    expect(prefill.householdLabel).toBe('Jamie Rivera')
    expect(prefill.assignedAdvisorId).toBe('adv-1')
  })
})
