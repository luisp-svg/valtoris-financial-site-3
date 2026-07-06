import { ReportActionPlan, ReportDashboardData } from '../reportDashboard/types'
import { PriorityRecommendation } from '../results/PriorityRecommendationCard'
import { DemoAssessmentAnswers } from '../assessment/types'
import { scoreFamilyAssessment } from '../assessment/scoring/scoreFamilyAssessment'
import { CategoryScore } from './types'

export type { CategoryScore, CategoryStatus, ReportPageId } from './types'

export const SAMPLE_GREETING = 'Sample Family Report Card'

export const REPORT_STRENGTHS = ['Income & Cash Flow', 'Debt Strategy', 'Protection Planning']

export const REPORT_OPPORTUNITIES = [
  'Estate & Legacy Planning',
  'Emergency Preparedness',
  'Retirement Readiness',
]

export const REPORT_TOP_PRIORITIES: PriorityRecommendation[] = [
  {
    level: 'Critical',
    title: 'Close Your Family Protection Gap',
    why: 'Your current coverage may leave a significant income and lifestyle gap if something unexpected happens to you or your spouse.',
    timeline: 'Recommended within 30–60 days',
    impact: 'Helps protect your family\'s income, lifestyle, and long-term legacy if the unexpected happens.',
  },
  {
    level: 'Important',
    title: 'Complete Estate & Legacy Planning',
    why: 'Updating your will, trust, and beneficiary designations ensures your family is protected and your wishes are carried out.',
    timeline: 'Recommended within 60–90 days',
    impact: 'Reduces legal uncertainty and ensures assets transfer according to your wishes.',
  },
  {
    level: 'Long-Term',
    title: 'Accelerate Retirement Readiness',
    why: 'A structured savings and investment plan helps your family build confidence toward long-term financial independence.',
    timeline: 'Recommended over the next 6–12 months',
    impact: 'Builds momentum toward financial independence and Legacy Ready™ status.',
  },
]

export const REPORT_GRADE = 'B+'
export const REPORT_LEVEL = 'Strong Foundation'
export const REPORT_PROGRESS = 82
export const REPORT_PROTECTION_GAP = '$750,000'

export const REPORT_PAGES = [
  { id: 'overview', label: 'Overview' },
  { id: 'insights', label: 'Insights' },
  { id: 'protection', label: 'Protection' },
  { id: 'priorities', label: 'Priorities' },
  { id: 'next-steps', label: 'Next Steps' },
] as const

export const CATEGORY_SCORES: CategoryScore[] = [
  {
    id: 'cashflow',
    title: 'Cash Flow & Budget',
    grade: 'A',
    score: 92,
    status: 'strength',
    summary: 'Strong income stability with healthy cash flow.',
    explanation:
      'Your household income and spending patterns indicate reliable cash flow with room to allocate toward protection, savings, and legacy goals.',
    guidance:
      'Healthy cash flow is the foundation of every financial plan — it creates flexibility for protection, savings, and legacy goals.',
    recommendations: [
      'Maintain 3–6 months of expenses in liquid reserves.',
      'Review tax-advantaged savings opportunities annually.',
    ],
  },
  {
    id: 'emergency',
    title: 'Emergency Fund',
    grade: 'C+',
    score: 76,
    status: 'opportunity',
    summary: 'Emergency reserves may not fully support your household.',
    explanation:
      'Your current emergency fund may cover short-term disruptions but falls short of a fully Legacy Ready™ reserve target.',
    guidance:
      'An adequate emergency fund prevents forced debt and protects long-term goals during unexpected events.',
    recommendations: [
      'Build toward 6 months of essential expenses in accessible savings.',
      'Automate monthly transfers to accelerate fund growth.',
    ],
  },
  {
    id: 'debt',
    title: 'Debt Management',
    grade: 'B+',
    score: 88,
    status: 'strength',
    summary: 'Manageable debt with a clear payoff trajectory.',
    explanation:
      'Your debt levels are proportionate to income, with no immediate red flags in your repayment structure.',
    guidance:
      'Strategic debt management frees cash flow for protection and long-term wealth building.',
    recommendations: [
      'Prioritize high-interest balances while preserving emergency savings.',
      'Consider consolidating where rates and terms improve cash flow.',
    ],
  },
  {
    id: 'protection',
    title: 'Insurance & Protection',
    grade: 'B',
    score: 82,
    status: 'opportunity',
    summary: 'Coverage exists, but a meaningful protection gap remains.',
    explanation:
      'Life insurance is in place, yet your estimated protection gap suggests your family may be underprotected relative to your lifestyle.',
    guidance:
      'Protection planning helps ensure your family can maintain their standard of living through life\'s unexpected events.',
    recommendations: [
      `Address the estimated ${REPORT_PROTECTION_GAP} Protection Gap™.`,
      'Review living benefits and disability coverage for both earners.',
    ],
  },
  {
    id: 'retirement',
    title: 'Retirement Readiness',
    grade: 'B-',
    score: 78,
    status: 'neutral',
    summary: 'Retirement savings in progress but behind target pace.',
    explanation:
      'You are saving for retirement, but current contributions may not meet your long-term income replacement goals.',
    guidance:
      'Consistent retirement savings compound over time — small increases today can significantly improve outcomes.',
    recommendations: [
      'Increase retirement contributions by 1–2% of household income.',
      'Align investment allocation with your time horizon and risk tolerance.',
    ],
  },
  {
    id: 'estate',
    title: 'Estate & Legacy',
    grade: 'C',
    score: 71,
    status: 'opportunity',
    summary: 'Estate documents and beneficiaries need attention.',
    explanation:
      'Key estate planning documents or beneficiary designations may be outdated or incomplete for your current family structure.',
    guidance:
      'Estate planning ensures your assets and wishes are honored — protecting your family beyond your lifetime.',
    recommendations: [
      'Update wills, trusts, and beneficiary forms to reflect current wishes.',
      'Document guardianship preferences for dependents.',
    ],
  },
]

export function buildFamilyActionPlan(categories: CategoryScore[]): ReportActionPlan {
  const byId = Object.fromEntries(categories.map((category) => [category.id, category]))

  return {
    immediate: [
      byId.protection?.recommendations[0] ?? 'Increase life insurance protection',
      byId.emergency?.recommendations[0] ?? 'Build emergency fund',
      'Review beneficiaries on all policies and accounts',
    ],
    thirtyDay: [
      'Meet with a Valtoris Financial Strategist',
      byId.debt?.recommendations[0] ?? 'Create debt payoff strategy',
      byId.retirement?.recommendations[0] ?? 'Begin retirement contributions',
    ],
    ninetyDay: [
      byId.estate?.recommendations[0] ?? 'Complete will & trust',
      'Review education funding for dependents',
      'Update your annual family financial plan',
    ],
  }
}

export function getGradeTone(grade: string): 'excellent' | 'good' | 'fair' | 'needs-attention' {
  const letter = grade.charAt(0).toUpperCase()
  if (letter === 'A') return 'excellent'
  if (letter === 'B') return 'good'
  if (letter === 'C') return 'fair'
  return 'needs-attention'
}

export function getHeroNarrative(firstName: string): string {
  const name = firstName.trim()
  if (name) {
    return `Great job ${name}. Your family has a strong financial foundation, but there are several opportunities to improve your long-term Legacy Ready™ score.`
  }
  return 'Your family has a strong financial foundation, but there are several opportunities to improve your long-term Legacy Ready™ score.'
}

export function getFamilyReportDashboardData(
  firstName: string,
  greeting: string,
  answers?: DemoAssessmentAnswers,
): ReportDashboardData {
  if (!answers) {
    return getSampleFamilyReportDashboardData(firstName, greeting)
  }

  const scored = scoreFamilyAssessment(answers)
  const categories = scored.categories

  return {
    title: 'Your Family Financial Report Card™',
    preparedFor: greeting,
    narrative: scored.narrative,
    scoreLabel: 'Overall Financial Score™',
    score: scored.overallScore,
    grade: scored.overallGrade,
    level: scored.currentLevel,
    heroMeta: [
      {
        type: 'progress',
        label: 'Progress Toward Legacy Ready™',
        value: scored.overallScore,
        copy: 'Measures how prepared your family is to protect income, build wealth, and become Legacy Ready™.',
      },
      {
        type: 'metric',
        label: 'Protection Gap™',
        value: scored.protectionGapFormatted,
        copy: 'Estimated additional protection your family may need beyond current coverage.',
      },
    ],
    glanceLead: 'Your financial foundation across six categories.',
    strengths: scored.strengths.length > 0 ? scored.strengths : ['Financial assessment completed'],
    opportunities:
      scored.opportunities.length > 0 ? scored.opportunities : ['Continue strengthening your financial foundation'],
    protectionAnalysis: {
      label: 'Family Protection Gap',
      value: scored.protectionGapFormatted,
      note: 'Closing this gap helps protect your family\'s income, lifestyle, and long-term legacy goals.',
    },
    categories,
    prioritiesTitle: 'Top 3 Priorities™',
    prioritiesLead: 'Highest-impact recommendations for your family.',
    priorities: scored.priorities,
    impactLabel: 'Family Impact',
    actionPlanTitle: 'Family Action Plan™',
    actionPlanLead: 'Immediate, 30-day, and 90-day next steps personalized from your report.',
    actionPlan: scored.actionPlan,
    actionPlanColumnIcons: ['bolt', 'calendar', 'flag'],
    categoriesTitle: 'Your Financial Score Breakdown™',
    categoriesLead:
      'Review each financial category, understand your score, and discover personalized recommendations to strengthen your family\'s financial foundation.',
    statusLabels: {
      strength: 'Low Risk',
      opportunity: 'Moderate Risk',
      neutral: 'Attention Needed',
    },
    statusMetricLabel: 'Risk Level',
    recommendationsSubhead: 'Next steps',
    blueprintTitle: 'Family Financial Blueprint™',
    blueprintCopy:
      'This report helps families identify strengths, exposures, and the highest-impact opportunities to protect income and build lasting wealth.',
    blueprintBullets: scored.blueprintBullets,
    footerLines: ['Powered by Valtoris Financial™', 'Helping Families Become Legacy Ready™'],
    defaultOpenCategory: scored.defaultOpenCategory,
  }
}

function getSampleFamilyReportDashboardData(
  firstName: string,
  greeting: string,
): ReportDashboardData {
  const categories = CATEGORY_SCORES

  return {
    title: 'Your Family Financial Report Card™',
    preparedFor: greeting,
    narrative: getHeroNarrative(firstName),
    scoreLabel: 'Overall Financial Score™',
    score: REPORT_PROGRESS,
    grade: REPORT_GRADE,
    level: REPORT_LEVEL,
    heroMeta: [
      {
        type: 'progress',
        label: 'Progress Toward Legacy Ready™',
        value: REPORT_PROGRESS,
        copy: 'Measures how prepared your family is to protect income, build wealth, and become Legacy Ready™.',
      },
      {
        type: 'metric',
        label: 'Protection Gap™',
        value: REPORT_PROTECTION_GAP,
        copy: 'Estimated additional protection your family may need beyond current coverage.',
      },
    ],
    glanceLead: 'Your financial foundation across six categories.',
    strengths: REPORT_STRENGTHS,
    opportunities: REPORT_OPPORTUNITIES,
    protectionAnalysis: {
      label: 'Family Protection Gap',
      value: REPORT_PROTECTION_GAP,
      note: 'Closing this gap helps protect your family\'s income, lifestyle, and long-term legacy goals.',
    },
    categories,
    prioritiesTitle: 'Top 3 Priorities™',
    prioritiesLead: 'Highest-impact recommendations for your family.',
    priorities: REPORT_TOP_PRIORITIES,
    impactLabel: 'Family Impact',
    actionPlanTitle: 'Family Action Plan™',
    actionPlanLead: 'Immediate, 30-day, and 90-day next steps personalized from your report.',
    actionPlan: buildFamilyActionPlan(categories),
    actionPlanColumnIcons: ['bolt', 'calendar', 'flag'],
    categoriesTitle: 'Your Financial Score Breakdown™',
    categoriesLead:
      'Review each financial category, understand your score, and discover personalized recommendations to strengthen your family\'s financial foundation.',
    statusLabels: {
      strength: 'Low Risk',
      opportunity: 'Moderate Risk',
      neutral: 'Attention Needed',
    },
    statusMetricLabel: 'Risk Level',
    recommendationsSubhead: 'Next steps',
    blueprintTitle: 'Family Financial Blueprint™',
    blueprintCopy:
      'This report helps families identify strengths, exposures, and the highest-impact opportunities to protect income and build lasting wealth.',
    blueprintBullets: [
      'Protect income',
      'Build emergency savings',
      'Eliminate unnecessary debt',
      'Prepare for retirement',
      'Protect children',
      'Build generational wealth',
      'Create an estate plan',
    ],
    footerLines: ['Powered by Valtoris Financial™', 'Helping Families Become Legacy Ready™'],
    defaultOpenCategory: 'protection',
  }
}
