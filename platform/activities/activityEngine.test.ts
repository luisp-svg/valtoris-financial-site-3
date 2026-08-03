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

describe('Activity Engine record validation + insert', () => {
  it('rejects invalid household, empty event key, unknown event key, and mismatched module', () => {
    expect(
      validateRecordActivityInput({
        householdId: 'bad',
        eventKey: 'tasks.manual.created',
        title: 'X',
      }).ok,
    ).toBe(false)
    expect(
      validateRecordActivityInput({
        householdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        eventKey: '',
        title: 'X',
      }).ok,
    ).toBe(false)
    expect(
      validateRecordActivityInput({
        householdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        eventKey: 'not.a.real.event',
        title: 'X',
      }),
    ).toEqual({ ok: false, error: 'Unknown eventKey' })
    expect(
      validateRecordActivityInput({
        householdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        eventKey: 'tasks.manual.created',
        moduleKey: 'credit_repair',
        title: 'X',
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

  it('inserts through supabase client with engine metadata only', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' },
      error: null,
    })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const from = vi.fn(() => ({ insert }))
    const supabase = { from } as never

    const result = await recordActivity(supabase, {
      householdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      eventKey: 'onboarding.completed',
      title: 'Household Onboarding completed',
      assessmentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      entityType: 'assessment',
      entityId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      metadata: {
        assessmentType: 'household_onboarding',
        idempotencyKey: 'onboarding.completed:cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        rawAnswers: { should: 'strip' },
      },
    })

    expect(result).toEqual({ ok: true, id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' })
    expect(from).toHaveBeenCalledWith('activities')
    const payload = insert.mock.calls[0]?.[0] as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual(
      [
        'assessment_id',
        'activity_type',
        'body',
        'household_id',
        'lead_id',
        'metadata',
        'opportunity_id',
        'recommendation_id',
        'title',
      ].sort(),
    )
    expect(payload.activity_type).toBe('assessment_completed')
    const meta = payload.metadata as Record<string, unknown>
    expect(meta.eventKey).toBe('onboarding.completed')
    expect(meta.assessmentType).toBe('household_onboarding')
    expect(meta.rawAnswers).toBeUndefined()
  })

  it('recordActivityBestEffort never throws and returns safe failure', async () => {
    const { recordActivityBestEffort } = await import('./recordActivity')
    const supabase = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => {
              throw new Error('boom')
            },
          }),
        }),
      }),
    } as never
    await expect(
      recordActivityBestEffort(supabase, {
        householdId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        eventKey: 'tasks.manual.created',
        title: 'Task',
      }),
    ).resolves.toMatchObject({ ok: false, code: 'unknown' })
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
