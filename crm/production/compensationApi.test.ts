import { describe, expect, it, vi } from 'vitest'
import {
  fetchLiveExpectedCompensations,
  fetchPaidCommissionEvents,
  fetchWritingCommissionSnapshot,
  mapLiveExpectedRow,
  mapPaidCommissionListEvent,
  mapWritingCommissionSnapshot,
} from './compensationApi'

function expectedSelectClient(result: { data: unknown; error: unknown }) {
  const is = vi.fn().mockResolvedValue(result)
  const inFn = vi.fn().mockReturnValue({ is })
  const select = vi.fn().mockReturnValue({ in: inFn })
  const from = vi.fn().mockReturnValue({ select })
  return { client: { from } as never, from, select, inFn, is }
}

describe('expected compensation mapping', () => {
  it('maps a live owner resolved row and keeps writing_rate as a string', () => {
    const mapped = mapLiveExpectedRow({
      id: 'row-1',
      application_id: 'app-1',
      allocation_id: 'alloc-1',
      advisor_id: 'adv-1',
      writing_contract_level: 'SFA',
      writing_rate: 0.015,
      compensation_base_cents: 120000,
      commission_bps: 7500,
      expected_compensation_cents: 45000,
      calculation_status: 'resolved',
      review_reason: null,
      calculated_at: '2026-08-01T00:00:00.000Z',
      superseded_at: null,
      advisor: { id: 'adv-1', display_name: 'Alex Advisor' },
    })
    expect(mapped).toMatchObject({
      advisor_display_name: 'Alex Advisor',
      writing_contract_level: 'SFA',
      writing_rate: '0.015',
      compensation_base_cents: 120000,
      expected_compensation_cents: 45000,
      calculation_status: 'resolved',
    })
  })

  it('drops superseded rows and keeps NULL expected cents', () => {
    expect(
      mapLiveExpectedRow({
        id: 'old',
        application_id: 'app-1',
        allocation_id: 'alloc-1',
        advisor_id: 'adv-1',
        writing_contract_level: 'FA',
        writing_rate: '0.01',
        compensation_base_cents: 1,
        commission_bps: 10000,
        expected_compensation_cents: 1,
        calculation_status: 'resolved',
        review_reason: null,
        calculated_at: '2026-08-01T00:00:00.000Z',
        superseded_at: '2026-08-02T00:00:00.000Z',
      }),
    ).toBeNull()

    const liveNull = mapLiveExpectedRow({
      id: 'live',
      application_id: 'app-1',
      allocation_id: 'alloc-1',
      advisor_id: 'adv-1',
      writing_contract_level: null,
      writing_rate: null,
      compensation_base_cents: null,
      commission_bps: null,
      expected_compensation_cents: null,
      calculation_status: 'review_required',
      review_reason: 'missing_compensation_base',
      calculated_at: '2026-08-01T00:00:00.000Z',
      superseded_at: null,
    })
    expect(liveNull?.expected_compensation_cents).toBeNull()
    expect(liveNull?.compensation_base_cents).toBeNull()
  })

  it('loads live expected rows in one SELECT for the page ids', async () => {
    const { client, from, select, inFn, is } = expectedSelectClient({
      data: [
        {
          id: 'row-1',
          application_id: 'app-1',
          allocation_id: 'alloc-1',
          advisor_id: 'adv-1',
          writing_contract_level: 'FA',
          writing_rate: '0.01',
          compensation_base_cents: 1000,
          commission_bps: 10000,
          expected_compensation_cents: 250,
          calculation_status: 'resolved',
          review_reason: null,
          calculated_at: '2026-08-01T00:00:00.000Z',
          superseded_at: null,
        },
      ],
      error: null,
    })
    const byApp = await fetchLiveExpectedCompensations(client, ['app-1', 'app-2'])
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('policy_application_expected_compensations')
    expect(select).toHaveBeenCalledTimes(1)
    expect(inFn).toHaveBeenCalledWith('application_id', ['app-1', 'app-2'])
    expect(is).toHaveBeenCalledWith('superseded_at', null)
    expect(byApp.get('app-1')?.[0]?.expected_compensation_cents).toBe(250)
    expect(byApp.get('app-2')).toBeUndefined()
  })
})

describe('paid commission list SELECT', () => {
  function paidSelectClient(result: { data: unknown; error: unknown }) {
    const inFn = vi.fn().mockResolvedValue(result)
    const select = vi.fn().mockReturnValue({ in: inFn })
    const from = vi.fn().mockReturnValue({ select })
    return { client: { from } as never, from, select, inFn }
  }

  it('loads 035 events in one batched SELECT and does not call the snapshot RPC', async () => {
    const { client, from, select, inFn } = paidSelectClient({
      data: [
        {
          id: 'e1',
          application_id: 'app-1',
          event_type: 'paid',
          amount_cents: 25000,
          reversed_event_id: null,
        },
      ],
      error: null,
    })
    const rows = await fetchPaidCommissionEvents(client, ['app-1', 'app-2'])
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('policy_writing_commission_events')
    expect(select).toHaveBeenCalledTimes(1)
    expect(inFn).toHaveBeenCalledWith('application_id', ['app-1', 'app-2'])
    expect(rows).toEqual([
      {
        id: 'e1',
        application_id: 'app-1',
        advisor_id: null,
        event_type: 'paid',
        amount_cents: 25000,
        reversed_event_id: null,
        transaction_date: null,
      },
    ])
  })

  it('returns an empty list when there are no application ids', async () => {
    const from = vi.fn()
    const rows = await fetchPaidCommissionEvents({ from } as never, [])
    expect(from).not.toHaveBeenCalled()
    expect(rows).toEqual([])
  })

  it('drops unusable event rows', () => {
    expect(mapPaidCommissionListEvent({ id: 'x' })).toBeNull()
    expect(
      mapPaidCommissionListEvent({
        id: 'e1',
        application_id: 'app-1',
        event_type: 'paid',
        amount_cents: 100,
        reversed_event_id: null,
      }),
    ).toMatchObject({ amount_cents: 100 })
  })
})

describe('actual commission snapshot mapping', () => {
  const paidEvent = {
    id: 'e1',
    event_type: 'paid',
    amount_cents: 60000,
    transaction_date: '2026-08-01',
    statement_identifier: 'STMT-1',
    policy_reference: 'POL-9',
    source_file: 'file.csv',
    source_row: 4,
    reversed_event_id: null,
    import_batch_identifier: 'b1',
    reason: 'Paid',
    created_at: '2026-08-01T00:00:00.000Z',
  }

  it('keeps owner multi-writer accounts, unattributed events, and RPC totals', () => {
    const mapped = mapWritingCommissionSnapshot({
      viewer: 'owner',
      application_id: 'app-1',
      accounts: [
        {
          account: { id: 'acct-a', advisor_id: 'adv-a', allocation_id: 'alloc-a', expected_cents_pinned: 60000 },
          events: [paidEvent],
          reconciliation: {
            expected_cents: 60000,
            gross_paid_cents: 60000,
            adjustment_cents: 0,
            chargeback_cents: 0,
            recovery_cents: 0,
            net_actual_cents: 60000,
            remaining_expected_cents: 0,
            variance_cents: 0,
          },
        },
        {
          account: { id: 'acct-b', advisor_id: 'adv-b', allocation_id: 'alloc-b', expected_cents_pinned: 20000 },
          events: [],
          reconciliation: {
            expected_cents: 20000,
            gross_paid_cents: 0,
            adjustment_cents: 0,
            chargeback_cents: 0,
            recovery_cents: 0,
            net_actual_cents: 0,
            remaining_expected_cents: 20000,
            variance_cents: -20000,
          },
        },
      ],
      unattributed_events: [
        {
          ...paidEvent,
          id: 'u1',
          amount_cents: 5000,
        },
      ],
      totals: {
        expected_cents: 80000,
        gross_paid_cents: 65000,
        adjustment_cents: 0,
        chargeback_cents: 0,
        recovery_cents: 0,
        net_actual_cents: 65000,
        remaining_expected_cents: 15000,
        variance_cents: -15000,
      },
    })
    expect(mapped?.viewer).toBe('owner')
    expect(mapped?.accounts).toHaveLength(2)
    expect(mapped?.unattributedEvents).toHaveLength(1)
    expect(mapped?.totals.expected_cents).toBe(80000)
    expect(mapped?.totals.variance_cents).toBe(-15000)
  })

  it('presents advisor own-only data and strips unattributed money even if present', () => {
    const mapped = mapWritingCommissionSnapshot({
      viewer: 'advisor',
      application_id: 'app-1',
      accounts: [
        {
          account: { id: 'acct-a', advisor_id: 'adv-a', allocation_id: 'alloc-a', expected_cents_pinned: 60000 },
          events: [paidEvent],
          reconciliation: {
            expected_cents: 60000,
            gross_paid_cents: 60000,
            adjustment_cents: 0,
            chargeback_cents: 0,
            recovery_cents: 0,
            net_actual_cents: 60000,
            remaining_expected_cents: 0,
            variance_cents: 0,
          },
        },
      ],
      unattributed_events: [{ ...paidEvent, id: 'should-not-leak', amount_cents: 99999 }],
      totals: {
        expected_cents: 60000,
        gross_paid_cents: 60000,
        adjustment_cents: 0,
        chargeback_cents: 0,
        recovery_cents: 0,
        net_actual_cents: 60000,
        remaining_expected_cents: 0,
        variance_cents: 0,
      },
    })
    expect(mapped?.viewer).toBe('advisor')
    expect(mapped?.accounts).toHaveLength(1)
    expect(mapped?.accounts[0]?.advisorId).toBe('adv-a')
    expect(mapped?.unattributedEvents).toEqual([])
    expect(mapped?.totals.expected_cents).toBe(60000)
  })

  it('preserves NULL expected in snapshot totals', () => {
    const mapped = mapWritingCommissionSnapshot({
      viewer: 'owner',
      application_id: 'app-1',
      accounts: [],
      unattributed_events: [],
      totals: {
        expected_cents: null,
        gross_paid_cents: 40000,
        adjustment_cents: 0,
        chargeback_cents: 0,
        recovery_cents: 0,
        net_actual_cents: 40000,
        remaining_expected_cents: null,
        variance_cents: null,
      },
    })
    expect(mapped?.totals.expected_cents).toBeNull()
    expect(mapped?.totals.remaining_expected_cents).toBeNull()
    expect(mapped?.totals.variance_cents).toBeNull()
    expect(mapped?.totals.net_actual_cents).toBe(40000)
  })

  it('calls pp_writing_commission_snapshot once with the application id', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        viewer: 'advisor',
        application_id: 'app-1',
        accounts: [],
        unattributed_events: [],
        totals: {
          expected_cents: null,
          gross_paid_cents: 0,
          adjustment_cents: 0,
          chargeback_cents: 0,
          recovery_cents: 0,
          net_actual_cents: 0,
          remaining_expected_cents: null,
          variance_cents: null,
        },
      },
      error: null,
    })
    const result = await fetchWritingCommissionSnapshot({ rpc } as never, 'app-1')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('pp_writing_commission_snapshot', {
      p_application_id: 'app-1',
    })
    expect(result.ok).toBe(true)
  })

  it('maps CRM_PP snapshot errors to safe copy', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'CRM_PP:not_authorized', code: 'PGRST', details: 'SELECT 1' },
    })
    const result = await fetchWritingCommissionSnapshot({ rpc } as never, 'app-secret')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/permission/i)
      expect(result.message).not.toMatch(/CRM_PP|PGRST|SELECT/i)
    }
  })
})
