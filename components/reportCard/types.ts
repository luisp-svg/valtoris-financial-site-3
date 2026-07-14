/** Family/Business use strength | opportunity | neutral. Retirement adds four-level statuses. */
export type CategoryStatus =
  | 'strength'
  | 'opportunity'
  | 'neutral'
  | 'strong'
  | 'stable'
  | 'needs-attention'
  | 'priority-risk'

export type CategoryScore = {
  id: string
  title: string
  grade: string
  score: number
  status: CategoryStatus
  summary: string
  explanation: string
  guidance: string
  recommendations: string[]
}

export type ReportPageId = 'overview' | 'insights' | 'protection' | 'priorities' | 'next-steps'
