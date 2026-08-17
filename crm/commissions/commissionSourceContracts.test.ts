import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { formatCommissionWorkStatusLabel } from './commissionWorkView'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../..')

function readCommissionSources(): string[] {
  const files = [
    'commissionWorkView.ts',
    'commissionFilters.ts',
    'commissionPresentation.ts',
    'commissionSnapshotView.ts',
    'CommissionWorkspace.tsx',
    'CommissionSummary.tsx',
    'CommissionAdvisorBreakdown.tsx',
    'CommissionQueueTable.tsx',
    'CommissionQueueCards.tsx',
    'CommissionWorkItemDetail.tsx',
    'CommissionOwnerActions.tsx',
    'RecordCommissionEventDialog.tsx',
    'ReverseCommissionEventDialog.tsx',
    'AttributeCommissionEventDialog.tsx',
    'commissionWriteApi.ts',
    'commissionWriteView.ts',
    'commissionIdempotency.ts',
  ]
  return files.map((name) => readFileSync(join(here, name), 'utf8'))
}

describe('commission Phase 1 Experior / source contracts', () => {
  it('does not treat Override or additional commissions as writing compensation', () => {
    const sources = readCommissionSources().join('\n')
    expect(sources).toMatch(/Override, upline, and additional non-policy commissions/)
    expect(sources).not.toMatch(/source_type = 'override'|ignored_nonwriting|additional_commissions/)
  })

  it('does not display Pending, Eligible, or Released as factual statuses', () => {
    for (const status of [
      'needs_review',
      'no_payments',
      'outstanding',
      'partially_paid',
      'paid',
      'overpaid',
      'net_zero',
      'expected_unavailable',
    ] as const) {
      expect(formatCommissionWorkStatusLabel(status)).not.toMatch(/pending|eligible|released/i)
    }
    const workspace = readFileSync(join(here, 'CommissionWorkspace.tsx'), 'utf8')
    const summary = readFileSync(join(here, 'CommissionSummary.tsx'), 'utf8')
    const queue = readFileSync(join(here, 'CommissionQueueTable.tsx'), 'utf8')
    expect(workspace).not.toMatch(/\bPending\b|\bEligible\b|\bReleased\b/)
    expect(queue).not.toMatch(/\bPending\b|\bEligible\b|\bReleased\b/)
    expect(summary).toMatch(/Pending, Eligible,\s+and Released are not tracked yet/)
  })

  it('does not parse PDFs, use OCR, use AI, or post 036 rows', () => {
    const sources = readCommissionSources().join('\n')
    expect(sources).not.toMatch(/pdf-parse|pdfjs|OCR|tesseract|openai|anthropic/i)
    expect(sources).not.toContain('create_commission_import_batch')
    expect(sources).not.toContain('stage_commission_import_rows')
    expect(sources).not.toContain('post_commission_import_row')
    expect(sources).not.toContain('download-paid-report.pdf')
  })
})

describe('commission Phase 1 multi-service guardrail', () => {
  it('keeps a single Commission workspace shell without P&C or service adapters', () => {
    const workspace = readFileSync(join(here, 'CommissionWorkspace.tsx'), 'utf8')
    const presentation = readFileSync(join(here, 'commissionPresentation.ts'), 'utf8')
    expect(workspace).toContain('Commission workspace')
    expect(workspace).not.toMatch(/Life Commission workspace|P&C Commission|Student Loan Commission|Credit Repair Commission/)
    expect(presentation).toContain('commissionClientLabel')
    expect(presentation).toContain('commissionReferenceLabel')
    expect(presentation).toContain('commissionProviderLabel')
    expect(presentation).toContain('commissionProductServiceLabel')
    expect(presentation).toMatch(/later P&C \/ Student Loan \/ Credit Repair adapter/)
    expect(presentation).toContain('No generic DB table')
    expect(workspace).not.toMatch(/written premium|service fee|completion milestone/)
  })

  it('does not add a generic compensation table or Migration 039', () => {
    const migrations = readdirSync(join(root, 'supabase/migrations'))
    expect(migrations.some((name) => name.startsWith('039'))).toBe(false)
    const view = readFileSync(join(here, 'commissionWorkView.ts'), 'utf8')
    expect(view).not.toMatch(/from\('generic_compensation|create table.*commission_lifecycle/i)
  })
})
