import { describe, expect, it } from 'vitest'
import {
  canRetryStageIntoOpenPendingBatch,
  formatPendingReviewReason,
  formatPendingReviewStatus,
  isAdditionalCommissionSection,
  isOverrideSourceType,
  parseOptionalMetadataCents,
  pendingRowBucket,
  shouldShowPendingImportEntry,
  summarizePendingRowAmounts,
  type CommissionPendingRowView,
} from './commissionPendingView'

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
    source_writing_associate: 'Jacqueline Juarez',
    source_client: 'Client',
    source_agent_entered_premium_cents: null,
    source_company_calculated_premium_cents: 10000,
    source_gross_rate: 115,
    source_factor_rate: 80,
    source_net_rate: 92,
    source_split_rate: null,
    source_type: 'Commission',
    source_transaction_type: null,
    source_income_cents: 335512,
    source_is_negative: false,
    source_is_chargeback_visual: false,
    pending_review_status: 'accepted_pending',
    pending_review_reason: 'exact_carrier_policy_single_writing_allocation',
    resolved_carrier_id: 'c1',
    resolved_application_id: 'app1',
    resolved_allocation_id: 'alloc1',
    resolved_advisor_id: 'adv1',
    reviewed_by_user_id: null,
    reviewed_at: null,
    created_at: '2026-08-17T00:00:00Z',
    ...over,
  }
}

describe('pending commission import classification view', () => {
  it('groups backend statuses into Phase A buckets', () => {
    expect(pendingRowBucket(row())).toBe('accepted')
    expect(pendingRowBucket(row({ pending_review_status: 'review_policy_match' }))).toBe('review')
    expect(pendingRowBucket(row({ pending_review_status: 'review_advisor_match' }))).toBe('review')
    expect(pendingRowBucket(row({ pending_review_status: 'review_split_attribution' }))).toBe('review')
    expect(pendingRowBucket(row({ pending_review_status: 'invalid_amount' }))).toBe('review')
    expect(pendingRowBucket(row({ pending_review_status: 'invalid_source_identity' }))).toBe('review')
    expect(pendingRowBucket(row({ pending_review_status: 'review_duplicate_candidate' }))).toBe(
      'duplicate',
    )
    expect(pendingRowBucket(row({ pending_review_status: 'duplicate' }))).toBe('duplicate')
    expect(pendingRowBucket(row({ pending_review_status: 'ignored_nonwriting' }))).toBe('ignored')
    expect(pendingRowBucket(row({ pending_review_status: 'ignored_nonpolicy' }))).toBe('ignored')
  })

  it('keeps Override and additional commissions out of accepted Pending', () => {
    expect(isOverrideSourceType('Override')).toBe(true)
    expect(isOverrideSourceType('Commission')).toBe(false)
    expect(isAdditionalCommissionSection('additional_commissions')).toBe(true)
    expect(isAdditionalCommissionSection('insurance')).toBe(false)
    expect(formatPendingReviewStatus('accepted_pending')).toBe('Accepted pending')
    expect(formatPendingReviewReason('override_nonwriting')).toMatch(/Override/)
  })

  it('summarizes Income without mixing statement amount or escrow', () => {
    const summary = summarizePendingRowAmounts([
      row(),
      row({
        id: 'r2',
        pending_review_status: 'ignored_nonwriting',
        source_type: 'Override',
        source_income_cents: 1046,
      }),
      row({
        id: 'r3',
        pending_review_status: 'ignored_nonwriting',
        source_type: 'Override',
        source_income_cents: 3952,
      }),
    ])
    expect(summary.acceptedIncomeCents).toBe(335512)
    expect(summary.ignoredIncomeCents).toBe(4998)
    expect(summary.sourceIncomeCents).toBe(340510)
    expect(summary.acceptedCount).toBe(1)
    expect(summary.ignoredCount).toBe(2)
  })

  it('parses statement amount and escrow as non-negative metadata', () => {
    expect(parseOptionalMetadataCents('')).toEqual({ ok: true, cents: null })
    expect(parseOptionalMetadataCents('3371.05')).toEqual({ ok: true, cents: 337105 })
    expect(parseOptionalMetadataCents('$34.05')).toEqual({ ok: true, cents: 3405 })
    expect(parseOptionalMetadataCents('-1.00').ok).toBe(false)
  })

  it('shows the owner-only pending import entry and retry-into-open-empty-batch', () => {
    expect(shouldShowPendingImportEntry('owner')).toBe(true)
    expect(shouldShowPendingImportEntry('advisor')).toBe(false)
    expect(shouldShowPendingImportEntry(null)).toBe(false)
    expect(
      canRetryStageIntoOpenPendingBatch({ import_status: 'open', row_count: 0 }),
    ).toBe(true)
    expect(
      canRetryStageIntoOpenPendingBatch({ import_status: 'open', row_count: 1 }),
    ).toBe(false)
    expect(
      canRetryStageIntoOpenPendingBatch({ import_status: 'duplicate_file', row_count: 0 }),
    ).toBe(false)
  })
})
