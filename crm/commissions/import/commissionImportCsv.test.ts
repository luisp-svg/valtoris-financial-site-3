import { describe, expect, it } from 'vitest'
import { COMMISSION_IMPORT_HEADERS } from './commissionImportConstants'
import {
  commissionImportTemplateCsv,
  hasZeroIncomeRows,
  parseCommissionImportCsv,
  parseCsvRecords,
  previewIncomeTotalCents,
} from './commissionImportCsv'

function headerLine(): string {
  return COMMISSION_IMPORT_HEADERS.join(',')
}

function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function dataLine(over: Record<string, string> = {}): string {
  const values: Record<string, string> = {
    Section: 'Insurance',
    Ordinal: '1',
    Page: '3',
    Date: '2026-08-05',
    'Payment Number': '',
    Company: 'National Life Group',
    Product: 'FlexLife II (B)',
    'Client Policy': 'L2194109',
    'Writing Associate': 'Luis & Jazmin Perez',
    Client: 'Sarah Butcher',
    'Agent Entered Premium': '',
    'Company Calculated Premium': '100.83',
    'Gross %': '115',
    'Factor %': '80',
    'Net %': '92',
    Split: '',
    Type: 'Commission',
    'Transaction Type': '100% Advance',
    Income: '2.67',
    'Chargeback Visual': '',
    ...over,
  }
  return COMMISSION_IMPORT_HEADERS.map((name) => csvField(values[name] ?? '')).join(',')
}

describe('commission import CSV parser', () => {
  it('parses a valid CSV into canonical 036 keys', () => {
    const parsed = parseCommissionImportCsv(`${headerLine()}\n${dataLine()}`)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.parsed.rows).toHaveLength(1)
    const row = parsed.parsed.rows[0]
    expect(row.source_section).toBe('insurance')
    expect(row.source_row_ordinal).toBe(1)
    expect(row.source_policy_number).toBe('L2194109')
    expect(row.source_income_cents).toBe(267)
    expect(row.source_gross_rate).toBe(115)
    expect(row.company_calculated_premium_cents).toBe(10083)
    expect(row.source_is_chargeback_visual).toBe(false)
  })

  it('keeps quoted commas inside fields', () => {
    const parsed = parseCommissionImportCsv(
      `${headerLine()}\n${dataLine({ Client: 'Butcher, Sarah' })}`,
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.parsed.rows[0].source_client).toBe('Butcher, Sarah')
  })

  it('unescapes doubled quotes', () => {
    const parsed = parseCommissionImportCsv(
      `${headerLine()}\n${dataLine({ Product: 'Flex "Life" II' })}`,
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.parsed.rows[0].source_product).toBe('Flex "Life" II')
  })

  it('accepts CRLF row separators', () => {
    const parsed = parseCommissionImportCsv(`${headerLine()}\r\n${dataLine()}\r\n`)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.parsed.rows).toHaveLength(1)
  })

  it('rejects missing required headers', () => {
    const parsed = parseCommissionImportCsv('Section,Ordinal\nInsurance,1')
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.errors[0].field).toBe('Income')
  })

  it('rejects duplicate headers', () => {
    const parsed = parseCommissionImportCsv('Section,Ordinal,Income,Income\nInsurance,1,1.00,1.00')
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.message).toMatch(/Duplicate/)
  })

  it('rejects invalid sections', () => {
    const parsed = parseCommissionImportCsv(`${headerLine()}\n${dataLine({ Section: 'Escrow' })}`)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.errors[0].field).toBe('Section')
  })

  it('rejects invalid ordinals', () => {
    const parsed = parseCommissionImportCsv(`${headerLine()}\n${dataLine({ Ordinal: '0' })}`)
    expect(parsed.ok).toBe(false)
  })

  it('rejects invalid dates', () => {
    const parsed = parseCommissionImportCsv(`${headerLine()}\n${dataLine({ Date: 'Aug 5' })}`)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.errors[0].field).toBe('Date')
  })

  it('parses positive and negative income as integer cents', () => {
    const positive = parseCommissionImportCsv(`${headerLine()}\n${dataLine({ Income: '100.00' })}`)
    const negative = parseCommissionImportCsv(
      `${headerLine()}\n${dataLine({ Income: '-25.00', Ordinal: '2' })}`,
    )
    expect(positive.ok && positive.parsed.rows[0].source_income_cents).toBe(10000)
    expect(negative.ok && negative.parsed.rows[0].source_income_cents).toBe(-2500)
  })

  it('flags zero income without sending it through as a silent success for staging UI', () => {
    const parsed = parseCommissionImportCsv(`${headerLine()}\n${dataLine({ Income: '0.00' })}`)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.parsed.rows[0].source_income_cents).toBe(0)
    expect(hasZeroIncomeRows(parsed.parsed.rows)).toBe(true)
    expect(parsed.parsed.warnings[0].field).toBe('Income')
  })

  it('does not use floating-point posting math for cents', () => {
    const parsed = parseCommissionImportCsv(`${headerLine()}\n${dataLine({ Income: '1.10' })}`)
    expect(parsed.ok && parsed.parsed.rows[0].source_income_cents).toBe(110)
  })

  it('parses premiums as source facts only', () => {
    const parsed = parseCommissionImportCsv(
      `${headerLine()}\n${dataLine({ 'Agent Entered Premium': '50.00', 'Company Calculated Premium': '49.99' })}`,
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.parsed.rows[0].agent_entered_premium_cents).toBe(5000)
    expect(parsed.parsed.rows[0].company_calculated_premium_cents).toBe(4999)
    expect(parsed.parsed.rows[0].source_income_cents).toBe(267)
  })

  it('preserves rates and does not recompute income from them', () => {
    const parsed = parseCommissionImportCsv(
      `${headerLine()}\n${dataLine({ 'Gross %': '45%', Split: '25', Income: '50.95' })}`,
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.parsed.rows[0].source_gross_rate).toBe(45)
    expect(parsed.parsed.rows[0].source_split_rate).toBe(25)
    expect(parsed.parsed.rows[0].source_income_cents).toBe(5095)
  })

  it('normalizes chargeback visual true/false without inferring from sign', () => {
    const charged = parseCommissionImportCsv(
      `${headerLine()}\n${dataLine({ Income: '-3.90', 'Chargeback Visual': 'yes' })}`,
    )
    const ambiguous = parseCommissionImportCsv(
      `${headerLine()}\n${dataLine({ Income: '-3.90', 'Chargeback Visual': '', Ordinal: '2' })}`,
    )
    expect(charged.ok && charged.parsed.rows[0].source_is_chargeback_visual).toBe(true)
    expect(ambiguous.ok && ambiguous.parsed.rows[0].source_is_chargeback_visual).toBe(false)
    expect(ambiguous.ok && ambiguous.parsed.rows[0].source_income_cents).toBe(-390)
  })

  it('keeps formula-looking text as an inert string', () => {
    const parsed = parseCommissionImportCsv(
      `${headerLine()}\n${dataLine({ Client: '=SUM(1,2)', Company: '+CMD("x")', Product: '@foo' })}`,
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.parsed.rows[0].source_client).toBe('=SUM(1,2)')
    expect(parsed.parsed.rows[0].source_company).toBe('+CMD("x")')
    expect(parsed.parsed.rows[0].source_product).toBe('@foo')
  })

  it('rejects malformed CSV', () => {
    const parsed = parseCsvRecords('Section,"unclosed')
    expect(parsed.ok).toBe(false)
  })

  it('maps paid-over-12 and additional commission sections', () => {
    const paid = parseCommissionImportCsv(
      `${headerLine()}\n${dataLine({ Section: 'Paid over 12 months', 'Payment Number': '6 / 13' })}`,
    )
    const extra = parseCommissionImportCsv(
      `${headerLine()}\n${dataLine({ Section: 'Additional commissions', Ordinal: '1', Company: '', 'Client Policy': '', 'Writing Associate': '', Type: 'Escrow Transfer', Income: '222.93' })}`,
    )
    expect(paid.ok && paid.parsed.rows[0].source_section).toBe('insurance_paid_over_12_months')
    expect(paid.ok && paid.parsed.rows[0].payment_number).toBe('6 / 13')
    expect(extra.ok && extra.parsed.rows[0].source_section).toBe('additional_commissions')
  })

  it('does not strip L vs LS policy prefixes', () => {
    const parsed = parseCommissionImportCsv(
      `${headerLine()}\n${dataLine({ 'Client Policy': 'LS2209414' })}`,
    )
    expect(parsed.ok && parsed.parsed.rows[0].source_policy_number).toBe('LS2209414')
  })

  it('sums preview income from source cents only', () => {
    const parsed = parseCommissionImportCsv(
      `${headerLine()}\n${dataLine({ Income: '8.10' })}\n${dataLine({ Ordinal: '2', Income: '8.10' })}`,
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(previewIncomeTotalCents(parsed.parsed.rows)).toBe(1620)
  })

  it('emits a header-only template without PII', () => {
    const csv = commissionImportTemplateCsv()
    expect(csv.startsWith(COMMISSION_IMPORT_HEADERS.join(','))).toBe(true)
    expect(csv).not.toMatch(/Perez|Quiroz|A42353/)
  })
})
