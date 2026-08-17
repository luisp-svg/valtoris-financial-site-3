import {
  COMMISSION_IMPORT_HEADERS,
  COMMISSION_IMPORT_SECTIONS,
  STAGE_MAX_JSON_BYTES,
  STAGE_MAX_ROWS,
  type CommissionImportHeader,
  type CommissionImportSection,
} from './commissionImportConstants'
import {
  parseChargebackVisual,
  parseImportDate,
  parseOptionalPage,
  parseOrdinal,
  parseSignedDollarCents,
  parseSourceRate,
} from './commissionImportMoney'

export type CsvCellError = {
  rowNumber: number
  field: string
  message: string
}

export type CanonicalImportRow = {
  source_section: CommissionImportSection
  source_page: number | null
  source_row_ordinal: number
  transaction_date: string | null
  payment_number: string | null
  source_company: string | null
  source_product: string | null
  source_policy_number: string | null
  source_writing_associate: string | null
  source_client: string | null
  agent_entered_premium_cents: number | null
  company_calculated_premium_cents: number | null
  source_gross_rate: number | null
  source_factor_rate: number | null
  source_net_rate: number | null
  source_split_rate: number | null
  source_type: string | null
  source_transaction_type: string | null
  source_income_cents: number
  source_is_chargeback_visual: boolean
}

export type ParsedImportFile = {
  rows: CanonicalImportRow[]
  warnings: CsvCellError[]
  jsonBytes: number
}

export type ParseCsvFailure = {
  ok: false
  message: string
  errors: CsvCellError[]
}

export type ParseCsvSuccess = {
  ok: true
  parsed: ParsedImportFile
}

const SECTION_ALIASES: Record<string, CommissionImportSection> = {
  insurance: 'insurance',
  'paid over 12 months': 'insurance_paid_over_12_months',
  'insurance paid over 12 months': 'insurance_paid_over_12_months',
  insurance_paid_over_12_months: 'insurance_paid_over_12_months',
  'additional commissions': 'additional_commissions',
  additional_commissions: 'additional_commissions',
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/**
 * RFC-4180-ish CSV parse. Quoted commas, doubled quotes, and quoted newlines
 * are supported. Values remain inert strings — never executed.
 */
export function parseCsvRecords(text: string): { ok: true; records: string[][] } | { ok: false; message: string } {
  const source = stripBom(text)
  const records: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < source.length) {
    const ch = source[i]
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }
    if (ch === '"') {
      if (field.length > 0) {
        return { ok: false, message: 'Malformed CSV: unexpected quote inside an unquoted field.' }
      }
      inQuotes = true
      i += 1
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (ch === '\n') {
      row.push(field)
      field = ''
      records.push(row)
      row = []
      i += 1
      continue
    }
    if (ch === '\r') {
      if (source[i + 1] === '\n') i += 1
      row.push(field)
      field = ''
      records.push(row)
      row = []
      i += 1
      continue
    }
    field += ch
    i += 1
  }

  if (inQuotes) {
    return { ok: false, message: 'Malformed CSV: unclosed quoted field.' }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    records.push(row)
  }

  return { ok: true, records }
}

export function normalizeImportSection(raw: string): CommissionImportSection | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!key) return null
  return SECTION_ALIASES[key] ?? null
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function isBlankRecord(record: string[]): boolean {
  return record.every((cell) => cell.trim() === '')
}

function headerIndex(headers: string[]): { ok: true; index: Record<CommissionImportHeader, number> } | ParseCsvFailure {
  const trimmed = headers.map((h) => h.trim())
  const seen = new Set<string>()
  for (const name of trimmed) {
    if (!name) {
      return {
        ok: false,
        message: 'The import file has a blank column header.',
        errors: [{ rowNumber: 1, field: 'Header', message: 'Blank column header.' }],
      }
    }
    if (seen.has(name)) {
      return {
        ok: false,
        message: `Duplicate column header: ${name}.`,
        errors: [{ rowNumber: 1, field: name, message: 'Duplicate column header.' }],
      }
    }
    seen.add(name)
  }

  for (const required of ['Section', 'Ordinal', 'Income'] as const) {
    if (!seen.has(required)) {
      return {
        ok: false,
        message: `Missing required column: ${required}.`,
        errors: [{ rowNumber: 1, field: required, message: 'Required header is missing.' }],
      }
    }
  }

  const unknown = trimmed.filter((name) => !COMMISSION_IMPORT_HEADERS.includes(name as CommissionImportHeader))
  if (unknown.length > 0) {
    return {
      ok: false,
      message: `Unsupported column: ${unknown[0]}. Use the Valtoris Experior import template.`,
      errors: [{ rowNumber: 1, field: unknown[0], message: 'Unsupported column header.' }],
    }
  }

  const index = {} as Record<CommissionImportHeader, number>
  for (const name of COMMISSION_IMPORT_HEADERS) {
    index[name] = trimmed.indexOf(name)
  }
  return { ok: true, index }
}

function cell(record: string[], index: number): string {
  if (index < 0) return ''
  return record[index] ?? ''
}

function mapRecord(
  record: string[],
  index: Record<CommissionImportHeader, number>,
  rowNumber: number,
): { ok: true; row: CanonicalImportRow; warnings: CsvCellError[] } | { ok: false; errors: CsvCellError[] } {
  const errors: CsvCellError[] = []
  const warnings: CsvCellError[] = []

  const sectionRaw = cell(record, index.Section)
  const section = normalizeImportSection(sectionRaw)
  if (!sectionRaw.trim()) {
    errors.push({ rowNumber, field: 'Section', message: 'Section is required.' })
  } else if (!section || !COMMISSION_IMPORT_SECTIONS.includes(section)) {
    errors.push({
      rowNumber,
      field: 'Section',
      message: 'Section must be Insurance, Paid over 12 months, or Additional commissions.',
    })
  }

  const ordinal = parseOrdinal(cell(record, index.Ordinal))
  if (!ordinal.ok) {
    errors.push({
      rowNumber,
      field: 'Ordinal',
      message: ordinal.reason === 'blank' ? 'Ordinal is required.' : 'Ordinal must be a positive whole number.',
    })
  }

  const income = parseSignedDollarCents(cell(record, index.Income))
  if (!income.ok) {
    errors.push({
      rowNumber,
      field: 'Income',
      message: income.reason === 'blank' ? 'Income is required.' : 'Income must be a dollar amount such as 100.00 or -25.00.',
    })
  } else if (income.cents === 0) {
    warnings.push({
      rowNumber,
      field: 'Income',
      message: 'Income is 0.00. Zero-income rows are not staged in the normal import flow.',
    })
  }

  const page = parseOptionalPage(cell(record, index.Page))
  if (!page.ok) {
    errors.push({ rowNumber, field: 'Page', message: 'Page must be a positive whole number when provided.' })
  }

  const date = parseImportDate(cell(record, index.Date))
  if (!date.ok) {
    errors.push({ rowNumber, field: 'Date', message: 'Date must be YYYY-MM-DD when provided.' })
  }

  const agentPremiumRaw = cell(record, index['Agent Entered Premium'])
  let agentPremiumCents: number | null = null
  if (agentPremiumRaw.trim()) {
    const agentPremium = parseSignedDollarCents(agentPremiumRaw)
    if (!agentPremium.ok) {
      errors.push({
        rowNumber,
        field: 'Agent Entered Premium',
        message: 'Agent Entered Premium must be a dollar amount when provided.',
      })
    } else {
      agentPremiumCents = agentPremium.cents
    }
  }

  const companyPremiumRaw = cell(record, index['Company Calculated Premium'])
  let companyPremiumCents: number | null = null
  if (companyPremiumRaw.trim()) {
    const companyPremium = parseSignedDollarCents(companyPremiumRaw)
    if (!companyPremium.ok) {
      errors.push({
        rowNumber,
        field: 'Company Calculated Premium',
        message: 'Company Calculated Premium must be a dollar amount when provided.',
      })
    } else {
      companyPremiumCents = companyPremium.cents
    }
  }

  const gross = parseSourceRate(cell(record, index['Gross %']))
  const factor = parseSourceRate(cell(record, index['Factor %']))
  const net = parseSourceRate(cell(record, index['Net %']))
  const split = parseSourceRate(cell(record, index.Split))
  if (!gross.ok) errors.push({ rowNumber, field: 'Gross %', message: 'Gross % must be a number when provided.' })
  if (!factor.ok) errors.push({ rowNumber, field: 'Factor %', message: 'Factor % must be a number when provided.' })
  if (!net.ok) errors.push({ rowNumber, field: 'Net %', message: 'Net % must be a number when provided.' })
  if (!split.ok) errors.push({ rowNumber, field: 'Split', message: 'Split must be a number when provided.' })

  const visual = parseChargebackVisual(cell(record, index['Chargeback Visual']))
  if (!visual.ok) {
    errors.push({
      rowNumber,
      field: 'Chargeback Visual',
      message: 'Chargeback Visual must be true/yes/1, false/no/0, or blank.',
    })
  }

  if (errors.length > 0 || !section || !ordinal.ok || !income.ok) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    warnings,
    row: {
      source_section: section,
      source_page: page.ok ? page.value : null,
      source_row_ordinal: ordinal.value,
      transaction_date: date.ok ? date.value : null,
      payment_number: emptyToNull(cell(record, index['Payment Number'])),
      source_company: emptyToNull(cell(record, index.Company)),
      source_product: emptyToNull(cell(record, index.Product)),
      source_policy_number: emptyToNull(cell(record, index['Client Policy'])),
      source_writing_associate: emptyToNull(cell(record, index['Writing Associate'])),
      source_client: emptyToNull(cell(record, index.Client)),
      agent_entered_premium_cents: agentPremiumCents,
      company_calculated_premium_cents: companyPremiumCents,
      source_gross_rate: gross.ok ? gross.value : null,
      source_factor_rate: factor.ok ? factor.value : null,
      source_net_rate: net.ok ? net.value : null,
      source_split_rate: split.ok ? split.value : null,
      source_type: emptyToNull(cell(record, index.Type)),
      source_transaction_type: emptyToNull(cell(record, index['Transaction Type'])),
      source_income_cents: income.cents,
      source_is_chargeback_visual: visual.ok ? visual.value : false,
    },
  }
}

export function parseCommissionImportCsv(text: string): ParseCsvSuccess | ParseCsvFailure {
  const parsed = parseCsvRecords(text)
  if (!parsed.ok) {
    return { ok: false, message: parsed.message, errors: [{ rowNumber: 1, field: 'CSV', message: parsed.message }] }
  }
  const records = parsed.records.filter((record, idx) => !(idx > 0 && isBlankRecord(record)))
  if (records.length === 0) {
    return {
      ok: false,
      message: 'The import file is empty.',
      errors: [{ rowNumber: 1, field: 'CSV', message: 'The import file is empty.' }],
    }
  }

  const header = headerIndex(records[0])
  if (!header.ok) return header

  const dataRecords = records.slice(1)
  if (dataRecords.length === 0) {
    return {
      ok: false,
      message: 'The import file has headers but no data rows.',
      errors: [{ rowNumber: 2, field: 'CSV', message: 'No data rows.' }],
    }
  }
  if (dataRecords.length > STAGE_MAX_ROWS) {
    return {
      ok: false,
      message: `This import has ${dataRecords.length} rows. Stage at most ${STAGE_MAX_ROWS} rows in one file.`,
      errors: [{ rowNumber: 1, field: 'CSV', message: `More than ${STAGE_MAX_ROWS} data rows.` }],
    }
  }

  const rows: CanonicalImportRow[] = []
  const errors: CsvCellError[] = []
  const warnings: CsvCellError[] = []
  for (let i = 0; i < dataRecords.length; i += 1) {
    const rowNumber = i + 2
    const mapped = mapRecord(dataRecords[i], header.index, rowNumber)
    if (!mapped.ok) {
      errors.push(...mapped.errors)
      continue
    }
    warnings.push(...mapped.warnings)
    rows.push(mapped.row)
  }

  if (errors.length > 0) {
    return {
      ok: false,
      message: errors[0].message,
      errors,
    }
  }

  const jsonBytes = new TextEncoder().encode(JSON.stringify(rows)).length
  if (jsonBytes > STAGE_MAX_JSON_BYTES) {
    return {
      ok: false,
      message: `This import payload is ${jsonBytes} bytes. Stage at most ${STAGE_MAX_JSON_BYTES} bytes in one file. The file was not truncated.`,
      errors: [{ rowNumber: 1, field: 'CSV', message: 'Payload exceeds the staging size limit.' }],
    }
  }

  return { ok: true, parsed: { rows, warnings, jsonBytes } }
}

export function commissionImportTemplateCsv(): string {
  return `${COMMISSION_IMPORT_HEADERS.join(',')}\r\n`
}

export function previewIncomeTotalCents(rows: readonly CanonicalImportRow[]): number {
  return rows.reduce((sum, row) => sum + row.source_income_cents, 0)
}

export function hasZeroIncomeRows(rows: readonly CanonicalImportRow[]): boolean {
  return rows.some((row) => row.source_income_cents === 0)
}
