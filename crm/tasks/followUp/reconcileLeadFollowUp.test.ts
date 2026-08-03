import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { reconcileLeadFollowUpTaskState } from './reconcileLeadFollowUp'
import { createTask } from '../tasksApi'

describe('reconcileLeadFollowUpTaskState', () => {
  it('updates task_failed lead to task_manually_created when task exists', async () => {
    let call = 0
    const supabase = {
      from: vi.fn((table: string) => {
        call += 1
        if (table === 'tasks') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'task-1',
                    lead_id: 'lead-1',
                    household_id: 'hh-1',
                    deleted_at: null,
                    source_type: 'manual',
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (call === 2) {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'lead-1',
                    household_id: 'hh-1',
                    deleted_at: null,
                    follow_up_task_automation_status: 'task_failed',
                    follow_up_task_id: null,
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        return {
          update: () => ({
            eq: () => ({
              is: () => ({
                select: async () => ({ data: [{ id: 'lead-1' }], error: null }),
              }),
            }),
          }),
        }
      }),
    } as unknown as SupabaseClient

    const result = await reconcileLeadFollowUpTaskState(supabase, {
      leadId: 'lead-1',
      taskId: 'task-1',
      status: 'task_manually_created',
    })
    expect(result).toEqual({ ok: true, updated: true, status: 'task_manually_created' })
  })

  it('does not overwrite a different successful automatic task reference', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'task-manual',
                    lead_id: 'lead-1',
                    household_id: 'hh-1',
                    deleted_at: null,
                    source_type: 'manual',
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'lead-1',
                  household_id: 'hh-1',
                  deleted_at: null,
                  follow_up_task_automation_status: 'task_created',
                  follow_up_task_id: 'task-auto',
                },
                error: null,
              }),
            }),
          }),
        }
      }),
    } as unknown as SupabaseClient

    const result = await reconcileLeadFollowUpTaskState(supabase, {
      leadId: 'lead-1',
      taskId: 'task-manual',
    })
    expect(result).toEqual({ ok: true, updated: false, reason: 'valid_automatic_present' })
  })

  it('rejects cross-lead task references', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 'task-1',
                lead_id: 'lead-other',
                household_id: 'hh-1',
                deleted_at: null,
                source_type: 'manual',
              },
              error: null,
            }),
          }),
        }),
      })),
    } as unknown as SupabaseClient

    const result = await reconcileLeadFollowUpTaskState(supabase, {
      leadId: 'lead-1',
      taskId: 'task-1',
    })
    expect(result.ok).toBe(false)
  })
})

describe('createTask manual reconciliation', () => {
  it('throws when lead bookkeeping fails after task insert', async () => {
    const insertResult = {
      data: {
        id: 'task-1',
        household_id: 'hh-1',
        opportunity_id: null,
        lead_id: 'lead-1',
        assessment_id: null,
        title: 'Review Initial Financial Diagnostic — no contact permission',
        description: 'Internal review only.',
        due_date: null,
        priority: 'medium',
        status: 'open',
        assigned_user_id: null,
        created_by_user_id: 'user-1',
        source_type: 'manual',
        workflow_type: 'review_initial_diagnostic',
        automation_idempotency_key: null,
        metadata: {},
        created_at: '2026-07-28T00:00:00.000Z',
        completed_at: null,
        deleted_at: null,
        household: null,
        assignee: null,
      },
      error: null,
    }

    let fromCalls = 0
    const supabase = {
      from: vi.fn((table: string) => {
        fromCalls += 1
        if (table === 'tasks' && fromCalls === 1) {
          return {
            insert: () => ({
              select: () => ({
                single: async () => insertResult,
              }),
            }),
          }
        }
        if (table === 'tasks') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'task-1',
                    lead_id: 'lead-1',
                    household_id: 'hh-1',
                    deleted_at: null,
                    source_type: 'manual',
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (fromCalls === 3) {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'lead-1',
                    household_id: 'hh-1',
                    deleted_at: null,
                    follow_up_task_automation_status: 'task_failed',
                    follow_up_task_id: null,
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        return {
          update: () => ({
            eq: () => ({
              is: () => ({
                select: async () => ({ data: null, error: { message: 'rls' } }),
              }),
            }),
          }),
        }
      }),
    } as unknown as SupabaseClient

    await expect(
      createTask(
        supabase,
        {
          title: 'Review Initial Financial Diagnostic — no contact permission',
          description: 'Internal review only.',
          due_date: null,
          priority: 'medium',
          assigned_user_id: null,
          household_id: 'hh-1',
          opportunity_id: null,
          lead_id: 'lead-1',
          source_type: 'manual',
          workflow_type: 'review_initial_diagnostic',
        },
        'user-1',
      ),
    ).rejects.toThrow(/lead follow-up status still needs reconciliation/i)
  })
})
