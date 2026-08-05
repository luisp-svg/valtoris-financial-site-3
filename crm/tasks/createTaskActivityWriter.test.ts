import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const TASK_API = readFileSync(resolve(process.cwd(), 'crm/tasks/tasksApi.ts'), 'utf8')

describe('manual task Activity writer (Migration 029 RPC)', () => {
  it('uses recordActivityBestEffort with tasks.manual.created and no direct activities insert', () => {
    expect(TASK_API).toContain("eventKey: 'tasks.manual.created'")
    expect(TASK_API).toContain('recordActivityBestEffort')
    expect(TASK_API).not.toMatch(/\.from\(\s*['"]activities['"]\s*\)/)
    expect(TASK_API).not.toMatch(/activity_type\s*:/)
    expect(TASK_API).not.toMatch(/\btitle:\s*created\.title/)
    expect(TASK_API).not.toMatch(/\bactorKind\s*:/)
    expect(TASK_API).not.toMatch(/\boccurredAt\s*:/)
    expect(TASK_API).not.toMatch(/\bvisibility\s*:/)
    // Task row may set created_by_user_id; Activity publish must not spoof actor fields.
    expect(TASK_API).not.toMatch(/recordActivityBestEffort\([\s\S]*created_by_user_id/)
  })

  it('publishes allowlisted metadata and matching task subjects via RPC', async () => {
    vi.resetModules()
    const rpc = vi.fn().mockResolvedValue({
      data: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      error: null,
    })
    const from = vi.fn((table: string) => {
      if (table === 'tasks') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: {
                  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                  household_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                  opportunity_id: '22222222-2222-4222-8222-222222222222',
                  lead_id: '11111111-1111-4111-8111-111111111111',
                  assessment_id: '33333333-3333-4333-8333-333333333333',
                  title: 'Call family',
                  description: null,
                  due_date: null,
                  priority: 'medium',
                  status: 'open',
                  assigned_user_id: null,
                  created_by_user_id: 'owner-id',
                  source_type: 'manual',
                  workflow_type: null,
                  automation_idempotency_key: null,
                  metadata: {},
                  created_at: '2026-08-05T00:00:00.000Z',
                  completed_at: null,
                  deleted_at: null,
                  household: null,
                  assignee: null,
                },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected from(${table})`)
    })

    const { createTask } = await import('./tasksApi')
    const created = await createTask(
      { from, rpc } as never,
      {
        household_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        title: 'Call family',
        description: '',
        due_date: null,
        priority: 'medium',
        assigned_user_id: null,
        opportunity_id: '22222222-2222-4222-8222-222222222222',
        lead_id: '11111111-1111-4111-8111-111111111111',
        assessment_id: '33333333-3333-4333-8333-333333333333',
        source_type: 'manual',
      },
      'owner-id',
    )

    expect(created.id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    expect(from).not.toHaveBeenCalledWith('activities')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('record_crm_activity', {
      p_household_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      p_event_key: 'tasks.manual.created',
      p_metadata: {
        taskId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        workflowType: null,
        sourceType: 'manual',
        idempotencyKey: 'task_created:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
      p_opportunity_id: '22222222-2222-4222-8222-222222222222',
      p_lead_id: '11111111-1111-4111-8111-111111111111',
      p_assessment_id: '33333333-3333-4333-8333-333333333333',
    })
  })

  it('keeps task creation successful when activity RPC fails safely', async () => {
    vi.resetModules()
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'CRM029:not_authorized raw', details: '/Users/secret' },
    })
    const from = vi.fn(() => ({
      insert: () => ({
        select: () => ({
          single: async () => ({
            data: {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              household_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              opportunity_id: null,
              lead_id: null,
              assessment_id: null,
              title: 'Call family',
              description: null,
              due_date: null,
              priority: 'medium',
              status: 'open',
              assigned_user_id: null,
              created_by_user_id: 'owner-id',
              source_type: 'manual',
              workflow_type: null,
              automation_idempotency_key: null,
              metadata: {},
              created_at: '2026-08-05T00:00:00.000Z',
              completed_at: null,
              deleted_at: null,
              household: null,
              assignee: null,
            },
            error: null,
          }),
        }),
      }),
    }))

    const { createTask } = await import('./tasksApi')
    await expect(
      createTask(
        { from, rpc } as never,
        {
          household_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          title: 'Call family',
          description: '',
          due_date: null,
          priority: 'medium',
          assigned_user_id: null,
          opportunity_id: null,
          source_type: 'manual',
        },
        'owner-id',
      ),
    ).resolves.toMatchObject({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  })
})
