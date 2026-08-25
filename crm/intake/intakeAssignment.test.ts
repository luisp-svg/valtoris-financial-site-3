import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assignIntakeHousehold,
  INTAKE_ASSIGN_HOUSEHOLD_RPC,
  mapAssignHouseholdRpcError,
} from './intakeAssignment'
import {
  canPresentIntakeAssignAdvisorAction,
  INTAKE_ASSIGN_ADVISOR_ACTION_LABEL,
  INTAKE_ASSIGN_RPC_BEHAVIOR_COPY,
  INTAKE_ASSIGN_SUCCESS_COPY,
  INTAKE_WORKFLOW_DUPLICATE_BLOCK_COPY,
  intakeAssignConfirmationCopy,
  intakeAssignVisibilityForItem,
} from './intakeAssignmentUi'
import type { IntakeQueueItem } from './types'

function householdItem(
  overrides: Partial<IntakeQueueItem> = {},
): Pick<IntakeQueueItem, 'household' | 'leadStatus' | 'duplicateReview' | 'duplicateReviewStatus'> {
  return {
    leadStatus: 'new',
    duplicateReview: null,
    duplicateReviewStatus: 'none',
    household: {
      id: 'hh-1',
      displayName: 'Jamie Rivera',
      status: 'lead',
      primaryEmail: null,
      primaryPhone: null,
      assignedAdvisor: { id: 'adv-1', displayName: 'Advisor A' },
      duplicateReviewStatus: 'none',
      mergedIntoHouseholdId: null,
      deletedAt: null,
    },
    ...overrides,
  }
}

describe('intake assign advisor visibility', () => {
  it('shows Assign Advisor for owners only', () => {
    expect(
      canPresentIntakeAssignAdvisorAction({ isOwner: true, householdId: 'hh-1' }),
    ).toBe(true)
    expect(
      canPresentIntakeAssignAdvisorAction({ isOwner: false, householdId: 'hh-1' }),
    ).toBe(false)
    expect(
      canPresentIntakeAssignAdvisorAction({ isOwner: true, householdId: null }),
    ).toBe(false)
  })

  it('does not treat assigned or unassigned-pool advisors as reassignment-capable', () => {
    expect(
      intakeAssignVisibilityForItem(householdItem(), { isOwner: false }).canPresent,
    ).toBe(false)
    expect(
      intakeAssignVisibilityForItem(
        householdItem({
          household: {
            id: 'hh-1',
            displayName: 'Unassigned',
            status: 'lead',
            primaryEmail: null,
            primaryPhone: null,
            assignedAdvisor: null,
            duplicateReviewStatus: 'none',
            mergedIntoHouseholdId: null,
            deletedAt: null,
          },
        }),
        { isOwner: false },
      ).canPresent,
    ).toBe(false)
  })

  it('blocks assignment when duplicate review is pending', () => {
    expect(
      intakeAssignVisibilityForItem(
        householdItem({ leadStatus: 'duplicate_review' }),
        { isOwner: true },
      ),
    ).toEqual({ canPresent: true, blockedByDuplicate: true })
    expect(
      intakeAssignVisibilityForItem(
        householdItem({ duplicateReviewStatus: 'pending' }),
        { isOwner: true },
      ).blockedByDuplicate,
    ).toBe(true)
    expect(INTAKE_WORKFLOW_DUPLICATE_BLOCK_COPY).toMatch(
      /Resolve the possible duplicate before assigning or creating an Opportunity/i,
    )
  })
})

describe('assignment copy', () => {
  it('confirms the selected advisor and describes existing RPC behavior', () => {
    expect(INTAKE_ASSIGN_ADVISOR_ACTION_LABEL).toBe('Assign Advisor')
    expect(intakeAssignConfirmationCopy('Jared Bantigue')).toBe(
      'Assign this household and its active work to Jared Bantigue?',
    )
    expect(INTAKE_ASSIGN_RPC_BEHAVIOR_COPY).toMatch(/household/i)
    expect(INTAKE_ASSIGN_RPC_BEHAVIOR_COPY).toMatch(/Intake leads/i)
    expect(INTAKE_ASSIGN_RPC_BEHAVIOR_COPY).toMatch(/open or on-hold Opportunities/i)
    expect(INTAKE_ASSIGN_SUCCESS_COPY).toMatch(/assignment updated/i)
  })
})

describe('mapAssignHouseholdRpcError', () => {
  it('maps owner-only and invalid advisor errors without raw Postgres text', () => {
    expect(mapAssignHouseholdRpcError({ message: 'only owners can assign households in V1' })).toEqual({
      ok: false,
      code: 'not_authorized',
      message: 'You do not have permission to assign this household.',
    })
    expect(mapAssignHouseholdRpcError({ message: 'advisor not found or inactive' })).toEqual({
      ok: false,
      code: 'invalid_advisor',
      message: 'That advisor could not be assigned.',
    })
    const unknown = mapAssignHouseholdRpcError({
      message: 'column assigned_advisor_id does not exist',
      code: '42703',
    })
    expect(unknown.code).toBe('unknown')
    expect(unknown.message).toBe('Unable to assign this household. Please try again.')
    expect(unknown.message).not.toMatch(/42703|column assigned_advisor_id|SQL/i)
  })
})

describe('assignIntakeHousehold client wrapper', () => {
  it('calls assign_household with household, advisor, and manual reason', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { id: 'hh-1', assigned_advisor_id: 'adv-2' },
      error: null,
    })
    const result = await assignIntakeHousehold({ rpc } as unknown as SupabaseClient, {
      householdId: 'hh-1',
      advisorId: 'adv-2',
    })
    expect(INTAKE_ASSIGN_HOUSEHOLD_RPC).toBe('assign_household')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('assign_household', {
      p_household_id: 'hh-1',
      p_advisor_id: 'adv-2',
      p_reason: 'manual',
    })
    expect(result).toEqual({
      ok: true,
      householdId: 'hh-1',
      assignedAdvisorId: 'adv-2',
    })
  })
})
