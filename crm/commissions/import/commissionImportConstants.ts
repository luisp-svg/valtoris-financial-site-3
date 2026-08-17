/** Experior Paid Report is the only Phase 3A import source. Matches 036 source_type. */
export const EXPERIOR_PAID_REPORT_SOURCE_TYPE = 'experior_paid_report' as const

export const COMMISSION_IMPORT_SOURCE_LABEL = 'Experior Paid Report'

export const STAGE_MAX_ROWS = 500
export const STAGE_MAX_JSON_BYTES = 262144

export const COMMISSION_IMPORT_SECTIONS = [
  'insurance',
  'insurance_paid_over_12_months',
  'additional_commissions',
] as const

export type CommissionImportSection = (typeof COMMISSION_IMPORT_SECTIONS)[number]

export const COMMISSION_IMPORT_HEADERS = [
  'Section',
  'Ordinal',
  'Page',
  'Date',
  'Payment Number',
  'Company',
  'Product',
  'Client Policy',
  'Writing Associate',
  'Client',
  'Agent Entered Premium',
  'Company Calculated Premium',
  'Gross %',
  'Factor %',
  'Net %',
  'Split',
  'Type',
  'Transaction Type',
  'Income',
  'Chargeback Visual',
] as const

export type CommissionImportHeader = (typeof COMMISSION_IMPORT_HEADERS)[number]

export const COMMISSION_IMPORT_REQUIRED_HEADERS = ['Section', 'Ordinal', 'Income'] as const

export const COMMISSION_IMPORT_TEMPLATE_FILENAME = 'valtoris-experior-commission-import.csv'

export const COMMISSION_IMPORT_PASTED_FILENAME = 'pasted-experior-commission-import.csv'
