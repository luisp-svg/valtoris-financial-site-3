import { PriorityRecommendation } from '../results/PriorityRecommendationCard'

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
  },
  {
    level: 'Important',
    title: 'Complete Estate & Legacy Planning',
    why: 'Updating your will, trust, and beneficiary designations ensures your family is protected and your wishes are carried out.',
    timeline: 'Recommended within 60–90 days',
  },
  {
    level: 'Long-Term',
    title: 'Accelerate Retirement Readiness',
    why: 'A structured savings and investment plan helps your family build confidence toward long-term financial independence.',
    timeline: 'Recommended over the next 6–12 months',
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

export type ReportPageId = (typeof REPORT_PAGES)[number]['id']
