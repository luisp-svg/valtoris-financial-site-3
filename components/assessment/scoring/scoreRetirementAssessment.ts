import { parseAmount, formatCurrency } from '../../calculator/calculations'
import { PriorityRecommendation } from '../../results/PriorityRecommendationCard'
import { CategoryScore, CategoryStatus } from '../../reportCard/types'
import { ReportActionPlan } from '../../reportDashboard/types'
import {
  RETIREMENT_CATEGORY_WEIGHTS,
  RETIREMENT_PROJECTION_ASSUMPTIONS,
  type RetirementCategoryId,
} from '../retirement/constants'
import {
  RetirementAssessmentAnswers,
  isAlreadyRetiredAnswer,
  isMarried,
} from '../retirement/types'
import { scoreToGrade } from './scoreFamilyAssessment'

export type RetirementProjectionAssumptions = {
  inflation: number
  preRetirementGrowth: number
  retirementReturn: number
  withdrawalRate: number
  longevityAge: number
  incomeReplacementFallback: number
}

export type RetirementProjectionMetrics = {
  currentAge: number
  retirementAge: number
  yearsUntilRetirement: number
  yearsInRetirement: number
  isAlreadyRetired: boolean
  usedSpendingFallback: boolean
  currentSavings: number
  monthlyContribution: number
  currentAnnualGrossIncome: number
  estimatedMonthlyRetirementSpending: number
  annualRetirementSpendingToday: number
  targetAnnualRetirementSpending: number
  targetMonthlyRetirementSpending: number
  socialSecurityMonthly: number
  pensionMonthly: number
  annuityMonthly: number
  totalGuaranteedMonthlyIncome: number
  rentalIncomeMonthly: number
  businessIncomeMonthly: number
  partTimeIncomeMonthly: number
  otherRecurringIncomeMonthly: number
  totalOtherExpectedMonthlyIncome: number
  totalOtherExpectedMonthlyIncomeExcludingPartTime: number
  partTimeIncomeIncluded: boolean
  partTimeIsTemporary: boolean
  expectedPartTimeWorkYears: number
  totalExpectedMonthlyIncomeBeforePortfolio: number
  portfolioMonthlyIncome: number
  totalProjectedMonthlyIncome: number
  guaranteedCoveragePercent: number
  expectedIncomeCoveragePercent: number
  projectedNestEgg: number
  requiredNestEgg: number
  nestEggGap: number
  portfolioAnnualIncome: number
  projectedAnnualRetirementIncome: number
  annualIncomeGap: number
  incomeReplacementRatio: number
  assumptions: RetirementProjectionAssumptions
}

export type RetirementAssessmentScoreResult = {
  overallScore: number
  overallGrade: string
  currentLevel: string
  categories: CategoryScore[]
  strongestCategory: CategoryScore
  priorityCategory: CategoryScore
  priorities: PriorityRecommendation[]
  immediatePriorities: string[]
  actionPlan: ReportActionPlan
  blueprintRecommendations: string[]
  blueprintBullets: string[]
  metrics: RetirementProjectionMetrics
  strengths: string[]
  opportunities: string[]
  defaultOpenCategory: string
  narrative: string
}

const CATEGORY_WEIGHT_FRACTIONS: Record<RetirementCategoryId, number> = {
  vision: RETIREMENT_CATEGORY_WEIGHTS.vision / 100,
  savings: RETIREMENT_CATEGORY_WEIGHTS.savings / 100,
  'income-sources': RETIREMENT_CATEGORY_WEIGHTS['income-sources'] / 100,
  'income-adequacy': RETIREMENT_CATEGORY_WEIGHTS['income-adequacy'] / 100,
  investments: RETIREMENT_CATEGORY_WEIGHTS.investments / 100,
  tax: RETIREMENT_CATEGORY_WEIGHTS.tax / 100,
  healthcare: RETIREMENT_CATEGORY_WEIGHTS.healthcare / 100,
  estate: RETIREMENT_CATEGORY_WEIGHTS.estate / 100,
}

const GOAL_CATEGORY_BOOST: Record<string, RetirementCategoryId> = {
  'close-income-gap': 'income-adequacy',
  'increase-savings': 'savings',
  'diversify-taxes': 'tax',
  'reduce-investment-risk': 'investments',
  'plan-healthcare': 'healthcare',
  'protect-legacy': 'estate',
  'clarify-timeline': 'vision',
  'maximize-income-sources': 'income-sources',
}

const BLUEPRINT_BY_CATEGORY: Record<RetirementCategoryId, string> = {
  vision: 'Clarify your retirement vision and timeline',
  savings: 'Accelerate retirement savings and contributions',
  'income-sources': 'Strengthen reliable retirement income sources',
  'income-adequacy': 'Close your retirement income gap',
  investments: 'Align investment risk and diversification',
  tax: 'Improve tax diversification and efficiency',
  healthcare: 'Prepare for healthcare and long-term care costs',
  estate: 'Complete estate, beneficiary, and legacy planning',
}

function safeFinite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback
}

function clampNonNegative(value: number): number {
  return Math.max(0, safeFinite(value))
}

function clampPercent(value: number): number {
  return Math.min(1, clampNonNegative(value))
}

function parseAge(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

function pointsFromMap(map: Record<string, number>, value: string, fallback = 0): number {
  return map[value] ?? fallback
}

/** Four-level retirement status system (extends CategoryStatus additively). */
export function scoreToRetirementStatus(score: number): CategoryStatus {
  if (score >= 80) return 'strong'
  if (score >= 65) return 'stable'
  if (score >= 45) return 'needs-attention'
  return 'priority-risk'
}

/**
 * Educational readiness labels by score band.
 * These do not imply guaranteed retirement success.
 */
export function scoreToRetirementLevel(score: number): string {
  if (score >= 90) return 'Strong Retirement Foundation'
  if (score >= 80) return 'Generally On Track'
  if (score >= 70) return 'Important Gaps to Address'
  if (score >= 60) return 'Significant Retirement Risks'
  return 'Immediate Planning Priorities'
}

function inflate(amount: number, rate: number, years: number): number {
  const n = clampNonNegative(years)
  const r = safeFinite(rate)
  if (n === 0) return clampNonNegative(amount)
  if (r === 0) return clampNonNegative(amount)
  return clampNonNegative(amount * Math.pow(1 + r, n))
}

/**
 * Future value of current savings plus level annual contributions.
 * Uses end-of-year contribution convention: FV = PV*(1+r)^n + PMT*((1+r)^n - 1)/r
 */
export function futureValueWithContributions(
  presentValue: number,
  annualContribution: number,
  annualRate: number,
  years: number,
): number {
  const pv = clampNonNegative(presentValue)
  const pmt = clampNonNegative(annualContribution)
  const n = clampNonNegative(years)
  const r = safeFinite(annualRate)

  if (n === 0) return pv
  if (r === 0) return clampNonNegative(pv + pmt * n)

  const growth = Math.pow(1 + r, n)
  if (!Number.isFinite(growth)) return pv

  return clampNonNegative(pv * growth + pmt * ((growth - 1) / r))
}

function coverageToScore(ratio: number): number {
  if (ratio >= 1.15) return 95
  if (ratio >= 1) return 88
  if (ratio >= 0.85) return 75
  if (ratio >= 0.7) return 60
  if (ratio >= 0.5) return 42
  if (ratio >= 0.25) return 28
  if (ratio > 0) return 18
  return 10
}

export function calculateRetirementProjections(
  answers: RetirementAssessmentAnswers,
  assumptionOverrides?: Partial<RetirementProjectionAssumptions>,
): RetirementProjectionMetrics {
  const assumptions: RetirementProjectionAssumptions = {
    ...RETIREMENT_PROJECTION_ASSUMPTIONS,
    ...assumptionOverrides,
  }

  const currentAge = parseAge(answers.household.currentAge)
  const isAlreadyRetired = isAlreadyRetiredAnswer(answers.household)
  const retirementAgeRaw = parseAge(answers.household.targetRetirementAge)
  const retirementAge = isAlreadyRetired
    ? currentAge
    : retirementAgeRaw > 0
      ? retirementAgeRaw
      : currentAge

  // Explicit alreadyRetired drives years; do not infer retirement from age comparison.
  const yearsUntilRetirement = isAlreadyRetired
    ? 0
    : clampNonNegative(retirementAge - currentAge)

  const retirementStartAge = isAlreadyRetired ? currentAge : Math.max(currentAge, retirementAge)
  const yearsInRetirement = clampNonNegative(assumptions.longevityAge - retirementStartAge)

  const currentSavings = parseAmount(answers.savings.currentRetirementSavings)
  const monthlyContribution = parseAmount(answers.savings.monthlyContribution)
  const annualContribution = monthlyContribution * 12
  const currentAnnualGrossIncome = parseAmount(answers.lifestyle.currentAnnualGrossIncome)
  const estimatedMonthlyRetirementSpending = parseAmount(
    answers.lifestyle.estimatedMonthlyRetirementSpending,
  )

  const usedSpendingFallback = estimatedMonthlyRetirementSpending <= 0
  const annualRetirementSpendingToday = usedSpendingFallback
    ? clampNonNegative(currentAnnualGrossIncome * assumptions.incomeReplacementFallback)
    : clampNonNegative(estimatedMonthlyRetirementSpending * 12)

  const targetAnnualRetirementSpending =
    yearsUntilRetirement > 0
      ? inflate(annualRetirementSpendingToday, assumptions.inflation, yearsUntilRetirement)
      : annualRetirementSpendingToday
  const targetMonthlyRetirementSpending = targetAnnualRetirementSpending / 12

  const projectedNestEgg = futureValueWithContributions(
    currentSavings,
    isAlreadyRetired || yearsUntilRetirement === 0 ? 0 : annualContribution,
    isAlreadyRetired || yearsUntilRetirement === 0
      ? assumptions.retirementReturn
      : assumptions.preRetirementGrowth,
    yearsUntilRetirement,
  )

  const sources = answers.incomeSources
  const socialSecurityMonthly =
    parseAmount(sources.socialSecurityMonthly) +
    (isMarried(answers.household) ? parseAmount(sources.spouseSocialSecurityMonthly) : 0)
  const pensionMonthly = parseAmount(sources.pensionMonthly)
  const annuityMonthly = parseAmount(sources.annuityMonthly)
  const totalGuaranteedMonthlyIncome = clampNonNegative(
    socialSecurityMonthly + pensionMonthly + annuityMonthly,
  )

  const rentalIncomeMonthly = parseAmount(sources.rentalIncomeMonthly)
  const businessIncomeMonthly = parseAmount(sources.businessIncomeMonthly)
  const otherRecurringIncomeMonthly = parseAmount(sources.otherRecurringIncomeMonthly)
  const expectsPartTime = sources.expectsPartTimeWork === 'yes'
  const partTimeIncomeMonthly = expectsPartTime
    ? parseAmount(sources.estimatedMonthlyPartTimeIncome)
    : 0
  const expectedPartTimeWorkYears = expectsPartTime
    ? clampNonNegative(Number.parseFloat(sources.expectedPartTimeWorkYears) || 0)
    : 0

  const totalOtherExpectedMonthlyIncomeExcludingPartTime = clampNonNegative(
    rentalIncomeMonthly + businessIncomeMonthly + otherRecurringIncomeMonthly,
  )
  const totalOtherExpectedMonthlyIncome = clampNonNegative(
    totalOtherExpectedMonthlyIncomeExcludingPartTime + partTimeIncomeMonthly,
  )

  // Income amounts are already estimated at retirement — do not inflate again.
  const totalExpectedMonthlyIncomeBeforePortfolio = clampNonNegative(
    totalGuaranteedMonthlyIncome + totalOtherExpectedMonthlyIncome,
  )

  const withdrawalRate = clampNonNegative(assumptions.withdrawalRate)
  const portfolioAnnualIncome = clampNonNegative(projectedNestEgg * withdrawalRate)
  const portfolioMonthlyIncome = portfolioAnnualIncome / 12

  const totalProjectedMonthlyIncome = clampNonNegative(
    totalExpectedMonthlyIncomeBeforePortfolio + portfolioMonthlyIncome,
  )

  const guaranteedCoveragePercent =
    targetMonthlyRetirementSpending > 0
      ? clampPercent(totalGuaranteedMonthlyIncome / targetMonthlyRetirementSpending)
      : totalGuaranteedMonthlyIncome > 0
        ? 1
        : 0

  const expectedIncomeCoveragePercent =
    targetMonthlyRetirementSpending > 0
      ? clampPercent(totalExpectedMonthlyIncomeBeforePortfolio / targetMonthlyRetirementSpending)
      : totalExpectedMonthlyIncomeBeforePortfolio > 0
        ? 1
        : 0

  // Required nest egg uses lifetime sources only (excludes temporary part-time).
  const lifetimeMonthlyIncome =
    totalGuaranteedMonthlyIncome + totalOtherExpectedMonthlyIncomeExcludingPartTime
  const lifetimeAnnualIncome = lifetimeMonthlyIncome * 12
  const portfolioNeed = clampNonNegative(targetAnnualRetirementSpending - lifetimeAnnualIncome)
  const requiredNestEgg =
    withdrawalRate > 0 ? clampNonNegative(portfolioNeed / withdrawalRate) : portfolioNeed > 0 ? projectedNestEgg : 0

  const nestEggGap = clampNonNegative(requiredNestEgg - projectedNestEgg)
  const projectedAnnualRetirementIncome = clampNonNegative(
    totalExpectedMonthlyIncomeBeforePortfolio * 12 + portfolioAnnualIncome,
  )
  const annualIncomeGap = clampNonNegative(targetAnnualRetirementSpending - projectedAnnualRetirementIncome)
  const incomeReplacementRatio =
    targetAnnualRetirementSpending > 0
      ? clampNonNegative(projectedAnnualRetirementIncome / targetAnnualRetirementSpending)
      : 1

  return {
    currentAge,
    retirementAge,
    yearsUntilRetirement,
    yearsInRetirement,
    isAlreadyRetired,
    usedSpendingFallback,
    currentSavings,
    monthlyContribution,
    currentAnnualGrossIncome,
    estimatedMonthlyRetirementSpending,
    annualRetirementSpendingToday: Math.round(annualRetirementSpendingToday),
    targetAnnualRetirementSpending: Math.round(targetAnnualRetirementSpending),
    targetMonthlyRetirementSpending: Math.round(targetMonthlyRetirementSpending),
    socialSecurityMonthly: Math.round(socialSecurityMonthly),
    pensionMonthly: Math.round(pensionMonthly),
    annuityMonthly: Math.round(annuityMonthly),
    totalGuaranteedMonthlyIncome: Math.round(totalGuaranteedMonthlyIncome),
    rentalIncomeMonthly: Math.round(rentalIncomeMonthly),
    businessIncomeMonthly: Math.round(businessIncomeMonthly),
    partTimeIncomeMonthly: Math.round(partTimeIncomeMonthly),
    otherRecurringIncomeMonthly: Math.round(otherRecurringIncomeMonthly),
    totalOtherExpectedMonthlyIncome: Math.round(totalOtherExpectedMonthlyIncome),
    totalOtherExpectedMonthlyIncomeExcludingPartTime: Math.round(
      totalOtherExpectedMonthlyIncomeExcludingPartTime,
    ),
    partTimeIncomeIncluded: expectsPartTime && partTimeIncomeMonthly > 0,
    partTimeIsTemporary: expectsPartTime,
    expectedPartTimeWorkYears,
    totalExpectedMonthlyIncomeBeforePortfolio: Math.round(totalExpectedMonthlyIncomeBeforePortfolio),
    portfolioMonthlyIncome: Math.round(portfolioMonthlyIncome),
    totalProjectedMonthlyIncome: Math.round(totalProjectedMonthlyIncome),
    guaranteedCoveragePercent: safeFinite(guaranteedCoveragePercent),
    expectedIncomeCoveragePercent: safeFinite(expectedIncomeCoveragePercent),
    projectedNestEgg: Math.round(projectedNestEgg),
    requiredNestEgg: Math.round(requiredNestEgg),
    nestEggGap: Math.round(nestEggGap),
    portfolioAnnualIncome: Math.round(portfolioAnnualIncome),
    projectedAnnualRetirementIncome: Math.round(projectedAnnualRetirementIncome),
    annualIncomeGap: Math.round(annualIncomeGap),
    incomeReplacementRatio: safeFinite(incomeReplacementRatio),
    assumptions,
  }
}

const PLAN_CLARITY_POINTS: Record<string, number> = {
  'very-clear': 95,
  'somewhat-clear': 72,
  unclear: 42,
  'no-plan': 18,
}

const LIFESTYLE_POINTS: Record<string, number> = {
  essential: 78,
  comfortable: 88,
  affluent: 82,
  luxury: 70,
}

const MOTIVATION_POINTS: Record<string, number> = {
  'income-security': 90,
  'leave-workforce': 85,
  'travel-lifestyle': 80,
  'family-legacy': 85,
  'reduce-stress': 78,
}

const EMPLOYER_MATCH_POINTS: Record<string, number> = {
  'full-match': 95,
  'partial-match': 60,
  'no-match-offered': 70,
  'not-participating': 20,
  'self-employed': 75,
  unsure: 45,
}

const CONSISTENCY_POINTS: Record<string, number> = {
  always: 95,
  'most-months': 80,
  sometimes: 55,
  rarely: 30,
  'not-saving': 10,
}

const DEBT_BURDEN_POINTS: Record<string, number> = {
  none: 95,
  low: 80,
  moderate: 55,
  high: 25,
}

const RISK_POINTS: Record<string, number> = {
  conservative: 70,
  moderate: 90,
  growth: 85,
  aggressive: 65,
  unsure: 40,
}

const DIVERSIFICATION_POINTS: Record<string, number> = {
  'well-diversified': 95,
  somewhat: 70,
  concentrated: 35,
  unsure: 40,
}

const ALLOCATION_REVIEW_POINTS: Record<string, number> = {
  'within-year': 95,
  '1-3-years': 75,
  'over-3-years': 45,
  never: 20,
  unsure: 40,
}

const TAX_PLANNING_POINTS: Record<string, number> = {
  proactive: 95,
  'annual-review': 72,
  'compliance-only': 45,
  none: 20,
}

const ROTH_USAGE_POINTS: Record<string, number> = {
  regular: 95,
  some: 70,
  none: 35,
  unsure: 40,
}

const MEDICARE_POINTS: Record<string, number> = {
  researched: 95,
  somewhat: 70,
  'not-yet': 35,
  'already-enrolled': 95,
  'years-away': 80,
}

const LTC_POINTS: Record<string, number> = {
  'has-coverage': 95,
  'self-fund': 75,
  'family-support': 50,
  'no-plan': 20,
  unsure: 35,
}

const LEGACY_POINTS: Record<string, number> = {
  strong: 90,
  moderate: 80,
  'spend-down': 70,
  unsure: 45,
}

const REVIEWED_POINTS: Record<string, number> = {
  yes: 95,
  no: 30,
  unsure: 45,
  na: 70,
}

const INFLATION_AWARENESS_POINTS: Record<string, number> = {
  yes: 95,
  no: 35,
  unsure: 50,
}

function yesNoScore(value: string, points: number): number {
  return value === 'yes' ? points : value === 'no' ? 0 : 20
}

function contributionRateScore(monthlyContribution: number, annualIncome: number): number {
  if (annualIncome <= 0) {
    if (monthlyContribution <= 0) return 15
    return 70
  }
  const rate = (monthlyContribution * 12) / annualIncome
  if (rate <= 0) return 15
  if (rate < 0.03) return 40
  if (rate < 0.06) return 60
  if (rate < 0.1) return 75
  if (rate < 0.15) return 88
  return 95
}

function savingsBalanceScore(savings: number, annualIncome: number, yearsUntilRetirement: number): number {
  if (savings <= 0) return 10
  if (annualIncome <= 0) {
    if (savings >= 1_000_000) return 90
    if (savings >= 250_000) return 75
    if (savings >= 50_000) return 55
    return 35
  }

  const multiple = savings / annualIncome
  const horizonFactor = yearsUntilRetirement >= 25 ? 0.5 : yearsUntilRetirement >= 15 ? 0.75 : 1
  const adjusted = multiple / horizonFactor

  if (adjusted >= 8) return 95
  if (adjusted >= 5) return 85
  if (adjusted >= 3) return 72
  if (adjusted >= 1.5) return 58
  if (adjusted >= 0.5) return 42
  return 25
}

function timelineRealismScore(
  isAlreadyRetired: boolean,
  currentAge: number,
  retirementAge: number,
  yearsUntil: number,
): number {
  if (isAlreadyRetired) return 88
  if (currentAge <= 0) return 40
  if (retirementAge < 50) return 45
  if (retirementAge > 75) return 55
  if (yearsUntil >= 5 && yearsUntil <= 40) return 90
  if (yearsUntil < 5) return 80
  return 65
}

function riskAlignmentScore(risk: string, yearsUntilRetirement: number, isAlreadyRetired: boolean): number {
  const base = pointsFromMap(RISK_POINTS, risk, 40)
  if (risk === 'unsure') return base

  if (isAlreadyRetired || yearsUntilRetirement <= 5) {
    if (risk === 'aggressive') return 40
    if (risk === 'conservative' || risk === 'moderate') return 90
    return base
  }
  if (yearsUntilRetirement >= 20) {
    if (risk === 'conservative') return 55
    if (risk === 'aggressive' || risk === 'growth') return 92
    return base
  }
  return base
}

function taxAccountDiversityScore(accountTypes: string[]): number {
  const types = new Set(accountTypes.filter(Boolean))
  if (types.has('none') && types.size === 1) return 15
  const meaningful = [...types].filter((type) => type !== 'none')
  if (meaningful.length === 0) return 20
  if (meaningful.length === 1) return 50
  if (meaningful.length === 2) return 72
  if (meaningful.length === 3) return 88
  return 95
}

function incomeAdequacyScore(metrics: RetirementProjectionMetrics): number {
  const ratio = metrics.incomeReplacementRatio
  if (metrics.targetAnnualRetirementSpending <= 0) {
    return metrics.projectedNestEgg > 0 || metrics.totalGuaranteedMonthlyIncome > 0 ? 70 : 40
  }
  // Weight guaranteed coverage more heavily than total projected coverage.
  const guaranteedScore = coverageToScore(metrics.guaranteedCoveragePercent)
  const totalScore = coverageToScore(ratio)
  return Math.round(guaranteedScore * 0.35 + totalScore * 0.65)
}

function modestDiversityBonus(metrics: RetirementProjectionMetrics): number {
  let sources = 0
  if (metrics.socialSecurityMonthly > 0) sources += 1
  if (metrics.pensionMonthly > 0) sources += 1
  if (metrics.annuityMonthly > 0) sources += 1
  if (metrics.rentalIncomeMonthly > 0) sources += 1
  if (metrics.businessIncomeMonthly > 0) sources += 1
  if (metrics.otherRecurringIncomeMonthly > 0) sources += 1
  if (metrics.partTimeIncomeIncluded) sources += 1

  // Cap diversity contribution so low-dollar multi-source profiles cannot look strong.
  if (sources >= 4) return 12
  if (sources === 3) return 8
  if (sources === 2) return 4
  return 0
}

function buildVisionCategory(answers: RetirementAssessmentAnswers, metrics: RetirementProjectionMetrics): CategoryScore {
  const clarity = pointsFromMap(PLAN_CLARITY_POINTS, answers.vision.planClarity)
  const lifestyle = pointsFromMap(LIFESTYLE_POINTS, answers.vision.retirementLifestyle)
  const motivation = pointsFromMap(MOTIVATION_POINTS, answers.vision.primaryMotivation)
  const timeline = timelineRealismScore(
    metrics.isAlreadyRetired,
    metrics.currentAge,
    metrics.retirementAge,
    metrics.yearsUntilRetirement,
  )
  const score = Math.round(clarity * 0.4 + lifestyle * 0.15 + motivation * 0.15 + timeline * 0.3)

  return {
    id: 'vision',
    title: 'Retirement Vision & Timeline',
    grade: scoreToGrade(score),
    score,
    status: scoreToRetirementStatus(score),
    summary:
      score >= 80
        ? 'Your retirement vision and timeline appear clear and actionable.'
        : score >= 65
          ? 'You have a direction, but timeline clarity could be stronger.'
          : 'Retirement vision or timeline clarity needs meaningful attention.',
    explanation: metrics.isAlreadyRetired
      ? 'You indicated you are already retired. Scoring emphasizes clarity of your current retirement plan rather than a future start date.'
      : `You reported retiring in about ${metrics.yearsUntilRetirement} year${metrics.yearsUntilRetirement === 1 ? '' : 's'} (age ${metrics.currentAge || 'n/a'} → ${metrics.retirementAge || 'n/a'}).`,
    guidance: 'A clear vision and realistic timeline guide savings, income design, and risk decisions.',
    recommendations:
      score >= 80
        ? ['Review your written retirement vision annually.', 'Confirm timeline assumptions after major life changes.']
        : [
            'Write a one-page retirement vision with a target date and lifestyle definition.',
            'Stress-test your retirement age against savings and income capacity.',
          ],
  }
}

function buildSavingsCategory(answers: RetirementAssessmentAnswers, metrics: RetirementProjectionMetrics): CategoryScore {
  const rateScore = contributionRateScore(metrics.monthlyContribution, metrics.currentAnnualGrossIncome)
  const balanceScore = savingsBalanceScore(
    metrics.currentSavings,
    metrics.currentAnnualGrossIncome,
    metrics.yearsUntilRetirement,
  )
  const matchScore = pointsFromMap(EMPLOYER_MATCH_POINTS, answers.savings.employerMatch)
  const consistencyScore = pointsFromMap(CONSISTENCY_POINTS, answers.savings.contributionConsistency)

  const score = metrics.isAlreadyRetired
    ? Math.round(balanceScore * 0.7 + consistencyScore * 0.15 + matchScore * 0.15)
    : Math.round(rateScore * 0.3 + balanceScore * 0.3 + matchScore * 0.2 + consistencyScore * 0.2)

  return {
    id: 'savings',
    title: 'Savings & Contribution Progress',
    grade: scoreToGrade(score),
    score,
    status: scoreToRetirementStatus(score),
    summary:
      score >= 80
        ? 'Savings balances and contribution habits look strong for your timeline.'
        : score >= 65
          ? 'You are saving, but contribution progress may need acceleration.'
          : 'Savings and contribution progress appear limited relative to retirement need.',
    explanation: `Current retirement savings: ${formatCurrency(metrics.currentSavings)}. Monthly contributions: ${formatCurrency(metrics.monthlyContribution)}.`,
    guidance: metrics.isAlreadyRetired
      ? 'In retirement, focus on sustainable withdrawals and preserving portfolio longevity.'
      : 'Consistent contributions and employer-match capture compound into long-term readiness.',
    recommendations:
      score >= 80
        ? metrics.isAlreadyRetired
          ? ['Maintain a written withdrawal policy.', 'Revisit spending annually against portfolio income.']
          : ['Raise contributions with each raise or bonus.', 'Keep capturing any available employer match.']
        : metrics.currentSavings <= 0
          ? ['Open or fund a retirement account and automate a starter contribution.', 'Capture any available employer match immediately.']
          : metrics.isAlreadyRetired
            ? ['Review withdrawal rate against longevity age 95.', 'Identify discretionary spending that can flex with markets.']
            : [
                'Increase monthly contributions by 1–2% of income.',
                'Automate transfers on payday and review match utilization.',
              ],
  }
}

function buildIncomeSourcesCategory(
  answers: RetirementAssessmentAnswers,
  metrics: RetirementProjectionMetrics,
): CategoryScore {
  const guaranteedScore = coverageToScore(metrics.guaranteedCoveragePercent)
  const expectedScore = coverageToScore(metrics.expectedIncomeCoveragePercent)
  // Guaranteed coverage weighs more than uncertain/earned income.
  const coverageScore = Math.round(guaranteedScore * 0.7 + expectedScore * 0.3)

  const ssReviewed = pointsFromMap(REVIEWED_POINTS, answers.incomeSources.socialSecurityEstimateReviewed, 40)
  const pensionUnderstood = pointsFromMap(REVIEWED_POINTS, answers.incomeSources.pensionElectionUnderstood, 40)
  const survivor = pointsFromMap(REVIEWED_POINTS, answers.incomeSources.survivorContinuation, 40)
  const inflationAwareness = pointsFromMap(
    INFLATION_AWARENESS_POINTS,
    answers.incomeSources.inflationAwareness,
    45,
  )
  const reliabilityScore = Math.round(
    ssReviewed * 0.3 + pensionUnderstood * 0.25 + survivor * 0.2 + inflationAwareness * 0.25,
  )

  const diversityBonus = modestDiversityBonus(metrics)
  const score = Math.min(100, Math.round(coverageScore * 0.55 + reliabilityScore * 0.35 + diversityBonus))

  return {
    id: 'income-sources',
    title: 'Retirement Income Sources',
    grade: scoreToGrade(score),
    score,
    status: scoreToRetirementStatus(score),
    summary:
      score >= 80
        ? 'Reliable income sources appear well aligned with spending need.'
        : score >= 65
          ? 'Income sources exist, but coverage or reliability can improve.'
          : 'Income reliability or spending coverage appears limited.',
    explanation: `Guaranteed monthly income: ${formatCurrency(metrics.totalGuaranteedMonthlyIncome)} (${Math.round(metrics.guaranteedCoveragePercent * 100)}% of spending). Other expected monthly income: ${formatCurrency(metrics.totalOtherExpectedMonthlyIncome)}${metrics.partTimeIncomeIncluded ? ' (includes temporary part-time income)' : ''}.`,
    guidance:
      'Guaranteed income (Social Security, pension, annuity) is weighted more heavily than rental, business, or temporary earned income.',
    recommendations:
      score >= 80
        ? ['Coordinate claiming and survivor strategies across household earners.', 'Revisit income-source reliability every 2–3 years.']
        : [
            'Improve the share of retirement spending covered by guaranteed income.',
            'Confirm Social Security estimates, pension elections, survivor options, and inflation impact on income.',
          ],
  }
}

function buildIncomeAdequacyCategory(metrics: RetirementProjectionMetrics): CategoryScore {
  const score = incomeAdequacyScore(metrics)
  const gap = metrics.annualIncomeGap

  return {
    id: 'income-adequacy',
    title: 'Income Adequacy & Sustainability',
    grade: scoreToGrade(score),
    score,
    status: scoreToRetirementStatus(score),
    summary:
      score >= 80
        ? 'Projected retirement income appears adequate relative to your spending target.'
        : score >= 65
          ? 'Income may cover most needs, but a sustainability gap remains.'
          : 'A meaningful retirement income gap may threaten long-term sustainability.',
    explanation: `Target monthly spending: ${formatCurrency(metrics.targetMonthlyRetirementSpending)}. Expected income before portfolio: ${formatCurrency(metrics.totalExpectedMonthlyIncomeBeforePortfolio)}. Total projected monthly income: ${formatCurrency(metrics.totalProjectedMonthlyIncome)}. Estimated annual gap: ${formatCurrency(gap)}.`,
    guidance: metrics.isAlreadyRetired
      ? 'Already-retired analysis emphasizes current spending coverage, withdrawal sustainability, and longevity.'
      : 'Adequacy compares entered retirement income plus portfolio withdrawals to inflated spending need when years remain until retirement.',
    recommendations:
      score >= 80
        ? ['Re-run projections after major income or spending changes.', 'Stress-test longevity and inflation assumptions.']
        : gap > 0
          ? [
              `Prioritize closing the estimated ${formatCurrency(gap)} annual income gap.`,
              'Combine higher savings, delayed retirement, and spending adjustments as needed.',
            ]
          : ['Confirm expense assumptions and withdrawal rate with an advisor.', 'Document a sustainable lifetime income plan.'],
  }
}

function buildInvestmentsCategory(
  answers: RetirementAssessmentAnswers,
  metrics: RetirementProjectionMetrics,
): CategoryScore {
  const risk = riskAlignmentScore(
    answers.investments.riskTolerance,
    metrics.yearsUntilRetirement,
    metrics.isAlreadyRetired,
  )
  const diversification = pointsFromMap(DIVERSIFICATION_POINTS, answers.investments.diversification)
  const review = pointsFromMap(ALLOCATION_REVIEW_POINTS, answers.investments.allocationReview)
  const debt = pointsFromMap(DEBT_BURDEN_POINTS, answers.lifestyle.debtBurden)
  const score = Math.round(risk * 0.35 + diversification * 0.35 + review * 0.2 + debt * 0.1)

  return {
    id: 'investments',
    title: 'Investment Risk & Diversification',
    grade: scoreToGrade(score),
    score,
    status: scoreToRetirementStatus(score),
    summary:
      score >= 80
        ? 'Investment risk and diversification appear aligned with your timeline.'
        : score >= 65
          ? 'Allocation is workable, but risk or review cadence may need attention.'
          : 'Investment risk, concentration, or review habits may undermine readiness.',
    explanation: `Reported risk posture: ${answers.investments.riskTolerance || 'unspecified'}; diversification: ${answers.investments.diversification || 'unspecified'}.`,
    guidance: metrics.isAlreadyRetired
      ? 'In retirement, prioritize withdrawal strategy and sequence-of-returns risk management.'
      : 'Risk should match time horizon, and diversification should be reviewed on a set cadence.',
    recommendations:
      score >= 80
        ? ['Keep a written allocation policy and rebalance annually.', 'Avoid concentration drift into single holdings.']
        : [
            'Review asset allocation against your years-to-retirement horizon.',
            'Diversify concentrated positions and set a recurring review schedule.',
          ],
  }
}

function buildTaxCategory(answers: RetirementAssessmentAnswers, metrics: RetirementProjectionMetrics): CategoryScore {
  const diversity = taxAccountDiversityScore(answers.tax.accountTypes)
  const planning = pointsFromMap(TAX_PLANNING_POINTS, answers.tax.taxPlanning)
  const roth = pointsFromMap(ROTH_USAGE_POINTS, answers.tax.rothUsage)
  const score = Math.round(diversity * 0.4 + planning * 0.35 + roth * 0.25)

  return {
    id: 'tax',
    title: 'Tax Diversification & Efficiency',
    grade: scoreToGrade(score),
    score,
    status: scoreToRetirementStatus(score),
    summary:
      score >= 80
        ? 'Tax location diversity and planning habits look strong.'
        : score >= 65
          ? 'Some tax diversification exists, with room to improve efficiency.'
          : 'Tax diversification or planning appears limited.',
    explanation: `Account types selected: ${answers.tax.accountTypes.length > 0 ? answers.tax.accountTypes.join(', ') : 'none'}.`,
    guidance: metrics.isAlreadyRetired
      ? 'In retirement, tax-efficient withdrawal sequencing can extend portfolio longevity.'
      : 'Mixing pre-tax, Roth, and taxable buckets improves flexibility in retirement.',
    recommendations:
      score >= 80
        ? ['Continue multi-year Roth and bracket management.', 'Coordinate withdrawals across account types.']
        : [
            'Build balances across Traditional, Roth, and taxable accounts where eligible.',
            'Add a simple annual tax-planning review for retirement withdrawals.',
          ],
  }
}

function buildHealthcareCategory(
  answers: RetirementAssessmentAnswers,
  metrics: RetirementProjectionMetrics,
): CategoryScore {
  const medicare = pointsFromMap(MEDICARE_POINTS, answers.healthcare.medicareReadiness)
  const ltc = pointsFromMap(LTC_POINTS, answers.healthcare.longTermCarePlan)
  const hsa = parseAmount(answers.healthcare.hsaBalance)
  const hsaScore = hsa >= 20000 ? 90 : hsa >= 5000 ? 75 : hsa > 0 ? 55 : metrics.yearsUntilRetirement > 15 ? 50 : 35
  const score = Math.round(medicare * 0.35 + ltc * 0.45 + hsaScore * 0.2)

  return {
    id: 'healthcare',
    title: 'Healthcare & Long-Term-Care Readiness',
    grade: scoreToGrade(score),
    score,
    status: scoreToRetirementStatus(score),
    summary:
      score >= 80
        ? 'Healthcare and long-term-care readiness appear thoughtfully addressed.'
        : score >= 65
          ? 'Some healthcare planning is in place, but gaps may remain.'
          : 'Healthcare or long-term-care planning needs attention before or during retirement.',
    explanation: `Medicare readiness: ${answers.healthcare.medicareReadiness || 'unspecified'}. Long-term care plan: ${answers.healthcare.longTermCarePlan || 'unspecified'}. HSA balance: ${formatCurrency(hsa)}.`,
    guidance: 'Healthcare and LTC costs are among the largest retirement uncertainties.',
    recommendations:
      score >= 80
        ? ['Revisit Medicare and LTC assumptions every few years.', 'Preserve HSA funds for qualified medical costs when possible.']
        : [
            'Document a Medicare transition plan and estimated premiums.',
            'Choose a long-term-care funding approach (insurance, self-fund, or hybrid).',
          ],
  }
}

function buildEstateCategory(answers: RetirementAssessmentAnswers): CategoryScore {
  const will = yesNoScore(answers.estate.hasWill, 22)
  const trust = yesNoScore(answers.estate.hasTrust, 22)
  const beneficiaries = yesNoScore(answers.estate.beneficiariesReviewed, 22)
  const poa = yesNoScore(answers.estate.hasPowerOfAttorney, 22)
  const legacy = pointsFromMap(LEGACY_POINTS, answers.estate.legacyIntent) * 0.12
  const score = Math.round(will + trust + beneficiaries + poa + legacy)

  return {
    id: 'estate',
    title: 'Estate, Beneficiaries & Legacy',
    grade: scoreToGrade(score),
    score,
    status: scoreToRetirementStatus(score),
    summary:
      score >= 80
        ? 'Estate documents and beneficiary planning appear in solid shape.'
        : score >= 65
          ? 'Some estate elements are in place, but updates may be needed.'
          : 'Estate documents, beneficiaries, or legacy intent need attention.',
    explanation: `Will: ${answers.estate.hasWill || 'n/a'}; Trust: ${answers.estate.hasTrust || 'n/a'}; Beneficiaries reviewed: ${answers.estate.beneficiariesReviewed || 'n/a'}; Power of attorney: ${answers.estate.hasPowerOfAttorney || 'n/a'}.`,
    guidance: 'Clear documents and updated beneficiaries protect family and legacy goals.',
    recommendations:
      score >= 80
        ? ['Review estate documents every 3–5 years or after life changes.', 'Confirm contingent beneficiaries on all accounts.']
        : [
            'Update wills, powers of attorney, and beneficiary designations.',
            'Document legacy intent and align account titling accordingly.',
          ],
  }
}

function buildPriorities(
  categories: CategoryScore[],
  answers: RetirementAssessmentAnswers,
  metrics: RetirementProjectionMetrics,
): PriorityRecommendation[] {
  const ranked = [...categories].sort((a, b) => a.score - b.score)
  const rankAdjustments = new Map<string, number>()

  for (const goal of answers.goals.selected) {
    const categoryId = GOAL_CATEGORY_BOOST[goal]
    if (categoryId) {
      rankAdjustments.set(categoryId, (rankAdjustments.get(categoryId) ?? 0) - 1)
    }
  }

  if (metrics.annualIncomeGap > 0 && metrics.incomeReplacementRatio < 0.85) {
    rankAdjustments.set('income-adequacy', (rankAdjustments.get('income-adequacy') ?? 0) - 3)
  }
  if (metrics.currentSavings <= 0 && !metrics.isAlreadyRetired) {
    rankAdjustments.set('savings', (rankAdjustments.get('savings') ?? 0) - 2)
  }
  if (metrics.isAlreadyRetired) {
    rankAdjustments.set('healthcare', (rankAdjustments.get('healthcare') ?? 0) - 1)
    rankAdjustments.set('tax', (rankAdjustments.get('tax') ?? 0) - 1)
    rankAdjustments.set('estate', (rankAdjustments.get('estate') ?? 0) - 1)
    rankAdjustments.set('income-adequacy', (rankAdjustments.get('income-adequacy') ?? 0) - 1)
  }
  if ((categories.find((c) => c.id === 'healthcare')?.score ?? 100) < 50) {
    rankAdjustments.set('healthcare', (rankAdjustments.get('healthcare') ?? 0) - 1)
  }

  ranked.sort((a, b) => {
    const aRank = a.score + (rankAdjustments.get(a.id) ?? 0) * 5
    const bRank = b.score + (rankAdjustments.get(b.id) ?? 0) * 5
    return aRank - bRank
  })

  const priorityMeta: Record<
    string,
    { title: string; why: string; impact: string; timeline: string }
  > = {
    vision: {
      title: 'Clarify Retirement Vision & Timeline',
      why: 'An unclear vision or timeline makes savings and income decisions harder to coordinate.',
      impact: 'Creates a decision framework for savings rate, risk, and retirement date.',
      timeline: 'Recommended within 30 days',
    },
    savings: {
      title: 'Accelerate Savings & Contributions',
      why: 'Current balances or contribution habits may not support your retirement income target.',
      impact: 'Improves projected nest egg and reduces future income gaps.',
      timeline: 'Recommended within 30–60 days',
    },
    'income-sources': {
      title: 'Strengthen Reliable Retirement Income',
      why: 'Guaranteed income coverage or benefit understanding may leave spending exposed.',
      impact: 'Improves reliability of lifetime cash flow in retirement.',
      timeline: 'Recommended within 60–90 days',
    },
    'income-adequacy': {
      title: 'Close Your Retirement Income Gap',
      why: 'Projected income may fall short of your retirement spending need.',
      impact: 'Improves the odds of sustaining lifestyle through longevity age 95.',
      timeline: 'Recommended within 30–60 days',
    },
    investments: {
      title: 'Align Investment Risk & Diversification',
      why: 'Risk posture, concentration, or review cadence may not match your timeline.',
      impact: 'Reduces sequence-of-returns and concentration risk near or in retirement.',
      timeline: 'Recommended within 60 days',
    },
    tax: {
      title: 'Improve Tax Diversification',
      why: 'Limited account-type diversity can reduce withdrawal flexibility later.',
      impact: 'Supports more efficient lifetime tax management in retirement.',
      timeline: 'Recommended within 60–90 days',
    },
    healthcare: {
      title: 'Prepare Healthcare & Long-Term Care',
      why: 'Healthcare or LTC planning gaps can create large unexpected retirement costs.',
      impact: 'Protects nest egg from medical and care-cost shocks.',
      timeline: 'Recommended within 60–90 days',
    },
    estate: {
      title: 'Complete Estate & Beneficiary Planning',
      why: 'Missing documents or outdated beneficiaries can disrupt family and legacy goals.',
      impact: 'Ensures assets transfer according to your wishes.',
      timeline: 'Recommended within 60–90 days',
    },
  }

  const levels: PriorityRecommendation['level'][] = ['Critical', 'Important', 'Long-Term']

  return ranked.slice(0, 3).map((category, index) => {
    const meta = priorityMeta[category.id]
    return {
      level: levels[index] ?? 'Long-Term',
      title: meta.title,
      why: `${meta.why} (${category.title} score: ${category.score}/100).`,
      timeline: meta.timeline,
      impact: meta.impact,
    }
  })
}

export function buildRetirementActionPlanFromCategories(
  categories: CategoryScore[],
  metrics: RetirementProjectionMetrics,
): ReportActionPlan {
  const byId = Object.fromEntries(categories.map((category) => [category.id, category]))
  const ranked = [...categories].sort((a, b) => a.score - b.score)
  const weakest = ranked[0]
  const second = ranked[1]
  const third = ranked[2]

  const immediate: string[] = metrics.isAlreadyRetired
    ? [
        weakest?.recommendations[0] ?? 'Review withdrawal sustainability against longevity age 95.',
        'Confirm current monthly spending against guaranteed and portfolio income.',
        second?.recommendations[0] ?? 'Document healthcare, tax, and legacy priorities for the next 90 days.',
      ]
    : [
        weakest?.recommendations[0] ?? 'Address your highest-risk retirement category.',
        second?.recommendations[0] ?? 'Confirm contribution automation and employer match.',
        metrics.annualIncomeGap > 0
          ? `Quantify and begin closing the ${formatCurrency(metrics.annualIncomeGap)} annual income gap.`
          : 'Validate that projected income still covers your retirement spending target.',
      ]

  const thirtyDay: string[] = [
    'Meet with a Valtoris Financial Strategist to review your Retirement Report Card™',
    third?.recommendations[0] ?? 'Build a written 12-month savings and income action list.',
    metrics.isAlreadyRetired
      ? (byId.tax?.recommendations[0] ?? 'Review tax-efficient withdrawal sequencing.')
      : (byId.investments?.recommendations[0] ?? 'Review investment allocation against your timeline.'),
  ]

  const ninetyDay: string[] = [
    byId.tax?.recommendations[0] ?? 'Improve tax diversification across account types.',
    byId.healthcare?.recommendations[0] ?? 'Document Medicare and long-term-care funding plans.',
    byId.estate?.recommendations[0] ?? 'Update estate documents and beneficiaries.',
  ]

  return { immediate, thirtyDay, ninetyDay }
}

function buildBlueprintRecommendations(categories: CategoryScore[]): string[] {
  const sorted = [...categories].sort((a, b) => a.score - b.score)
  const bullets = sorted
    .map((category) => BLUEPRINT_BY_CATEGORY[category.id as RetirementCategoryId])
    .filter((bullet): bullet is string => Boolean(bullet))

  if (!bullets.includes('Build a sustainable lifetime income plan')) {
    bullets.push('Build a sustainable lifetime income plan')
  }

  return bullets
}

function buildNarrative(firstName: string, overallScore: number, metrics: RetirementProjectionMetrics): string {
  const name = firstName.trim()
  const prefix = name ? `${name}, your` : 'Your'
  const gapNote =
    metrics.annualIncomeGap > 0
      ? ` An estimated ${formatCurrency(metrics.annualIncomeGap)} annual income gap remains under current assumptions.`
      : ' Projected income currently covers your modeled spending target.'
  const retiredNote = metrics.isAlreadyRetired
    ? ' Because you are already retired, this report emphasizes sustainability, withdrawals, healthcare, taxes, and legacy.'
    : ''
  const disclaimer = ' These results are educational and do not guarantee retirement outcomes.'

  if (overallScore >= 85) {
    return `${prefix} retirement profile shows strong fundamentals with targeted opportunities to refine income design and longevity planning.${gapNote}${retiredNote}${disclaimer}`
  }
  if (overallScore >= 70) {
    return `${prefix} retirement foundation is workable, but several categories need attention before income is fully sustainable.${gapNote}${retiredNote}${disclaimer}`
  }
  return `${prefix} retirement profile shows meaningful readiness gaps that should be addressed promptly.${gapNote}${retiredNote}${disclaimer}`
}

export function scoreRetirementAssessment(answers: RetirementAssessmentAnswers): RetirementAssessmentScoreResult {
  const metrics = calculateRetirementProjections(answers)

  const categories = [
    buildVisionCategory(answers, metrics),
    buildSavingsCategory(answers, metrics),
    buildIncomeSourcesCategory(answers, metrics),
    buildIncomeAdequacyCategory(metrics),
    buildInvestmentsCategory(answers, metrics),
    buildTaxCategory(answers, metrics),
    buildHealthcareCategory(answers, metrics),
    buildEstateCategory(answers),
  ]

  const overallScore = Math.round(
    categories.reduce((sum, category) => {
      const weight = CATEGORY_WEIGHT_FRACTIONS[category.id as RetirementCategoryId] ?? 0
      return sum + category.score * weight
    }, 0),
  )

  const overallGrade = scoreToGrade(overallScore)
  const currentLevel = scoreToRetirementLevel(overallScore)
  const strengths = categories.filter((category) => category.score >= 80).map((category) => category.title)
  const opportunities = categories.filter((category) => category.score < 65).map((category) => category.title)

  const strongestCategory = [...categories].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))[0]!
  const priorityCategory = [...categories].sort((a, b) => a.score - b.score || a.title.localeCompare(b.title))[0]!

  const priorities = buildPriorities(categories, answers, metrics)
  const actionPlan = buildRetirementActionPlanFromCategories(categories, metrics)
  const blueprintRecommendations = buildBlueprintRecommendations(categories)

  return {
    overallScore,
    overallGrade,
    currentLevel,
    categories,
    strongestCategory,
    priorityCategory,
    priorities,
    immediatePriorities: actionPlan.immediate,
    actionPlan,
    blueprintRecommendations,
    blueprintBullets: blueprintRecommendations,
    metrics,
    strengths,
    opportunities,
    defaultOpenCategory: priorityCategory.id,
    narrative: buildNarrative(answers.household.firstName, overallScore, metrics),
  }
}
