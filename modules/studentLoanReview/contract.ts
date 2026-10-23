export const MAX_AID_DATA_BYTES = 512 * 1024
export const STUDENT_LOAN_WORKFLOW_URL = '/api/crm/session?workflow=student-loans'
export type LoanFact = {
  number: number
  type: string
  principal: number | null
  interest: number | null
  interestRate: number | null
  status: string
  repaymentPlan: string
  disbursedAt: string | null
  evidenceLines: number[]
}
export type AidInventory = {
  version: 1
  sourceDate: string | null
  loans: LoanFact[]
  totalPrincipal: number | null
  totalInterest: number | null
  warnings: string[]
}
export type GuidanceSource = { id: string; title: string; url: string; checkedAt: string; sha256: string; excerpt: string }
export type LoanRecommendation = {
  summary: string
  findings: { title: string; detail: string; loanNumbers: number[] }[]
  recommendations: { title: string; rationale: string; nextStep: string; sourceIds: string[] }[]
  missingInformation: string[]
}
export type LoanUpload = {
  id: string; household_id: string; case_id: string | null; file_name: string
  sha256: string; byte_size: number; source_date: string | null; created_at: string
  inventory: AidInventory
}
export type LoanReview = {
  id: string; upload_id: string; status: 'generating' | 'ready' | 'failed'
  revision: number; final_text: string; output: LoanRecommendation | null
  sources: GuidanceSource[]; model: string | null; created_at: string
  failure_code: string | null
}
export type LoanWorkspace = {
  household_id: string; household_name: string; latest_submission: string | null
  report_count: number; upload_count: number; pending_reviews: number
}
export function recommendationText(output: LoanRecommendation): string {
  return [output.summary, ...output.findings.map(f => `${f.title}\n${f.detail}`),
    ...output.recommendations.map(r => `${r.title}\n${r.rationale}\nNext step: ${r.nextStep}\nSources: ${r.sourceIds.join(', ')}`),
    'Information to confirm', ...output.missingInformation.map(s => `• ${s}`)].join('\n\n')
}
