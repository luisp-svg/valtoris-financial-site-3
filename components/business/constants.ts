export const BUSINESS_REPORT_STORAGE_KEY = 'valtoris-business-report'
export const BUSINESS_ANSWERS_STORAGE_KEY = 'valtoris-business-answers'

export type BusinessReportContext = {
  businessName: string
}

export const INITIAL_BUSINESS_REPORT_CONTEXT: BusinessReportContext = {
  businessName: '',
}
