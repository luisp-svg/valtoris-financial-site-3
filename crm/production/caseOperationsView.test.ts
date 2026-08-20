import { describe, expect, it } from 'vitest'
import { PRODUCTION_STAGES, PRODUCTION_TERMINAL_STAGES, type ProductionStage } from './types'
import {
  CASE_OPERATIONS_DELIVERY_STAGES,
  CASE_OPERATIONS_FLAG_STAGES,
  CASE_OPERATIONS_NOTES_MAX,
  CASE_OPERATIONS_PAYLOAD_KEYS,
  ISSUED_DELIVERY_EDIT_STATUSES,
  buildCaseOperationsPayload,
  canAccessCaseOperations,
  canShowCaseOperations,
  caseOperationsEligibility,
  isIssuedDeliveryEditStatus,
  sanitizeCaseOperationsPatch,
  showLifeReplacementOnly,
  toCaseOperationsDraft,
  type CaseOperationsDraft,
  type CaseOperationsPatch,
} from './caseOperationsView'

function draft(over: Partial<CaseOperationsDraft> = {}): CaseOperationsDraft {
  return {
    nextFollowUpDate: '2026-08-21',
    notes: 'Call carrier',
    isReplacement: false,
    isExchangeOrTransfer: false,
    deliveryStatus: 'pre_issue',
    ...over,
  }
}

describe('Case Operations eligibility', () => {
  it('allows owner and advisor on live applications and hides the surface when deleted', () => {
    expect(canAccessCaseOperations({ role: 'owner', deletedAt: null })).toBe(true)
    expect(canAccessCaseOperations({ role: 'advisor', deletedAt: null })).toBe(true)
    expect(canAccessCaseOperations({ role: null, deletedAt: null })).toBe(false)
    expect(canAccessCaseOperations({ role: 'owner', deletedAt: '2026-08-01' })).toBe(false)
  })

  it('allows follow-up and notes on every production stage, including terminal stages', () => {
    for (const stage of PRODUCTION_STAGES) {
      const eligibility = caseOperationsEligibility({
        role: 'advisor',
        stage,
        productLine: 'life_term',
        deliveryStatus: stage === 'issued' ? 'not_started' : 'pre_issue',
        deletedAt: null,
      })
      expect(eligibility.followUp, stage).toBe(true)
      expect(eligibility.notes, stage).toBe(true)
      expect(canShowCaseOperations(eligibility), stage).toBe(true)
    }
  })

  it('limits replacement/exchange flags to the 032 flag stages and hides exchange on Life', () => {
    for (const stage of CASE_OPERATIONS_FLAG_STAGES) {
      const life = caseOperationsEligibility({
        role: 'owner',
        stage,
        productLine: 'life_permanent',
        deliveryStatus: 'pre_issue',
        deletedAt: null,
      })
      const fia = caseOperationsEligibility({
        role: 'owner',
        stage,
        productLine: 'fia',
        deliveryStatus: 'pre_issue',
        deletedAt: null,
      })
      expect(life.replacement, stage).toBe(true)
      expect(life.exchange, stage).toBe(false)
      expect(showLifeReplacementOnly('life_term')).toBe(true)
      expect(showLifeReplacementOnly('fia')).toBe(false)
      expect(fia.replacement, stage).toBe(true)
      expect(fia.exchange, stage).toBe(true)
    }

    const locked: ProductionStage[] = PRODUCTION_STAGES.filter(
      (stage) => !CASE_OPERATIONS_FLAG_STAGES.includes(stage),
    )
    for (const stage of locked) {
      const eligibility = caseOperationsEligibility({
        role: 'owner',
        stage,
        productLine: 'fia',
        deliveryStatus: stage === 'issued' ? 'with_agent' : 'pre_issue',
        deletedAt: null,
      })
      expect(eligibility.replacement, stage).toBe(false)
      expect(eligibility.exchange, stage).toBe(false)
    }
  })

  it('exposes delivery progress only at issued among the five update-allowed values', () => {
    expect(CASE_OPERATIONS_DELIVERY_STAGES).toEqual(['issued'])
    expect(ISSUED_DELIVERY_EDIT_STATUSES).toEqual([
      'not_started',
      'with_agent',
      'with_client',
      'requirements_pending',
      'complete',
    ])

    const issued = caseOperationsEligibility({
      role: 'advisor',
      stage: 'issued',
      productLine: 'life_term',
      deliveryStatus: 'with_client',
      deletedAt: null,
    })
    expect(issued.delivery).toBe(true)
    expect(issued.replacement).toBe(false)

    const notRequired = caseOperationsEligibility({
      role: 'advisor',
      stage: 'issued',
      productLine: 'life_term',
      deliveryStatus: 'not_required',
      deletedAt: null,
    })
    expect(notRequired.delivery).toBe(false)
    expect(isIssuedDeliveryEditStatus('not_required')).toBe(false)
    expect(isIssuedDeliveryEditStatus('pre_issue')).toBe(false)

    for (const stage of PRODUCTION_STAGES.filter((item) => item !== 'issued')) {
      const eligibility = caseOperationsEligibility({
        role: 'owner',
        stage,
        productLine: 'life_term',
        deliveryStatus: 'complete',
        deletedAt: null,
      })
      expect(eligibility.delivery, stage).toBe(false)
    }
  })

  it('limits terminal stages to follow-up and notes', () => {
    for (const stage of PRODUCTION_TERMINAL_STAGES) {
      const eligibility = caseOperationsEligibility({
        role: 'owner',
        stage,
        productLine: 'fia',
        deliveryStatus: stage === 'in_force' ? 'complete' : 'pre_issue',
        deletedAt: null,
      })
      expect(eligibility).toEqual({
        followUp: true,
        notes: true,
        replacement: false,
        exchange: false,
        delivery: false,
      })
    }
  })
})

describe('Case Operations payload', () => {
  it('sends only changed eligible fields and can clear follow-up and notes', () => {
    const eligibility = caseOperationsEligibility({
      role: 'owner',
      stage: 'submitted',
      productLine: 'fia',
      deliveryStatus: 'pre_issue',
      deletedAt: null,
    })
    const built = buildCaseOperationsPayload({
      eligibility,
      original: draft(),
      draft: draft({
        nextFollowUpDate: '',
        notes: '  ',
        isReplacement: true,
        isExchangeOrTransfer: true,
        deliveryStatus: 'complete',
      }),
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.payload).toEqual({
      next_follow_up_date: null,
      notes: null,
      is_replacement: true,
      is_exchange_or_transfer: true,
    })
    expect(built.payload && 'delivery_status' in built.payload).toBe(false)
    expect(built.payload && 'production_stage' in built.payload).toBe(false)
    expect(built.payload && 'submitted_premium_cents' in built.payload).toBe(false)
    expect(built.payload && 'policy_number' in built.payload).toBe(false)
    expect(built.payload && 'writing_receivable_expected' in built.payload).toBe(false)
  })

  it('omits Life exchange and issued-locked money/identifier fields', () => {
    const life = caseOperationsEligibility({
      role: 'advisor',
      stage: 'draft',
      productLine: 'life_term',
      deliveryStatus: 'pre_issue',
      deletedAt: null,
    })
    const built = buildCaseOperationsPayload({
      eligibility: life,
      original: draft({ isExchangeOrTransfer: true }),
      draft: draft({ isExchangeOrTransfer: false, isReplacement: true }),
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.payload).toEqual({ is_replacement: true })

    const issued = caseOperationsEligibility({
      role: 'owner',
      stage: 'issued',
      productLine: 'life_term',
      deliveryStatus: 'not_started',
      deletedAt: null,
    })
    const delivery = buildCaseOperationsPayload({
      eligibility: issued,
      original: draft({ deliveryStatus: 'not_started', notes: 'Keep' }),
      draft: draft({
        deliveryStatus: 'complete',
        notes: 'Keep',
        isReplacement: true,
      }),
    })
    expect(delivery).toEqual({
      ok: true,
      payload: { delivery_status: 'complete' },
    })

    const tooLong = buildCaseOperationsPayload({
      eligibility: issued,
      original: draft({ notes: '' }),
      draft: draft({ notes: 'x'.repeat(CASE_OPERATIONS_NOTES_MAX + 1) }),
    })
    expect(tooLong.ok).toBe(false)
  })

  it('rejects notes over 5000 characters and sanitizes unknown keys', () => {
    const eligibility = caseOperationsEligibility({
      role: 'owner',
      stage: 'in_force',
      productLine: 'fia',
      deliveryStatus: 'complete',
      deletedAt: null,
    })
    const tooLong = buildCaseOperationsPayload({
      eligibility,
      original: draft({ notes: '' }),
      draft: draft({ notes: 'n'.repeat(CASE_OPERATIONS_NOTES_MAX + 1) }),
    })
    expect(tooLong.ok).toBe(false)

    const sanitized = sanitizeCaseOperationsPatch({
      notes: 'Keep',
      next_follow_up_date: '2026-09-01',
      production_stage: 'in_force',
      submitted_premium_cents: 1,
    } as CaseOperationsPatch)
    expect(Object.keys(sanitized).sort()).toEqual(['next_follow_up_date', 'notes'])
    expect(CASE_OPERATIONS_PAYLOAD_KEYS).toEqual([
      'next_follow_up_date',
      'notes',
      'is_replacement',
      'is_exchange_or_transfer',
      'delivery_status',
    ])
  })

  it('maps application rows onto the draft without inventing values', () => {
    expect(
      toCaseOperationsDraft({
        next_follow_up_date: '2026-08-21T00:00:00.000Z',
        notes: null,
        is_replacement: true,
        is_exchange_or_transfer: false,
        delivery_status: 'with_agent',
      }),
    ).toEqual({
      nextFollowUpDate: '2026-08-21',
      notes: '',
      isReplacement: true,
      isExchangeOrTransfer: false,
      deliveryStatus: 'with_agent',
    })
  })
})
