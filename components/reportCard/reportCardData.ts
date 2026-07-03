import { ReportDashboardData } from '../reportDashboard/types'
import { PriorityRecommendation } from '../results/PriorityRecommendationCard'
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
    title: 'Cash Flow',
    grade: 'A',
    score: 92,
    status: 'strength',
    summary: 'Strong income stability with healthy cash flow.',
    explanation:
      'Your household income and spending patterns indicate reliable cash flow with room to allocate toward goals.',
    guidance:
      'Healthy cash flow is the foundation of every financial plan — it creates flexibility for protection, savings, and legacy goals.',
    recommendations: [
      'Maintain 3–6 months of expenses in liquid reserves.',
      'Review tax-advantaged savings opportunities annually.',
    ],
  },
  {
    id: 'debt',
    title: 'Debt',
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
    title: 'Protection',
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
    id: 'retirement',
    title: 'Retirement',
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

export const ACTION_PLAN = {
  immediate: [
    'Review your Protection Gap™ estimate and current coverage.',
    'Confirm beneficiary designations on all policies and accounts.',
    'Save or print this report for your household records.',
  ],
  thirtyDay: [
    'Schedule your complimentary Family Financial Strategy Session™.',
    'Gather estate documents for advisor review.',
    'Set a 30-day emergency fund milestone.',
  ],
  ninetyDay: [
    'Implement your Personalized Financial Blueprint™ priorities.',
    'Close identified protection gaps with appropriate coverage.',
    'Establish a quarterly family financial check-in.',
  ],
} as const

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
): ReportDashboardData {
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
      },
      {
        type: 'metric',
        label: 'Protection Gap™',
        value: REPORT_PROTECTION_GAP,
        copy: 'Estimated additional protection your family may need beyond current coverage.',
      },
    ],
    glanceLead: 'Your financial foundation across six categories.',
    categories: CATEGORY_SCORES,
    prioritiesTitle: 'Top 3 Priorities™',
    prioritiesLead: 'Highest-impact recommendations for your family.',
    priorities: REPORT_TOP_PRIORITIES,
    impactLabel: 'Expected impact',
    actionPlanTitle: 'Personalized Action Plan™',
    actionPlanLead: 'Immediate, 30-day, and 90-day next steps.',
    actionPlan: ACTION_PLAN,
    categoriesTitle: 'Category Recommendations',
    categoriesLead: 'Expand each category for personalized guidance and improvements.',
    statusLabels: {
      strength: 'Strength',
      opportunity: 'Opportunity',
      neutral: 'In progress',
    },
    recommendationsSubhead: 'Recommended improvements',
    blueprintTitle: 'Your Personalized Financial Blueprint™',
    blueprintCopy:
      'This report identifies your current strengths, potential risks, and highest-impact opportunities. During your complimentary Family Financial Strategy Session™, we\'ll review every recommendation and create a customized action plan for your family.',
    footerLines: ['Powered by Valtoris Financial™', 'Helping Families Become Legacy Ready™'],
    defaultOpenCategory: 'protection',
  }
}
