import type {
  CrmHouseholdDetail,
  HouseholdAssessmentSummary,
  HouseholdOpenOpportunitySummary,
  HouseholdOpenTaskSummary,
  HouseholdPolicySummary,
} from '../households/types'

/**
 * Approved Valtoris Household Financial Progress categories.
 * Each has an independent calculator and a fixed max-points budget.
 */
export type FinancialProgressCategoryId =
  | 'cash_flow_budget'
  | 'emergency_fund'
  | 'debt_management'
  | 'protection_insurance'
  | 'retirement_readiness'
  | 'estate_legacy'
  | 'credit_health'
  | 'financial_independence'

/** Letter grade for overall or category presentation. Null when unscored. */
export type FinancialProgressGrade = 'A' | 'B' | 'C' | 'D' | 'F'

/**
 * Urgency for recommended actions. Independent of score magnitude so
 * calculators can surface high-priority gaps even with placeholder scores.
 */
export type ActionPriority = 'critical' | 'high' | 'medium' | 'low'

/** How a category/overall Progress Score was produced. */
export type FinancialProgressScoreStatus =
  | 'placeholder'
  | 'computed'
  | 'insufficient_data'

/** Canonical category definition — maxPoints is source of truth; weight is derived. */
export type FinancialProgressCategoryDefinition = {
  id: FinancialProgressCategoryId
  label: string
  maxPoints: number
  /** Derived as maxPoints / 100. */
  weight: number
}

/**
 * Domain input for the engine. Reuses the existing Household entity —
 * does not duplicate household models.
 */
export type HouseholdFinancialProgressInput = {
  household: CrmHouseholdDetail
  /** Optional signals for future calculators; unused by placeholders. */
  assessments?: {
    family?: HouseholdAssessmentSummary | null
    business?: HouseholdAssessmentSummary | null
    retirement?: HouseholdAssessmentSummary | null
    protection?: HouseholdAssessmentSummary | null
  }
  policies?: HouseholdPolicySummary[]
  openTasks?: HouseholdOpenTaskSummary[]
  openOpportunities?: HouseholdOpenOpportunitySummary[]
  /** ISO timestamp used for snapshot.computedAt when provided. */
  asOf?: string
}

/** Category Progress — one scored dimension within Household Financial Progress. */
export type CategoryProgress = {
  categoryId: FinancialProgressCategoryId
  /** Points earned toward maxPoints when scored; null for placeholder / insufficient data. */
  score: number | null
  /** Maximum points available for this category (methodology budget). */
  maxPoints: number
  /**
   * Normalized weight derived from maxPoints / 100.
   * Not an independently maintained constant.
   */
  weight: number
  grade: FinancialProgressGrade | null
  status: FinancialProgressScoreStatus
  summary: string
}

/** Overall Progress Score + grade for the household. */
export type ProgressScore = {
  grade: FinancialProgressGrade | null
  /** 0–100 Progress Score when available; null in placeholder mode. */
  score: number | null
  status: FinancialProgressScoreStatus
  summary: string
}

/**
 * Score Snapshot — point-in-time capture of Category Progress + Progress Score.
 * Ready for persistence later; this sprint keeps it in-memory only.
 */
export type ScoreSnapshot = {
  householdId: string
  computedAt: string
  overall: ProgressScore
  categories: CategoryProgress[]
  engineVersion: string
  methodologyVersion: string
}

export type Recommendation = {
  id: string
  categoryId: FinancialProgressCategoryId
  title: string
  body: string
  priority: ActionPriority
  /** Stable key for dedupe / future workflow mapping. */
  actionKey: string
}

/**
 * Full Household Financial Progress result returned by the engine.
 */
export type HouseholdFinancialProgressResult = {
  householdId: string
  overall: ProgressScore
  categories: CategoryProgress[]
  snapshot: ScoreSnapshot
  recommendations: Recommendation[]
  /** True when every category (and overall) is still placeholder. */
  isPlaceholder: boolean
  engineVersion: string
  methodologyVersion: string
}

/**
 * Contract for an independent category calculator.
 * Calculators must not import UI and must not mutate shared state.
 */
export type CategoryCalculator = {
  readonly categoryId: FinancialProgressCategoryId
  calculate: (input: HouseholdFinancialProgressInput) => CategoryProgress
}
