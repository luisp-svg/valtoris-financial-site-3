import { describe, expect, it, vi } from 'vitest'
import {
  COMMISSION_PENDING_DASHBOARD_PAGE_SIZE,
  fetchCommissionPendingDashboardSource,
  mapAcceptedPendingSourceFact,
} from './commissionPendingReadApi'

function acceptedRow(id: string, extras: Record<string, unknown> = {}) {
  return {
    id,
    batch_id: 'batch-1',
    pending_review_status: 'accepted_pending',
    source_income_cents: 335512,
    transaction_date: '2026-08-17',
    source_writing_associate: 'Jacqueline Juarez',
    source_client: 'Client',
    source_policy_number: 'ST11314961',
    source_company: 'Symetra',
    source_product: 'Life',
    resolved_application_id: 'app-1',
    resolved_allocation_id: 'alloc-1',
    resolved_advisor_id: 'adv-1',
    created_at: '2026-08-17T16:00:00.000Z',
    batch: {
      statement_date: '2026-08-17',
      statement_identifier: 'experior-pending:A42353:2026-08-17',
      source_file: 'file.csv',
      source_created_at: '2026-08-17T15:57:28Z',
    },
    ...extras,
  }
}

function pendingFromMock(pages: unknown[][], reviewCount = 0) {
  const range = vi.fn()
  pages.forEach((page) => {
    range.mockResolvedValueOnce({ data: page, error: null })
  })
  const order = vi.fn(() => ({ range }))
  const inFilter = vi.fn(() => ({ order }))
  const eq = vi.fn(() => ({ in: inFilter }))
  const selectRows = vi.fn(() => ({ eq }))
  const countIn = vi.fn().mockResolvedValue({ count: reviewCount, error: null })
  const selectCount = vi.fn(() => ({ in: countIn }))
  const rpc = vi.fn()
  const from = vi.fn((table: string) => {
    if (table === 'commission_pending_import_rows') {
      return {
        select: (_columns: string, options?: { count?: string; head?: boolean }) =>
          options?.head ? selectCount() : selectRows(),
      }
    }
    throw new Error(table)
  })
  return { from, rpc, range, eq, inFilter }
}

describe('commission Phase C pending read API', () => {
  it('selects only accepted_pending rows for the working-set applications', async () => {
    const { from, eq, inFilter } = pendingFromMock([[acceptedRow('row-1')]], 2)
    const result = await fetchCommissionPendingDashboardSource(
      { from } as never,
      ['app-1', 'app-2'],
    )
    expect(from).toHaveBeenCalledWith('commission_pending_import_rows')
    expect(eq).toHaveBeenCalledWith('pending_review_status', 'accepted_pending')
    expect(inFilter).toHaveBeenCalledWith('resolved_application_id', ['app-1', 'app-2'])
    expect(result.facts).toHaveLength(1)
    expect(result.facts[0]?.sourceIncomeCents).toBe(335512)
    expect(result.reviewCount).toBe(2)
  })

  it('maps advisor-empty RLS results to zero facts without calling write RPCs', async () => {
    const { from, rpc } = pendingFromMock([[]])
    const result = await fetchCommissionPendingDashboardSource({ from, rpc } as never, ['app-1'])
    expect(rpc).not.toHaveBeenCalled()
    expect(result.facts).toEqual([])
    expect(result.reviewCount).toBe(0)
  })

  it('drops accepted rows that are missing allocation or advisor instead of counting them', () => {
    expect(mapAcceptedPendingSourceFact(acceptedRow('ok'))?.sourceIncomeCents).toBe(335512)
    expect(
      mapAcceptedPendingSourceFact(
        acceptedRow('no-alloc', { resolved_allocation_id: null }),
      ),
    ).toBeNull()
    expect(
      mapAcceptedPendingSourceFact(acceptedRow('no-advisor', { resolved_advisor_id: '   ' })),
    ).toBeNull()
    expect(
      mapAcceptedPendingSourceFact(
        acceptedRow('review', { pending_review_status: 'review_policy_match' }),
      ),
    ).toBeNull()
  })

  it('keeps paging from the raw row count when some accepted rows fail mapping', async () => {
    const fullPage = Array.from({ length: COMMISSION_PENDING_DASHBOARD_PAGE_SIZE }, (_, index) =>
      index === 0
        ? acceptedRow('bad', { resolved_allocation_id: null })
        : acceptedRow(`row-${index}`, { resolved_allocation_id: `alloc-${index}` }),
    )
    const { from, rpc, range } = pendingFromMock([
      fullPage,
      [acceptedRow('tail', { resolved_allocation_id: 'alloc-tail' })],
    ])
    const result = await fetchCommissionPendingDashboardSource({ from, rpc } as never, ['app-1'])
    expect(range).toHaveBeenCalledTimes(2)
    expect(rpc).not.toHaveBeenCalled()
    expect(result.facts).toHaveLength(COMMISSION_PENDING_DASHBOARD_PAGE_SIZE)
    expect(result.facts.some((row) => row.allocationId === 'alloc-tail')).toBe(true)
  })
})
