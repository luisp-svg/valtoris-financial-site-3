import { describe, expect, it, vi } from 'vitest'
import {
  buildActivityMetadata,
  filterPlatformActivities,
  formatActivityLabel,
  formatActivityTypeLabel,
  getActivityEventDefinition,
  inferEventKeyFromLegacyRow,
  listActivityEventKeysFromCatalog,
  normalizeActivityRow,
  recordActivity,
  resolveTimelineMapping,
  sortActivitiesByOccurredAtDesc,
  validateRecordActivityInput,
} from './index'
import { getModule, listActivityEventKeys, listEnabledModules, listModules } from '../registry'
import { normalizeActivityToTimelineItem } from '../../crm/households/timeline'

describe('Activity Engine event catalog', () => {
  it('registers unique event keys', () => {
    const keys = listActivityEventKeysFromCatalog()
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain('diagnostic.ifd.submitted')
    expect(keys).toContain('crm.duplicate.resolved')
    expect(keys).toContain('tasks.manual.created')
    expect(keys).toContain('onboarding.completed')
  })

  it('keeps registry activity declarations unique within each module', () => {
    for (const module of listModules()) {
      const keys = module.activityTypes.map((item) => item.eventKey)
      expect(new Set(keys).size).toBe(keys.length)
    }
    // Aggregated registry helper is de-duplicated across modules.
    const aggregated = listActivityEventKeys()
    expect(new Set(aggregated).size).toBe(aggregated.length)
  })

  it('maps event keys to DB activity types', () => {
    expect(getActivityEventDefinition('diagnostic.ifd.submitted')?.activityType).toBe(
      'assessment_completed',
    )
    expect(getActivityEventDefinition('tasks.manual.created')?.activityType).toBe('task_created')
    expect(getActivityEventDefinition('crm.duplicate.resolved')?.activityType).toBe('system')
  })
})

describe('Activity Engine legacy inference', () => {
  it('infers IFD and duplicate events from existing SQL writer shapes', () => {
    expect(
      inferEventKeyFromLegacyRow({
        activityType: 'assessment_completed',
        title: 'Initial Financial Diagnostic completed',
        metadata: { capture_channel: 'public_self_report' },
      }),
    ).toBe('diagnostic.ifd.submitted')

    expect(
      inferEventKeyFromLegacyRow({
        activityType: 'lead_created',
        title: 'Initial Financial Diagnostic submitted',
      }),
    ).toBe('crm.lead.created')

    expect(
      inferEventKeyFromLegacyRow({
        activityType: 'system',
        metadata: { event: 'public_duplicate_confirmed' },
      }),
    ).toBe('crm.duplicate.resolved')

    expect(
      inferEventKeyFromLegacyRow({
        activityType: 'system',
        metadata: { event: 'public_family_follow_up_task_created' },
      }),
    ).toBe('tasks.automated.created')
  })

  it('prefers explicit metadata.eventKey when present', () => {
    expect(
      inferEventKeyFromLegacyRow({
        activityType: 'system',
        metadata: { eventKey: 'onboarding.completed', event: 'public_duplicate_confirmed' },
      }),
    ).toBe('onboarding.completed')
  })

  it('falls unknown legacy activity types back to a safe legacy.* key', () => {
    expect(
      inferEventKeyFromLegacyRow({
        activityType: 'email_sent',
        title: 'Email',
      }),
    ).toBe('legacy.email_sent')
  })
})

describe('Activity Engine normalize + metadata', () => {
  it('normalizes a diagnostic activity with module, visibility, and actorKind', () => {
    const activity = normalizeActivityRow({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      household_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      actor_user_id: null,
      activity_type: 'assessment_completed',
      title: 'Family Report Card completed',
      body: null,
      metadata: { capture_channel: 'public_self_report' },
      occurred_at: '2026-08-01T12:00:00.000Z',
      created_at: '2026-08-01T12:00:00.000Z',
      assessment_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    })

    expect(activity.eventKey).toBe('diagnostic.ifd.submitted')
    expect(activity.moduleKey).toBe('initial_financial_diagnostic')
    expect(activity.actorKind).toBe('system')
    expect(activity.visibility).toBe('internal')
    expect(activity.pinned).toBe(false)
    expect(activity.caseId).toBeNull()
    expect(activity.entityType).toBe('assessment')
    expect(activity.metadata.eventKey).toBe('diagnostic.ifd.submitted')
  })

  it('builds publish metadata with caseId reserved for future Case Engine', () => {
    const metadata = buildActivityMetadata({
      householdId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      eventKey: 'tasks.manual.created',
      title: 'Call client',
      caseId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      entityType: 'task',
      entityId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      pinned: true,
      visibility: 'internal',
    })
    expect(metadata.eventKey).toBe('tasks.manual.created')
    expect(metadata.caseId).toBe('dddddddd-dddd-dddd-dddd-dddddddddddd')
    expect(metadata.pinned).toBe(true)
    expect(metadata.module).toBe('tasks')
  })
})

describe('Activity Engine timeline helpers', () => {
  it('sorts deterministically by occurredAt desc then id', () => {
    const a = normalizeActivityRow({
      id: 'a',
      household_id: 'h',
      activity_type: 'system',
      title: 'A',
      occurred_at: '2026-08-02T00:00:00.000Z',
      metadata: { event: 'public_duplicate_confirmed' },
    })
    const b = normalizeActivityRow({
      id: 'b',
      household_id: 'h',
      activity_type: 'system',
      title: 'B',
      occurred_at: '2026-08-03T00:00:00.000Z',
      metadata: { event: 'public_duplicate_confirmed' },
    })
    const c = normalizeActivityRow({
      id: 'c',
      household_id: 'h',
      activity_type: 'system',
      title: 'C',
      occurred_at: '2026-08-03T00:00:00.000Z',
      metadata: { event: 'public_duplicate_confirmed' },
    })
    expect(sortActivitiesByOccurredAtDesc([a, c, b]).map((item) => item.id)).toEqual([
      'c',
      'b',
      'a',
    ])
  })

  it('filters by module and eventKey', () => {
    const ifd = normalizeActivityRow({
      id: '1',
      household_id: 'h',
      activity_type: 'assessment_completed',
      title: 'IFD',
      occurred_at: '2026-08-01T00:00:00.000Z',
      metadata: { capture_channel: 'public_self_report' },
    })
    const task = normalizeActivityRow({
      id: '2',
      household_id: 'h',
      activity_type: 'task_created',
      title: 'Task',
      occurred_at: '2026-08-02T00:00:00.000Z',
      metadata: { eventKey: 'tasks.manual.created', module: 'tasks' },
    })
    expect(
      filterPlatformActivities([ifd, task], { moduleKey: 'tasks' }).map((item) => item.id),
    ).toEqual(['2'])
    expect(
      filterPlatformActivities([ifd, task], { eventKey: 'diagnostic.ifd.submitted' }).map(
        (item) => item.id,
      ),
    ).toEqual(['1'])
  })

  it('maps automated task system rows to task timeline presentation', () => {
    const mapping = resolveTimelineMapping('system', 'tasks.automated.created')
    expect(mapping.timelineActivityType).toBe('task_created')
    expect(mapping.displayVariant).toBe('task')
  })

  it('keeps CRM timeline adapter backward compatible for assignment rows', () => {
    const item = normalizeActivityToTimelineItem({
      id: '22222222-2222-2222-2222-222222222222',
      household_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      actor_user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      actor_display_name: 'Ada Advisor',
      activity_type: 'assignment_changed',
      title: 'Household assigned',
      body: 'Assigned to advisor',
      metadata: { reason: 'manual' },
      occurred_at: '2026-07-02T12:00:00.000Z',
      created_at: '2026-07-02T12:00:00.000Z',
    })
    expect(item.activityType).toBe('assignment_changed')
    expect(item.displayVariant).toBe('assignment')
    expect(item.metadata?.eventKey).toBe('crm.household.assigned')
    expect(item.metadata?.module).toBe('households')
  })

  it('maps IFD legacy rows to other/system display without visual redesign', () => {
    const item = normalizeActivityToTimelineItem({
      id: '33333333-3333-3333-3333-333333333333',
      household_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      actor_user_id: null,
      actor_display_name: null,
      activity_type: 'assessment_completed',
      title: 'Family Report Card completed',
      body: null,
      metadata: { capture_channel: 'public_self_report' },
      occurred_at: '2026-07-02T12:00:00.000Z',
      created_at: '2026-07-02T12:00:00.000Z',
    })
    expect(item.activityType).toBe('other')
    expect(item.displayVariant).toBe('system')
    expect(item.metadata?.eventKey).toBe('diagnostic.ifd.submitted')
  })
})

describe('Activity Engine labels', () => {
  it('formats known activity types and event keys', () => {
    expect(formatActivityTypeLabel('stage_changed')).toBe('Stage changed')
    expect(
      formatActivityLabel({
        activityType: 'system',
        metadata: { eventKey: 'crm.duplicate.resolved' },
      }),
    ).toBe('Duplicate resolved')
  })
})

describe('Activity Engine record validation + RPC-only browser writes', () => {
  it('rejects invalid household, empty event key, non-RPC events, and mismatched module', () => {
    expect(
      validateRecordActivityInput({
        householdId: 'bad',
        eventKey: 'tasks.manual.created',
        metadata: { taskId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      }).ok,
    ).toBe(false)
    expect(
      validateRecordActivityInput({
        householdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        eventKey: '',
      }).ok,
    ).toBe(false)
    expect(
      validateRecordActivityInput({
        householdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        eventKey: 'notes.added',
        title: 'Note added',
      }),
    ).toEqual({
      ok: false,
      error: 'eventKey is not an approved browser record_crm_activity event',
    })
    expect(
      validateRecordActivityInput({
        householdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        eventKey: 'tasks.manual.created',
        moduleKey: 'credit_repair',
        metadata: { taskId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      }),
    ).toEqual({ ok: false, error: 'moduleKey does not match event catalog module' })
  })

  it('allow-lists publish metadata and accepts caseId only as metadata', () => {
    const metadata = buildActivityMetadata({
      householdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      eventKey: 'tasks.manual.created',
      title: 'Call',
      caseId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      metadata: {
        taskId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        answers: { income: 'secret' },
        consent: { contactPermission: true },
        nested: { bad: true },
        sourceType: 'manual',
      },
    })
    expect(metadata.caseId).toBe('dddddddd-dddd-4ddd-8ddd-dddddddddddd')
    expect(metadata.taskId).toBe('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')
    expect(metadata.sourceType).toBe('manual')
    expect(metadata.answers).toBeUndefined()
    expect(metadata.consent).toBeUndefined()
    expect(metadata.nested).toBeUndefined()
  })

  it('routes onboarding.completed through record_crm_activity RPC (no direct insert)', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      error: null,
    })
    const from = vi.fn()
    const supabase = { rpc, from } as never

    const result = await recordActivity(supabase, {
      householdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      eventKey: 'onboarding.completed',
      title: 'client must not control title',
      body: 'client must not control body',
      activityType: 'task_created',
      visibility: 'client_visible',
      actorKind: 'ai',
      occurredAt: '2020-01-01T00:00:00.000Z',
      assessmentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      opportunityId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      leadId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      metadata: {
        assessmentType: 'household_onboarding',
        idempotencyKey: 'onboarding.completed:cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        rawAnswers: { should: 'strip' },
        actorKind: 'ai',
        visibility: 'client_visible',
        eventKey: 'spoofed',
      },
    })

    expect(result).toEqual({ ok: true, id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' })
    expect(from).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith('record_crm_activity', {
      p_household_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      p_event_key: 'onboarding.completed',
      p_metadata: {
        assessmentType: 'household_onboarding',
        idempotencyKey: 'onboarding.completed:cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
      p_opportunity_id: null,
      p_lead_id: null,
      p_assessment_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    })
  })

  it('rejects non-RPC catalog events and never touches activities.insert', async () => {
    const from = vi.fn()
    const rpc = vi.fn()
    const result = await recordActivity(
      { from, rpc } as never,
      {
        householdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        eventKey: 'notes.added',
        title: 'Note added',
      },
    )
    expect(result).toEqual({
      ok: false,
      error: 'eventKey is not an approved browser record_crm_activity event',
      code: 'validation',
    })
    expect(from).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('recordActivity source has no activities.insert bypass', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const src = readFileSync(resolve(process.cwd(), 'platform/activities/recordActivity.ts'), 'utf8')
    expect(src).not.toMatch(/\.from\(\s*['"]activities['"]\s*\)/)
    expect(src).not.toMatch(/\.insert\s*\(/)
    expect(src).toContain('recordCrmActivityRpc')
  })

  it('recordActivityBestEffort never throws and returns safe failure', async () => {
    const { recordActivityBestEffort } = await import('./recordActivity')
    const supabase = {
      rpc: async () => {
        throw new Error('boom')
      },
      from: vi.fn(),
    } as never
    await expect(
      recordActivityBestEffort(supabase, {
        householdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        eventKey: 'tasks.manual.created',
        metadata: { taskId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      }),
    ).resolves.toMatchObject({
      ok: false,
      code: 'rpc_failed',
      error: 'Unable to record activity',
    })
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('Activity Engine module registry integration', () => {
  it('registers activities as an enabled platform engine without sidebar nav', () => {
    const module = getModule('activities')
    expect(module?.status).toBe('active')
    expect(module?.featureFlag.enabled).toBe(true)
    expect(module?.navigation.visible).toBe(false)
    expect(listEnabledModules().some((item) => item.key === 'activities')).toBe(true)
  })
})
