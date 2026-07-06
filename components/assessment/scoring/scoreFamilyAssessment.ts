import { parseAmount, formatCurrency } from '../../calculator/calculations'
import { PriorityRecommendation } from '../../results/PriorityRecommendationCard'
import { CategoryScore } from '../../reportCard/types'
import { ReportActionPlan } from '../../reportDashboard/types'
import { DemoAssessmentAnswers } from '../types'

export type FamilyAssessmentScoreResult = {
  overallScore: number
  overallGrade: string
  currentLevel: string
  protectionGapAmount: number
  protectionGapFormatted: string
  categories: CategoryScore[]
  priorities: PriorityRecommendation[]
  strengths: string[]
  opportunities: string[]
  actionPlan: ReportActionPlan
  blueprintBullets: string[]
  defaultOpenCategory: string
  narrative: string
}

const CATEGORY_WEIGHTS = {
  cashflow: 0.15,
  emergency: 0.15,
  debt: 0.2,
  protection: 0.2,
  retirement: 0.15,
  estate: 0.15,
} as const

const GOAL_CATEGORY_BOOST: Record<string, keyof typeof CATEGORY_WEIGHTS> = {
  'protect-family': 'protection',
  'debt-free': 'debt',
  'build-wealth': 'cashflow',
  retire: 'retirement',
  college: 'emergency',
  legacy: 'estate',
}

const BLUEPRINT_BY_CATEGORY: Record<string, string> = {
  protection: 'Protect income',
  emergency: 'Build emergency savings',
  debt: 'Eliminate unnecessary debt',
  retirement: 'Prepare for retirement',
  cashflow: 'Strengthen monthly cash flow',
  estate: 'Create an estate plan',
}

export function scoreToGrade(score: number): string {
  if (score >= 93) return 'A'
  if (score >= 90) return 'A-'
  if (score >= 87) return 'B+'
  if (score >= 83) return 'B'
  if (score >= 80) return 'B-'
  if (score >= 77) return 'C+'
  if (score >= 73) return 'C'
  if (score >= 70) return 'C-'
  if (score >= 67) return 'D+'
  if (score >= 60) return 'D'
  return 'F'
}

function scoreToStatus(score: number): CategoryScore['status'] {
  if (score >= 80) return 'strength'
  if (score >= 65) return 'neutral'
  return 'opportunity'
}

function scoreToLevel(score: number): string {
  if (score >= 90) return 'Legacy Ready™ Track'
  if (score >= 80) return 'Strong Foundation'
  if (score >= 70) return 'Building Momentum'
  if (score >= 60) return 'Stabilizing Phase'
  return 'Needs Immediate Attention'
}

function housingRatioScore(ratio: number): number {
  if (ratio <= 0.28) return 95
  if (ratio <= 0.36) return 80
  if (ratio <= 0.43) return 60
  return 40
}

function cashFlowPatternScore(value: string): number {
  switch (value) {
    case 'save-most-months':
      return 95
    case 'break-even':
      return 70
    case 'overspend':
      return 35
    case 'unsure':
      return 50
    default:
      return 0
  }
}

function emergencyMonthsScore(months: number): number {
  if (months === 0) return 20
  if (months <= 2) return 45
  if (months <= 5) return 70
  if (months <= 8) return 85
  return 95
}

function dtiScore(dti: number): number {
  if (dti === 0) return 100
  if (dti <= 0.25) return 90
  if (dti <= 0.5) return 75
  if (dti <= 1) return 55
  if (dti <= 2) return 35
  return 20
}

function retirementContributionScore(value: string): number {
  switch (value) {
    case 'not-saving':
      return 15
    case 'under-3':
      return 40
    case '3-5':
      return 60
    case '6-10':
      return 75
    case '11-15':
      return 88
    case 'over-15':
      return 95
    default:
      return 0
  }
}

function lifeInsuranceScore(coverageRatio: number): number {
  if (coverageRatio >= 1) return 95
  if (coverageRatio >= 0.75) return 80
  if (coverageRatio >= 0.5) return 65
  if (coverageRatio >= 0.25) return 45
  if (coverageRatio > 0) return 25
  return 15
}

function disabilityScore(value: string): number {
  return value === 'yes' ? 100 : 25
}

function yesNoScore(value: string, points: number): number {
  return value === 'yes' ? points : 0
}

function childCount(answers: DemoAssessmentAnswers): number {
  const count = Number.parseInt(answers.family.numberOfChildren, 10)
  return Number.isFinite(count) && count > 0 ? count : 0
}

export function calculateProtectionNeed(answers: DemoAssessmentAnswers): number {
  const income = parseAmount(answers.financial.householdIncome)
  if (income <= 0) return 0

  const children = childCount(answers)
  const married = answers.family.maritalStatus === 'married'
  const dependentFactor = 1 + children * 0.25 + (married ? 0.15 : 0)

  return Math.round(income * 5 * dependentFactor)
}

export function calculateProtectionGap(answers: DemoAssessmentAnswers): number {
  const need = calculateProtectionNeed(answers)
  const coverage = parseAmount(answers.protection.currentLifeInsurance)
  return Math.max(need - coverage, 0)
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function buildCashflowCategory(answers: DemoAssessmentAnswers): CategoryScore {
  const income = parseAmount(answers.financial.householdIncome)
  const housing = parseAmount(answers.financial.monthlyHousingPayment)
  const ratio = income > 0 ? housing / (income / 12) : 1
  const housingScore = income > 0 ? housingRatioScore(ratio) : 0
  const patternScore = cashFlowPatternScore(answers.financial.monthlyCashFlow)
  const score = Math.round(housingScore * 0.5 + patternScore * 0.5)
  const ratioLabel = formatPercent(ratio)

  return {
    id: 'cashflow',
    title: 'Cash Flow & Budget',
    grade: scoreToGrade(score),
    score,
    status: scoreToStatus(score),
    summary:
      score >= 80
        ? 'Healthy housing burden and positive monthly cash flow.'
        : score >= 65
          ? 'Cash flow is manageable, but housing or spending patterns need attention.'
          : 'Housing costs or spending patterns are putting pressure on monthly cash flow.',
    explanation: `Your housing payment represents ${ratioLabel} of household income, and you reported "${
      answers.financial.monthlyCashFlow === 'save-most-months'
        ? 'consistently saving most months'
        : answers.financial.monthlyCashFlow === 'break-even'
          ? 'usually breaking even'
          : answers.financial.monthlyCashFlow === 'overspend'
            ? 'often spending more than you take in'
            : 'uncertainty about monthly cash flow'
    }."`,
    guidance:
      'Healthy cash flow is the foundation of every financial plan — it creates flexibility for protection, savings, and legacy goals.',
    recommendations:
      score >= 80
        ? [
            'Maintain your current savings discipline.',
            'Review tax-advantaged savings opportunities annually.',
          ]
        : ratio > 0.36
          ? [
              'Reduce housing burden or increase income where possible.',
              'Track essential expenses for 30 days to identify savings opportunities.',
            ]
          : [
              'Build a simple monthly budget focused on saving consistently.',
              'Automate transfers to savings on payday.',
            ],
  }
}

function buildEmergencyCategory(answers: DemoAssessmentAnswers): CategoryScore {
  const months = Number.parseInt(answers.financial.emergencyFundMonths, 10) || 0
  const score = emergencyMonthsScore(months)

  return {
    id: 'emergency',
    title: 'Emergency Fund',
    grade: scoreToGrade(score),
    score,
    status: scoreToStatus(score),
    summary:
      score >= 80
        ? 'Emergency reserves appear adequate for short-term disruptions.'
        : score >= 65
          ? 'You have some reserves, but may not fully weather a major disruption.'
          : 'Emergency reserves may not fully support your household.',
    explanation: `You reported ${months} month${months === 1 ? '' : 's'} of expenses set aside in emergency savings.`,
    guidance:
      'An adequate emergency fund prevents forced debt and protects long-term goals during unexpected events.',
    recommendations:
      score >= 80
        ? ['Maintain 6+ months of essential expenses in liquid reserves.', 'Review fund location annually for accessibility.']
        : months < 3
          ? [
              'Build toward 3–6 months of essential expenses in accessible savings.',
              'Automate monthly transfers to accelerate fund growth.',
            ]
          : [
              'Increase reserves toward 6 months of essential expenses.',
              'Keep emergency funds in liquid, accessible accounts.',
            ],
  }
}

function buildDebtCategory(answers: DemoAssessmentAnswers): CategoryScore {
  const income = parseAmount(answers.financial.householdIncome)
  const debt = parseAmount(answers.financial.totalDebt)
  const dti = income > 0 ? debt / income : 2
  const score = dtiScore(dti)

  return {
    id: 'debt',
    title: 'Debt Management',
    grade: scoreToGrade(score),
    score,
    status: scoreToStatus(score),
    summary:
      score >= 80
        ? 'Debt levels appear manageable relative to income.'
        : score >= 65
          ? 'Debt is serviceable but may limit financial flexibility.'
          : 'Debt levels may be creating meaningful financial pressure.',
    explanation: `Your total debt is ${formatCurrency(debt)} against ${formatCurrency(income)} household income (${formatPercent(dti)} debt-to-income).`,
    guidance:
      'Strategic debt management frees cash flow for protection and long-term wealth building.',
    recommendations:
      score >= 80
        ? [
            'Maintain disciplined payoff habits while preserving emergency savings.',
            'Avoid taking on high-interest debt for non-essential purchases.',
          ]
        : [
            'Prioritize high-interest balances while preserving emergency savings.',
            'Consider consolidating where rates and terms improve cash flow.',
          ],
  }
}

function buildProtectionCategory(
  answers: DemoAssessmentAnswers,
  protectionGap: number,
  protectionGapFormatted: string,
): CategoryScore {
  const need = calculateProtectionNeed(answers)
  const coverage = parseAmount(answers.protection.currentLifeInsurance)
  const coverageRatio = need > 0 ? coverage / need : 0
  const lifeScore = lifeInsuranceScore(coverageRatio)
  const disability = disabilityScore(answers.protection.hasDisabilityProtection)
  const score = Math.round(lifeScore * 0.7 + disability * 0.3)

  return {
    id: 'protection',
    title: 'Insurance & Protection',
    grade: scoreToGrade(score),
    score,
    status: scoreToStatus(score),
    summary:
      score >= 80
        ? 'Life and disability protection appear reasonably aligned with household need.'
        : score >= 65
          ? 'Coverage exists, but important protection gaps may remain.'
          : 'Coverage and disability protection appear insufficient for your household profile.',
    explanation: `Based on your reported income, marital status, and ${childCount(answers)} dependent${
      childCount(answers) === 1 ? '' : 's'
    }, estimated life insurance need is ${formatCurrency(need)}. Current coverage is ${formatCurrency(
      coverage,
    )} (${formatPercent(coverageRatio)} of estimated need). Disability protection: ${
      answers.protection.hasDisabilityProtection === 'yes' ? 'Yes' : 'No'
    }.`,
    guidance:
      "Protection planning helps ensure your family can maintain their standard of living through life's unexpected events.",
    recommendations:
      protectionGap > 0
        ? [
            `Address the estimated ${protectionGapFormatted} Protection Gap™.`,
            answers.protection.hasDisabilityProtection === 'yes'
              ? 'Review living benefits and disability coverage limits for both earners.'
              : 'Add disability income protection to help protect paychecks.',
          ]
        : [
            'Review policy beneficiaries and coverage amounts annually.',
            'Confirm disability protection covers essential household expenses.',
          ],
  }
}

function buildRetirementCategory(answers: DemoAssessmentAnswers): CategoryScore {
  const score = retirementContributionScore(answers.financial.retirementContribution)
  const labelMap: Record<string, string> = {
    'not-saving': 'not currently saving for retirement',
    'under-3': 'saving less than 3% of household income',
    '3-5': 'saving 3% to 5% of household income',
    '6-10': 'saving 6% to 10% of household income',
    '11-15': 'saving 11% to 15% of household income',
    'over-15': 'saving more than 15% of household income',
  }
  const label = labelMap[answers.financial.retirementContribution] ?? 'an unspecified savings rate'

  return {
    id: 'retirement',
    title: 'Retirement Readiness',
    grade: scoreToGrade(score),
    score,
    status: scoreToStatus(score),
    summary:
      score >= 80
        ? 'Retirement savings contributions appear strong for your household.'
        : score >= 65
          ? 'You are saving for retirement, but contributions may need to increase.'
          : 'Retirement savings appear limited or not yet established.',
    explanation: `You reported ${label} toward retirement.${
      answers.family.age.trim()
        ? ` Age ${answers.family.age.trim()} provides context for your savings timeline, but your score is based on contribution behavior.`
        : ''
    }`,
    guidance:
      'Consistent retirement savings compound over time — small increases today can significantly improve outcomes.',
    recommendations:
      score >= 80
        ? [
            'Maintain or increase contribution rates with income growth.',
            'Review investment allocation with your time horizon in mind.',
          ]
        : answers.financial.retirementContribution === 'not-saving'
          ? [
              'Start retirement contributions through employer or IRA accounts.',
              'Automate contributions each pay period, even at a modest percentage.',
            ]
          : [
              'Increase retirement contributions by 1–2% of household income.',
              'Review employer match opportunities if available.',
            ],
  }
}

function buildEstateCategory(answers: DemoAssessmentAnswers): CategoryScore {
  const children = childCount(answers)
  const will = yesNoScore(answers.protection.hasWill, 33)
  const trust = yesNoScore(answers.protection.hasTrust, 33)
  const beneficiaries = yesNoScore(answers.protection.beneficiariesReviewed, 34)
  const base = will + trust + beneficiaries

  let score = base
  if (children > 0 && answers.protection.guardianDocumented) {
    const guardian = yesNoScore(answers.protection.guardianDocumented, 100)
    score = Math.round(base * 0.75 + guardian * 0.25)
  }

  return {
    id: 'estate',
    title: 'Estate & Legacy',
    grade: scoreToGrade(score),
    score,
    status: scoreToStatus(score),
    summary:
      score >= 80
        ? 'Estate documents and beneficiary planning appear in good order.'
        : score >= 65
          ? 'Some estate planning elements are in place, but updates may be needed.'
          : 'Estate documents and beneficiary designations need attention.',
    explanation: `Will: ${answers.protection.hasWill === 'yes' ? 'Yes' : 'No'}. Trust: ${
      answers.protection.hasTrust === 'yes' ? 'Yes' : 'No'
    }. Beneficiaries reviewed: ${answers.protection.beneficiariesReviewed === 'yes' ? 'Yes' : 'No'}.${
      children > 0
        ? ` Guardian preferences documented: ${
            answers.protection.guardianDocumented === 'yes' ? 'Yes' : 'No'
          }.`
        : ''
    }`,
    guidance:
      'Estate planning ensures your assets and wishes are honored — protecting your family beyond your lifetime.',
    recommendations:
      score >= 80
        ? [
            'Review estate documents every 3–5 years or after major life changes.',
            'Confirm beneficiary designations on all accounts and policies.',
          ]
        : [
            'Update wills, trusts, and beneficiary forms to reflect current wishes.',
            children > 0
              ? 'Document guardianship preferences for dependents.'
              : 'Document asset transfer wishes and key account beneficiaries.',
          ],
  }
}

function buildPriorities(
  categories: CategoryScore[],
  answers: DemoAssessmentAnswers,
): PriorityRecommendation[] {
  const ranked = [...categories].sort((a, b) => a.score - b.score)
  const rankAdjustments = new Map<string, number>()

  for (const goal of answers.goals.selected) {
    const categoryId = GOAL_CATEGORY_BOOST[goal]
    if (categoryId) {
      rankAdjustments.set(categoryId, (rankAdjustments.get(categoryId) ?? 0) - 1)
    }
  }

  if (categories.find((c) => c.id === 'protection')!.score < 50) {
    rankAdjustments.set('protection', (rankAdjustments.get('protection') ?? 0) - 2)
  }
  if (childCount(answers) > 0 && categories.find((c) => c.id === 'estate')!.score < 50) {
    rankAdjustments.set('estate', (rankAdjustments.get('estate') ?? 0) - 2)
  }
  if (categories.find((c) => c.id === 'emergency')!.score < 40) {
    rankAdjustments.set('emergency', (rankAdjustments.get('emergency') ?? 0) - 2)
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
    protection: {
      title: 'Close Your Family Protection Gap',
      why: 'Your reported life insurance and disability coverage may leave meaningful income and lifestyle risk.',
      impact: "Helps protect your family's income, lifestyle, and long-term legacy if the unexpected happens.",
      timeline: 'Recommended within 30–60 days',
    },
    emergency: {
      title: 'Strengthen Your Emergency Fund',
      why: 'Your reported emergency reserves may not cover a major income or expense disruption.',
      impact: 'Reduces reliance on debt during unexpected events and stabilizes long-term planning.',
      timeline: 'Recommended within 30–60 days',
    },
    debt: {
      title: 'Reduce High-Priority Debt Pressure',
      why: 'Your debt-to-income level may be limiting cash flow and financial flexibility.',
      impact: 'Frees monthly cash flow for protection, savings, and legacy goals.',
      timeline: 'Recommended within 60–90 days',
    },
    estate: {
      title: 'Complete Estate & Legacy Planning',
      why: 'Key estate documents or beneficiary designations appear incomplete or outdated.',
      impact: 'Reduces legal uncertainty and ensures assets transfer according to your wishes.',
      timeline: 'Recommended within 60–90 days',
    },
    retirement: {
      title: 'Accelerate Retirement Readiness',
      why: 'Your reported retirement contribution level may not support long-term independence goals.',
      impact: 'Builds momentum toward financial independence and Legacy Ready™ status.',
      timeline: 'Recommended over the next 6–12 months',
    },
    cashflow: {
      title: 'Improve Monthly Cash Flow',
      why: 'Housing burden or spending patterns may be limiting your ability to save and protect income.',
      impact: 'Creates monthly flexibility to fund protection, reserves, and long-term goals.',
      timeline: 'Recommended within 30–60 days',
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

export function buildFamilyActionPlanFromCategories(
  categories: CategoryScore[],
  answers: DemoAssessmentAnswers,
  protectionGapFormatted: string,
): ReportActionPlan {
  const byId = Object.fromEntries(categories.map((category) => [category.id, category]))
  const ranked = [...categories].sort((a, b) => a.score - b.score)
  const weakest = ranked[0]
  const second = ranked[1]
  const third = ranked[2]

  const immediate: string[] = [
    weakest?.recommendations[0] ?? 'Address your highest-risk financial category.',
    second?.recommendations[0] ?? 'Build emergency savings momentum.',
    byId.protection && byId.protection.score < 70
      ? `Review your ${protectionGapFormatted} Protection Gap™ with an advisor.`
      : 'Review beneficiaries on all policies and accounts.',
  ]

  const thirtyDay: string[] = [
    'Meet with a Valtoris Financial Strategist',
    third?.recommendations[0] ?? 'Create a debt or savings action plan.',
    ranked.find((c) => c.id === 'retirement')?.recommendations[0] ?? 'Review retirement contribution targets.',
  ]

  const ninetyDay: string[] = [
    byId.estate?.recommendations[0] ?? 'Complete will & trust planning.',
    answers.goals.selected.includes('college')
      ? 'Review education funding targets for dependents.'
      : (ranked[3]?.recommendations[0] ?? 'Review long-term wealth-building priorities.'),
    'Update your annual family financial plan',
  ]

  return { immediate, thirtyDay, ninetyDay }
}

function buildBlueprintBullets(categories: CategoryScore[]): string[] {
  const sorted = [...categories].sort((a, b) => a.score - b.score)
  const bullets = sorted
    .map((category) => BLUEPRINT_BY_CATEGORY[category.id])
    .filter((bullet): bullet is string => Boolean(bullet))

  if (!bullets.includes('Build generational wealth')) {
    bullets.push('Build generational wealth')
  }

  return bullets
}

function buildNarrative(firstName: string, overallScore: number): string {
  const name = firstName.trim()
  const prefix = name ? `${name}, your` : 'Your'
  if (overallScore >= 85) {
    return `${prefix} family financial profile shows strong fundamentals with targeted opportunities to become Legacy Ready™.`
  }
  if (overallScore >= 70) {
    return `${prefix} family has a workable foundation, but several categories need attention to improve long-term stability.`
  }
  return `${prefix} family profile shows meaningful financial vulnerabilities that should be addressed promptly.`
}

export function scoreFamilyAssessment(answers: DemoAssessmentAnswers): FamilyAssessmentScoreResult {
  const protectionGapAmount = calculateProtectionGap(answers)
  const protectionGapFormatted = formatCurrency(protectionGapAmount)

  const categories = [
    buildCashflowCategory(answers),
    buildEmergencyCategory(answers),
    buildDebtCategory(answers),
    buildProtectionCategory(answers, protectionGapAmount, protectionGapFormatted),
    buildRetirementCategory(answers),
    buildEstateCategory(answers),
  ]

  const overallScore = Math.round(
    categories[0].score * CATEGORY_WEIGHTS.cashflow +
      categories[1].score * CATEGORY_WEIGHTS.emergency +
      categories[2].score * CATEGORY_WEIGHTS.debt +
      categories[3].score * CATEGORY_WEIGHTS.protection +
      categories[4].score * CATEGORY_WEIGHTS.retirement +
      categories[5].score * CATEGORY_WEIGHTS.estate,
  )

  const overallGrade = scoreToGrade(overallScore)
  const currentLevel = scoreToLevel(overallScore)
  const strengths = categories.filter((c) => c.score >= 80).map((c) => c.title)
  const opportunities = categories.filter((c) => c.score < 65).map((c) => c.title)
  const priorities = buildPriorities(categories, answers)
  const actionPlan = buildFamilyActionPlanFromCategories(
    categories,
    answers,
    protectionGapFormatted,
  )
  const blueprintBullets = buildBlueprintBullets(categories)
  const defaultOpenCategory = [...categories].sort((a, b) => a.score - b.score)[0]?.id ?? 'protection'

  return {
    overallScore,
    overallGrade,
    currentLevel,
    protectionGapAmount,
    protectionGapFormatted,
    categories,
    priorities,
    strengths,
    opportunities,
    actionPlan,
    blueprintBullets,
    defaultOpenCategory,
    narrative: buildNarrative(answers.family.firstName, overallScore),
  }
}
