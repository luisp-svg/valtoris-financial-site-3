import { describe, expect, it } from 'vitest'
import { reviewTradelines, type Tradeline } from './report'

const entry: Tradeline = {
  accountGroup: 1,
  creditor: 'Sample collection agency',
  originalCreditor: 'Sample utility',
  bureau: 'TransUnion',
  balance: 300,
  reported: '10/09/2026',
  opened: '04/16/2024',
  status: 'Collection',
}

describe('credit report review', () => {
  it('compares the same report account across bureaus despite date formatting differences', () => {
    const result = reviewTradelines([
      entry,
      { ...entry, bureau: 'Experian', balance: 200, opened: '04/01/2024' },
    ])
    expect(result.every(line => line.checks.some(check => check.includes('Balances differ')))).toBe(true)
  })

  it('flags multiple same-bureau entries for invoice verification without treating them as a balance mismatch', () => {
    const result = reviewTradelines([entry, { ...entry, accountGroup: 2, balance: 400 }])
    expect(result[0].checks.some(check => check.includes('its own invoice'))).toBe(true)
    expect(result[0].checks.some(check => check.includes('Balances differ'))).toBe(false)
  })

  it('treats a paid auto loan with late payments as a payment history review', () => {
    const [result] = reviewTradelines([{ ...entry, balance: 0, status: 'Paid · Late 60 Days · Auto Loan' }])
    expect(result.checks).toHaveLength(1)
    expect(result.checks[0]).toContain('payment ledger')
  })
})
