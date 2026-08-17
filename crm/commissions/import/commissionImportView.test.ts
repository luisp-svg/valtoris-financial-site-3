import { describe, expect, it } from 'vitest'
import {
  canRetryStageIntoOpenBatch,
  formatImportReviewReason,
  formatImportReviewStatus,
  ignoredSafetyCopy,
  importRowBucket,
  isOverrideSourceType,
  negativeTransactionCopy,
  overrideSafetyCopy,
  shouldShowImportEntry,
  summarizeImportRowAmounts,
  type CommissionImportRowView,
} from './commissionImportView'

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
    review_status: 'ready_to_post',
    review_reason: 'exact_carrier_policy_single_writing_allocation',
    resolved_carrier_id: 'c1',
    resolved_application_id: 'app1',
    resolved_allocation_id: 'alloc1',
    resolved_advisor_id: 'adv1',
    resolved_event_type: 'paid',
    posted_commission_event_id: null,
    created_at: '2026-08-17T00:00:00Z',
    ...over,
  }
}

describe('commission import classification view', () => {
  it('groups backend statuses into Phase 3A buckets', () => {
    expect(importRowBucket(row())).toBe('ready')
    expect(importRowBucket(row({ review_status: 'review_policy_match' }))).toBe('review')
    expect(importRowBucket(row({ review_status: 'review_advisor_match' }))).toBe('review')
    expect(importRowBucket(row({ review_status: 'review_split_attribution' }))).toBe('review')
    expect(importRowBucket(row({ review_status: 'review_transaction_type' }))).toBe('review')
    expect(importRowBucket(row({ review_status: 'review_duplicate_candidate' }))).toBe('review')
    expect(importRowBucket(row({ review_status: 'invalid_amount' }))).toBe('review')
    expect(importRowBucket(row({ review_status: 'invalid_source_identity' }))).toBe('review')
    expect(importRowBucket(row({ review_status: 'ignored_nonwriting' }))).toBe('ignored')
    expect(importRowBucket(row({ review_status: 'ignored_nonpolicy' }))).toBe('ignored')
    expect(importRowBucket(row({ review_status: 'duplicate' }))).toBe('duplicate')
    expect(importRowBucket(row({ posted_commission_event_id: 'e1' }))).toBe('posted')
  })

  it('does not treat resolved_event_type as postable when the row is a duplicate candidate', () => {
    const candidate = row({
      review_status: 'review_duplicate_candidate',
      review_reason: 'cross_report_fingerprint_ambiguous',
      resolved_event_type: 'paid',
      posted_commission_event_id: null,
    })
    expect(importRowBucket(candidate)).toBe('review')
    expect(importRowBucket(candidate)).not.toBe('ready')
    expect(importRowBucket(candidate)).not.toBe('posted')
    expect(
      importRowBucket(row({ review_status: 'ready_to_post', posted_commission_event_id: null })),
    ).toBe('ready')
    expect(
      importRowBucket(row({ review_status: 'ready_to_post', posted_commission_event_id: 'e1' })),
    ).toBe('posted')
  })

  it('uses human status and reason copy', () => {
    expect(formatImportReviewStatus('ready_to_post')).toBe('Ready to post')
    expect(formatImportReviewStatus('review_policy_match')).toBe('Policy match needed')
    expect(formatImportReviewStatus('review_advisor_match')).toBe('Writing advisor match needed')
    expect(formatImportReviewStatus('review_split_attribution')).toBe('Writing allocation selection needed')
    expect(formatImportReviewStatus('review_transaction_type')).toBe('Transaction type review needed')
    expect(formatImportReviewStatus('review_duplicate_candidate')).toBe('Possible duplicate')
    expect(formatImportReviewStatus('ignored_nonwriting')).toBe('Ignored — non-writing compensation')
    expect(formatImportReviewStatus('ignored_nonpolicy')).toBe('Ignored — non-policy commission')
    expect(formatImportReviewStatus('duplicate')).toBe('Duplicate source transaction')
    expect(formatImportReviewStatus('invalid_amount')).toBe('Invalid amount')
    expect(formatImportReviewStatus('invalid_source_identity')).toBe('Invalid source identity')
    expect(formatImportReviewReason('unknown_carrier')).toMatch(/company/i)
    expect(formatImportReviewReason('negative_without_chargeback_visual')).toMatch(/not a confirmed chargeback/i)
    expect(formatImportReviewReason('override_nonwriting')).toMatch(/excluded/i)
    expect(formatImportReviewReason('household_override_split')).toMatch(/not treated as writing/i)
    expect(formatImportReviewReason('household_override_ambiguous')).toMatch(/not treated as writing/i)
  })

  it('flags override rows even when backend review status is not ignored', () => {
    const household = row({
      source_type: 'Override',
      review_status: 'review_split_attribution',
    })
    expect(isOverrideSourceType(household.source_type)).toBe(true)
    expect(overrideSafetyCopy(household)).toMatch(/not treated as writing-advisor compensation/)
    expect(ignoredSafetyCopy(row({ review_status: 'ignored_nonwriting' }))).toMatch(/Excluded from Valtoris/)
    expect(ignoredSafetyCopy(row({ review_status: 'ignored_nonpolicy' }))).toMatch(/non-policy/)
  })

  it('does not call a negative without visual a chargeback', () => {
    expect(
      negativeTransactionCopy(
        row({
          source_income_cents: -390,
          source_is_chargeback_visual: true,
          resolved_event_type: 'chargeback',
        }),
      ),
    ).toBe('Chargeback')
    expect(
      negativeTransactionCopy(
        row({
          source_income_cents: -390,
          source_is_chargeback_visual: false,
          review_status: 'review_transaction_type',
          resolved_event_type: null,
        }),
      ),
    ).toBe('Negative transaction needs classification')
  })

  it('keeps ignored and duplicate amounts out of writing income', () => {
    const summary = summarizeImportRowAmounts([
      row({ source_income_cents: 267 }),
      row({ id: 'r2', review_status: 'ignored_nonwriting', source_income_cents: 3893 }),
      row({ id: 'r3', review_status: 'duplicate', source_income_cents: 810 }),
      row({ id: 'r4', posted_commission_event_id: 'e1', source_income_cents: 100 }),
    ])
    expect(summary.sourceIncomeCents).toBe(267 + 3893 + 810 + 100)
    expect(summary.readyIncomeCents).toBe(267)
    expect(summary.ignoredIncomeCents).toBe(3893)
    expect(summary.duplicateIncomeCents).toBe(810)
    expect(summary.postedIncomeCents).toBe(100)
  })

  it('is owner-only', () => {
    expect(shouldShowImportEntry('owner')).toBe(true)
    expect(shouldShowImportEntry('advisor')).toBe(false)
    expect(shouldShowImportEntry(null)).toBe(false)
  })

  it('allows retry staging only into an empty open original batch', () => {
    expect(canRetryStageIntoOpenBatch({ import_status: 'open', row_count: 0 })).toBe(true)
    expect(canRetryStageIntoOpenBatch({ import_status: 'open', row_count: 4 })).toBe(false)
    expect(canRetryStageIntoOpenBatch({ import_status: 'duplicate_file', row_count: 0 })).toBe(false)
    expect(canRetryStageIntoOpenBatch(null)).toBe(false)
  })
})
