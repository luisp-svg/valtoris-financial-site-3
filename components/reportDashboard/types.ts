import { PriorityRecommendation } from '../results/PriorityRecommendationCard'
import { CategoryScore } from '../reportCard/types'

export type ReportHeroMetaCard =
  | {
      type: 'progress'
      label: string
      value: number
      copy?: string
    }
  | {
      type: 'metric'
      label: string
      value: string
      copy?: string
    }

export type ReportActionPlanIcon = 'bolt' | 'calendar' | 'flag'

export type ReportActionPlan = {
  immediate: readonly string[]
  thirtyDay: readonly string[]
  ninetyDay: readonly string[]
}

export type ReportProtectionAnalysis = {
  label: string
  value: string
  note: string
}

export type ReportDashboardData = {
  title: string
  preparedFor: string
  narrative: string
  scoreLabel: string
  score: number
  grade: string
  level: string
  heroMeta: ReportHeroMetaCard[]
  glanceLead: string
  strengths?: readonly string[]
  opportunities?: readonly string[]
  protectionAnalysis?: ReportProtectionAnalysis
  categories: CategoryScore[]
  prioritiesTitle: string
  prioritiesLead: string
  priorities: PriorityRecommendation[]
  impactLabel: string
  actionPlanTitle: string
  actionPlanLead: string
  actionPlan: ReportActionPlan
  actionPlanColumnIcons?: readonly [ReportActionPlanIcon, ReportActionPlanIcon, ReportActionPlanIcon]
  categoriesTitle: string
  categoriesLead: string
  statusLabels: {
    strength: string
    opportunity: string
    neutral: string
    strong?: string
    stable?: string
    'needs-attention'?: string
    'priority-risk'?: string
  }
  statusMetricLabel?: string
  recommendationsSubhead: string
  blueprintTitle: string
  blueprintCopy: string
  blueprintBullets?: readonly string[]
  footerLines: readonly [string, string]
  defaultOpenCategory: string
}
