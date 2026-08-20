import { describe, expect, it } from 'vitest'
import {
  applicationsInSubmittedCohort,
  computeProductionFunnel,
  formatPlacementRate,
  isLegitimateSubmittedApplication,
  pipelineStageLabel,
  placementRatesFromCounts,
} from './productionMetrics'
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
    application_number: null,
    policy_number: null,
    underwriting_disposition: 'pending',
    delivery_status: 'pre_issue',
    submission_date: '2026-06-15',
    next_follow_up_date: null,
    submitted_premium_cents: null,
    annuity_deposit_cents: null,
    face_amount_cents: null,
    premium_mode: 'annual',
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

describe('cumulative Applied', () => {
  const laterStages = [
    'submitted',
    'paramed',
    'in_underwriting',
    'approved',
    'sent_to_draft',
    'premium_drafted',
    'issued',
    'in_force',
    'declined',
    'postponed',
    'withdrawn',
    'incomplete',
    'not_taken',
  ] as const

  it.each(laterStages)('counts %s as Applied', (stage) => {
    expect(isLegitimateSubmittedApplication(item({ id: stage, production_stage: stage }))).toBe(true)
  })

  it('excludes draft, pre_submitted, deleted, and missing submission_date', () => {
    expect(
      isLegitimateSubmittedApplication(item({ id: 'draft', production_stage: 'draft' })),
    ).toBe(false)
    expect(
      isLegitimateSubmittedApplication(
        item({ id: 'pre', production_stage: 'pre_submitted' }),
      ),
    ).toBe(false)
    expect(
      isLegitimateSubmittedApplication(
        item({ id: 'deleted', production_stage: 'submitted', deleted_at: '2026-08-01T00:00:00.000Z' }),
      ),
    ).toBe(false)
    expect(
      isLegitimateSubmittedApplication(
        item({ id: 'no-date', production_stage: 'in_force', submission_date: null }),
      ),
    ).toBe(false)
  })

  it('keeps UW, approved, issued, in_force, declined, withdrawn, and not_taken in the Applied cohort', () => {
    const rows = [
      item({ id: 'uw', production_stage: 'in_underwriting' }),
      item({ id: 'appr', production_stage: 'approved' }),
      item({ id: 'iss', production_stage: 'issued' }),
      item({ id: 'if', production_stage: 'in_force' }),
      item({ id: 'dec', production_stage: 'declined' }),
      item({ id: 'wd', production_stage: 'withdrawn' }),
      item({ id: 'nt', production_stage: 'not_taken' }),
      item({ id: 'draft', production_stage: 'draft' }),
    ]
    const cohort = applicationsInSubmittedCohort(rows, 'lifetime', '2026-08-20')
    expect(cohort.map((row) => row.id).sort()).toEqual(
      ['appr', 'dec', 'if', 'iss', 'nt', 'uw', 'wd'].sort(),
    )
    expect(computeProductionFunnel(cohort).all.applied).toBe(7)
  })
})

describe('placement formulas', () => {
  it('computes gross placed/applied and resolved excluding pending and postponed', () => {
    const cohort = [
      item({ id: 'p1', production_stage: 'in_force' }),
      item({ id: 'p2', production_stage: 'in_force' }),
      item({ id: 'd1', production_stage: 'declined' }),
      item({ id: 'w1', production_stage: 'withdrawn' }),
      item({ id: 'n1', production_stage: 'not_taken' }),
      item({ id: 'i1', production_stage: 'incomplete' }),
      item({ id: 'u1', production_stage: 'in_underwriting' }),
      item({ id: 'po1', production_stage: 'postponed' }),
    ]
    const funnel = computeProductionFunnel(cohort).life
    expect(funnel.applied).toBe(8)
    expect(funnel.placed).toBe(2)
    expect(funnel.declined).toBe(1)
    expect(funnel.withdrawn).toBe(1)
    expect(funnel.notTaken).toBe(1)
    expect(funnel.incomplete).toBe(1)
    expect(funnel.pending).toBe(2)
    expect(funnel.postponed).toBe(1)
    expect(funnel.grossPlacementRate).toBe(2 / 8)
    expect(funnel.resolvedPlacementRate).toBe(2 / 6)
  })

  it('keeps postponed in pending and out of the resolved denominator', () => {
    const funnel = computeProductionFunnel([
      item({ id: 'po', production_stage: 'postponed' }),
      item({ id: 'if', production_stage: 'in_force' }),
    ]).all
    expect(funnel.pending).toBe(1)
    expect(funnel.postponed).toBe(1)
    expect(funnel.resolvedPlacementRate).toBe(1)
  })

  it('returns N/A when the resolved denominator is 0', () => {
    const rates = placementRatesFromCounts({
      applied: 3,
      placed: 0,
      declined: 0,
      notTaken: 0,
      withdrawn: 0,
      incomplete: 0,
      postponed: 1,
      pending: 3,
    })
    expect(rates.grossPlacementRate).toBe(0)
    expect(rates.resolvedPlacementRate).toBeNull()
    expect(formatPlacementRate(rates.resolvedPlacementRate)).toBe('N/A')
    expect(formatPlacementRate(placementRatesFromCounts({
      applied: 0,
      placed: 0,
      declined: 0,
      notTaken: 0,
      withdrawn: 0,
      incomplete: 0,
      postponed: 0,
      pending: 0,
    }).grossPlacementRate)).toBe('N/A')
  })
})

describe('period cohort vs protection date', () => {
  it('scopes the submitted cohort by submission_date', () => {
    const rows = [
      item({ id: 'old', production_stage: 'in_force', submission_date: '2025-12-01' }),
      item({ id: 'ytd', production_stage: 'issued', submission_date: '2026-03-01' }),
      item({ id: 'month', production_stage: 'approved', submission_date: '2026-08-05' }),
      item({ id: 'null', production_stage: 'in_force', submission_date: null }),
    ]
    const today = '2026-08-20'
    expect(applicationsInSubmittedCohort(rows, 'lifetime', today).map((r) => r.id).sort()).toEqual(
      ['month', 'old', 'ytd'],
    )
    expect(applicationsInSubmittedCohort(rows, 'ytd', today).map((r) => r.id).sort()).toEqual(
      ['month', 'ytd'],
    )
    expect(applicationsInSubmittedCohort(rows, 'this_month', today).map((r) => r.id)).toEqual([
      'month',
    ])
  })
})

describe('pipeline labels and Life/FIA split', () => {
  it('labels current submitted as Submitted, not Applied, and includes issued', () => {
    expect(pipelineStageLabel('submitted')).toBe('Submitted')
    expect(pipelineStageLabel('issued')).toBe('Issued / Awaiting Placement')
    expect(pipelineStageLabel('paramed')).toBe('Paramed / Requirements')
    expect(pipelineStageLabel('premium_drafted')).toBe('Premium Drafted')
  })

  it('does not treat FIA deposits as life cases in the funnel', () => {
    const funnel = computeProductionFunnel([
      item({
        id: 'life',
        production_stage: 'in_force',
        product_line: 'life_term',
        face_amount_cents: 50000000,
      }),
      item({
        id: 'fia',
        production_stage: 'issued',
        product_line: 'fia',
        annuity_deposit_cents: 9321504,
        face_amount_cents: 1,
      }),
    ])
    expect(funnel.life.applied).toBe(1)
    expect(funnel.life.placed).toBe(1)
    expect(funnel.fia.applied).toBe(1)
    expect(funnel.fia.placed).toBe(0)
    expect(funnel.fia.pending).toBe(1)
    expect(funnel.all.applied).toBe(2)
  })
})
