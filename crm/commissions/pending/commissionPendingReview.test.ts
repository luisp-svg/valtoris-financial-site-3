import { describe, expect, it } from 'vitest'
import {
  PENDING_OVERRIDE_EXCLUSION_COPY,
  buildAcceptPendingRequest,
  buildConfirmPendingDuplicateRequest,
  canConfirmPendingDistinct,
  canConfirmPendingDuplicate,
  canResolvePendingRow,
  isExcludedFromPendingAcceptance,
  pendingApplicationCandidateFilter,
} from './commissionPendingReview'
import type { CommissionPendingRowView } from './commissionPendingView'

function row(over: Partial<CommissionPendingRowView> = {}): CommissionPendingRowView {
  return {
    id: 'r1',
    batch_id: 'b1',
    source_section: 'insurance',
    source_page: 3,
    source_row_ordinal: 1,
    source_row_key: 'a'.repeat(64),
    transaction_fingerprint: 'b'.repeat(64),
    transaction_date: '2026-08-17',
    payment_number: null,
    source_company: 'Symetra',
    source_product: 'Life',
    source_policy_number: 'ST11314961',
    source_writing_associate: 'Jared Writer',
    source_client: 'Client',
    source_agent_entered_premium_cents: null,
    source_company_calculated_premium_cents: 10000,
    source_gross_rate: 115,
    source_factor_rate: 80,
    source_net_rate: 92,
    source_split_rate: 0.75,
    source_type: 'Commission',
    source_transaction_type: null,
    source_income_cents: 335512,
    source_is_negative: false,
    source_is_chargeback_visual: false,
    pending_review_status: 'review_policy_match',
    pending_review_reason: 'policy_not_found',
    resolved_carrier_id: 'c1',
    resolved_application_id: null,
    resolved_allocation_id: null,
    resolved_advisor_id: null,
    reviewed_by_user_id: null,
    reviewed_at: null,
    created_at: '2026-08-17T00:00:00Z',
    ...over,
  }
}

describe('pending Phase B review helpers', () => {
  it('allows Resolve only for policy/advisor/split review rows', () => {
    expect(canResolvePendingRow(row())).toBe(true)
    expect(canResolvePendingRow(row({ pending_review_status: 'review_advisor_match' }))).toBe(true)
    expect(canResolvePendingRow(row({ pending_review_status: 'review_split_attribution' }))).toBe(true)
    expect(canResolvePendingRow(row({ pending_review_status: 'accepted_pending' }))).toBe(false)
    expect(canResolvePendingRow(row({ pending_review_status: 'ignored_nonwriting' }))).toBe(false)
    expect(canResolvePendingRow(row({ pending_review_status: 'ignored_nonpolicy' }))).toBe(false)
    expect(canResolvePendingRow(row({ pending_review_status: 'duplicate' }))).toBe(false)
    expect(canResolvePendingRow(row({ pending_review_status: 'invalid_amount' }))).toBe(false)
    expect(canResolvePendingRow(row({ pending_review_status: 'invalid_source_identity' }))).toBe(false)
    expect(canResolvePendingRow(row({ source_type: 'Override' }))).toBe(false)
  })

  it('allows Confirm Duplicate / Distinct only for duplicate candidates', () => {
    const candidate = row({ pending_review_status: 'review_duplicate_candidate' })
    expect(canConfirmPendingDuplicate(candidate)).toBe(true)
    expect(canConfirmPendingDistinct(candidate)).toBe(true)
    expect(canConfirmPendingDuplicate(row({ pending_review_status: 'duplicate' }))).toBe(false)
    expect(canConfirmPendingDuplicate(row())).toBe(false)
  })

  it('builds accept args without auto-splitting Income or setting event type', () => {
    const built = buildAcceptPendingRequest({
      row: row({ pending_review_status: 'review_split_attribution', source_split_rate: 0.75 }),
      applicationId: 'app-1',
      allocationId: 'alloc-jared',
      allocationApplicationId: 'app-1',
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.args).toEqual({
      p_row_id: 'r1',
      p_action: 'accept',
      p_reason: expect.any(String),
      p_resolved_application_id: 'app-1',
      p_resolved_allocation_id: 'alloc-jared',
    })
    expect(JSON.stringify(built.args)).not.toContain('251634')
    expect(built.args).not.toHaveProperty('p_resolved_event_type')
    expect(built.args).not.toHaveProperty('p_source_income_cents')
  })

  it('rejects Override, additional, ignored, invalid, duplicate, and mismatched allocation', () => {
    expect(
      buildAcceptPendingRequest({
        row: row({ source_type: 'Override' }),
        applicationId: 'app-1',
        allocationId: 'alloc-1',
      }).ok,
    ).toBe(false)
    expect(
      buildAcceptPendingRequest({
        row: row({ source_section: 'additional_commissions' }),
        applicationId: 'app-1',
        allocationId: 'alloc-1',
      }).ok,
    ).toBe(false)
    expect(
      buildAcceptPendingRequest({
        row: row({ pending_review_status: 'ignored_nonwriting' }),
        applicationId: 'app-1',
        allocationId: 'alloc-1',
      }).ok,
    ).toBe(false)
    expect(
      buildAcceptPendingRequest({
        row: row({ pending_review_status: 'invalid_amount' }),
        applicationId: 'app-1',
        allocationId: 'alloc-1',
      }).ok,
    ).toBe(false)
    expect(
      buildAcceptPendingRequest({
        row: row({ pending_review_status: 'duplicate' }),
        applicationId: 'app-1',
        allocationId: 'alloc-1',
      }).ok,
    ).toBe(false)
    expect(
      buildAcceptPendingRequest({
        row: row(),
        applicationId: 'app-1',
        allocationId: 'alloc-2',
        allocationApplicationId: 'app-other',
      }).ok,
    ).toBe(false)
    expect(isExcludedFromPendingAcceptance(row({ source_type: 'Override' }))).toBe(true)
    expect(PENDING_OVERRIDE_EXCLUSION_COPY).toMatch(/Override/)
  })

  it('requires a live allocation for Confirm Distinct and confirms duplicate without one', () => {
    const candidate = row({ pending_review_status: 'review_duplicate_candidate' })
    expect(
      buildAcceptPendingRequest({
        row: candidate,
        applicationId: null,
        allocationId: null,
        distinct: true,
      }).ok,
    ).toBe(false)
    const distinct = buildAcceptPendingRequest({
      row: candidate,
      applicationId: 'app-1',
      allocationId: 'alloc-1',
      allocationApplicationId: 'app-1',
      distinct: true,
    })
    expect(distinct.ok).toBe(true)
    if (distinct.ok) expect(distinct.args.p_action).toBe('confirm_distinct')
    const duplicate = buildConfirmPendingDuplicateRequest({ row: candidate })
    expect(duplicate.ok).toBe(true)
    if (duplicate.ok) {
      expect(duplicate.args.p_action).toBe('confirm_duplicate')
      expect(duplicate.args).not.toHaveProperty('p_resolved_allocation_id')
    }
  })

  it('scopes application candidates by policy/carrier and not the whole book', () => {
    const filter = pendingApplicationCandidateFilter(row())
    expect(filter).toEqual({
      ok: true,
      policyNormalized: 'st11314961',
      carrierId: 'c1',
    })
    expect(pendingApplicationCandidateFilter(row({ source_policy_number: null })).ok).toBe(false)
    expect(pendingApplicationCandidateFilter(row({ source_type: 'Override' })).ok).toBe(false)
  })
})
