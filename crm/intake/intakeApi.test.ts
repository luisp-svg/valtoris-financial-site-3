import { describe, expect, it, vi } from 'vitest'
import {
  fetchIntakeQueue,
  fetchIntakeQueueSafe,
  formatIntakeError,
  getDuplicateResolutionAvailability,
} from './intakeApi'
import { DIGITAL_IDENTITY_LEAD_TYPE } from '../../modules/digital-identity'
import type { SupabaseClient } from '@supabase/supabase-js'

function createQuery(result: { data: unknown; error: null | object }) {
  const query: Record<string, unknown> = {}
  const self = new Proxy(query, {
    get(target, prop) {
      if (prop === 'then') {
        return (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
      }
      if (!(prop in target)) {
        target[prop as string] = vi.fn(() => self)
      }
      return target[prop as string]
    },
  })
  return self
}

describe('fetchIntakeQueue', () => {
  it('maps newest public Family leads and excludes onboarding by query shape', async () => {
    const leadRow = {
      id: 'lead-1',
      household_id: 'hh-1',
      lead_type: 'Family Report Card',
      status: 'unassigned',
      source_page: '/family-assessment',
      submitted_at: '2026-07-28T20:00:00.000Z',
      overall_score: 72,
      overall_grade: 'C',
      top_priorities: [{ title: 'Build emergency savings' }],
      raw_payload: {
        firstName: 'Jamie',
        lastName: 'Rivera',
        email: 'jamie@example.com',
        phone: '555-111-2222',
      },
      normalized_email: 'jamie@example.com',
      normalized_phone: '+15551112222',
      duplicate_review_status: 'none',
      ingest_match_status: 'new_prospect',
      sheets_sync_status: 'succeeded',
      consent_snapshot: {
        assessmentStorageAcknowledged: true,
        contactPermission: false,
        emailMarketingConsent: false,
        smsMarketingConsent: false,
        privacyAcknowledged: true,
        consentVersion: 'family-report-card-consent-v1',
        consentedAt: '2026-07-28T20:00:00.000Z',
      },
      original_campaign: null,
      original_advisor_slug: null,
      original_source_metadata: { utmSource: 'newsletter' },
      assigned_advisor_id: null,
      follow_up_task_automation_status: null,
      follow_up_task_id: null,
      deleted_at: null,
      household: {
        id: 'hh-1',
        display_name: 'Jamie Rivera',
        status: 'lead',
        primary_email: 'jamie@example.com',
        primary_phone: '555-111-2222',
        assigned_advisor_id: null,
        duplicate_review_status: 'none',
        merged_into_household_id: null,
        deleted_at: null,
        assigned_advisor: null,
      },
      assigned_advisor: null,
    }

    const assessmentRow = {
      id: 'assess-1',
      lead_id: 'lead-1',
      household_id: 'hh-1',
      assessment_type: 'family',
      status: 'completed',
      overall_score: 72,
      overall_grade: 'C',
      priorities: [{ title: 'Build emergency savings' }],
      derived_metrics: { categories: [{ id: 'debt', title: 'Debt', score: 55, grade: 'F' }] },
      capture_channel: 'public_self_report',
      scoring_version: 1,
      completed_at: '2026-07-28T20:00:00.000Z',
      deleted_at: null,
    }

    const from = vi.fn((table: string) => {
      if (table === 'leads') return createQuery({ data: [leadRow], error: null })
      if (table === 'assessments') return createQuery({ data: [assessmentRow], error: null })
      if (table === 'duplicate_reviews') return createQuery({ data: [], error: null })
      return createQuery({ data: [], error: null })
    })

    const items = await fetchIntakeQueue({ from } as unknown as SupabaseClient)
    expect(items).toHaveLength(1)
    expect(items[0].diagnostic?.productLabel).toBe('Initial Financial Diagnostic')
    expect(items[0].diagnostic?.captureChannel).toBe('public_self_report')
    expect(items[0].digitalIdentity).toBeNull()
    expect(items[0].consent.contactPermission).toBe(false)
    expect(items[0].sheetsSyncStatus).toBe('succeeded')
    expect(items[0].ingestMatchStatus).toBe('new_prospect')
    expect(from).toHaveBeenCalledWith('leads')
    expect(from).toHaveBeenCalledWith('assessments')
    const leadsQuery = from.mock.results[0]?.value as { is?: ReturnType<typeof vi.fn> }
    expect(leadsQuery.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('maps Digital Identity Let’s Connect leads without inventing a diagnostic', async () => {
    const leadRow = {
      id: 'lead-di',
      household_id: 'hh-di',
      lead_type: DIGITAL_IDENTITY_LEAD_TYPE,
      status: 'unassigned',
      source_page: '/c/k/pk_live_abcdefghijklmnop',
      submitted_at: '2026-08-03T20:00:00.000Z',
      overall_score: null,
      overall_grade: null,
      top_priorities: null,
      raw_payload: {
        company: 'Acme',
        reason: 'Networking',
        preferredFollowUp: 'email',
        cardPublicKey: 'pk_live_abcdefghijklmnop',
      },
      normalized_email: 'alex@example.com',
      normalized_phone: '+15550001111',
      duplicate_review_status: 'none',
      ingest_match_status: 'new_prospect',
      sheets_sync_status: 'skipped',
      consent_snapshot: {
        privacyAcknowledged: true,
        contactPermission: true,
        emailMarketingConsent: false,
        smsMarketingConsent: false,
        consentVersion: 'digital-identity-consent-v1',
        consentedAt: '2026-08-03T20:00:00.000Z',
      },
      original_campaign: 'summit',
      original_advisor_slug: 'jane-advisor',
      original_source_metadata: {
        company: 'Acme',
        reason: 'Networking',
        eventCode: 'booth-a',
      },
      assigned_advisor_id: 'adv-1',
      follow_up_task_automation_status: 'task_created',
      follow_up_task_id: 'task-di',
      deleted_at: null,
      household: {
        id: 'hh-di',
        display_name: 'Alex Lee',
        status: 'lead',
        primary_email: 'alex@example.com',
        primary_phone: '555-000-1111',
        assigned_advisor_id: 'adv-1',
        duplicate_review_status: 'none',
        merged_into_household_id: null,
        deleted_at: null,
        assigned_advisor: { id: 'adv-1', display_name: 'Jane Advisor' },
      },
      assigned_advisor: { id: 'adv-1', display_name: 'Jane Advisor' },
    }

    const from = vi.fn((table: string) => {
      if (table === 'leads') return createQuery({ data: [leadRow], error: null })
      if (table === 'assessments') return createQuery({ data: [], error: null })
      if (table === 'duplicate_reviews') return createQuery({ data: [], error: null })
      if (table === 'tasks') {
        return createQuery({
          data: [
            {
              id: 'task-di',
              title: 'Review Digital Identity lead',
              status: 'open',
              priority: 'medium',
              due_date: '2026-08-04',
              assigned_user_id: null,
              workflow_type: 'review_digital_identity_lead',
              source_type: 'digital_identity_ingest',
              lead_id: 'lead-di',
              assessment_id: null,
              assignee: null,
            },
          ],
          error: null,
        })
      }
      return createQuery({ data: [], error: null })
    })

    const items = await fetchIntakeQueue({ from } as unknown as SupabaseClient)
    expect(items).toHaveLength(1)
    expect(items[0].leadType).toBe(DIGITAL_IDENTITY_LEAD_TYPE)
    expect(items[0].diagnostic).toBeNull()
    expect(items[0].digitalIdentity?.productLabel).toBe('Digital Identity')
    expect(items[0].digitalIdentity?.reason).toBe('Networking')
    expect(items[0].digitalIdentity?.advisorSlug).toBe('jane-advisor')
    expect(items[0].digitalIdentity?.campaignCode).toBe('summit')
    expect(items[0].submittedFullName).toBe('Alex Lee')
    expect(items[0].submittedEmail).toBe('alex@example.com')
    expect(items[0].followUpTask?.workflowType).toBe('review_digital_identity_lead')
  })

  it('treats advisor duplicate_reviews permission failures as empty, not fatal', async () => {
    const leadRow = {
      id: 'lead-2',
      household_id: 'hh-2',
      lead_type: 'Family Report Card',
      status: 'duplicate_review',
      source_page: '/family-assessment',
      submitted_at: '2026-07-28T21:00:00.000Z',
      overall_score: 60,
      overall_grade: 'D',
      top_priorities: [],
      raw_payload: { firstName: 'Alex', lastName: 'Lee', email: 'alex@example.com', phone: '555' },
      normalized_email: 'alex@example.com',
      normalized_phone: null,
      duplicate_review_status: 'pending',
      ingest_match_status: 'possible_match',
      sheets_sync_status: 'pending',
      consent_snapshot: {},
      original_campaign: null,
      original_advisor_slug: null,
      original_source_metadata: {},
      assigned_advisor_id: null,
      follow_up_task_automation_status: null,
      follow_up_task_id: null,
      deleted_at: null,
      household: {
        id: 'hh-2',
        display_name: 'Alex Lee',
        status: 'lead',
        primary_email: 'alex@example.com',
        primary_phone: null,
        assigned_advisor_id: null,
        duplicate_review_status: 'pending',
        merged_into_household_id: null,
        deleted_at: null,
        assigned_advisor: null,
      },
      assigned_advisor: null,
    }

    const from = vi.fn((table: string) => {
      if (table === 'leads') return createQuery({ data: [leadRow], error: null })
      if (table === 'assessments') return createQuery({ data: [], error: null })
      if (table === 'duplicate_reviews') {
        return createQuery({
          data: null,
          error: { code: '42501', message: 'permission denied for table duplicate_reviews' },
        })
      }
      return createQuery({ data: [], error: null })
    })

    const items = await fetchIntakeQueue({ from } as unknown as SupabaseClient)
    expect(items).toHaveLength(1)
    expect(items[0].duplicateReview).toBeNull()
    expect(items[0].ingestMatchStatus).toBe('possible_match')
  })

  it('maps exact trusted matches and possible-match duplicate review rows', async () => {
    const exactLead = {
      id: 'lead-exact',
      household_id: 'hh-canonical',
      lead_type: 'Family Report Card',
      status: 'new',
      source_page: '/family-assessment',
      submitted_at: '2026-07-28T22:00:00.000Z',
      overall_score: 88,
      overall_grade: 'B+',
      top_priorities: [],
      raw_payload: { firstName: 'Pat', lastName: 'Nguyen', email: 'pat@example.com', phone: '555' },
      normalized_email: 'pat@example.com',
      normalized_phone: '+15550001111',
      duplicate_review_status: 'none',
      ingest_match_status: 'exact_trusted_match',
      sheets_sync_status: 'skipped',
      consent_snapshot: { contactPermission: true },
      original_campaign: null,
      original_advisor_slug: null,
      original_source_metadata: {},
      assigned_advisor_id: 'adv-1',
      follow_up_task_automation_status: 'task_created',
      follow_up_task_id: 'task-exact',
      deleted_at: null,
      household: {
        id: 'hh-canonical',
        display_name: 'Pat Nguyen Household',
        status: 'client',
        primary_email: 'pat@example.com',
        primary_phone: '555',
        assigned_advisor_id: 'adv-1',
        duplicate_review_status: 'none',
        merged_into_household_id: null,
        deleted_at: null,
        assigned_advisor: { id: 'adv-1', display_name: 'Advisor One' },
      },
      assigned_advisor: { id: 'adv-1', display_name: 'Advisor One' },
    }

    const possibleLead = {
      id: 'lead-possible',
      household_id: 'hh-provisional',
      lead_type: 'Family Report Card',
      status: 'duplicate_review',
      source_page: '/family-assessment',
      submitted_at: '2026-07-28T21:30:00.000Z',
      overall_score: 64,
      overall_grade: 'D',
      top_priorities: [],
      raw_payload: { firstName: 'Sam', lastName: 'Ortiz', email: 'sam@example.com', phone: '555-9' },
      normalized_email: 'sam@example.com',
      normalized_phone: null,
      duplicate_review_status: 'pending',
      ingest_match_status: 'possible_match',
      sheets_sync_status: 'failed',
      consent_snapshot: { contactPermission: false },
      original_campaign: null,
      original_advisor_slug: null,
      original_source_metadata: {},
      assigned_advisor_id: null,
      follow_up_task_automation_status: null,
      follow_up_task_id: null,
      deleted_at: null,
      household: {
        id: 'hh-provisional',
        display_name: 'Sam Ortiz',
        status: 'lead',
        primary_email: 'sam@example.com',
        primary_phone: null,
        assigned_advisor_id: null,
        duplicate_review_status: 'pending',
        merged_into_household_id: null,
        deleted_at: null,
        assigned_advisor: null,
      },
      assigned_advisor: null,
    }

    const from = vi.fn((table: string) => {
      if (table === 'leads') return createQuery({ data: [exactLead, possibleLead], error: null })
      if (table === 'assessments') return createQuery({ data: [], error: null })
      if (table === 'duplicate_reviews') {
        return createQuery({
          data: [
            {
              id: 'dup-1',
              incoming_lead_id: 'lead-possible',
              candidate_household_id: 'hh-candidate',
              provisional_household_id: 'hh-provisional',
              match_reason: 'email_only_match',
              match_confidence: 'medium',
              status: 'pending',
              resolution_notes: null,
              resolved_by_user_id: null,
              resolved_at: null,
            },
          ],
          error: null,
        })
      }
      return createQuery({ data: [], error: null })
    })

    const items = await fetchIntakeQueue({ from } as unknown as SupabaseClient)
    expect(items.map((item) => item.leadId)).toEqual(['lead-exact', 'lead-possible'])
    expect(items[0].ingestMatchStatus).toBe('exact_trusted_match')
    expect(items[0].assignedAdvisor?.displayName).toBe('Advisor One')
    expect(items[0].sheetsSyncStatus).toBe('skipped')
    expect(items[1].duplicateReview?.candidateHouseholdId).toBe('hh-candidate')
    expect(items[1].duplicateReview?.matchReason).toBe('email_only_match')
    expect(items[1].sheetsSyncStatus).toBe('failed')
  })

  it('converts fetch failures into safe application errors', async () => {
    const from = vi.fn(() =>
      createQuery({ data: null, error: { code: 'PGRST301', message: 'JWT expired' } }),
    )
    await expect(fetchIntakeQueue({ from } as unknown as SupabaseClient)).rejects.toBeTruthy()

    const safe = await fetchIntakeQueueSafe({ from } as unknown as SupabaseClient)
    expect(safe.ok).toBe(false)
    if (!safe.ok) {
      expect(safe.error).toMatch(/Unable to load incoming leads/i)
      expect(safe.error).not.toMatch(/JWT|PGRST/i)
    }
  })
})

describe('formatIntakeError', () => {
  it('keeps technical detail for logs without inventing Sheets payloads', () => {
    expect(formatIntakeError('intake queue', { message: 'boom', code: '42P01' })).toContain(
      'intake queue failed',
    )
    expect(getDuplicateResolutionAvailability('owner').canResolveWrites).toBe(true)
  })
})
