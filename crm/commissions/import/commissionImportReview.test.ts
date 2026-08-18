import { describe, expect, it } from 'vitest'
import { formatCommissionImportUserError } from './commissionImportErrors'
import type { CommissionImportRowView } from './commissionImportView'
import {
  OVERRIDE_EXCLUSION_COPY,
  ADDITIONAL_COMMISSION_EXCLUSION_COPY,
  buildConfirmDuplicateRequest,
  buildPostImportRowRequest,
  buildReadyReviewRequest,
  canConfirmDistinct,
  canConfirmDuplicate,
  canPostImportRow,
  canReviewImportRow,
  eventTypeAllowedForIncome,
  eventTypeSignError,
  importApplicationCandidateFilter,
  isExcludedFromWritingCompensation,
  isLiveWritingAllocation,
  normalizeImportPolicyNumber,
  peersInCurrentBatch,
  resultingSignedAmountCents,
} from './commissionImportReview'

function row(over: Partial<CommissionImportRowView> = {}): CommissionImportRowView {
  return {
    id: 'r1',
    batch_id: 'b1',
    source_section: 'insurance',
    source_page: 3,
    source_row_ordinal: 1,
    source_row_key: 'a'.repeat(64),
    transaction_fingerprint: 'b'.repeat(64),
    transaction_date: '2026-08-05',
    payment_number: null,
    source_company: 'NLG',
    source_product: 'FlexLife',
    source_policy_number: 'L2194109',
    source_writing_associate: 'Luis & Jazmin Perez',
    source_client: 'Sarah',
    agent_entered_premium_cents: null,
    company_calculated_premium_cents: 10083,
    source_gross_rate: 115,
    source_factor_rate: 80,
    source_net_rate: 92,
    source_split_rate: null,
    source_type: 'Commission',
    source_transaction_type: '100% Advance',
    source_income_cents: 267,
    source_is_chargeback_visual: false,
    review_status: 'review_policy_match',
    review_reason: 'policy_not_found',
    resolved_carrier_id: 'c1',
    resolved_application_id: null,
    resolved_allocation_id: null,
    resolved_advisor_id: null,
    resolved_event_type: null,
    posted_commission_event_id: null,
    created_at: '2026-08-17T00:00:00Z',
    ...over,
  }
}

describe('commission Phase 3B review safety', () => {
  it('resolves policy rows only with a constrained policy-number filter', () => {
    const filter = importApplicationCandidateFilter(row())
    expect(filter.ok).toBe(true)
    if (!filter.ok) return
    expect(filter.policyNormalized).toBe(normalizeImportPolicyNumber('L2194109'))
    expect(filter.carrierId).toBe('c1')
    expect(importApplicationCandidateFilter(row({ source_policy_number: null })).ok).toBe(false)
    expect(importApplicationCandidateFilter(row({ source_type: 'Override' })).ok).toBe(false)
  })

  it('requires live writing allocations on the selected application', () => {
    expect(
      isLiveWritingAllocation({
        allocation_role: 'writing',
        recipient_type: 'advisor',
        effective_to: null,
        advisor_id: 'adv-a',
      }),
    ).toBe(true)
    expect(
      isLiveWritingAllocation({
        allocation_role: 'house',
        recipient_type: 'advisor',
        effective_to: null,
        advisor_id: 'adv-a',
      }),
    ).toBe(false)
    expect(
      isLiveWritingAllocation({
        allocation_role: 'writing',
        recipient_type: 'advisor',
        effective_to: '2026-01-01',
        advisor_id: 'adv-a',
      }),
    ).toBe(false)
  })

  it('keeps split writer A and writer B isolated and sends application+allocation+event together', () => {
    const split = row({
      review_status: 'review_split_attribution',
      resolved_application_id: 'app-1',
    })
    const writerA = buildReadyReviewRequest({
      row: split,
      applicationId: 'app-1',
      allocationId: 'alloc-jared',
      allocationApplicationId: 'app-1',
      eventType: 'paid',
    })
    const writerB = buildReadyReviewRequest({
      row: split,
      applicationId: 'app-1',
      allocationId: 'alloc-jazmin',
      allocationApplicationId: 'app-1',
      eventType: 'paid',
    })
    expect(writerA.ok).toBe(true)
    expect(writerB.ok).toBe(true)
    if (!writerA.ok || !writerB.ok) return
    expect(writerA.args.p_resolved_allocation_id).toBe('alloc-jared')
    expect(writerB.args.p_resolved_allocation_id).toBe('alloc-jazmin')
    expect(writerA.args.p_resolved_application_id).toBe('app-1')
    expect(writerA.args.p_resolved_event_type).toBe('paid')
    expect(writerA.args.p_review_status).toBe('ready_to_post')
    expect(
      buildReadyReviewRequest({
        row: split,
        applicationId: 'app-1',
        allocationId: 'alloc-other',
        allocationApplicationId: 'app-2',
        eventType: 'paid',
      }).ok,
    ).toBe(false)
    expect(
      buildReadyReviewRequest({
        row: split,
        applicationId: 'app-1',
        allocationId: null,
        eventType: 'paid',
      }).ok,
    ).toBe(false)
  })

  it('validates event-type signs and keeps source Income immutable', () => {
    expect(eventTypeAllowedForIncome('paid', 267)).toBe(true)
    expect(eventTypeAllowedForIncome('recovery', 100)).toBe(true)
    expect(eventTypeAllowedForIncome('chargeback', -390)).toBe(true)
    expect(eventTypeAllowedForIncome('adjustment', 50)).toBe(true)
    expect(eventTypeAllowedForIncome('adjustment', -50)).toBe(true)
    expect(eventTypeAllowedForIncome('paid', 0)).toBe(false)
    expect(eventTypeAllowedForIncome('paid', -10)).toBe(false)
    expect(eventTypeAllowedForIncome('chargeback', 10)).toBe(false)
    expect(eventTypeAllowedForIncome('recovery', -10)).toBe(false)
    expect(eventTypeAllowedForIncome('adjustment', 0)).toBe(false)
    expect(eventTypeSignError('reversal', 267)).toMatch(/not an imported transaction type/i)
    expect(eventTypeSignError('paid', -10)).toMatch(/positive/i)
    const ready = row({ review_status: 'review_transaction_type', source_income_cents: -390 })
    expect(
      buildReadyReviewRequest({
        row: ready,
        applicationId: 'app-1',
        allocationId: 'alloc-1',
        allocationApplicationId: 'app-1',
        eventType: 'paid',
      }).ok,
    ).toBe(false)
    expect(
      buildReadyReviewRequest({
        row: ready,
        applicationId: 'app-1',
        allocationId: 'alloc-1',
        allocationApplicationId: 'app-1',
        eventType: 'chargeback',
      }).ok,
    ).toBe(true)
    expect(resultingSignedAmountCents(ready)).toBe(-390)
  })

  it('never constructs an Override ready_to_post request', () => {
    const override = row({
      source_type: 'Override',
      review_status: 'review_split_attribution',
      resolved_application_id: 'app-1',
      resolved_allocation_id: 'alloc-1',
      resolved_event_type: 'paid',
    })
    expect(isExcludedFromWritingCompensation(override)).toBe(true)
    expect(canReviewImportRow(override)).toBe(false)
    expect(canConfirmDuplicate(override)).toBe(false)
    expect(canConfirmDistinct(override)).toBe(false)
    expect(canPostImportRow(override)).toBe(false)
    const built = buildReadyReviewRequest({
      row: override,
      applicationId: 'app-1',
      allocationId: 'alloc-1',
      allocationApplicationId: 'app-1',
      eventType: 'paid',
      distinct: true,
    })
    expect(built.ok).toBe(false)
    if (built.ok) return
    expect(built.message).toBe(OVERRIDE_EXCLUSION_COPY)
    expect(JSON.stringify(built)).not.toContain('ready_to_post')
    expect(
      canPostImportRow(
        row({
          source_type: 'Override',
          review_status: 'ready_to_post',
          resolved_application_id: 'app-1',
          resolved_allocation_id: 'alloc-1',
          resolved_event_type: 'paid',
        }),
      ),
    ).toBe(false)
  })

  it('never promotes additional commissions or ignored non-policy rows', () => {
    const additional = row({
      source_section: 'additional_commissions',
      review_status: 'ignored_nonpolicy',
      resolved_event_type: 'paid',
    })
    const ignoredPolicy = row({
      review_status: 'ignored_nonpolicy',
      source_section: 'additional_commissions',
    })
    expect(isExcludedFromWritingCompensation(additional)).toBe(true)
    expect(canReviewImportRow(additional)).toBe(false)
    expect(canPostImportRow(additional)).toBe(false)
    expect(buildReadyReviewRequest({
      row: additional,
      applicationId: 'app-1',
      allocationId: 'alloc-1',
      eventType: 'paid',
    }).ok).toBe(false)
    expect(buildPostImportRowRequest({ row: additional, reason: 'post' }).ok).toBe(false)
    expect(isExcludedFromWritingCompensation(ignoredPolicy)).toBe(true)
    expect(ADDITIONAL_COMMISSION_EXCLUSION_COPY).toMatch(/non-policy/)
  })

  it('does not treat resolved_event_type alone as Ready and requires full Confirm Distinct', () => {
    const candidate = row({
      review_status: 'review_duplicate_candidate',
      resolved_event_type: 'paid',
      resolved_application_id: 'app-1',
      resolved_allocation_id: 'alloc-1',
    })
    expect(canPostImportRow(candidate)).toBe(false)
    expect(canConfirmDuplicate(candidate)).toBe(true)
    expect(canConfirmDistinct(candidate)).toBe(true)
    const duplicate = buildConfirmDuplicateRequest({ row: candidate })
    expect(duplicate.ok).toBe(true)
    if (duplicate.ok) {
      expect(duplicate.args.p_review_status).toBe('duplicate')
      expect(duplicate.args).not.toHaveProperty('p_resolved_allocation_id')
    }
    expect(
      buildReadyReviewRequest({
        row: candidate,
        applicationId: null,
        allocationId: null,
        eventType: 'paid',
        distinct: true,
      }).ok,
    ).toBe(false)
    const distinct = buildReadyReviewRequest({
      row: candidate,
      applicationId: 'app-1',
      allocationId: 'alloc-chosen',
      allocationApplicationId: 'app-1',
      eventType: 'paid',
      distinct: true,
    })
    expect(distinct.ok).toBe(true)
    if (distinct.ok) {
      expect(distinct.args.p_resolved_allocation_id).toBe('alloc-chosen')
      expect(distinct.args.p_resolved_allocation_id).not.toBe('alloc-1')
    }
    const confirmed = row({ review_status: 'duplicate', resolved_event_type: 'paid' })
    expect(canPostImportRow(confirmed)).toBe(false)
    expect(buildReadyReviewRequest({
      row: confirmed,
      applicationId: 'app-1',
      allocationId: 'alloc-1',
      eventType: 'paid',
      distinct: true,
    }).ok).toBe(false)
  })

  it('posts only ready writing rows using source Income cents', () => {
    const readyPaid = row({
      review_status: 'ready_to_post',
      resolved_application_id: 'app-1',
      resolved_allocation_id: 'alloc-1',
      resolved_event_type: 'paid',
      source_income_cents: 267,
    })
    const readyChargeback = row({
      id: 'r2',
      review_status: 'ready_to_post',
      resolved_application_id: 'app-1',
      resolved_allocation_id: 'alloc-1',
      resolved_event_type: 'chargeback',
      source_income_cents: -390,
    })
    expect(canPostImportRow(readyPaid)).toBe(true)
    expect(canPostImportRow(readyChargeback)).toBe(true)
    expect(buildPostImportRowRequest({ row: readyPaid, reason: 'Experior statement' }).ok).toBe(true)
    expect(resultingSignedAmountCents(readyPaid)).toBe(267)
    expect(resultingSignedAmountCents(readyChargeback)).toBe(-390)
    expect(canPostImportRow(row({ review_status: 'review_policy_match' }))).toBe(false)
    expect(canPostImportRow(row({ review_status: 'ignored_nonwriting', source_type: 'Override' }))).toBe(false)
    expect(canPostImportRow(row({ review_status: 'duplicate' }))).toBe(false)
    expect(canPostImportRow(row({ ...readyPaid, posted_commission_event_id: 'e1' }))).toBe(false)
  })

  it('scopes duplicate peers by fingerprint in the current batch', () => {
    const current = row({ id: 'r1', transaction_fingerprint: 'fp-1' })
    const peer = row({ id: 'r2', transaction_fingerprint: 'fp-1', source_writing_associate: 'Jared' })
    const other = row({ id: 'r3', transaction_fingerprint: 'fp-2' })
    expect(peersInCurrentBatch([current, peer, other], current).map((item) => item.id)).toEqual(['r2'])
  })

  it('does not give advisors a review path through the helpers', () => {
    expect(canReviewImportRow(row())).toBe(true)
    expect(
      canPostImportRow(
        row({
          review_status: 'ready_to_post',
          resolved_application_id: 'a',
          resolved_allocation_id: 'b',
          resolved_event_type: 'paid',
        }),
      ),
    ).toBe(true)
  })

  it('explains invalid_transition without creating a pre-issue import path', () => {
    expect(formatCommissionImportUserError({ message: 'CRM_PP:invalid_transition' })).toMatch(
      /not issued or in force/i,
    )
    expect(formatCommissionImportUserError({ message: 'CRM_PP:invalid_transition' })).toMatch(
      /does not use the pre-issue path/i,
    )
  })
})
