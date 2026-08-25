import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  archiveIntakeLead,
  INTAKE_ARCHIVE_REASONS,
  INTAKE_ARCHIVE_RPC,
  isIntakeArchiveReason,
  mapIntakeArchiveRpcError,
} from './intakeArchive'
import {
  canPresentIntakeArchiveAction,
  INTAKE_ARCHIVE_ACTION_LABEL,
  INTAKE_ARCHIVE_CONFIRM_COPY,
  INTAKE_ARCHIVE_DUPLICATE_BLOCK_COPY,
  INTAKE_ARCHIVE_REASON_OPTIONS,
  INTAKE_ARCHIVE_SUCCESS_COPY,
  INTAKE_ARCHIVE_TASK_COMPLETED_COPY,
  intakeArchiveVisibilityForItem,
  isIntakeArchiveBlockedByDuplicateReview,
} from './intakeArchiveUi'
import type { IntakeQueueItem } from './types'

describe('intake archive reasons', () => {
  it('exposes exactly four canonical reasons with UI labels', () => {
    expect(INTAKE_ARCHIVE_REASONS).toEqual([
      'dismissed',
      'not_a_fit',
      'spam',
      'test_or_accidental',
    ])
    expect(INTAKE_ARCHIVE_REASON_OPTIONS.map((option) => option.value)).toEqual([
      ...INTAKE_ARCHIVE_REASONS,
    ])
    expect(INTAKE_ARCHIVE_REASON_OPTIONS.map((option) => option.label)).toEqual([
      'Dismissed',
      'Not a Fit',
      'Spam',
      'Test / Accidental',
    ])
    expect(INTAKE_ARCHIVE_REASON_OPTIONS.some((option) => /delete/i.test(option.label))).toBe(false)
    expect(isIntakeArchiveReason('not_a_fit')).toBe(true)
    expect(isIntakeArchiveReason('delete')).toBe(false)
  })

  it('explains retention and does not imply hard cleanup', () => {
    expect(INTAKE_ARCHIVE_CONFIRM_COPY).toMatch(/household, assessment, and CRM history will remain/i)
    expect(INTAKE_ARCHIVE_SUCCESS_COPY).toMatch(/Household and CRM history were retained/i)
    const testHelp = INTAKE_ARCHIVE_REASON_OPTIONS.find((option) => option.value === 'test_or_accidental')
    expect(testHelp?.help).toMatch(/does not permanently delete/i)
    expect(INTAKE_ARCHIVE_TASK_COMPLETED_COPY).toMatch(/follow-up task completed/i)
  })
})

describe('intake archive visibility', () => {
  it('shows Archive for owners and assigned advisors only', () => {
    expect(
      canPresentIntakeArchiveAction({
        isOwner: true,
        currentAdvisorProfileId: null,
        leadAssignedAdvisorId: null,
        householdAssignedAdvisorId: null,
      }),
    ).toBe(true)
    expect(
      canPresentIntakeArchiveAction({
        isOwner: false,
        currentAdvisorProfileId: 'adv-1',
        leadAssignedAdvisorId: 'adv-1',
        householdAssignedAdvisorId: null,
      }),
    ).toBe(true)
    expect(
      canPresentIntakeArchiveAction({
        isOwner: false,
        currentAdvisorProfileId: 'adv-1',
        leadAssignedAdvisorId: null,
        householdAssignedAdvisorId: 'adv-1',
      }),
    ).toBe(true)
    expect(
      canPresentIntakeArchiveAction({
        isOwner: false,
        currentAdvisorProfileId: 'adv-1',
        leadAssignedAdvisorId: null,
        householdAssignedAdvisorId: null,
      }),
    ).toBe(false)
    expect(
      canPresentIntakeArchiveAction({
        isOwner: false,
        currentAdvisorProfileId: 'adv-pool',
        leadAssignedAdvisorId: 'adv-other',
        householdAssignedAdvisorId: 'adv-other',
      }),
    ).toBe(false)
    expect(
      canPresentIntakeArchiveAction({
        isOwner: false,
        currentAdvisorProfileId: null,
        leadAssignedAdvisorId: 'adv-1',
        householdAssignedAdvisorId: 'adv-1',
      }),
    ).toBe(false)
  })

  it('blocks archive when duplicate review is pending', () => {
    expect(
      isIntakeArchiveBlockedByDuplicateReview({
        leadStatus: 'duplicate_review',
        duplicateReviewStatus: 'none',
      }),
    ).toBe(true)
    expect(
      isIntakeArchiveBlockedByDuplicateReview({
        leadStatus: 'new',
        duplicateReviewStatus: 'pending',
      }),
    ).toBe(true)
    expect(
      isIntakeArchiveBlockedByDuplicateReview({
        leadStatus: 'new',
        duplicateReviewStatus: 'confirmed_unique',
      }),
    ).toBe(false)
    expect(INTAKE_ARCHIVE_ACTION_LABEL).toBe('Archive / Dismiss')
    expect(INTAKE_ARCHIVE_DUPLICATE_BLOCK_COPY).toMatch(/Resolve the possible duplicate/i)
  })

  it('derives visibility from existing Intake assignment state', () => {
    const item = {
      leadStatus: 'new',
      duplicateReview: null,
      duplicateReviewStatus: 'none',
      assignedAdvisor: { id: 'adv-1', displayName: 'Assigned' },
      household: {
        id: 'hh-1',
        displayName: 'Prospect',
        status: 'lead',
        primaryEmail: null,
        primaryPhone: null,
        assignedAdvisor: { id: 'adv-1', displayName: 'Assigned' },
        duplicateReviewStatus: 'none',
        mergedIntoHouseholdId: null,
        deletedAt: null,
      },
    } as Pick<
      IntakeQueueItem,
      'leadStatus' | 'duplicateReview' | 'duplicateReviewStatus' | 'assignedAdvisor' | 'household'
    >

    expect(
      intakeArchiveVisibilityForItem(item, {
        isOwner: false,
        currentAdvisorProfileId: 'adv-1',
      }),
    ).toEqual({ canPresent: true, blockedByDuplicate: false })
    expect(
      intakeArchiveVisibilityForItem(
        { ...item, leadStatus: 'duplicate_review' },
        { isOwner: true, currentAdvisorProfileId: null },
      ),
    ).toEqual({ canPresent: true, blockedByDuplicate: true })
  })
})

describe('mapIntakeArchiveRpcError', () => {
  it('maps CRM_INTAKE codes to safe copy without raw server text', () => {
    const pending = mapIntakeArchiveRpcError({
      message: 'CRM_INTAKE:duplicate_review_pending',
      code: 'P0001',
    })
    expect(pending).toEqual({
      ok: false,
      code: 'duplicate_review_pending',
      message: INTAKE_ARCHIVE_DUPLICATE_BLOCK_COPY,
    })

    const already = mapIntakeArchiveRpcError({ message: 'CRM_INTAKE:already_archived' })
    expect(already.code).toBe('already_archived')
    expect(already.message).toBe('This Intake has already been archived.')

    const unauthorized = mapIntakeArchiveRpcError({
      message: 'CRM_INTAKE:not_authorized',
      details: 'permission denied for function archive_intake_lead',
    })
    expect(unauthorized.message).toBe('You do not have permission to archive this Intake.')
    expect(unauthorized.message).not.toMatch(/permission denied|P0001|SQL|stack/i)

    const unknown = mapIntakeArchiveRpcError({ message: 'relation does not exist' })
    expect(unknown.code).toBe('unknown')
    expect(unknown.message).toBe('Unable to archive this Intake. Please try again.')

    const subject = mapIntakeArchiveRpcError({
      message: 'CRM029:subject_relationship_invalid',
      code: '23514',
    })
    expect(subject.code).toBe('unknown')
    expect(subject.message).not.toMatch(/CRM029|23514|subject_relationship/i)
  })
})

describe('archiveIntakeLead client wrapper', () => {
  it('calls archive_intake_lead with the exact lead ID and canonical reason', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        lead_id: 'lead-archive-1',
        archived: true,
        reason: 'not_a_fit',
        follow_up_task_completed: true,
      },
      error: null,
    })

    const result = await archiveIntakeLead({ rpc } as unknown as SupabaseClient, {
      leadId: 'lead-archive-1',
      reason: 'not_a_fit',
    })

    expect(INTAKE_ARCHIVE_RPC).toBe('archive_intake_lead')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('archive_intake_lead', {
      p_lead_id: 'lead-archive-1',
      p_reason: 'not_a_fit',
    })
    expect(result).toEqual({
      ok: true,
      lead_id: 'lead-archive-1',
      archived: true,
      reason: 'not_a_fit',
      follow_up_task_completed: true,
    })
  })

  it('surfaces RPC errors safely and rejects invalid local reasons', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'CRM_INTAKE:duplicate_review_pending' },
    })
    const failed = await archiveIntakeLead({ rpc } as unknown as SupabaseClient, {
      leadId: 'lead-dup',
      reason: 'dismissed',
    })
    expect(failed.ok).toBe(false)
    if (!failed.ok) {
      expect(failed.code).toBe('duplicate_review_pending')
      expect(failed.message).not.toMatch(/CRM_INTAKE|SQL/i)
    }

    const invalid = await archiveIntakeLead({ rpc } as unknown as SupabaseClient, {
      leadId: 'lead-dup',
      reason: 'delete' as 'dismissed',
    })
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.code).toBe('invalid_reason')
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
