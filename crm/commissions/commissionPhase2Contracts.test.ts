import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../..')
const migrationsDir = join(root, 'supabase/migrations')

function read(name: string): string {
  return readFileSync(join(here, name), 'utf8')
}

describe('commission Phase 2 contracts', () => {
  it('does not add Migration 039 or change 001–038', () => {
    const numbered = readdirSync(migrationsDir).filter((name) => /^\d{3}_/.test(name))
    expect(numbered).toHaveLength(38)
    expect(numbered.some((name) => name.startsWith('039'))).toBe(false)
    expect(existsSync(join(migrationsDir, '039_commission_lifecycle.sql'))).toBe(false)
  })

  it('writes only through existing 035 RPCs with no table DML or service-role client', () => {
    const api = read('commissionWriteApi.ts')
    expect(api).toContain("rpc(rpcName")
    expect(api).toContain('record_policy_writing_commission_event')
    expect(api).toContain('record_policy_writing_commission_event_pre_issue')
    expect(api).toContain('reverse_policy_writing_commission_event')
    expect(api).toContain('attribute_unattributed_commission_event')
    expect(api).not.toMatch(/\.insert\s*\(/)
    expect(api).not.toMatch(/\.update\s*\(/)
    expect(api).not.toMatch(/\.upsert\s*\(/)
    expect(api).not.toMatch(/\.delete\s*\(/)
    expect(api).not.toContain('SERVICE_ROLE')
    expect(api).not.toContain('create_commission_import_batch')
    expect(api).not.toContain('stage_commission_import_rows')
    expect(api).not.toContain('review_commission_import_row')
    expect(api).not.toContain('post_commission_import_row')
    expect(api).not.toContain('p_import_batch_identifier')
  })

  it('keeps advisor mutation UI behind owner checks and does not offer reversal as a record type', () => {
    const actions = read('CommissionOwnerActions.tsx')
    const record = read('RecordCommissionEventDialog.tsx')
    const reverse = read('ReverseCommissionEventDialog.tsx')
    const attribute = read('AttributeCommissionEventDialog.tsx')
    const detail = read('CommissionWorkItemDetail.tsx')
    const table = read('CommissionQueueTable.tsx')
    expect(actions).toContain('canRecordAttributedActual(isOwner, item)')
    expect(actions).toContain('Record actual')
    expect(actions).toContain('Record pre-issue actual')
    expect(table).toContain('{isOwner ? <th scope="col">Actions</th> : null}')
    expect(detail).toContain('isOwner ? renderEventActions : undefined')
    expect(detail).toContain('canReverseCommissionEvent')
    expect(detail).toContain('canAttributeCommissionEvent')
    expect(record).toContain('MANUAL_RECORD_EVENT_TYPES')
    expect(record).not.toMatch(/<option[^>]*>Reversal/)
    expect(record).not.toMatch(/\bPending\b|\bEligible\b|\bReleased\b/)
    expect(reverse).toContain('The original event remains in history')
    expect(reverse).not.toContain('p_amount_cents')
    expect(attribute).toContain('Amounts are not filled from writing split percentages')
    expect(read('commissionWriteView.ts')).not.toMatch(/upline|generational|override commission/i)
  })

  it('does not implement PDF, OCR, AI, or extra service adapters', () => {
    const sources = [
      'commissionWriteApi.ts',
      'RecordCommissionEventDialog.tsx',
      'ReverseCommissionEventDialog.tsx',
      'AttributeCommissionEventDialog.tsx',
      'CommissionOwnerActions.tsx',
      'commissionIdempotency.ts',
    ].map(read).join('\n')
    expect(sources).not.toMatch(/pdf-parse|pdfjs|OCR|tesseract|openai|anthropic/i)
    expect(sources).not.toMatch(/P&C Commission|Student Loan Commission|Credit Repair Commission/)
  })
})
