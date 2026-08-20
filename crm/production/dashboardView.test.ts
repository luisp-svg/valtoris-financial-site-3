import { describe, expect, it } from 'vitest'
import {
  buildProductionDashboard,
  computeActiveLifeProtection,
  summarizeLifeAndAnnuity,
} from './dashboardView'
import { defaultProductionQueueFilters, filterProductionQueueItems } from './queueView'
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

describe('production dashboard aggregation', () => {
  it('counts current submitted on the pipeline and cumulative Applied on the funnel', () => {
    const model = buildProductionDashboard([
      item({
        id: 'applied',
        production_stage: 'submitted',
        submitted_premium_cents: 428000,
      }),
      item({
        id: 'drafted',
        production_stage: 'premium_drafted',
        submitted_premium_cents: 100000,
      }),
      item({
        id: 'app-draft',
        production_stage: 'draft',
        submitted_premium_cents: 999999,
      }),
    ])
    expect(model.pipeline.submitted.caseCount).toBe(1)
    expect(model.pipeline.submitted.lifePremiumCents).toBe(428000)
    expect(model.pipeline.premium_drafted.caseCount).toBe(1)
    expect(model.pipeline.premium_drafted.lifePremiumCents).toBe(100000)
    expect(model.pipeline.paramed.caseCount).toBe(0)
    expect(model.funnel.all.applied).toBe(2)
    expect(model.funnel.life.applied).toBe(2)
  })

  it('annualizes stored monthly premium using premium_mode and never treats face as premium', () => {
    const rows = [
      item({
        id: 'm1',
        production_stage: 'paramed',
        submitted_premium_cents: 12915,
        premium_mode: 'monthly',
        face_amount_cents: 50000000,
      }),
      item({
        id: 'm2',
        production_stage: 'in_underwriting',
        submitted_premium_cents: 66155,
        premium_mode: 'monthly',
      }),
      item({
        id: 'm3',
        production_stage: 'approved',
        submitted_premium_cents: 24074,
        premium_mode: 'monthly',
      }),
    ]
    const model = buildProductionDashboard(rows)
    expect(model.pipeline.paramed.lifePremiumCents).toBe(154980)
    expect(model.pipeline.in_underwriting.lifePremiumCents).toBe(793860)
    expect(model.pipeline.approved.lifePremiumCents).toBe(288888)
    expect(model.summary.lifePremiumCents).toBe(154980 + 793860 + 288888)
  })

  it('omits unsupported premium modes from life premium totals', () => {
    const model = buildProductionDashboard([
      item({
        id: 'single',
        production_stage: 'submitted',
        submitted_premium_cents: 100000,
        premium_mode: 'single',
      }),
      item({
        id: 'annual',
        production_stage: 'submitted',
        submitted_premium_cents: 50000,
        premium_mode: 'annual',
      }),
    ])
    expect(model.pipeline.submitted.caseCount).toBe(2)
    expect(model.pipeline.submitted.lifePremiumCents).toBe(50000)
    expect(model.pipeline.submitted.unannualizableLifeCount).toBe(1)
    expect(model.summary.unannualizableLifeCount).toBe(1)
  })

  it('keeps paramed separate from in underwriting', () => {
    const model = buildProductionDashboard([
      item({ id: 'p', production_stage: 'paramed', submitted_premium_cents: 50000 }),
      item({
        id: 'uw',
        production_stage: 'in_underwriting',
        submitted_premium_cents: 80000,
      }),
    ])
    expect(model.pipeline.paramed.caseCount).toBe(1)
    expect(model.pipeline.paramed.lifePremiumCents).toBe(50000)
    expect(model.pipeline.in_underwriting.caseCount).toBe(1)
    expect(model.pipeline.in_underwriting.lifePremiumCents).toBe(80000)
  })

  it('separates life premium from FIA deposits and never adds face to premium', () => {
    const rows = [
      item({
        id: 'life',
        production_stage: 'approved',
        product_line: 'life_permanent',
        submitted_premium_cents: 200000,
        annuity_deposit_cents: 99999999,
        face_amount_cents: 500000000,
      }),
      item({
        id: 'fia',
        production_stage: 'approved',
        product_line: 'fia',
        submitted_premium_cents: 888888,
        annuity_deposit_cents: 18072611,
        face_amount_cents: 1,
      }),
    ]
    const model = buildProductionDashboard(rows)
    expect(model.pipeline.approved.caseCount).toBe(2)
    expect(model.pipeline.approved.lifePremiumCents).toBe(200000)
    expect(model.pipeline.approved.annuityDepositCents).toBe(18072611)
    expect(summarizeLifeAndAnnuity(rows)).toEqual({
      lifePremiumCents: 200000,
      annuityDepositCents: 18072611,
      unannualizableLifeCount: 0,
    })
  })

  it('does not change FIA deposit calculations when annualizing life premium', () => {
    const model = buildProductionDashboard([
      item({
        id: 'fia',
        production_stage: 'submitted',
        product_line: 'fia',
        submitted_premium_cents: 100,
        premium_mode: 'monthly',
        annuity_deposit_cents: 2500000,
      }),
    ])
    expect(model.summary.annuityDepositCents).toBe(2500000)
    expect(model.summary.lifePremiumCents).toBe(0)
    expect(model.pipeline.submitted.annuityDepositCents).toBe(2500000)
  })

  it('excludes NULL money from sums and does not treat missing values as stored zeros', () => {
    const model = buildProductionDashboard([
      item({
        id: 'known',
        production_stage: 'submitted',
        submitted_premium_cents: 1000,
      }),
      item({
        id: 'unknown',
        production_stage: 'submitted',
        submitted_premium_cents: null,
      }),
    ])
    expect(model.pipeline.submitted.caseCount).toBe(2)
    expect(model.pipeline.submitted.lifePremiumCents).toBe(1000)
  })

  it('computes Lifetime Active Life Protection from in-force life only', () => {
    const rows = [
      item({
        id: 'in-force-known',
        production_stage: 'in_force',
        product_line: 'life_permanent',
        face_amount_cents: 1247609400,
        in_force_date: '2025-01-01',
      }),
      item({
        id: 'in-force-null',
        production_stage: 'in_force',
        product_line: 'life_term',
        face_amount_cents: null,
      }),
      item({
        id: 'issued-life',
        production_stage: 'issued',
        product_line: 'life_term',
        face_amount_cents: 999999999,
      }),
      item({
        id: 'fia-in-force',
        production_stage: 'in_force',
        product_line: 'fia',
        face_amount_cents: 777777777,
        annuity_deposit_cents: 100,
      }),
    ]
    const protection = computeActiveLifeProtection(rows)
    expect(protection.knownFaceCents).toBe(1247609400)
    expect(protection.unknownFaceCount).toBe(1)
    expect(protection.inForceLifeCount).toBe(2)
    expect(protection.missingInForceDateCount).toBe(1)
  })

  it('scopes Active Life Protection YTD and This Month by in-force date, not submission date', () => {
    const rows = [
      item({
        id: 'placed-jan',
        production_stage: 'in_force',
        submission_date: '2025-12-01',
        in_force_date: '2026-01-20',
        face_amount_cents: 100000,
      }),
      item({
        id: 'placed-aug',
        production_stage: 'in_force',
        submission_date: '2026-01-02',
        in_force_date: '2026-08-02',
        face_amount_cents: 200000,
      }),
      item({
        id: 'null-place',
        production_stage: 'in_force',
        submission_date: '2026-08-02',
        in_force_date: null,
        face_amount_cents: 300000,
      }),
    ]
    const today = '2026-08-16'
    expect(computeActiveLifeProtection(rows, { period: 'lifetime', today }).knownFaceCents).toBe(600000)
    expect(computeActiveLifeProtection(rows, { period: 'ytd', today }).knownFaceCents).toBe(300000)
    expect(computeActiveLifeProtection(rows, { period: 'this_month', today }).knownFaceCents).toBe(200000)
    expect(computeActiveLifeProtection(rows, { period: 'ytd', today }).inForceLifeCount).toBe(2)
    expect(computeActiveLifeProtection(rows, { period: 'ytd', today }).missingInForceDateCount).toBe(1)
  })

  it('scopes pipeline snapshots by submission date for YTD and This Month', () => {
    const rows = [
      item({
        id: 'last-year',
        production_stage: 'approved',
        submission_date: '2025-12-31',
        submitted_premium_cents: 10000,
      }),
      item({
        id: 'ytd',
        production_stage: 'approved',
        submission_date: '2026-01-02',
        submitted_premium_cents: 20000,
      }),
      item({
        id: 'month',
        production_stage: 'in_underwriting',
        submission_date: '2026-08-10',
        submitted_premium_cents: 30000,
      }),
      item({
        id: 'null-date',
        production_stage: 'approved',
        submission_date: null,
        submitted_premium_cents: 40000,
      }),
    ]
    const today = '2026-08-16'
    const lifetime = buildProductionDashboard(rows, { period: 'lifetime', today })
    const ytd = buildProductionDashboard(rows, { period: 'ytd', today })
    const month = buildProductionDashboard(rows, { period: 'this_month', today })
    expect(lifetime.pipeline.approved.caseCount).toBe(2)
    expect(lifetime.pipeline.approved.lifePremiumCents).toBe(30000)
    expect(lifetime.funnel.all.applied).toBe(3)
    expect(ytd.pipeline.approved.caseCount).toBe(1)
    expect(ytd.pipeline.approved.lifePremiumCents).toBe(20000)
    expect(ytd.pipeline.in_underwriting.caseCount).toBe(1)
    expect(ytd.funnel.all.applied).toBe(2)
    expect(month.pipeline.in_underwriting.caseCount).toBe(1)
    expect(month.pipeline.approved.caseCount).toBe(0)
    expect(month.summary.lifePremiumCents).toBe(30000)
    expect(month.funnel.all.applied).toBe(1)
  })

  it('composes operational filters with the reporting period without mutating the queue set', () => {
    const rows = [
      item({
        id: 'tx-month',
        production_stage: 'in_underwriting',
        state: 'TX',
        submission_date: '2026-08-05',
        submitted_premium_cents: 50000,
      }),
      item({
        id: 'tx-old',
        production_stage: 'in_underwriting',
        state: 'TX',
        submission_date: '2025-08-05',
        submitted_premium_cents: 90000,
      }),
      item({
        id: 'fl-month',
        production_stage: 'in_underwriting',
        state: 'FL',
        submission_date: '2026-08-05',
        submitted_premium_cents: 70000,
      }),
    ]
    const filtered = filterProductionQueueItems(rows, {
      ...defaultProductionQueueFilters(),
      writtenState: 'TX',
    })
    const month = buildProductionDashboard(filtered, { period: 'this_month', today: '2026-08-16' })
    expect(filtered.map((row) => row.id).sort()).toEqual(['tx-month', 'tx-old'])
    expect(month.pipeline.in_underwriting.caseCount).toBe(1)
    expect(month.pipeline.in_underwriting.lifePremiumCents).toBe(50000)
  })

  it('puts issued on the current-stage pipeline and still counts it as Applied', () => {
    const model = buildProductionDashboard([
      item({
        id: 'iss',
        production_stage: 'issued',
        submitted_premium_cents: 120000,
      }),
      item({
        id: 'if',
        production_stage: 'in_force',
        submitted_premium_cents: 80000,
        face_amount_cents: 25000000,
        in_force_date: '2026-06-01',
      }),
    ])
    expect(model.pipeline.issued.caseCount).toBe(1)
    expect(model.pipeline.issued.lifePremiumCents).toBe(120000)
    expect(model.funnel.all.applied).toBe(2)
    expect(model.funnel.all.placed).toBe(1)
    expect(model.funnel.all.pending).toBe(1)
    expect(model.protection.inForceLifeCount).toBe(1)
  })
})
