import { describe, expect, it, vi } from 'vitest'
import {
  createManualCommissionIdempotencyKey,
  EXPERIOR_IMPORT_IDEMPOTENCY_PREFIX,
  isExperiorImportIdempotencyKey,
  isManualCommissionIdempotencyKey,
  MANUAL_COMMISSION_IDEMPOTENCY_PREFIX,
} from './commissionIdempotency'
import {
  applySourceSign,
  parsePositiveDollarCents,
  signedCentsForManualEvent,
} from './commissionMoney'
import {
  validateAttributionDraft,
  validateRecordCommissionDraft,
  validateReverseReason,
} from './commissionRecordDraft'
import { defaultRecordCommissionDraft } from './commissionWriteView'
import {
  COMMISSION_IDEMPOTENCY_CONFLICT_ERROR,
  COMMISSION_PRE_ISSUE_GATE_ERROR,
  COMMISSION_WRITE_GENERIC_ERROR,
  formatCommissionWriteUserError,
} from './commissionWriteErrors'
import {
  recordCommissionEventRpcArgs,
  recordPolicyWritingCommissionEvent,
  reversePolicyWritingCommissionEvent,
  attributeUnattributedCommissionEvent,
} from './commissionWriteApi'
import { formatCommissionEventSourceLabel } from './commissionEventSource'
import {
  canAttributeCommissionEvent,
  canRecordAttributedActual,
  canReverseCommissionEvent,
  MANUAL_RECORD_EVENT_TYPES,
  ordinaryRecordRpcName,
  preIssueRecordRpcName,
  recordRpcName,
  writingAttributionTargets,
} from './commissionWriteView'
import type { CommissionWorkItem } from './commissionWorkView'
import type { WritingCommissionEvent } from '../production/compensationView'
import { buildCommissionWorkItems } from './commissionWorkView'
import type { PaidCommissionListEvent } from '../production/dashboardView'
import type {
  LiveExpectedCompensationRow,
  ProductionApplicationListItem,
} from '../production/types'

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
    expectedRow: {
      id: 'exp-1',
      application_id: partial.applicationId,
      allocation_id: 'alloc-a',
      advisor_id: 'adv-a',
      advisor_display_name: 'Jared',
      writing_contract_level: 'FA',
      writing_rate: '0.01',
      compensation_base_cents: 1000000,
      commission_bps: 7500,
      expected_compensation_cents: 100000,
      calculation_status: 'resolved',
      review_reason: null,
      calculated_at: '2026-08-01T00:00:00.000Z',
    },
    ...partial,
  }
}

function event(
  partial: Partial<WritingCommissionEvent> & Pick<WritingCommissionEvent, 'id'>,
): WritingCommissionEvent {
  return {
    event_type: 'paid',
    amount_cents: 75000,
    transaction_date: '2026-08-15',
    statement_identifier: null,
    policy_reference: null,
    source_file: null,
    source_row: null,
    reversed_event_id: null,
    import_batch_identifier: null,
    reason: 'Carrier commission statement',
    created_at: '2026-08-15T12:00:00.000Z',
    idempotency_key: 'manual035:11111111-1111-4111-8111-111111111111',
    ...partial,
  }
}

describe('commission Phase 2 money and event types', () => {
  it('parses positive dollars into integer cents without floating point', () => {
    expect(parsePositiveDollarCents('750.00')).toEqual({ ok: true, cents: 75000 })
    expect(parsePositiveDollarCents('$1,000.25')).toEqual({ ok: true, cents: 100025 })
    expect(parsePositiveDollarCents('')).toEqual({ ok: false, reason: 'blank' })
    expect(parsePositiveDollarCents('0')).toEqual({ ok: false, reason: 'zero' })
    expect(parsePositiveDollarCents('0.00')).toEqual({ ok: false, reason: 'zero' })
    expect(parsePositiveDollarCents('-10')).toEqual({ ok: false, reason: 'invalid' })
    expect(parsePositiveDollarCents('12.345')).toEqual({ ok: false, reason: 'invalid' })
    expect(parsePositiveDollarCents('abc')).toEqual({ ok: false, reason: 'invalid' })
  })

  it('converts paid, recovery, chargeback, and adjustment signs', () => {
    expect(signedCentsForManualEvent({ eventType: 'paid', magnitudeCents: 100000 })).toBe(100000)
    expect(signedCentsForManualEvent({ eventType: 'recovery', magnitudeCents: 25000 })).toBe(25000)
    expect(signedCentsForManualEvent({ eventType: 'chargeback', magnitudeCents: 50000 })).toBe(-50000)
    expect(
      signedCentsForManualEvent({
        eventType: 'adjustment',
        magnitudeCents: 1000,
        adjustmentDirection: 'increase',
      }),
    ).toBe(1000)
    expect(
      signedCentsForManualEvent({
        eventType: 'adjustment',
        magnitudeCents: 1000,
        adjustmentDirection: 'decrease',
      }),
    ).toBe(-1000)
    expect(MANUAL_RECORD_EVENT_TYPES).toEqual(['paid', 'adjustment', 'chargeback', 'recovery'])
    expect(MANUAL_RECORD_EVENT_TYPES).not.toContain('reversal')
    expect(MANUAL_RECORD_EVENT_TYPES.join(' ')).not.toMatch(/pending|eligible|released/i)
  })
})

describe('commission Phase 2 idempotency', () => {
  it('generates a manual035 UUID key once per factory call and never uses Date.now', () => {
    const key = createManualCommissionIdempotencyKey(() => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    expect(key).toBe(`${MANUAL_COMMISSION_IDEMPOTENCY_PREFIX}aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`)
    expect(isManualCommissionIdempotencyKey(key)).toBe(true)
    expect(isExperiorImportIdempotencyKey(key)).toBe(false)
    expect(key.startsWith(EXPERIOR_IMPORT_IDEMPOTENCY_PREFIX)).toBe(false)
    expect(key).not.toMatch(/Date\.now/)
  })

  it('reuses the same operation key on retry and does not mint a new key on conflict', () => {
    const opened = createManualCommissionIdempotencyKey(() => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    const retryKey = opened
    expect(retryKey).toBe(opened)
    expect(formatCommissionWriteUserError({ message: 'CRM_PP:idempotency_conflict' })).toBe(
      COMMISSION_IDEMPOTENCY_CONFLICT_ERROR,
    )
    expect(COMMISSION_IDEMPOTENCY_CONFLICT_ERROR).toMatch(/Nothing new was recorded/)
  })
})

describe('commission Phase 2 record draft', () => {
  it('posts paid/recovery positive, chargeback negative, and preserves date/reason/source', () => {
    const draft = {
      ...defaultRecordCommissionDraft('2026-08-15'),
      eventType: 'paid' as const,
      amountInput: '750.00',
      reason: 'Carrier commission statement',
      statementIdentifier: 'STMT-9',
      policyReference: 'POL-1',
    }
    const paid = validateRecordCommissionDraft({
      item: item({ id: 'app:alloc-a', applicationId: 'app-1' }),
      draft,
      idempotencyKey: 'manual035:key-1',
      preIssue: false,
      includeCarrierId: true,
    })
    expect(paid.ok).toBe(true)
    if (!paid.ok) return
    expect(paid.args.amountCents).toBe(75000)
    expect(paid.args.eventType).toBe('paid')
    expect(paid.args.transactionDate).toBe('2026-08-15')
    expect(paid.args.reason).toBe('Carrier commission statement')
    expect(paid.args.statementIdentifier).toBe('STMT-9')
    expect(paid.args.allocationId).toBe('alloc-a')
    expect(paid.args.applicationId).toBe('app-1')
    expect(paid.args.preIssue).toBe(false)
    expect(paid.args.idempotencyKey).toBe('manual035:key-1')

    const chargeback = validateRecordCommissionDraft({
      item: item({ id: 'app:alloc-a', applicationId: 'app-1' }),
      draft: { ...draft, eventType: 'chargeback' },
      idempotencyKey: 'manual035:key-1',
      preIssue: false,
      includeCarrierId: true,
    })
    expect(chargeback.ok && chargeback.args.amountCents).toBe(-75000)

    const recovery = validateRecordCommissionDraft({
      item: item({ id: 'app:alloc-a', applicationId: 'app-1' }),
      draft: { ...draft, eventType: 'recovery', amountInput: '25' },
      idempotencyKey: 'manual035:key-1',
      preIssue: false,
      includeCarrierId: true,
    })
    expect(recovery.ok && recovery.args.amountCents).toBe(2500)

    const adjDown = validateRecordCommissionDraft({
      item: item({ id: 'app:alloc-a', applicationId: 'app-1' }),
      draft: { ...draft, eventType: 'adjustment', adjustmentDirection: 'decrease', amountInput: '10.00' },
      idempotencyKey: 'manual035:key-1',
      preIssue: false,
      includeCarrierId: true,
    })
    expect(adjDown.ok && adjDown.args.amountCents).toBe(-1000)
  })

  it('rejects zero, invalid currency, and missing reason/date before RPC args are built', () => {
    const base = defaultRecordCommissionDraft('2026-08-15')
    const target = item({ id: 'app:alloc-a', applicationId: 'app-1' })
    expect(
      validateRecordCommissionDraft({
        item: target,
        draft: { ...base, amountInput: '0.00', reason: 'x' },
        idempotencyKey: 'manual035:k',
        preIssue: false,
        includeCarrierId: true,
      }).ok,
    ).toBe(false)
    expect(
      validateRecordCommissionDraft({
        item: target,
        draft: { ...base, amountInput: 'nope', reason: 'x' },
        idempotencyKey: 'manual035:k',
        preIssue: false,
        includeCarrierId: true,
      }).ok,
    ).toBe(false)
    expect(
      validateRecordCommissionDraft({
        item: target,
        draft: { ...base, amountInput: '10.00', reason: '', transactionDate: '2026-08-15' },
        idempotencyKey: 'manual035:k',
        preIssue: false,
        includeCarrierId: true,
      }).ok,
    ).toBe(false)
    expect(
      validateRecordCommissionDraft({
        item: target,
        draft: { ...base, amountInput: '10.00', reason: 'x', transactionDate: '' },
        idempotencyKey: 'manual035:k',
        preIssue: false,
        includeCarrierId: true,
      }).ok,
    ).toBe(false)
  })

  it('keeps ordinary record on the ordinary RPC and pre-issue on the exception RPC', () => {
    expect(recordRpcName(false)).toBe(ordinaryRecordRpcName())
    expect(recordRpcName(true)).toBe(preIssueRecordRpcName())
    expect(ordinaryRecordRpcName()).toBe('record_policy_writing_commission_event')
    expect(preIssueRecordRpcName()).toBe('record_policy_writing_commission_event_pre_issue')
    const gate = formatCommissionWriteUserError({ message: 'CRM_PP:invalid_transition' })
    expect(gate).toBe(COMMISSION_PRE_ISSUE_GATE_ERROR)
    expect(gate).toMatch(/Record pre-issue actual/)
    expect(gate).not.toMatch(/silently|automatically/)
  })
})

describe('commission Phase 2 owner/advisor and split-writer isolation', () => {
  it('shows record actions only for owners on a writing allocation', () => {
    const writing = item({ id: 'app:alloc-a', applicationId: 'app-1' })
    const unattributed = item({
      id: 'app:unattributed',
      applicationId: 'app-1',
      kind: 'unattributed',
      allocationId: null,
      advisorId: null,
      advisorName: 'Unattributed',
    })
    expect(canRecordAttributedActual(true, writing)).toBe(true)
    expect(canRecordAttributedActual(false, writing)).toBe(false)
    expect(canRecordAttributedActual(true, unattributed)).toBe(false)
    expect(
      canRecordAttributedActual(true, item({ id: 'app:stub', applicationId: 'app-1', pendingOnlyStub: true })),
    ).toBe(false)
    expect(
      canRecordAttributedActual(
        true,
        item({ id: 'app:pending-overlay', applicationId: 'app-1', pendingCents: 335512 }),
      ),
    ).toBe(true)
  })

  it('posts writer A against allocation_id and does not auto-split to writer B', () => {
    const jared = item({
      id: 'app:alloc-jared',
      applicationId: 'app-1',
      allocationId: 'alloc-jared',
      advisorId: 'adv-jared',
      advisorName: 'Jared',
    })
    const jazmin = item({
      id: 'app:alloc-jazmin',
      applicationId: 'app-1',
      allocationId: 'alloc-jazmin',
      advisorId: 'adv-jazmin',
      advisorName: 'Jazmin',
      expectedRow: {
        ...jared.expectedRow!,
        id: 'exp-b',
        allocation_id: 'alloc-jazmin',
        advisor_id: 'adv-jazmin',
        commission_bps: 2500,
        expected_compensation_cents: 25000,
      },
    })
    const draft = {
      ...defaultRecordCommissionDraft('2026-08-15'),
      amountInput: '750.00',
      reason: 'Jared paid',
    }
    const result = validateRecordCommissionDraft({
      item: jared,
      draft,
      idempotencyKey: 'manual035:jared',
      preIssue: false,
      includeCarrierId: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.args.allocationId).toBe('alloc-jared')
    expect(result.args.allocationId).not.toBe(jazmin.allocationId)
    expect(writingAttributionTargets([jared, jazmin], 'app-1')).toHaveLength(2)
    expect(writingAttributionTargets([jared, jazmin], 'app-1').map((row) => row.allocationId)).toEqual(
      ['alloc-jared', 'alloc-jazmin'],
    )
  })
})

describe('commission Phase 2 reverse and attribute', () => {
  it('allows reverse only on active non-reversal events for owners', () => {
    const paid = event({ id: 'e1' })
    const reversal = event({
      id: 'e2',
      event_type: 'reversal',
      amount_cents: -75000,
      reversed_event_id: 'e1',
    })
    expect(canReverseCommissionEvent({ isOwner: true, event: paid, allEvents: [paid] })).toBe(true)
    expect(canReverseCommissionEvent({ isOwner: false, event: paid, allEvents: [paid] })).toBe(false)
    expect(
      canReverseCommissionEvent({ isOwner: true, event: paid, allEvents: [paid, reversal] }),
    ).toBe(false)
    expect(
      canReverseCommissionEvent({ isOwner: true, event: reversal, allEvents: [paid, reversal] }),
    ).toBe(false)
    expect(validateReverseReason('')).toBeTruthy()
    expect(validateReverseReason('Posted to the wrong writer')).toBeNull()
  })

  it('attributes only owner-visible unattributed events and requires explicit split amounts', () => {
    const unattr = event({ id: 'u1', advisor_id: null, allocation_id: null })
    expect(
      canAttributeCommissionEvent({
        isOwner: true,
        unattributed: true,
        event: unattr,
        allEvents: [unattr],
      }),
    ).toBe(true)
    expect(
      canAttributeCommissionEvent({
        isOwner: false,
        unattributed: true,
        event: unattr,
        allEvents: [unattr],
      }),
    ).toBe(false)
    const split = validateAttributionDraft({
      sourceAmountCents: 57000,
      reason: 'writers identified',
      lines: [
        { allocationId: 'alloc-a', selected: true, amountInput: '450.00' },
        { allocationId: 'alloc-b', selected: true, amountInput: '120.00' },
      ],
    })
    expect(split.ok).toBe(true)
    if (!split.ok) return
    expect(split.attributions).toEqual([
      { allocationId: 'alloc-a', amountCents: 45000 },
      { allocationId: 'alloc-b', amountCents: 12000 },
    ])
    const auto = validateAttributionDraft({
      sourceAmountCents: 57000,
      reason: 'writers identified',
      lines: [
        { allocationId: 'alloc-a', selected: false, amountInput: '' },
        { allocationId: 'alloc-b', selected: false, amountInput: '' },
      ],
    })
    expect(auto.ok).toBe(false)
    expect(applySourceSign(45000, -57000)).toBe(-45000)
  })
})

describe('commission Phase 2 write API wrappers', () => {
  it('calls existing 035 RPCs and never table DML', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, duplicate: false, event: { id: 'e1' } },
      error: null,
    })
    const supabase = { rpc } as never
    const args = recordCommissionEventRpcArgs({
      applicationId: 'app-1',
      eventType: 'paid',
      amountCents: 75000,
      reason: 'Carrier commission statement',
      idempotencyKey: 'manual035:key-1',
      allocationId: 'alloc-a',
      transactionDate: '2026-08-15',
      preIssue: false,
    })
    expect(args.p_allocation_id).toBe('alloc-a')
    expect(args.p_idempotency_key).toBe('manual035:key-1')
    expect(args).not.toHaveProperty('p_import_batch_identifier')

    await recordPolicyWritingCommissionEvent(supabase, {
      applicationId: 'app-1',
      eventType: 'paid',
      amountCents: 75000,
      reason: 'Carrier commission statement',
      idempotencyKey: 'manual035:key-1',
      allocationId: 'alloc-a',
      transactionDate: '2026-08-15',
      preIssue: false,
    })
    expect(rpc).toHaveBeenCalledWith(
      'record_policy_writing_commission_event',
      expect.objectContaining({ p_amount_cents: 75000, p_idempotency_key: 'manual035:key-1' }),
    )

    rpc.mockClear()
    await recordPolicyWritingCommissionEvent(supabase, {
      applicationId: 'app-1',
      eventType: 'paid',
      amountCents: 75000,
      reason: 'Carrier advanced commission before issue',
      idempotencyKey: 'manual035:key-1',
      allocationId: 'alloc-a',
      transactionDate: '2026-08-15',
      preIssue: true,
    })
    expect(rpc).toHaveBeenCalledWith(
      'record_policy_writing_commission_event_pre_issue',
      expect.objectContaining({ p_allocation_id: 'alloc-a' }),
    )

    rpc.mockClear()
    await reversePolicyWritingCommissionEvent(supabase, {
      eventId: 'e1',
      reason: 'wrong writer',
    })
    expect(rpc).toHaveBeenCalledWith('reverse_policy_writing_commission_event', {
      p_event_id: 'e1',
      p_reason: 'wrong writer',
    })
    expect(rpc.mock.calls[0][1]).not.toHaveProperty('p_amount_cents')

    rpc.mockClear()
    await attributeUnattributedCommissionEvent(supabase, {
      eventId: 'u1',
      reason: 'writers identified',
      idempotencyKey: 'manual035:attr',
      attributions: [{ allocationId: 'alloc-a', amountCents: 57000 }],
    })
    expect(rpc).toHaveBeenCalledWith(
      'attribute_unattributed_commission_event',
      expect.objectContaining({
        p_event_id: 'u1',
        p_idempotency_key: 'manual035:attr',
      }),
    )
  })

  it('treats identical replay as success and surfaces idempotency conflict without a new key', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: { ok: true, duplicate: true, event: { id: 'e1' } }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'CRM_PP:idempotency_conflict' },
      })
    const supabase = { rpc } as never
    const retry = await recordPolicyWritingCommissionEvent(supabase, {
      applicationId: 'app-1',
      eventType: 'paid',
      amountCents: 75000,
      reason: 'retry',
      idempotencyKey: 'manual035:same',
      allocationId: 'alloc-a',
      transactionDate: '2026-08-15',
      preIssue: false,
    })
    expect(retry).toMatchObject({ ok: true, duplicate: true })
    const conflict = await recordPolicyWritingCommissionEvent(supabase, {
      applicationId: 'app-1',
      eventType: 'paid',
      amountCents: 1,
      reason: 'different',
      idempotencyKey: 'manual035:same',
      allocationId: 'alloc-a',
      transactionDate: '2026-08-15',
      preIssue: false,
    })
    expect(conflict.ok).toBe(false)
    if (conflict.ok) return
    expect(conflict.message).toBe(COMMISSION_IDEMPOTENCY_CONFLICT_ERROR)
    expect(conflict.code).toBe('idempotency_conflict')
  })
})

describe('commission Phase 2 source labels and write errors', () => {
  it('labels manual entries without calling them Experior Import', () => {
    expect(
      formatCommissionEventSourceLabel(
        event({ id: 'm1', statement_identifier: 'STMT-1' }),
      ),
    ).toMatch(/^Manual entry/)
    expect(
      formatCommissionEventSourceLabel(
        event({
          id: 'i1',
          idempotency_key: '036:batch:row',
          import_batch_identifier: 'batch-1',
        }),
      ),
    ).toMatch(/^Experior Import/)
    expect(formatCommissionWriteUserError({ message: 'CRM_PP:not_authorized' })).toMatch(
      /permission/i,
    )
    expect(
      formatCommissionWriteUserError({
        message: 'permission denied for table policy_writing_commission_events',
        code: '42501',
      }),
    ).toBe(COMMISSION_WRITE_GENERIC_ERROR)
    expect(COMMISSION_WRITE_GENERIC_ERROR).not.toMatch(/CRM_PP|SQLSTATE|42501/)
  })
})

function productionItem(
  partial: Partial<ProductionApplicationListItem> &
    Pick<ProductionApplicationListItem, 'id' | 'production_stage'>,
): ProductionApplicationListItem {
  return {
    household_id: 'hh1',
    carrier_id: 'c1',
    product_id: 'p1',
    product_line: 'life_term',
    state: 'TX',
    application_number: 'APP-1',
    policy_number: 'POL-1',
    underwriting_disposition: 'pending',
    delivery_status: 'pre_issue',
    submission_date: '2026-08-05',
    next_follow_up_date: null,
    submitted_premium_cents: 10000,
    annuity_deposit_cents: null,
    face_amount_cents: null,
    premium_mode: 'annual',
    issue_date: '2026-08-10',
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

function expectedRow(
  partial: Partial<LiveExpectedCompensationRow> &
    Pick<LiveExpectedCompensationRow, 'id' | 'advisor_id' | 'application_id' | 'allocation_id'>,
): LiveExpectedCompensationRow {
  return {
    advisor_display_name: 'Jared',
    writing_contract_level: 'FA',
    writing_rate: '0.01',
    compensation_base_cents: 1000000,
    commission_bps: 7500,
    expected_compensation_cents: 100000,
    calculation_status: 'resolved',
    review_reason: null,
    calculated_at: '2026-08-01T00:00:00.000Z',
    ...partial,
  }
}

function listEvent(
  partial: Partial<PaidCommissionListEvent> & Pick<PaidCommissionListEvent, 'id' | 'application_id'>,
): PaidCommissionListEvent {
  return {
    advisor_id: 'adv-a',
    allocation_id: 'alloc-a',
    event_type: 'paid',
    amount_cents: 75000,
    reversed_event_id: null,
    transaction_date: '2026-08-15',
    ...partial,
  }
}

describe('commission Phase 2 Phase 1 metric refresh from 035 events', () => {
  it('rebuilds Paid, Chargebacks, Net Paid, Outstanding, status, and last activity from refetched events', () => {
    const app = productionItem({
      id: 'app-1',
      production_stage: 'issued',
      expected_compensations: [
        expectedRow({
          id: 'exp-a',
          application_id: 'app-1',
          advisor_id: 'adv-a',
          allocation_id: 'alloc-a',
          advisor_display_name: 'Jared',
        }),
        expectedRow({
          id: 'exp-b',
          application_id: 'app-1',
          advisor_id: 'adv-b',
          allocation_id: 'alloc-b',
          advisor_display_name: 'Jazmin',
          commission_bps: 2500,
          expected_compensation_cents: 25000,
        }),
      ],
    })
    const before = buildCommissionWorkItems({ items: [app], events: [] })
    const jaredBefore = before.find((row) => row.allocationId === 'alloc-a')
    const jazminBefore = before.find((row) => row.allocationId === 'alloc-b')
    expect(jaredBefore?.paidCents).toBe(0)
    expect(jaredBefore?.outstandingCents).toBe(100000)

    const afterPaid = buildCommissionWorkItems({
      items: [app],
      events: [
        listEvent({
          id: 'paid-a',
          application_id: 'app-1',
          advisor_id: 'adv-a',
          allocation_id: 'alloc-a',
          amount_cents: 75000,
        }),
      ],
    })
    const jaredPaid = afterPaid.find((row) => row.allocationId === 'alloc-a')
    const jazminPaid = afterPaid.find((row) => row.allocationId === 'alloc-b')
    expect(jaredPaid?.paidCents).toBe(75000)
    expect(jaredPaid?.netPaidCents).toBe(75000)
    expect(jaredPaid?.outstandingCents).toBe(25000)
    expect(jaredPaid?.lastFinancialActivity).toBe('2026-08-15')
    expect(jaredPaid?.derivedStatus.primary).toBe('partially_paid')
    expect(jazminPaid?.paidCents).toBe(0)
    expect(jazminPaid?.outstandingCents).toBe(jazminBefore?.outstandingCents)

    const afterChargeback = buildCommissionWorkItems({
      items: [app],
      events: [
        listEvent({
          id: 'paid-a',
          application_id: 'app-1',
          advisor_id: 'adv-a',
          allocation_id: 'alloc-a',
          amount_cents: 75000,
        }),
        listEvent({
          id: 'cb-a',
          application_id: 'app-1',
          advisor_id: 'adv-a',
          allocation_id: 'alloc-a',
          event_type: 'chargeback',
          amount_cents: -25000,
          transaction_date: '2026-08-30',
        }),
      ],
    })
    const jaredCb = afterChargeback.find((row) => row.allocationId === 'alloc-a')
    expect(jaredCb?.chargebackCents).toBe(-25000)
    expect(jaredCb?.netPaidCents).toBe(50000)
    expect(jaredCb?.lastFinancialActivity).toBe('2026-08-30')

    const afterReverse = buildCommissionWorkItems({
      items: [app],
      events: [
        listEvent({
          id: 'paid-a',
          application_id: 'app-1',
          advisor_id: 'adv-a',
          allocation_id: 'alloc-a',
          amount_cents: 75000,
        }),
        listEvent({
          id: 'rev-a',
          application_id: 'app-1',
          advisor_id: 'adv-a',
          allocation_id: 'alloc-a',
          event_type: 'reversal',
          amount_cents: -75000,
          reversed_event_id: 'paid-a',
          transaction_date: '2026-08-31',
        }),
      ],
    })
    const jaredRev = afterReverse.find((row) => row.allocationId === 'alloc-a')
    expect(jaredRev?.paidCents).toBe(0)
    expect(jaredRev?.netPaidCents).toBe(0)
    expect(jaredRev?.eventCount).toBe(2)
    expect(jaredRev?.outstandingCents).toBe(100000)
  })
})
