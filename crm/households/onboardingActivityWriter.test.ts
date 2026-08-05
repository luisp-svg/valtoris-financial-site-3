import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { HOUSEHOLD_ONBOARDING_ASSESSMENT_TYPE } from './onboardingApi'

const ONBOARDING_API = readFileSync(
  resolve(process.cwd(), 'crm/households/onboardingApi.ts'),
  'utf8',
)

describe('onboarding.completed Activity writer (Migration 029 RPC)', () => {
  it('uses recordActivityBestEffort with onboarding.completed and no direct activities insert', () => {
    expect(ONBOARDING_API).toContain("eventKey: 'onboarding.completed'")
    expect(ONBOARDING_API).toContain('recordActivityBestEffort')
    expect(ONBOARDING_API).not.toMatch(/\.from\(\s*['"]activities['"]\s*\)/)
    expect(ONBOARDING_API).not.toMatch(/title:\s*'Household Onboarding completed'/)
    expect(ONBOARDING_API).not.toMatch(/\bactorKind\s*:/)
    expect(ONBOARDING_API).not.toMatch(/\boccurredAt\s*:/)
    expect(ONBOARDING_API).not.toMatch(/\bvisibility\s*:/)
    expect(ONBOARDING_API).not.toMatch(/\bopportunityId\s*:/)
    expect(ONBOARDING_API).not.toMatch(/\bleadId\s*:/)
  })

  it('publishes assessmentType + assessment id via RPC after completion', async () => {
    vi.resetModules()
    const rpc = vi.fn().mockResolvedValue({
      data: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      error: null,
    })
    const completedAt = '2026-07-04T15:30:00.000Z'
    const from = vi.fn((table: string) => {
      if (table !== 'assessments') throw new Error(`unexpected from(${table})`)
      const chain: Record<string, unknown> = {}
      const self = () => chain
      for (const method of ['update', 'select', 'eq', 'is']) {
        chain[method] = vi.fn(self)
      }
      chain.maybeSingle = async () => ({
        data: {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          household_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          assessment_type: HOUSEHOLD_ONBOARDING_ASSESSMENT_TYPE,
          status: 'completed',
          completed_at: completedAt,
          answers: {},
          derived_metrics: {},
          created_at: '2026-07-01T10:00:00.000Z',
          updated_at: completedAt,
          deleted_at: null,
        },
        error: null,
      })
      return chain
    })

    const { completeHouseholdOnboardingDraft } = await import('./onboardingApi')
    const result = await completeHouseholdOnboardingDraft(
      { from, rpc } as never,
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      { completedAt: new Date(completedAt) },
    )

    expect(result.status).toBe('completed')
    expect(from).not.toHaveBeenCalledWith('activities')
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

  it('keeps onboarding completion successful when activity RPC fails safely', async () => {
    vi.resetModules()
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'CRM029:not_authorized', hint: 'service_role=xyz' },
    })
    const completedAt = '2026-07-04T15:30:00.000Z'
    const from = vi.fn(() => {
      const chain: Record<string, unknown> = {}
      const self = () => chain
      for (const method of ['update', 'select', 'eq', 'is']) {
        chain[method] = vi.fn(self)
      }
      chain.maybeSingle = async () => ({
        data: {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          household_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          assessment_type: HOUSEHOLD_ONBOARDING_ASSESSMENT_TYPE,
          status: 'completed',
          completed_at: completedAt,
          answers: {},
          derived_metrics: {},
          created_at: '2026-07-01T10:00:00.000Z',
          updated_at: completedAt,
          deleted_at: null,
        },
        error: null,
      })
      return chain
    })

    const { completeHouseholdOnboardingDraft } = await import('./onboardingApi')
    await expect(
      completeHouseholdOnboardingDraft(
        { from, rpc } as never,
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        { completedAt: new Date(completedAt) },
      ),
    ).resolves.toMatchObject({ status: 'completed' })
  })
})
