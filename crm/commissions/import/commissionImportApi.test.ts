import { describe, expect, it, vi } from 'vitest'
import {
  confirmDuplicateImportRow,
  createCommissionImportBatch,
  createCommissionImportBatchRpcArgs,
  fetchFingerprintPeers,
  fetchImportApplicationCandidates,
  fetchLiveWritingAllocations,
  postCommissionImportRow,
  reviewCommissionImportRow,
  stageCommissionImportRows,
} from './commissionImportApi'
import type { CanonicalImportRow } from './commissionImportCsv'
import { EXPERIOR_PAID_REPORT_SOURCE_TYPE } from './commissionImportConstants'
import { canRetryStageIntoOpenBatch } from './commissionImportView'
import type { CommissionImportRowView } from './commissionImportView'

const sampleRow: CanonicalImportRow = {
  source_section: 'insurance',
  source_page: 3,
  source_row_ordinal: 1,
  transaction_date: '2026-08-05',
  payment_number: null,
  source_company: 'National Life Group',
  source_product: 'FlexLife II (B)',
  source_policy_number: 'L2194109',
  source_writing_associate: 'Luis & Jazmin Perez',
  source_client: 'Sarah Butcher',
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
}

describe('commission import API wrappers', () => {
  it('builds an Experior create-batch payload with filename and SHA', () => {
    const args = createCommissionImportBatchRpcArgs({
      sourceFile: 'valtoris-experior-commission-import.csv',
      fileSha256: 'a'.repeat(64),
      statementIdentifier: 'experior:A42353:2026-08-13',
      fsCode: 'A42353',
      statementDate: '2026-08-13',
      sourceCreatedAt: '2026-08-13T15:57:28Z',
      payeeName: 'Luis & Jazmin Perez',
    })
    expect(args.p_source_type).toBe(EXPERIOR_PAID_REPORT_SOURCE_TYPE)
    expect(args.p_source_file).toBe('valtoris-experior-commission-import.csv')
    expect(args.p_file_sha256).toBe('a'.repeat(64))
    expect(args).not.toHaveProperty('p_file_bytes')
    expect(args).not.toHaveProperty('p_storage_path')
  })

  it('does not stage when create-batch reports duplicate=true', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        duplicate: true,
        original_batch_id: 'orig-1',
        batch: {
          id: 'dup-1',
          source_type: EXPERIOR_PAID_REPORT_SOURCE_TYPE,
          source_file: 'file.csv',
          file_sha256: 'a'.repeat(64),
          statement_identifier: 'st',
          import_status: 'duplicate_file',
          duplicate_of_batch_id: 'orig-1',
          row_count: 0,
          ready_count: 0,
          review_count: 0,
          duplicate_count: 0,
          ignored_count: 0,
          posted_count: 0,
          failed_count: 0,
          created_at: '2026-08-17T00:00:00Z',
        },
      },
      error: null,
    })
    const created = await createCommissionImportBatch({ rpc } as never, {
      sourceFile: 'file.csv',
      fileSha256: 'a'.repeat(64),
      statementIdentifier: 'st',
    })
    expect(created.ok && created.duplicate).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][0]).toBe('create_commission_import_batch')
  })

  it('does not treat a processed original as a staging target', () => {
    expect(
      canRetryStageIntoOpenBatch({
        import_status: 'open',
        row_count: 12,
      }),
    ).toBe(false)
  })

  it('stages canonical rows once through the existing RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, created: 1, same_batch_existing: 0, row_ids: ['row-1'] },
      error: null,
    })
    const result = await stageCommissionImportRows({ rpc } as never, {
      batchId: 'batch-1',
      rows: [sampleRow],
    })
    expect(result.ok).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][0]).toBe('stage_commission_import_rows')
    expect(rpc.mock.calls[0][1]).toEqual({
      p_batch_id: 'batch-1',
      p_rows: [sampleRow],
    })
    expect(sampleRow.source_income_cents).toBe(267)
    expect(sampleRow.source_section).toBe('insurance')
  })
})

function importRow(over: Partial<CommissionImportRowView> = {}): CommissionImportRowView {
  return {
    id: 'row-1',
    batch_id: 'batch-1',
    source_section: 'insurance',
    source_page: 3,
    source_row_ordinal: 1,
    source_row_key: 'k'.repeat(64),
    transaction_fingerprint: 'f'.repeat(64),
    transaction_date: '2026-08-05',
    payment_number: null,
    source_company: 'NLG',
    source_product: 'FlexLife',
    source_policy_number: 'L2194109',
    source_writing_associate: 'Jared',
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
    resolved_carrier_id: 'carrier-1',
    resolved_application_id: null,
    resolved_allocation_id: null,
    resolved_advisor_id: null,
    resolved_event_type: null,
    posted_commission_event_id: null,
    created_at: '2026-08-17T00:00:00Z',
    ...over,
  }
}

function thenableQuery(calls: Record<string, unknown[][]>, data: unknown) {
  const query: Record<string, unknown> = {}
  const record = (name: string) =>
    (...args: unknown[]) => {
      calls[name] = [...(calls[name] ?? []), args]
      return query
    }
  query.select = record('select')
  query.eq = record('eq')
  query.is = record('is')
  query.neq = record('neq')
  query.in = record('in')
  query.limit = record('limit')
  query.then = (resolve: (value: { data: unknown; error: null }) => unknown) =>
    Promise.resolve({ data, error: null }).then(resolve)
  return query
}

describe('commission Phase 3B import API wrappers', () => {
  it('sends a complete ready resolution and never a partial payload', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        row: importRow({
          review_status: 'ready_to_post',
          resolved_application_id: 'app-1',
          resolved_allocation_id: 'alloc-1',
          resolved_event_type: 'paid',
        }),
      },
      error: null,
    })
    const result = await reviewCommissionImportRow({ rpc } as never, {
      row: importRow({ review_status: 'review_split_attribution' }),
      applicationId: 'app-1',
      allocationId: 'alloc-1',
      allocationApplicationId: 'app-1',
      eventType: 'paid',
      reason: 'Owner resolved split writer A',
    })
    expect(result.ok).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][0]).toBe('review_commission_import_row')
    expect(rpc.mock.calls[0][1]).toEqual({
      p_row_id: 'row-1',
      p_reason: 'Owner resolved split writer A',
      p_review_status: 'ready_to_post',
      p_resolved_application_id: 'app-1',
      p_resolved_allocation_id: 'alloc-1',
      p_resolved_event_type: 'paid',
    })
  })

  it('does not call the review RPC for Override ready_to_post attempts', async () => {
    const rpc = vi.fn()
    const result = await reviewCommissionImportRow({ rpc } as never, {
      row: importRow({ source_type: 'OVERRIDE', review_status: 'review_split_attribution' }),
      applicationId: 'app-1',
      allocationId: 'alloc-1',
      allocationApplicationId: 'app-1',
      eventType: 'paid',
      distinct: true,
    })
    expect(result.ok).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('does not call the review or post RPC for additional commissions', async () => {
    const rpc = vi.fn()
    const additional = importRow({
      source_section: 'additional_commissions',
      review_status: 'ignored_nonpolicy',
    })
    const reviewed = await reviewCommissionImportRow({ rpc } as never, {
      row: additional,
      applicationId: 'app-1',
      allocationId: 'alloc-1',
      eventType: 'paid',
    })
    const posted = await postCommissionImportRow({ rpc } as never, {
      row: additional,
      reason: 'should not post',
    })
    expect(reviewed.ok).toBe(false)
    expect(posted.ok).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('posts a ready paid row once and treats an idempotent duplicate response as success', async () => {
    const ready = importRow({
      review_status: 'ready_to_post',
      resolved_application_id: 'app-1',
      resolved_allocation_id: 'alloc-1',
      resolved_event_type: 'paid',
      source_income_cents: 267,
    })
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        duplicate: true,
        row: { ...ready, posted_commission_event_id: 'evt-1' },
        event: { id: 'evt-1', event_type: 'paid', amount_cents: 267 },
      },
      error: null,
    })
    const result = await postCommissionImportRow({ rpc } as never, {
      row: ready,
      reason: 'Experior Paid Report',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.duplicate).toBe(true)
    expect(result.eventId).toBe('evt-1')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][0]).toBe('post_commission_import_row')
    expect(rpc.mock.calls[0][1]).toEqual({
      p_row_id: 'row-1',
      p_reason: 'Experior Paid Report',
    })
    expect(rpc.mock.calls[0][1]).not.toHaveProperty('p_amount_cents')
  })

  it('does not post ignored, duplicate, or not-ready rows', async () => {
    const rpc = vi.fn()
    const ignored = await postCommissionImportRow({ rpc } as never, {
      row: importRow({ review_status: 'ignored_nonwriting', source_type: 'Override' }),
      reason: 'no',
    })
    const duplicate = await postCommissionImportRow({ rpc } as never, {
      row: importRow({ review_status: 'duplicate' }),
      reason: 'no',
    })
    const review = await postCommissionImportRow({ rpc } as never, {
      row: importRow({ review_status: 'review_policy_match' }),
      reason: 'no',
    })
    expect(ignored.ok).toBe(false)
    expect(duplicate.ok).toBe(false)
    expect(review.ok).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('confirms a duplicate without sending allocation fields', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, row: importRow({ review_status: 'duplicate' }) },
      error: null,
    })
    const result = await confirmDuplicateImportRow({ rpc } as never, {
      row: importRow({ review_status: 'review_duplicate_candidate' }),
    })
    expect(result.ok).toBe(true)
    expect(rpc.mock.calls[0][1]).toEqual({
      p_row_id: 'row-1',
      p_reason: 'Owner confirmed this source row is a duplicate.',
      p_review_status: 'duplicate',
    })
    expect(rpc.mock.calls[0][1]).not.toHaveProperty('p_resolved_allocation_id')
  })

  it('queries application candidates by normalized policy number and optional carrier', async () => {
    const calls: Record<string, unknown[][]> = {}
    const supabase = {
      from: vi.fn(() => thenableQuery(calls, [])),
    }
    await fetchImportApplicationCandidates(supabase as never, importRow())
    expect(supabase.from).toHaveBeenCalledWith('policy_applications')
    expect(calls.eq?.some((args) => args[0] === 'policy_number_normalized')).toBe(true)
    expect(calls.eq?.some((args) => args[0] === 'carrier_id' && args[1] === 'carrier-1')).toBe(true)
    expect(calls.limit?.[0]?.[0]).toBe(20)
    calls.eq = []
    await fetchImportApplicationCandidates(
      { from: vi.fn(() => thenableQuery(calls, [])) } as never,
      importRow({ source_policy_number: '' }),
    )
    expect(calls.eq ?? []).toHaveLength(0)
  })

  it('loads live writing allocations only for the selected application', async () => {
    const calls: Record<string, unknown[][]> = {}
    const supabase = {
      from: vi.fn(() =>
        thenableQuery(calls, [
          {
            id: 'alloc-a',
            application_id: 'app-1',
            advisor_id: 'adv-a',
            allocation_role: 'writing',
            recipient_type: 'advisor',
            commission_bps: 7500,
            writing_contract_level: 'SFA',
            effective_to: null,
            advisor: { display_name: 'Jared' },
          },
          {
            id: 'alloc-house',
            application_id: 'app-1',
            advisor_id: 'adv-h',
            allocation_role: 'house',
            recipient_type: 'firm',
            commission_bps: 0,
            effective_to: null,
          },
        ]),
      ),
    }
    const rows = await fetchLiveWritingAllocations(supabase as never, 'app-1')
    expect(calls.eq?.some((args) => args[0] === 'application_id' && args[1] === 'app-1')).toBe(true)
    expect(calls.eq?.some((args) => args[0] === 'allocation_role' && args[1] === 'writing')).toBe(true)
    expect(rows.map((item) => item.id)).toEqual(['alloc-a'])
    expect(await fetchLiveWritingAllocations(supabase as never, '')).toEqual([])
  })

  it('queries fingerprint peers by the current row fingerprint', async () => {
    const calls: Record<string, unknown[][]> = {}
    const supabase = {
      from: vi.fn(() => thenableQuery(calls, [])),
    }
    await fetchFingerprintPeers(supabase as never, importRow())
    expect(supabase.from).toHaveBeenCalledWith('commission_import_rows')
    expect(calls.eq?.some((args) => args[0] === 'transaction_fingerprint')).toBe(true)
    expect(calls.neq?.some((args) => args[0] === 'id' && args[1] === 'row-1')).toBe(true)
  })
})
