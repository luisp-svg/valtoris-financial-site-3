import { describe, expect, it } from 'vitest'
import {
  applyCaseWorkspaceView,
  CASE_APPROVED_CLIENT_STAGES,
  CASE_RECENTLY_UPDATED_DAYS,
  CASE_UNDERWRITING_STAGES,
  caseAttentionFlags,
  caseHasOverdueRequirement,
  caseNeedsAttention,
  caseOperationalBucket,
  casePipelineStagesMatchDashboard,
  countOpenPolicyCases,
  formatCaseAmount,
  formatCaseAttentionLabels,
  formatCaseDeliveryBucketLabel,
  formatCaseProductLineLabel,
  formatCaseStageLabel,
  isCaseDeliveryFundingStage,
  isClosedPolicyCase,
  isOpenPolicyCase,
} from './caseWorkspace'
import { DASHBOARD_PIPELINE_STAGES, pipelineStageLabel } from './productionMetrics'
import { PRODUCTION_TERMINAL_STAGES } from './types'
import type { ProductionApplicationListItem } from './types'

function item(
  partial: Partial<ProductionApplicationListItem> &
    Pick<ProductionApplicationListItem, 'id' | 'production_stage'>,
): ProductionApplicationListItem {
  return {
    household_id: 'hh1',
    carrier_id: 'c1',
    product_id: 'p1',
    product_line: 'life_term',
    state: 'TX',
    application_number: 'A-1',
    policy_number: null,
    underwriting_disposition: 'pending',
    delivery_status: 'pre_issue',
    submission_date: '2026-06-15',
    next_follow_up_date: null,
    submitted_premium_cents: 10000,
    annuity_deposit_cents: null,
    face_amount_cents: 25000000,
    premium_mode: 'monthly',
    issue_date: null,
    in_force_date: null,
    updated_at: '2026-08-01T00:00:00.000Z',
    deleted_at: null,
    household: { id: 'hh1', display_name: 'Rivera Household' },
    carrier: { id: 'c1', name: 'Acme Life', code: 'ACME' },
    product: { id: 'p1', name: 'Term 20', product_line: 'life_term' },
    participants: [],
    allocations: [],
    stage_history: [],
    linked_policies: [],
    expected_compensations: [],
    writing_receivable_expected: true,
    ...partial,
  }
}

const OPEN_STAGES = [
  'submitted',
  'paramed',
  'in_underwriting',
  'postponed',
  'approved',
  'sent_to_draft',
  'premium_drafted',
  'issued',
] as const

describe('open vs closed policy cases', () => {
  it.each(OPEN_STAGES)('treats %s as an open case', (stage) => {
    expect(isOpenPolicyCase(item({ id: stage, production_stage: stage }))).toBe(true)
    expect(isClosedPolicyCase(item({ id: stage, production_stage: stage }))).toBe(false)
  })

  it.each(PRODUCTION_TERMINAL_STAGES)('treats %s as a closed case', (stage) => {
    expect(isOpenPolicyCase(item({ id: stage, production_stage: stage }))).toBe(false)
    expect(isClosedPolicyCase(item({ id: stage, production_stage: stage }))).toBe(true)
  })

  it('does not treat draft or pre_submitted as a legitimate active case', () => {
    expect(isOpenPolicyCase(item({ id: 'draft', production_stage: 'draft' }))).toBe(false)
    expect(isClosedPolicyCase(item({ id: 'draft', production_stage: 'draft' }))).toBe(false)
    expect(
      isOpenPolicyCase(item({ id: 'pre', production_stage: 'pre_submitted' })),
    ).toBe(false)
    expect(
      isClosedPolicyCase(item({ id: 'pre', production_stage: 'pre_submitted' })),
    ).toBe(false)
  })

  it('excludes missing submission_date and deleted rows from open and closed cases', () => {
    expect(
      isOpenPolicyCase(item({ id: 'nosub', production_stage: 'submitted', submission_date: null })),
    ).toBe(false)
    expect(
      isOpenPolicyCase(
        item({ id: 'del', production_stage: 'submitted', deleted_at: '2026-08-01T00:00:00.000Z' }),
      ),
    ).toBe(false)
  })

  it('counts open cases with the same helper used by the household workspace', () => {
    const rows = [
      item({ id: 'open', production_stage: 'issued' }),
      item({ id: 'closed', production_stage: 'in_force' }),
      item({ id: 'draft', production_stage: 'draft' }),
      item({ id: 'post', production_stage: 'postponed' }),
    ]
    expect(countOpenPolicyCases(rows)).toBe(2)
  })
})

describe('needs attention', () => {
  const now = new Date('2026-08-20T15:00:00.000Z')

  it('flags overdue follow-up', () => {
    const overdue = item({
      id: 'overdue',
      production_stage: 'in_underwriting',
      next_follow_up_date: '2026-08-19',
    })
    expect(caseNeedsAttention(overdue, now)).toBe(true)
    expect(caseAttentionFlags(overdue, now).overdueFollowUp).toBe(true)
  })

  it('flags stale-in-stage using the existing 14-day helper', () => {
    const stale = item({
      id: 'stale',
      production_stage: 'paramed',
      updated_at: '2026-08-01T00:00:00.000Z',
    })
    expect(caseNeedsAttention(stale, now)).toBe(true)
    expect(caseAttentionFlags(stale, now).staleInStage).toBe(true)
  })

  it('flags issued with incomplete delivery', () => {
    const issued = item({
      id: 'iss',
      production_stage: 'issued',
      delivery_status: 'with_client',
      updated_at: '2026-08-18T00:00:00.000Z',
    })
    expect(caseNeedsAttention(issued, now)).toBe(true)
    expect(caseAttentionFlags(issued, now).issuedDeliveryIncomplete).toBe(true)
  })

  it('does not treat follow-up due today as overdue', () => {
    const dueToday = item({
      id: 'today',
      production_stage: 'approved',
      next_follow_up_date: '2026-08-20',
      updated_at: '2026-08-18T00:00:00.000Z',
    })
    expect(caseNeedsAttention(dueToday, now)).toBe(false)
    expect(caseAttentionFlags(dueToday, now).overdueFollowUp).toBe(false)
  })

  it('does not flag a current open case', () => {
    const current = item({
      id: 'ok',
      production_stage: 'approved',
      delivery_status: 'not_started',
      next_follow_up_date: '2026-08-21',
      updated_at: '2026-08-18T00:00:00.000Z',
    })
    expect(caseNeedsAttention(current, now)).toBe(false)
    expect(caseAttentionFlags(current, now)).toEqual({
      overdueFollowUp: false,
      staleInStage: false,
      issuedDeliveryIncomplete: false,
      overdueRequirementCount: 0,
    })
  })

  it('does not flag in_force for delivery incomplete', () => {
    const placed = item({
      id: 'if',
      production_stage: 'in_force',
      delivery_status: 'with_client',
      next_follow_up_date: '2026-08-01',
    })
    expect(caseNeedsAttention(placed, now)).toBe(false)
  })

  it('flags an open Case with an overdue persisted requirement', () => {
    const overdueReq = item({
      id: 'req',
      production_stage: 'submitted',
      updated_at: '2026-08-18T00:00:00.000Z',
      overdue_requirement_count: 1,
    })
    expect(caseNeedsAttention(overdueReq, now)).toBe(true)
    expect(caseHasOverdueRequirement(overdueReq)).toBe(true)
    expect(caseAttentionFlags(overdueReq, now).overdueRequirementCount).toBe(1)
    expect(applyCaseWorkspaceView([overdueReq], 'needs_attention', now).map((row) => row.id)).toEqual(
      ['req'],
    )
    expect(formatCaseAttentionLabels(caseAttentionFlags(overdueReq, now), 'life_term')).toEqual([
      'Overdue requirement',
    ])
  })

  it('does not let a closed Case enter Needs Attention from an overdue requirement', () => {
    const closed = item({
      id: 'closed',
      production_stage: 'withdrawn',
      overdue_requirement_count: 2,
      next_follow_up_date: '2026-08-01',
    })
    expect(caseHasOverdueRequirement(closed)).toBe(false)
    expect(caseNeedsAttention(closed, now)).toBe(false)
    expect(applyCaseWorkspaceView([closed], 'needs_attention', now)).toEqual([])
    expect(applyCaseWorkspaceView([closed], 'open', now)).toEqual([])
  })

  it('keeps existing Needs Attention signals and adds overdue requirement as another concise flag', () => {
    const followUpAndReq = item({
      id: 'both',
      production_stage: 'in_underwriting',
      next_follow_up_date: '2026-08-19',
      updated_at: '2026-08-18T00:00:00.000Z',
      overdue_requirement_count: 2,
    })
    expect(caseNeedsAttention(followUpAndReq, now)).toBe(true)
    expect(formatCaseAttentionLabels(caseAttentionFlags(followUpAndReq, now), 'life_term')).toEqual([
      'Overdue follow-up',
      '2 overdue requirements',
    ])

    const staleAndReq = item({
      id: 'stale-req',
      production_stage: 'paramed',
      updated_at: '2026-08-01T00:00:00.000Z',
      overdue_requirement_count: 1,
    })
    expect(caseNeedsAttention(staleAndReq, now)).toBe(true)
    expect(formatCaseAttentionLabels(caseAttentionFlags(staleAndReq, now), 'life_term')).toEqual([
      'Stale in stage',
      'Overdue requirement',
    ])
  })
})

describe('case workspace views', () => {
  const now = new Date('2026-08-20T12:00:00.000Z')

  it('keeps issued visible in open and delivery/funding views', () => {
    const issued = item({
      id: 'iss',
      production_stage: 'issued',
      delivery_status: 'with_agent',
      updated_at: '2026-08-19T00:00:00.000Z',
    })
    expect(applyCaseWorkspaceView([issued], 'open', now).map((row) => row.id)).toEqual(['iss'])
    expect(applyCaseWorkspaceView([issued], 'delivery_funding', now).map((row) => row.id)).toEqual([
      'iss',
    ])
  })

  it('keeps FIA issued in delivery/funding until in_force even when delivery is complete', () => {
    const fiaIssued = item({
      id: 'fia',
      production_stage: 'issued',
      product_line: 'fia',
      delivery_status: 'complete',
      annuity_deposit_cents: 100000,
      submitted_premium_cents: null,
    })
    expect(isCaseDeliveryFundingStage(fiaIssued)).toBe(true)
    expect(applyCaseWorkspaceView([fiaIssued], 'delivery_funding', now)).toHaveLength(1)
  })

  it('drops life issued from delivery/funding when delivery is complete or not required', () => {
    const complete = item({
      id: 'done',
      production_stage: 'issued',
      delivery_status: 'complete',
    })
    const skipped = item({
      id: 'skip',
      production_stage: 'issued',
      delivery_status: 'not_required',
    })
    expect(applyCaseWorkspaceView([complete, skipped], 'delivery_funding', now)).toEqual([])
    expect(applyCaseWorkspaceView([complete], 'open', now)).toHaveLength(1)
  })

  it('places postponed in underwriting and approved/client stages in their bucket', () => {
    const postponed = item({ id: 'p', production_stage: 'postponed' })
    const drafted = item({ id: 'd', production_stage: 'premium_drafted' })
    expect(applyCaseWorkspaceView([postponed], 'underwriting', now)).toHaveLength(1)
    expect(applyCaseWorkspaceView([drafted], 'approved_client', now)).toHaveLength(1)
    expect(caseOperationalBucket(postponed)).toBe('underwriting')
    expect(caseOperationalBucket(drafted)).toBe('approved_client')
  })

  it('uses a 7-day recently-updated window on updated_at and stage history', () => {
    expect(CASE_RECENTLY_UPDATED_DAYS).toBe(7)
    const recent = item({
      id: 'recent',
      production_stage: 'in_force',
      updated_at: '2026-08-14T00:00:00.000Z',
    })
    const stale = item({
      id: 'old',
      production_stage: 'submitted',
      updated_at: '2026-08-01T00:00:00.000Z',
    })
    const viaHistory = item({
      id: 'hist',
      production_stage: 'approved',
      updated_at: '2026-07-01T00:00:00.000Z',
      stage_history: [
        {
          id: 'h1',
          from_stage: 'in_underwriting',
          to_stage: 'approved',
          from_disposition: null,
          to_disposition: null,
          from_delivery_status: null,
          to_delivery_status: null,
          reason: null,
          changed_by_user_id: null,
          changed_at: '2026-08-18T00:00:00.000Z',
        },
      ],
    })
    expect(applyCaseWorkspaceView([recent, stale, viaHistory], 'recently_updated', now).map((row) => row.id)).toEqual(
      ['recent', 'hist'],
    )
  })
})

describe('pipeline and Life/FIA presentation', () => {
  it('keeps Case pipeline stages identical to Current Case Pipeline', () => {
    expect(casePipelineStagesMatchDashboard()).toEqual([...DASHBOARD_PIPELINE_STAGES])
    expect(CASE_UNDERWRITING_STAGES).toContain('postponed')
    expect(CASE_APPROVED_CLIENT_STAGES).toEqual(['approved', 'sent_to_draft', 'premium_drafted'])
    expect(formatCaseStageLabel('submitted')).toBe(pipelineStageLabel('submitted'))
    expect(formatCaseStageLabel('submitted')).toBe('Submitted')
    expect(formatCaseStageLabel('issued')).toBe('Issued / Awaiting Placement')
  })

  it('formats Term / Permanent / Annuity FIA amounts without commission values', () => {
    expect(formatCaseProductLineLabel('life_term')).toBe('Term')
    expect(formatCaseProductLineLabel('life_permanent')).toBe('Permanent')
    expect(formatCaseProductLineLabel('fia')).toBe('Annuity / FIA')
    expect(formatCaseDeliveryBucketLabel('life_term')).toBe('Delivery')
    expect(formatCaseDeliveryBucketLabel('fia')).toBe('Funding / Issue')
    const life = formatCaseAmount(
      item({
        id: 'life',
        production_stage: 'submitted',
        submitted_premium_cents: 10000,
        premium_mode: 'monthly',
        face_amount_cents: 25000000,
      }),
    )
    expect(life).toContain('Annual premium')
    expect(life).toContain('Face')
    expect(life).not.toMatch(/expected|commission/i)
    const fia = formatCaseAmount(
      item({
        id: 'fia',
        production_stage: 'issued',
        product_line: 'fia',
        annuity_deposit_cents: 9321504,
        submitted_premium_cents: null,
      }),
    )
    expect(fia).toContain('Deposit')
    expect(fia).not.toMatch(/expected|commission/i)
  })
})
