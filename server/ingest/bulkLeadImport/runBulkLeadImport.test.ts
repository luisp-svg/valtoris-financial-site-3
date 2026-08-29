import { describe, expect, it, vi } from 'vitest'
import { BULK_LEAD_IMPORT_RPC } from '../../../modules/bulkLeadImport'
import { runBulkLeadImportBatch } from './runBulkLeadImport.js'
import type { BulkLeadImportIdentity } from './payload.js'

function identity(overrides: Partial<BulkLeadImportIdentity> = {}): BulkLeadImportIdentity {
  return {
    canonicalSourceRow: 5,
    allSourceRows: [5],
    firstName: 'Andre',
    lastName: 'Quek',
    rawPhone: '7132089809',
    rawEmail: 'aquek57@yahoo.com',
    city: 'Park Row',
    state: 'TX',
    ...overrides,
  }
}

describe('runBulkLeadImportBatch', () => {
  it('dry-run classifies without calling the write RPC', async () => {
    const rpc = vi.fn()
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        is: vi.fn(() => ({
          is: vi.fn(() => ({
            or: vi.fn(async () => ({ data: [], error: null })),
          })),
          or: vi.fn(async () => ({ data: [], error: null })),
        })),
      })),
    }))
    const summary = await runBulkLeadImportBatch({
      supabase: { rpc, from } as never,
      identities: [identity()],
      mode: 'dry_run',
    })
    expect(rpc).not.toHaveBeenCalled()
    expect(summary.mode).toBe('dry_run')
    expect(summary.results[0]?.matchStatus).toBe('new_prospect')
    expect(summary.results[0]?.outcome).toBe('would_create')
    expect(summary.created).toBe(0)
  })

  it('execute calls the owner RPC once per identity and stops on authorization failure', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          ok: true,
          created: true,
          outcome: 'created',
          match_status: 'new_prospect',
          household_id: 'hh-1',
          member_id: 'm-1',
          lead_id: 'lead-1',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'PP:not_authorized' },
      })
    const summary = await runBulkLeadImportBatch({
      supabase: { rpc, from: vi.fn() } as never,
      identities: [identity(), identity({ canonicalSourceRow: 6, allSourceRows: [6] })],
      mode: 'execute',
    })
    expect(rpc).toHaveBeenCalledWith(BULK_LEAD_IMPORT_RPC, expect.objectContaining({
      p_payload: expect.objectContaining({ canonical_source_row: 5 }),
    }))
    expect(summary.created).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.stoppedEarly).toBe(true)
    expect(summary.results).toHaveLength(2)
  })
})
