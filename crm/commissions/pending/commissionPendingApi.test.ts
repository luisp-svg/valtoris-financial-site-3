import { describe, expect, it, vi } from 'vitest'
import {
  createCommissionPendingImportBatch,
  createCommissionPendingImportBatchRpcArgs,
  stageCommissionPendingImportRows,
} from './commissionPendingApi'
import { EXPERIOR_PENDING_REPORT_SOURCE_TYPE } from './commissionPendingConstants'
import type { CanonicalImportRow } from '../import/commissionImportCsv'

const sampleRow: CanonicalImportRow = {
  source_section: 'insurance',
  source_page: 3,
  source_row_ordinal: 1,
  transaction_date: '2026-08-17',
  payment_number: null,
  source_company: 'Symetra',
  source_product: 'Life',
  source_policy_number: 'ST11314961',
  source_writing_associate: 'Jacqueline Juarez',
  source_client: 'Client',
  agent_entered_premium_cents: null,
  company_calculated_premium_cents: 10000,
  source_gross_rate: 115,
  source_factor_rate: 80,
  source_net_rate: 92,
  source_split_rate: null,
  source_type: 'Commission',
  source_transaction_type: null,
  source_income_cents: 335512,
  source_is_chargeback_visual: false,
}

describe('pending commission import API wrappers', () => {
  it('builds an Experior Pending create-batch payload with metadata cents', () => {
    const args = createCommissionPendingImportBatchRpcArgs({
      sourceFile: 'valtoris-experior-pending-import.csv',
      fileSha256: 'a'.repeat(64),
      statementIdentifier: 'experior-pending:A42353:2026-08-17',
      fsCode: 'A42353',
      statementDate: '2026-08-17',
      sourceCreatedAt: '2026-08-17T15:57:28Z',
      payeeName: 'Jacqueline Juarez',
      statementAmountCents: 337105,
      escrowCents: 3405,
    })
    expect(args.p_source_type).toBe(EXPERIOR_PENDING_REPORT_SOURCE_TYPE)
    expect(args.p_source_file).toBe('valtoris-experior-pending-import.csv')
    expect(args.p_file_sha256).toBe('a'.repeat(64))
    expect(args.p_statement_amount_cents).toBe(337105)
    expect(args.p_escrow_cents).toBe(3405)
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
          source_type: EXPERIOR_PENDING_REPORT_SOURCE_TYPE,
          source_file: 'file.csv',
          file_sha256: 'a'.repeat(64),
          statement_identifier: 'st',
          statement_amount_cents: 337105,
          escrow_cents: 3405,
          import_status: 'duplicate_file',
          duplicate_of_batch_id: 'orig-1',
          row_count: 0,
          accepted_count: 0,
          review_count: 0,
          duplicate_count: 0,
          ignored_count: 0,
          failed_count: 0,
          created_at: '2026-08-17T00:00:00Z',
        },
      },
      error: null,
    })
    const created = await createCommissionPendingImportBatch(
      { rpc } as never,
      {
        sourceFile: 'file.csv',
        fileSha256: 'a'.repeat(64),
        statementIdentifier: 'st',
        fsCode: null,
        statementDate: null,
        sourceCreatedAt: null,
        payeeName: null,
        statementAmountCents: 337105,
        escrowCents: 3405,
      },
    )
    expect(created.ok && created.duplicate).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][0]).toBe('create_commission_pending_import_batch')
  })

  it('stages through the pending RPC only', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, created: 1, same_batch_existing: 0, row_ids: ['r1'] },
      error: null,
    })
    const staged = await stageCommissionPendingImportRows(
      { rpc } as never,
      { batchId: 'b1', rows: [sampleRow] },
    )
    expect(staged).toEqual({ ok: true, created: 1, sameBatchExisting: 0, rowIds: ['r1'] })
    expect(rpc.mock.calls[0][0]).toBe('stage_commission_pending_import_rows')
    expect(rpc.mock.calls[0][1]).toEqual({ p_batch_id: 'b1', p_rows: [sampleRow] })
  })
})
