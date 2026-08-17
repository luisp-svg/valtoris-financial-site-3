import { describe, expect, it, vi } from 'vitest'
import {
  createCommissionImportBatch,
  createCommissionImportBatchRpcArgs,
  stageCommissionImportRows,
} from './commissionImportApi'
import type { CanonicalImportRow } from './commissionImportCsv'
import { EXPERIOR_PAID_REPORT_SOURCE_TYPE } from './commissionImportConstants'
import { canRetryStageIntoOpenBatch } from './commissionImportView'

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
