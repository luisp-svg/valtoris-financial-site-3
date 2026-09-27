import { describe, expect, it } from 'vitest'
import {
  defaultDraft,
  linesForVertical,
  money,
  parseCents,
  recordPayload,
  serviceError,
  splitPayload,
} from './model'
describe('service production input rules', () => {
  it('keeps an unknown value distinct from a supported zero', () => {
    expect(parseCents('')).toBeNull()
    expect(parseCents('0.00')).toBe(0)
    expect(money(null)).toBe('Not recorded')
    expect(money(0)).toBe('$0.00')
  })
  it('preserves cents exactly and rejects ambiguous monetary input', () => {
    expect(parseCents('123456.78')).toBe(12345678)
    expect(parseCents('0.29')).toBe(29)
    for (const value of [
      '-1',
      '1e3',
      'NaN',
      '1.001',
      '1,000',
      '10000000000',
      'Infinity',
    ])
      expect(() => parseCents(value)).toThrow()
  })
  it('rejects duplicate writers, missing writers and incomplete splits', () => {
    expect(
      splitPayload([
        { advisor_id: 'a', percent: '33.33' },
        { advisor_id: 'b', percent: '66.67' },
      ]).map((r) => r.writing_bps),
    ).toEqual([3333, 6667])
    for (const rows of [
      [],
      [{ advisor_id: '', percent: '100' }],
      [{ advisor_id: 'a', percent: '99.99' }],
      [
        { advisor_id: 'a', percent: '50' },
        { advisor_id: 'a', percent: '50' },
      ],
    ])
      expect(() => splitPayload(rows)).toThrow()
  })
  it('requires submission dates for completed or submitted production', () => {
    const draft = {
      ...defaultDraft(),
      provider_name: 'Provider',
      product_name: 'Product',
    }
    expect(recordPayload(draft).value_cents).toBeNull()
    for (const status of ['submitted', 'completed'] as const)
      expect(() =>
        recordPayload({ ...draft, production_status: status }),
      ).toThrow('submission date')
  })
  it('offers both P&C lines without reclassifying the existing opportunity', () => {
    expect(linesForVertical('pc')).toEqual(['pc_personal', 'pc_commercial'])
    expect(linesForVertical('life')).toEqual([])
    expect(linesForVertical('tax_strategy')).toEqual(['tax_strategy'])
  })
  it('explains stale edits and never prints raw database errors', () => {
    expect(serviceError({ message: 'CRM_SP:stale_record' })).toContain('Reload')
    expect(
      serviceError({ message: 'private SQL with client values' }),
    ).not.toContain('private SQL')
  })
})
