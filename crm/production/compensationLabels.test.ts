import { describe, expect, it } from 'vitest'
import { EXPECTED_REVIEW_REASONS } from './types'
import {
  formatActualStatusLabel,
  formatCommissionEventTypeLabel,
  formatExpectedReviewReason,
  formatExpectedStatusLabel,
  formatExpectedUnavailableOrReviewCopy,
} from './compensationLabels'

describe('expected review-reason copy', () => {
  it('maps every approved 034 reason to human-readable language', () => {
    expect(formatExpectedReviewReason('no_rate_card')).toBe(
      'No compensation rate is available for this product.',
    )
    expect(formatExpectedReviewReason('no_rate_card_for_lookup_date')).toBe(
      'No compensation rate applies to the policy’s lookup date.',
    )
    expect(formatExpectedReviewReason('age_sensitive_rate_card')).toBe(
      'The compensation rate requires age review.',
    )
    expect(formatExpectedReviewReason('premium_mode_not_annualizable')).toBe(
      'The submitted premium mode cannot be automatically annualized.',
    )
    expect(formatExpectedReviewReason('missing_writing_contract_level')).toMatch(/rank/i)
    expect(formatExpectedReviewReason('missing_lookup_date')).toMatch(/date/i)
    expect(formatExpectedReviewReason('missing_compensation_base')).toMatch(/premium|deposit/i)

    for (const reason of EXPECTED_REVIEW_REASONS) {
      const copy = formatExpectedReviewReason(reason)
      expect(copy).not.toBe(reason)
      expect(copy).not.toContain(reason)
      expect(copy).not.toMatch(/_/ )
    }
  })

  it('never shows raw internal codes as primary copy', () => {
    expect(formatExpectedReviewReason('not_a_real_reason')).not.toContain('not_a_real_reason')
    expect(formatExpectedReviewReason(null)).toMatch(/needs review/i)
    expect(formatExpectedUnavailableOrReviewCopy('resolved', 'no_rate_card')).toBeNull()
    expect(formatExpectedUnavailableOrReviewCopy('unavailable', null)).toMatch(/rate is currently available/i)
    expect(formatExpectedUnavailableOrReviewCopy('review_required', 'age_sensitive_rate_card')).toMatch(
      /age review/i,
    )
  })

  it('uses derived presentation labels, not stored DB statuses', () => {
    expect(formatExpectedStatusLabel('not_calculated')).toBe('Not calculated')
    expect(formatExpectedStatusLabel('expected')).toBe('Expected')
    expect(formatExpectedStatusLabel('review_required')).toBe('Review required')
    expect(formatExpectedStatusLabel('no_rate')).toBe('No rate')
    expect(formatActualStatusLabel('no_payments')).toBe('No payments')
    expect(formatActualStatusLabel('partially_paid')).toBe('Partially paid')
    expect(formatActualStatusLabel('paid')).toBe('Paid')
    expect(formatActualStatusLabel('overpaid')).toBe('Overpaid')
    expect(formatActualStatusLabel('charged_back')).toBe('Charged back')
    expect(formatActualStatusLabel('net_zero')).toBe('Net zero')
    expect(formatActualStatusLabel('expected_unavailable')).toBe('Expected unavailable')
    expect(formatCommissionEventTypeLabel('paid')).toBe('Paid')
    expect(formatCommissionEventTypeLabel('chargeback')).toBe('Chargeback')
    expect(formatCommissionEventTypeLabel('recovery')).toBe('Recovery')
    expect(formatCommissionEventTypeLabel('adjustment')).toBe('Adjustment')
    expect(formatCommissionEventTypeLabel('reversal')).toBe('Reversal')
  })
})
