import { describe, expect, it, vi } from 'vitest'
import {
  getDuplicateResolutionAvailability,
  mapDuplicateResolutionRpcError,
  resolveDigitalIdentityDuplicateReview,
  resolveDuplicateReview,
  sanitizeDuplicateResolutionNotes,
} from './intakeApi'
import {
  canOwnerResolveDuplicate,
  duplicateConfirmCopy,
  postResolutionProvenanceGuard,
} from './duplicateResolutionUi'
import { DUPLICATE_RESOLUTION_REQUIRES_MIGRATION_021 } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isEligibleForFinancialProgressEvidence, isPublicFamilyDiagnostic } from '../households/householdsApi'

describe('duplicate resolution availability', () => {
  it('enables owner writes after migration 021', () => {
    expect(DUPLICATE_RESOLUTION_REQUIRES_MIGRATION_021).toBe(false)
    expect(getDuplicateResolutionAvailability('owner').canResolveWrites).toBe(true)
    expect(getDuplicateResolutionAvailability('advisor').canResolveWrites).toBe(false)
    expect(getDuplicateResolutionAvailability(null).canResolveWrites).toBe(false)
  })
})

describe('sanitizeDuplicateResolutionNotes', () => {
  it('trims and rejects empty notes', () => {
    expect(sanitizeDuplicateResolutionNotes('  hello  ')).toBe('hello')
    expect(sanitizeDuplicateResolutionNotes('   ')).toBeNull()
    expect(sanitizeDuplicateResolutionNotes(null)).toBeNull()
  })

  it('strips null bytes and caps length', () => {
    expect(sanitizeDuplicateResolutionNotes('a\u0000b')).toBe('ab')
    const long = 'x'.repeat(2500)
    expect(sanitizeDuplicateResolutionNotes(long)?.length).toBe(2000)
  })
})

describe('mapDuplicateResolutionRpcError', () => {
  it('maps CRM_DUP codes to safe messages without raw SQL', () => {
    const unauthorized = mapDuplicateResolutionRpcError({
      message: 'CRM_DUP:not_authorized',
      code: '42501',
    })
    expect(unauthorized.code).toBe('not_authorized')
    expect(unauthorized.message).toMatch(/owners/i)
    expect(unauthorized.message).not.toMatch(/42501|SQL|permission denied for table/i)

    const unsafe = mapDuplicateResolutionRpcError({
      message: 'CRM_DUP:unsafe_dependents',
    })
    expect(unsafe.code).toBe('unsafe_dependents')
    expect(unsafe.message).toMatch(/additional CRM records/i)

    const conflict = mapDuplicateResolutionRpcError({
      message: 'CRM_DUP:already_resolved_conflict',
    })
    expect(conflict.code).toBe('already_resolved_conflict')
  })
})

describe('resolveDuplicateReview client', () => {
  it('maps successful RPC payloads', async () => {
    const rpc = vi.fn().mockImplementation(async (fn: string) => {
      if (fn === 'resolve_public_family_duplicate_review') {
        return {
          data: {
            ok: true,
            action: 'confirm_same_household',
            duplicate_review_id: 'dup-1',
            lead_id: 'lead-1',
            assessment_id: 'assess-1',
            resulting_household_id: 'hh-canonical',
            provisional_household_id: 'hh-prov',
            resolved_at: '2026-07-28T22:00:00.000Z',
            already_resolved: false,
          },
          error: null,
        }
      }
      if (fn === 'create_public_family_follow_up_task') {
        return {
          data: {
            ok: true,
            already_exists: false,
            needs_manual_review: false,
            task_id: 'task-review-1',
            workflow_type: 'review_initial_diagnostic',
          },
          error: null,
        }
      }
      throw new Error(`Unexpected RPC ${fn}`)
    })
    const result = await resolveDuplicateReview({ rpc } as unknown as SupabaseClient, {
      duplicateReviewId: 'dup-1',
      action: 'confirm_same_household',
      notes: ' matched ',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.resultingHouseholdId).toBe('hh-canonical')
      expect(result.action).toBe('confirm_same_household')
    }
    expect(rpc).toHaveBeenCalledWith('resolve_public_family_duplicate_review', {
      p_duplicate_review_id: 'dup-1',
      p_action: 'confirm_same_household',
      p_resolution_notes: 'matched',
    })
    expect(rpc).toHaveBeenCalledWith(
      'create_public_family_follow_up_task',
      expect.objectContaining({
        p_assessment_id: 'assess-1',
        p_workflow_type: 'review_initial_diagnostic',
        p_creation_source: 'duplicate_resolution',
      }),
    )
  })

  it('keeps resolution success when follow-up task creation fails', async () => {
    const rpc = vi.fn().mockImplementation(async (fn: string) => {
      if (fn === 'resolve_public_family_duplicate_review') {
        return {
          data: {
            ok: true,
            action: 'keep_separate',
            duplicate_review_id: 'dup-2',
            lead_id: 'lead-2',
            assessment_id: 'assess-2',
            resulting_household_id: 'hh-prov',
            provisional_household_id: 'hh-prov',
            resolved_at: '2026-07-28T22:00:00.000Z',
            already_resolved: false,
          },
          error: null,
        }
      }
      return { data: null, error: { message: 'CRM_TASK:invalid_assessment' } }
    })
    const result = await resolveDuplicateReview({ rpc } as unknown as SupabaseClient, {
      duplicateReviewId: 'dup-2',
      action: 'keep_separate',
    })
    expect(result.ok).toBe(true)
  })

  it('maps unauthorized RPC failures safely', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'CRM_DUP:not_authorized', code: '42501' },
    })
    const result = await resolveDuplicateReview({ rpc } as unknown as SupabaseClient, {
      duplicateReviewId: 'dup-1',
      action: 'keep_separate',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('not_authorized')
      expect(result.message).not.toMatch(/42501/)
    }
  })
})

describe('resolveDigitalIdentityDuplicateReview client', () => {
  it('calls DI resolve RPC and best-effort review task with duplicate_resolution source', async () => {
    const rpc = vi.fn().mockImplementation(async (fn: string) => {
      if (fn === 'resolve_digital_identity_duplicate_review') {
        return {
          data: {
            ok: true,
            action: 'confirm_same_household',
            duplicate_review_id: 'dup-di',
            lead_id: 'lead-di',
            assessment_id: null,
            resulting_household_id: 'hh-canonical',
            provisional_household_id: 'hh-prov',
            resolved_at: '2026-08-03T22:00:00.000Z',
            already_resolved: false,
          },
          error: null,
        }
      }
      if (fn === 'create_digital_identity_follow_up_task') {
        return {
          data: {
            ok: true,
            already_exists: false,
            needs_manual_review: false,
            task_id: 'task-di-review',
            workflow_type: 'review_digital_identity_lead',
          },
          error: null,
        }
      }
      throw new Error(`Unexpected RPC ${fn}`)
    })

    const result = await resolveDigitalIdentityDuplicateReview(
      { rpc } as unknown as SupabaseClient,
      {
        duplicateReviewId: 'dup-di',
        action: 'confirm_same_household',
        notes: 'same person',
      },
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.assessmentId).toBeNull()
      expect(result.resultingHouseholdId).toBe('hh-canonical')
    }
    expect(rpc).toHaveBeenCalledWith('resolve_digital_identity_duplicate_review', {
      p_duplicate_review_id: 'dup-di',
      p_action: 'confirm_same_household',
      p_resolution_notes: 'same person',
    })
    expect(rpc).toHaveBeenCalledWith('create_digital_identity_follow_up_task', {
      p_lead_id: 'lead-di',
      p_workflow_type: 'review_digital_identity_lead',
      p_creation_source: 'duplicate_resolution',
    })
  })

  it('keeps DI resolution success when follow-up task creation fails', async () => {
    const rpc = vi.fn().mockImplementation(async (fn: string) => {
      if (fn === 'resolve_digital_identity_duplicate_review') {
        return {
          data: {
            ok: true,
            action: 'keep_separate',
            duplicate_review_id: 'dup-di-2',
            lead_id: 'lead-di-2',
            assessment_id: null,
            resulting_household_id: 'hh-prov',
            provisional_household_id: 'hh-prov',
            resolved_at: '2026-08-03T22:00:00.000Z',
            already_resolved: false,
          },
          error: null,
        }
      }
      return Promise.reject(new Error('RPC unavailable'))
    })

    const result = await resolveDigitalIdentityDuplicateReview(
      { rpc } as unknown as SupabaseClient,
      {
        duplicateReviewId: 'dup-di-2',
        action: 'keep_separate',
      },
    )
    expect(result.ok).toBe(true)
  })
})

describe('duplicate resolution UI helpers', () => {
  it('enables owner actions only while pending', () => {
    expect(
      canOwnerResolveDuplicate({
        isOwner: true,
        reviewStatus: 'pending',
        resolving: false,
        alreadySucceeded: false,
      }),
    ).toBe(true)
    expect(
      canOwnerResolveDuplicate({
        isOwner: false,
        reviewStatus: 'pending',
        resolving: false,
        alreadySucceeded: false,
      }),
    ).toBe(false)
    expect(
      canOwnerResolveDuplicate({
        isOwner: true,
        reviewStatus: 'merged',
        resolving: false,
        alreadySucceeded: false,
      }),
    ).toBe(false)
  })

  it('uses explicit confirm labels (not vague Merge)', () => {
    const confirm = duplicateConfirmCopy('confirm_same_household')
    expect(confirm.confirmLabel).toBe('Confirm Same Household')
    expect(confirm.mentionsCanonicalContactUnchanged).toBe(true)
    expect(confirm.confirmLabel).not.toMatch(/^Merge$/i)

    const keep = duplicateConfirmCopy('keep_separate')
    expect(keep.confirmLabel).toBe('Keep as Separate Household')
    expect(keep.mentionsKeepSeparate).toBe(true)
  })
})

describe('post-resolution Financial Progress protection', () => {
  it('keeps public diagnostics ineligible for Financial Progress after re-link', () => {
    const assessment = {
      assessment_type: 'family' as const,
      capture_channel: 'public_self_report' as const,
      overall_score: 72,
      overall_grade: 'C',
    }
    const guard = postResolutionProvenanceGuard(assessment)
    expect(guard.remainsPublicSelfReport).toBe(true)
    expect(guard.remainsFamily).toBe(true)
    expect(guard.eligibleForFinancialProgress).toBe(false)
    expect(isEligibleForFinancialProgressEvidence(assessment)).toBe(false)
    expect(isPublicFamilyDiagnostic(assessment)).toBe(true)
    expect(guard.scoreUnchanged).toBe(72)
    expect(guard.gradeUnchanged).toBe('C')
  })
})
