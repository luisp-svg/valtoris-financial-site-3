import { describe, expect, it } from 'vitest'
import { crmCommissionsRecordPaymentPath } from '../../constants/routes'
import { centsToDollarInput } from './commissionMoney'
import {
  COMMISSION_PAYMENT_ALREADY_RECORDED_COPY,
  COMMISSION_PAYMENT_RECORDED_COPY,
  PENDING_AMOUNT_IS_SUGGESTION_COPY,
  PENDING_AND_PAID_COEXISTENCE_COPY,
  PENDING_IS_NOT_PAID_COPY,
  RECORD_PAYMENT_ACTION_LABEL,
  canOpenPendingPaymentFromSearch,
  canRecordPaymentFromAcceptedPendingRow,
  canRecordPendingPayment,
  defaultPendingPaymentDraft,
  parseCommissionRecordPaymentSearch,
  pendingPaymentRawDescription,
  pendingPaymentShowsCoexistence,
  remainingExpectedDisplay,
} from './commissionPendingPayment'
import { validateRecordCommissionDraft } from './commissionRecordDraft'
import type { CommissionWorkItem, CommissionWorkPendingSource } from './commissionWorkView'
import { canRecordAttributedActual, canRecordChargeback } from './commissionWriteView'

function pendingSource(
  partial: Partial<CommissionWorkPendingSource> = {},
): CommissionWorkPendingSource {
  return {
    rowId: 'pending-row-1',
    batchId: 'batch-1',
    amountCents: 335512,
    advisorName: 'Jared',
    client: 'Rivera',
    policyNumber: 'POL-1',
    company: 'Acme',
    product: 'Term 20',
    statementIdentifier: 'experior-pending:A1',
    statementDate: '2026-08-17',
    sourceFile: 'pending.csv',
    transactionDate: '2026-08-16',
    carrierId: 'carrier-1',
    sourceRow: 4,
    ...partial,
  }
}

function item(
  partial: Partial<CommissionWorkItem> & Pick<CommissionWorkItem, 'id' | 'applicationId'>,
): CommissionWorkItem {
  return {
    kind: 'writing_advisor',
    allocationId: 'alloc-a',
    advisorId: 'adv-a',
    advisorName: 'Jared',
    clientLabel: 'Rivera',
    referenceLabel: 'POL-1',
    providerLabel: 'Acme',
    providerId: 'carrier-1',
    productServiceLabel: 'Term 20',
    productLine: 'life_term',
    productionStage: 'issued',
    productionStageLabel: 'Issued',
    expectedCents: 100000,
    outstandingCents: 100000,
    remainingExpectedCents: 100000,
    paidCents: 0,
    chargebackCents: 0,
    netPaidCents: 0,
    adjustmentCents: 0,
    recoveryCents: 0,
    eventCount: 0,
    lastFinancialActivity: null,
    expectedPeriodDate: '2026-08-01',
    pendingCents: 0,
    pendingPeriodDate: null,
    pendingSource: null,
    pendingOnlyStub: false,
    derivedStatus: { primary: 'outstanding', chargedBack: false, needsReview: false },
    reviewReason: null,
    expectedRow: null,
    ...partial,
  }
}

describe('commission Phase E1 pending payment helpers', () => {
  it('keeps accepted_pending as staging and never names it paid/posted/released/eligible', () => {
    expect(PENDING_IS_NOT_PAID_COPY).toMatch(/reviewed staging/)
    expect(PENDING_IS_NOT_PAID_COPY).toMatch(/not Paid/)
    expect(PENDING_AMOUNT_IS_SUGGESTION_COPY).toMatch(/suggestion only/)
    expect(PENDING_AND_PAID_COEXISTENCE_COPY).toMatch(/Paid recorded separately/)
    expect(RECORD_PAYMENT_ACTION_LABEL).toBe('Record Payment')
    expect(RECORD_PAYMENT_ACTION_LABEL).not.toMatch(/posted|released|eligible/i)
    expect(pendingPaymentRawDescription('row-9')).toContain('not a ledger event')
    expect(canRecordPaymentFromAcceptedPendingRow({
      pending_review_status: 'accepted_pending',
      resolved_application_id: 'app-1',
      resolved_allocation_id: 'alloc-a',
      source_income_cents: 100,
    })).toBe(true)
    expect(canRecordPaymentFromAcceptedPendingRow({
      pending_review_status: 'review_policy_match',
      resolved_application_id: 'app-1',
      resolved_allocation_id: 'alloc-a',
      source_income_cents: 100,
    })).toBe(false)
    expect(canRecordPaymentFromAcceptedPendingRow({
      pending_review_status: 'paid',
      resolved_application_id: 'app-1',
      resolved_allocation_id: 'alloc-a',
      source_income_cents: 100,
    })).toBe(false)
  })

  it('shows Record Payment to owners for accepted pending, including pending-only stubs', () => {
    const overlay = item({
      id: 'app:alloc-a',
      applicationId: 'app-1',
      pendingSource: pendingSource(),
      pendingCents: 335512,
    })
    const stub = item({
      id: 'app:alloc-b',
      applicationId: 'app-1',
      allocationId: 'alloc-b',
      advisorId: 'adv-b',
      pendingOnlyStub: true,
      pendingSource: pendingSource({ rowId: 'pending-row-2', amountCents: 88000 }),
      pendingCents: 88000,
      expectedCents: null,
      remainingExpectedCents: null,
    })
    expect(canRecordPendingPayment(true, overlay)).toBe(true)
    expect(canRecordPendingPayment(true, stub)).toBe(true)
    expect(canRecordPendingPayment(false, overlay)).toBe(false)
    expect(canRecordPendingPayment(false, stub)).toBe(false)
    expect(canRecordAttributedActual(true, stub)).toBe(false)
    expect(canRecordChargeback(true, stub)).toBe(false)
    expect(
      canRecordPendingPayment(true, item({ id: 'app:none', applicationId: 'app-1' })),
    ).toBe(false)
  })

  it('prefills identity from the resolved writing allocation and treats Pending amount as a suggestion', () => {
    const target = item({
      id: 'app:alloc-a',
      applicationId: 'app-1',
      pendingSource: pendingSource(),
      pendingOnlyStub: true,
    })
    const draft = defaultPendingPaymentDraft(target, '2026-08-20')
    expect(draft.eventType).toBe('paid')
    expect(draft.amountInput).toBe(centsToDollarInput(335512))
    expect(draft.statementIdentifier).toBe('experior-pending:A1')
    expect(draft.transactionDate).toBe('2026-08-16')
    const suggested = validateRecordCommissionDraft({
      item: target,
      draft,
      idempotencyKey: 'manual035:pending-1',
      preIssue: false,
      includeCarrierId: true,
      lockedEventType: 'paid',
      fromPending: true,
    })
    expect(suggested.ok).toBe(true)
    if (!suggested.ok) return
    expect(suggested.args.eventType).toBe('paid')
    expect(suggested.args.applicationId).toBe('app-1')
    expect(suggested.args.allocationId).toBe('alloc-a')
    expect(suggested.args.amountCents).toBe(335512)
    expect(suggested.args.carrierId).toBe('carrier-1')
    expect(suggested.args.sourceRow).toBe(4)
    expect(suggested.args.preIssue).toBe(false)
    expect(suggested.args).not.toHaveProperty('advisorId')

    const differentAmount = validateRecordCommissionDraft({
      item: target,
      draft: { ...draft, amountInput: '10.00' },
      idempotencyKey: 'manual035:pending-2',
      preIssue: false,
      includeCarrierId: true,
      lockedEventType: 'paid',
      fromPending: true,
    })
    expect(differentAmount.ok).toBe(true)
    if (differentAmount.ok) expect(differentAmount.args.amountCents).toBe(1000)

    const blockedGeneric = validateRecordCommissionDraft({
      item: target,
      draft: { ...draft, amountInput: '10.00' },
      idempotencyKey: 'manual035:pending-3',
      preIssue: false,
      includeCarrierId: true,
    })
    expect(blockedGeneric.ok).toBe(false)

    const lockedIgnoresAdjustment = validateRecordCommissionDraft({
      item: target,
      draft: { ...draft, eventType: 'adjustment', amountInput: '25.00' },
      idempotencyKey: 'manual035:pending-4',
      preIssue: false,
      includeCarrierId: true,
      lockedEventType: 'paid',
      fromPending: true,
    })
    expect(lockedIgnoresAdjustment.ok).toBe(true)
    if (lockedIgnoresAdjustment.ok) {
      expect(lockedIgnoresAdjustment.args.eventType).toBe('paid')
      expect(lockedIgnoresAdjustment.args.amountCents).toBe(2500)
    }
  })

  it('does not let the owner change advisor independently of the resolved allocation', () => {
    const target = item({
      id: 'app:alloc-a',
      applicationId: 'app-1',
      allocationId: 'alloc-a',
      advisorId: 'adv-a',
      pendingSource: pendingSource(),
    })
    const result = validateRecordCommissionDraft({
      item: target,
      draft: defaultPendingPaymentDraft(target, '2026-08-20'),
      idempotencyKey: 'manual035:pending-5',
      preIssue: false,
      includeCarrierId: true,
      lockedEventType: 'paid',
      fromPending: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.args.allocationId).toBe('alloc-a')
    expect(result.args.applicationId).toBe('app-1')
    expect(result.args).not.toHaveProperty('advisorId')
    expect(Object.keys(result.args).sort()).not.toContain('advisorId')
  })

  it('parses the commissions Record Payment deep link and remaining/coexistence copy', () => {
    const path = crmCommissionsRecordPaymentPath('app-1', 'alloc-a')
    expect(path).toContain('/crm/commissions?')
    expect(path).toContain('recordPayment=1')
    expect(path).toContain('application=app-1')
    expect(path).toContain('allocation=alloc-a')
    const parsed = parseCommissionRecordPaymentSearch(new URLSearchParams(path.split('?')[1]))
    expect(parsed).toEqual({ applicationId: 'app-1', allocationId: 'alloc-a' })
    const overlay = item({
      id: 'app:alloc-a',
      applicationId: 'app-1',
      pendingSource: pendingSource(),
      paidCents: 50000,
    })
    expect(canOpenPendingPaymentFromSearch({ isOwner: true, item: overlay })).toBe(true)
    expect(canOpenPendingPaymentFromSearch({ isOwner: false, item: overlay })).toBe(false)
    expect(pendingPaymentShowsCoexistence(overlay)).toBe(true)
    expect(remainingExpectedDisplay(25000)).toBe('$250.00')
    expect(remainingExpectedDisplay(null)).toBe('—')
    expect(COMMISSION_PAYMENT_RECORDED_COPY).toBe('Payment recorded.')
    expect(COMMISSION_PAYMENT_ALREADY_RECORDED_COPY).toMatch(/already recorded/)
  })
})
