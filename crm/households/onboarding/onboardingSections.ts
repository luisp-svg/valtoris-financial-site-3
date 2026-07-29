/**
 * Centralized Household Onboarding section metadata.
 * Source of truth for navigation, progress, routing, review order, and labels.
 */

export const ONBOARDING_SECTION_IDS = [
  'overview',
  'members',
  'income',
  'cash-flow',
  'assets',
  'debts',
  'insurance',
  'retirement',
  'estate',
  'goals',
  'review',
] as const

export type OnboardingSectionId = (typeof ONBOARDING_SECTION_IDS)[number]

/** Future Financial Progress category ids (unused in Sprint 4A.2 scoring). */
export type OnboardingScoreCategoryId =
  | 'cash_flow_budget'
  | 'emergency_fund'
  | 'debt_management'
  | 'protection_insurance'
  | 'retirement_readiness'
  | 'estate_legacy'
  | 'credit_health'
  | 'financial_independence'

export type OnboardingSectionConfig = {
  id: OnboardingSectionId
  title: string
  shortTitle?: string
  description: string
  order: number
  required: boolean
  /** Future mapping into Household Financial Progress categories. */
  scoreCategory?: OnboardingScoreCategoryId
  /** Future report section key. */
  reportSection?: string
}

export const ONBOARDING_SECTIONS: readonly OnboardingSectionConfig[] = [
  {
    id: 'overview',
    title: 'Household Overview',
    shortTitle: 'Overview',
    description: 'Household profile details used as the starting point for onboarding.',
    order: 1,
    required: true,
    reportSection: 'household_overview',
  },
  {
    id: 'members',
    title: 'Household Members',
    shortTitle: 'Members',
    description: 'Review and manage household members using the CRM member record.',
    order: 2,
    required: true,
    reportSection: 'household_members',
  },
  {
    id: 'income',
    title: 'Income and Employment',
    shortTitle: 'Income',
    description: 'Household income sources and employment details.',
    order: 3,
    required: true,
    scoreCategory: 'cash_flow_budget',
    reportSection: 'income_employment',
  },
  {
    id: 'cash-flow',
    title: 'Monthly Cash Flow',
    shortTitle: 'Cash Flow',
    description: 'Estimated monthly income, expenses, and surplus or deficit.',
    order: 4,
    required: true,
    scoreCategory: 'cash_flow_budget',
    reportSection: 'monthly_cash_flow',
  },
  {
    id: 'assets',
    title: 'Assets and Savings',
    shortTitle: 'Assets',
    description: 'Cash reserves, investment accounts, and other major assets.',
    order: 5,
    required: true,
    scoreCategory: 'emergency_fund',
    reportSection: 'assets_savings',
  },
  {
    id: 'debts',
    title: 'Debts and Liabilities',
    shortTitle: 'Debts',
    description: 'Outstanding household liabilities and payment obligations.',
    order: 6,
    required: true,
    scoreCategory: 'debt_management',
    reportSection: 'debts_liabilities',
  },
  {
    id: 'insurance',
    title: 'Insurance and Protection',
    shortTitle: 'Protection',
    description: 'Current coverage and protection concerns for educational review.',
    order: 7,
    required: true,
    scoreCategory: 'protection_insurance',
    reportSection: 'insurance_protection',
  },
  {
    id: 'retirement',
    title: 'Retirement',
    shortTitle: 'Retirement',
    description: 'Retirement savings activity, goals, and confidence.',
    order: 8,
    required: true,
    scoreCategory: 'retirement_readiness',
    reportSection: 'retirement',
  },
  {
    id: 'estate',
    title: 'Estate and Legacy',
    shortTitle: 'Estate',
    description: 'Estate planning documents and legacy intentions (educational only).',
    order: 9,
    required: true,
    scoreCategory: 'estate_legacy',
    reportSection: 'estate_legacy',
  },
  {
    id: 'goals',
    title: 'Goals and Priorities',
    shortTitle: 'Goals',
    description: 'Client-stated and advisor-observed financial priorities.',
    order: 10,
    required: true,
    scoreCategory: 'financial_independence',
    reportSection: 'goals_priorities',
  },
  {
    id: 'review',
    title: 'Financial Progress Review',
    shortTitle: 'Review',
    description:
      'Review onboarding completeness before connecting evidence to Household Financial Progress.',
    order: 11,
    required: true,
    reportSection: 'financial_progress_review',
  },
] as const

const SECTION_BY_ID: ReadonlyMap<OnboardingSectionId, OnboardingSectionConfig> = new Map(
  ONBOARDING_SECTIONS.map((section) => [section.id, section]),
)

export const DEFAULT_ONBOARDING_SECTION_ID: OnboardingSectionId = 'overview'

export const ONBOARDING_SECTION_QUERY_PARAM = 'section'

export function isOnboardingSectionId(value: string): value is OnboardingSectionId {
  return SECTION_BY_ID.has(value as OnboardingSectionId)
}

export function getOnboardingSection(
  id: OnboardingSectionId,
): OnboardingSectionConfig {
  const section = SECTION_BY_ID.get(id)
  if (!section) {
    throw new Error(`Unknown onboarding section: ${id}`)
  }
  return section
}

/** Ordered section configs (canonical order). */
export function getOrderedOnboardingSections(): readonly OnboardingSectionConfig[] {
  return ONBOARDING_SECTIONS
}

/**
 * Resolve `?section=` to a valid section id.
 * Missing or invalid values fall back to `fallback` (default: overview).
 */
export function sectionIdFromSearchParams(
  params: URLSearchParams,
  fallback: OnboardingSectionId = DEFAULT_ONBOARDING_SECTION_ID,
): OnboardingSectionId {
  const raw = params.get(ONBOARDING_SECTION_QUERY_PARAM)
  if (!raw) return fallback
  return isOnboardingSectionId(raw) ? raw : fallback
}

export function getAdjacentOnboardingSection(
  current: OnboardingSectionId,
  direction: 'previous' | 'next',
): OnboardingSectionId | null {
  const index = ONBOARDING_SECTIONS.findIndex((section) => section.id === current)
  if (index < 0) return null
  const nextIndex = direction === 'previous' ? index - 1 : index + 1
  return ONBOARDING_SECTIONS[nextIndex]?.id ?? null
}

export function getOnboardingSectionIndex(id: OnboardingSectionId): number {
  return ONBOARDING_SECTIONS.findIndex((section) => section.id === id)
}
