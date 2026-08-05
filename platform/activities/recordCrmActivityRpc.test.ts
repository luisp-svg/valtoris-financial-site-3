import { describe, expect, it, vi } from 'vitest'
import {
  RECORD_CRM_ACTIVITY_ONBOARDING_METADATA_ALLOWLIST,
  RECORD_CRM_ACTIVITY_RPC_EVENT_KEYS,
  RECORD_CRM_ACTIVITY_RPC_NAME,
  RECORD_CRM_ACTIVITY_TASK_METADATA_ALLOWLIST,
  isRecordCrmActivityRpcEvent,
  recordCrmActivityRpc,
  toRecordCrmActivityRpcInput,
} from './recordCrmActivityRpc'
import { MIGRATION_029_ONBOARDING_METADATA_ALLOWLIST, MIGRATION_029_TASK_METADATA_ALLOWLIST } from '../../crm/security/migration029Contract'

describe('recordCrmActivityRpc contract', () => {
  it('covers only the two approved Migration 029 browser events', () => {
    expect(RECORD_CRM_ACTIVITY_RPC_EVENT_KEYS).toEqual([
      'tasks.manual.created',
      'onboarding.completed',
    ])
    expect(RECORD_CRM_ACTIVITY_RPC_NAME).toBe('record_crm_activity')
    expect(isRecordCrmActivityRpcEvent('tasks.manual.created')).toBe(true)
    expect(isRecordCrmActivityRpcEvent('onboarding.completed')).toBe(true)
    expect(isRecordCrmActivityRpcEvent('tasks.completed')).toBe(false)
    expect(isRecordCrmActivityRpcEvent('notes.added')).toBe(false)
  })

  it('keeps metadata allowlists aligned with Migration 029', () => {
    expect([...RECORD_CRM_ACTIVITY_TASK_METADATA_ALLOWLIST]).toEqual([
      ...MIGRATION_029_TASK_METADATA_ALLOWLIST,
    ])
    expect([...RECORD_CRM_ACTIVITY_ONBOARDING_METADATA_ALLOWLIST]).toEqual([
      ...MIGRATION_029_ONBOARDING_METADATA_ALLOWLIST,
    ])
  })

  it('maps task writer input to allowlisted RPC payload only', () => {
    const mapped = toRecordCrmActivityRpcInput({
      householdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      eventKey: 'tasks.manual.created',
      title: 'ignored',
      body: 'ignored',
      activityType: 'task_created',
      visibility: 'client_visible',
      actorKind: 'ai',
      occurredAt: '2020-01-01T00:00:00.000Z',
      leadId: '11111111-1111-4111-8111-111111111111',
      opportunityId: '22222222-2222-4222-8222-222222222222',
      assessmentId: '33333333-3333-4333-8333-333333333333',
      metadata: {
        taskId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        workflowType: 'family_follow_up',
        sourceType: 'manual',
        idempotencyKey: 'task_created:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        documentId: 'should-drop',
        actorKind: 'ai',
        eventKey: 'spoof',
      },
    })
    expect(mapped.ok).toBe(true)
    if (!mapped.ok) return
    expect(mapped.value).toEqual({
      householdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      eventKey: 'tasks.manual.created',
      metadata: {
        taskId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        workflowType: 'family_follow_up',
        sourceType: 'manual',
        idempotencyKey: 'task_created:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
      opportunityId: '22222222-2222-4222-8222-222222222222',
      leadId: '11111111-1111-4111-8111-111111111111',
      assessmentId: '33333333-3333-4333-8333-333333333333',
    })
  })

  it('forces onboarding subjects to assessment-only', () => {
    const mapped = toRecordCrmActivityRpcInput({
      householdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      eventKey: 'onboarding.completed',
      assessmentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      opportunityId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      leadId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      metadata: {
        assessmentType: 'household_onboarding',
        idempotencyKey: 'onboarding.completed:cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
    })
    expect(mapped.ok).toBe(true)
    if (!mapped.ok) return
    expect(mapped.value.opportunityId).toBeNull()
    expect(mapped.value.leadId).toBeNull()
    expect(mapped.value.assessmentId).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc')
  })

  it('invokes RPC with exact args and never uses activities.insert', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      error: null,
    })
    const from = vi.fn()
    const result = await recordCrmActivityRpc(
      { rpc, from } as never,
      {
        householdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        eventKey: 'tasks.manual.created',
        metadata: {
          taskId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          sourceType: 'manual',
          actorKind: 'ai',
          title: 'spoof',
        },
        opportunityId: '22222222-2222-4222-8222-222222222222',
        leadId: null,
        assessmentId: null,
      },
    )

    expect(result).toEqual({ ok: true, id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' })
    expect(from).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith('record_crm_activity', {
      p_household_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      p_event_key: 'tasks.manual.created',
      p_metadata: {
        taskId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        sourceType: 'manual',
      },
      p_opportunity_id: '22222222-2222-4222-8222-222222222222',
      p_lead_id: null,
      p_assessment_id: null,
    })
    const meta = rpc.mock.calls[0]?.[1]?.p_metadata as Record<string, unknown>
    expect(meta).not.toHaveProperty('actorKind')
    expect(meta).not.toHaveProperty('title')
    expect(meta).not.toHaveProperty('visibility')
    expect(meta).not.toHaveProperty('eventKey')
  })

  it('returns a safe generic error on RPC failure (no raw Supabase message)', async () => {
    const result = await recordCrmActivityRpc(
      {
        rpc: async () => ({
          data: null,
          error: { message: 'CRM029:not_authorized secret=abc', code: '42501' },
        }),
        from: vi.fn(),
      } as never,
      {
        householdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        eventKey: 'onboarding.completed',
        assessmentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        metadata: { assessmentType: 'household_onboarding' },
      },
    )
    expect(result).toEqual({
      ok: false,
      error: 'Unable to record activity',
      code: 'rpc_failed',
    })
    expect(JSON.stringify(result)).not.toMatch(/CRM029|secret|42501/i)
  })
})
