import { describe, expect, it } from 'vitest'
import {
  buildDiagnosticFromAssessmentRow,
  buildIntakeCounts,
  extractDigitalIdentitySnapshot,
  extractSubmittedIdentity,
  intakeProductLabel,
  isDigitalIdentityLead,
  isNeedsReview,
  mapMatchReasonLabel,
  mapMatchStatusLabel,
  mapSheetsSyncLabel,
  matchesIntakeFilter,
  parseConsentSnapshot,
  resolveIntakeSubmittedContact,
  sortIntakeNewestFirst,
} from './intakeFormatters'
import { DIGITAL_IDENTITY_LEAD_TYPE } from '../../modules/digital-identity'
import type { IntakeQueueItem } from './types'
import { getDuplicateResolutionAvailability } from './intakeApi'
import { emptyStateCopy, getIntakeListViewState } from './listLoadState'
import { DUPLICATE_RESOLUTION_REQUIRES_MIGRATION_021 } from './types'

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
      contactPermission: false,
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
      assignedAdvisor: null,
      duplicateReviewStatus: 'none',
      mergedIntoHouseholdId: null,
      deletedAt: null,
    },
    assignedAdvisor: null,
    diagnostic: {
      assessmentId: 'assess-1',
      overallScore: 72,
      overallGrade: 'C',
      categories: [],
      topPriorities: ['Build emergency savings'],
      captureChannel: 'public_self_report',
      scoringVersion: 1,
      completedAt: '2026-07-28T18:00:00.000Z',
      productLabel: 'Initial Financial Diagnostic',
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
    ...overrides,
  }
}

describe('intake formatters', () => {
  it('maps sheets and match labels safely', () => {
    expect(mapSheetsSyncLabel('failed')).toBe('Sync issue')
    expect(mapSheetsSyncLabel('succeeded')).toBe('Synced')
    expect(mapMatchStatusLabel('exact_trusted_match')).toBe('Matched to existing household')
    expect(mapMatchReasonLabel('email_only_match')).toBe('Email matched')
  })

  it('parses consent without collapsing into a single flag', () => {
    const consent = parseConsentSnapshot({
      assessmentStorageAcknowledged: true,
      contactPermission: false,
      emailMarketingConsent: true,
      smsMarketingConsent: false,
      privacyAcknowledged: true,
    })
    expect(consent.assessmentStorageAcknowledged).toBe(true)
    expect(consent.contactPermission).toBe(false)
    expect(consent.emailMarketingConsent).toBe(true)
    expect(consent.smsMarketingConsent).toBe(false)
  })

  it('sorts newest first and filters match classes', () => {
    const items = [
      makeItem({ leadId: 'old', submittedAt: '2026-07-01T00:00:00.000Z' }),
      makeItem({
        leadId: 'dup',
        submittedAt: '2026-07-29T00:00:00.000Z',
        ingestMatchStatus: 'possible_match',
        duplicateReviewStatus: 'pending',
      }),
      makeItem({
        leadId: 'exact',
        submittedAt: '2026-07-28T00:00:00.000Z',
        ingestMatchStatus: 'exact_trusted_match',
      }),
    ]
    expect(sortIntakeNewestFirst(items).map((item) => item.leadId)).toEqual([
      'dup',
      'exact',
      'old',
    ])
    expect(matchesIntakeFilter(items[1], 'needs_review', null)).toBe(true)
    expect(matchesIntakeFilter(items[2], 'exact_matches', null)).toBe(true)
    expect(isNeedsReview(items[1])).toBe(true)
  })

  it('builds diagnostic summaries as Initial Financial Diagnostic', () => {
    const diagnostic = buildDiagnosticFromAssessmentRow(
      {
        id: 'assess-1',
        overall_score: 80,
        overall_grade: 'B-',
        capture_channel: 'public_self_report',
        scoring_version: 1,
        completed_at: '2026-07-28T18:00:00.000Z',
        priorities: [{ title: 'Protect income' }],
        derived_metrics: {
          categories: [{ id: 'debt', title: 'Debt', score: 70, grade: 'C-' }],
        },
      },
      null,
      null,
      [],
    )
    expect(diagnostic?.productLabel).toBe('Initial Financial Diagnostic')
    expect(diagnostic?.captureChannel).toBe('public_self_report')
    expect(diagnostic?.topPriorities).toEqual(['Protect income'])
    expect(diagnostic?.categories[0]?.title).toBe('Debt')
  })

  it('extracts submitted identity from raw payload snapshots', () => {
    expect(
      extractSubmittedIdentity({
        firstName: 'Jamie',
        lastName: 'Rivera',
        email: 'jamie@example.com',
        phone: '555-111-2222',
      }),
    ).toMatchObject({
      fullName: 'Jamie Rivera',
      email: 'jamie@example.com',
    })
  })

  it('counts filter buckets', () => {
    const counts = buildIntakeCounts(
      [
        makeItem({ ingestMatchStatus: 'new_prospect', sheetsSyncStatus: 'failed' }),
        makeItem({
          leadId: '2',
          ingestMatchStatus: 'possible_match',
          duplicateReviewStatus: 'pending',
        }),
      ],
      null,
    )
    expect(counts.all).toBe(2)
    expect(counts.sheets_failed).toBe(1)
    expect(counts.possible_duplicates).toBe(1)
    expect(counts.new_prospects).toBe(1)
  })

  it('supports unassigned, assigned-to-me, and resolved filters', () => {
    const unassigned = makeItem({ leadId: 'u', assignedAdvisor: null })
    const mine = makeItem({
      leadId: 'm',
      assignedAdvisor: { id: 'adv-me', displayName: 'Me' },
      ingestMatchStatus: 'exact_trusted_match',
    })
    const resolved = makeItem({
      leadId: 'r',
      ingestMatchStatus: 'possible_match',
      duplicateReviewStatus: 'confirmed_unique',
      duplicateReview: {
        id: 'dup-r',
        status: 'confirmed_unique',
        matchReason: 'email_only_match',
        matchConfidence: 'medium',
        candidateHouseholdId: 'hh-c',
        provisionalHouseholdId: 'hh-1',
        resolutionNotes: null,
        resolvedAt: '2026-07-28T19:00:00.000Z',
        resolvedByUserId: 'user-1',
      },
    })

    expect(matchesIntakeFilter(unassigned, 'unassigned', 'adv-me')).toBe(true)
    expect(matchesIntakeFilter(mine, 'assigned_to_me', 'adv-me')).toBe(true)
    expect(matchesIntakeFilter(mine, 'assigned_to_me', 'adv-other')).toBe(false)
    expect(matchesIntakeFilter(resolved, 'resolved', null)).toBe(true)
    expect(matchesIntakeFilter(resolved, 'needs_review', null)).toBe(false)
  })

  it('never labels diagnostics as Financial Progress', () => {
    const item = makeItem()
    expect(item.diagnostic?.productLabel).toBe('Initial Financial Diagnostic')
    expect(item.diagnostic?.productLabel).not.toMatch(/Financial Progress/i)
    expect(mapSheetsSyncLabel('failed')).not.toMatch(/Apps Script|Error:/i)
  })

  it('labels Digital Identity leads separately from Initial Financial Diagnostic', () => {
    const di = makeItem({
      leadType: DIGITAL_IDENTITY_LEAD_TYPE,
      diagnostic: null,
      digitalIdentity: {
        company: 'Acme',
        title: 'Owner',
        reason: 'Networking',
        note: null,
        preferredFollowUp: 'email',
        cardPublicKey: 'pk_live_abcdefghijklmnop',
        cardSlug: 'jane-advisor',
        advisorSlug: 'jane-advisor',
        campaignCode: 'summit',
        eventCode: 'booth-a',
        productLabel: 'Digital Identity',
      },
      originalAdvisorSlug: 'jane-advisor',
      originalCampaign: 'summit',
    })
    expect(isDigitalIdentityLead(di)).toBe(true)
    expect(intakeProductLabel(di)).toBe('Digital Identity')
    expect(intakeProductLabel(makeItem())).toBe('Initial Financial Diagnostic')
  })

  it('extracts Digital Identity snapshot from metadata without inventing assessment data', () => {
    const snapshot = extractDigitalIdentitySnapshot({
      leadType: DIGITAL_IDENTITY_LEAD_TYPE,
      rawPayload: {
        company: 'Acme',
        reason: 'Networking',
        preferredFollowUp: 'email',
        cardPublicKey: 'pk_live_abcdefghijklmnop',
      },
      sourceMetadata: { eventCode: 'booth-a' },
      originalCampaign: 'summit',
      originalAdvisorSlug: 'jane-advisor',
    })
    expect(snapshot).toMatchObject({
      productLabel: 'Digital Identity',
      company: 'Acme',
      reason: 'Networking',
      campaignCode: 'summit',
      advisorSlug: 'jane-advisor',
      cardPublicKey: 'pk_live_abcdefghijklmnop',
      eventCode: 'booth-a',
    })
    expect(extractDigitalIdentitySnapshot({
      leadType: 'Family Report Card',
      rawPayload: {},
      sourceMetadata: {},
      originalCampaign: null,
      originalAdvisorSlug: null,
    })).toBeNull()
  })

  it('resolves Digital Identity contact from household and normalized fields', () => {
    const contact = resolveIntakeSubmittedContact({
      rawPayload: { company: 'Acme', reason: 'Networking' },
      leadType: DIGITAL_IDENTITY_LEAD_TYPE,
      householdDisplayName: 'Jamie Rivera',
      householdEmail: 'jamie@example.com',
      householdPhone: '555-111-2222',
      normalizedEmail: 'jamie@example.com',
      normalizedPhone: '+15551112222',
    })
    expect(contact.fullName).toBe('Jamie Rivera')
    expect(contact.email).toBe('jamie@example.com')
    expect(contact.phone).toBe('+15551112222')
  })
})

describe('intake list load state', () => {
  it('never reports empty when an error is present', () => {
    expect(
      getIntakeListViewState({
        loading: false,
        error: 'Unable to load',
        totalCount: 0,
        filteredCount: 0,
      }).kind,
    ).toBe('error')
  })

  it('provides empty-state copy for sheets failures and duplicates', () => {
    expect(emptyStateCopy('sheets_failed').title).toMatch(/Sheets sync/i)
    expect(emptyStateCopy('possible_duplicates').body).toMatch(/duplicate review/i)
  })
})

describe('duplicate resolution availability', () => {
  it('enables owner resolution after migration 021', () => {
    expect(DUPLICATE_RESOLUTION_REQUIRES_MIGRATION_021).toBe(false)
    expect(getDuplicateResolutionAvailability('owner').canResolveWrites).toBe(true)
    expect(getDuplicateResolutionAvailability('advisor').canResolveWrites).toBe(false)
  })
})
