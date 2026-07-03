import { ReportDashboardData } from '../reportDashboard/types'
import { PriorityRecommendation } from '../results/PriorityRecommendationCard'
import { CategoryScore } from './types'

export const BUSINESS_SAMPLE_GREETING = 'Prepared for Your Business'

export const BUSINESS_REPORT_GRADE = 'B'
export const BUSINESS_REPORT_LEVEL = 'Solid Foundation with Growth Potential'
export const BUSINESS_REPORT_SCORE = 78
export const BUSINESS_GROWTH_READINESS = 74
export const BUSINESS_PROTECTION_RATING = 'Moderate Protection'

export const BUSINESS_CATEGORY_SCORES: CategoryScore[] = [
  {
    id: 'business-protection',
    title: 'Business Protection',
    grade: 'C+',
    score: 72,
    status: 'opportunity',
    summary: 'Key revenue and leadership roles may be underprotected.',
    explanation:
      'Your business relies on critical people and revenue streams, but current protection strategies may not fully cover a sudden loss of a key owner or employee.',
    guidance:
      'Business protection helps preserve operations, revenue, and enterprise value when unexpected events disrupt leadership or key talent.',
    recommendations: [
      'Identify revenue tied to key people and quantify potential disruption.',
      'Review key person and buy-sell funding strategies with your advisor.',
    ],
  },
  {
    id: 'cashflow',
    title: 'Cash Flow',
    grade: 'A-',
    score: 90,
    status: 'strength',
    summary: 'Healthy operating cash flow with predictable revenue patterns.',
    explanation:
      'Your business generates consistent cash flow with manageable seasonal variation, creating flexibility for reinvestment and protection planning.',
    guidance:
      'Strong cash flow is the engine of business growth — it funds expansion, reserves, and strategic initiatives without overreliance on debt.',
    recommendations: [
      'Maintain 3–6 months of operating expenses in business reserves.',
      'Review cash flow forecasting quarterly to anticipate capital needs.',
    ],
  },
  {
    id: 'structure',
    title: 'Business Structure',
    grade: 'B',
    score: 81,
    status: 'neutral',
    summary: 'Entity structure is in place but may need optimization.',
    explanation:
      'Your current business entity provides basic liability separation, but ownership structure and agreements may not fully reflect today\'s operations or partners.',
    guidance:
      'The right structure protects personal assets, clarifies ownership, and creates a stronger foundation for growth and exit planning.',
    recommendations: [
      'Review operating agreements and ownership documents with legal counsel.',
      'Confirm personal and business assets are properly separated.',
    ],
  },
  {
    id: 'tax',
    title: 'Tax Strategy',
    grade: 'B-',
    score: 77,
    status: 'opportunity',
    summary: 'Tax planning exists, but optimization opportunities remain.',
    explanation:
      'You are meeting compliance requirements, but proactive tax strategies could reduce liability and improve retained earnings for growth.',
    guidance:
      'Strategic tax planning keeps more capital working inside your business — fueling expansion, reserves, and long-term wealth building.',
    recommendations: [
      'Schedule a proactive tax review before year-end planning deadlines.',
      'Evaluate retirement and benefit strategies that reduce taxable income.',
    ],
  },
  {
    id: 'credit',
    title: 'Credit & Funding',
    grade: 'C+',
    score: 74,
    status: 'opportunity',
    summary: 'Business credit profile has room to strengthen.',
    explanation:
      'Your business may rely on personal credit or limited business credit lines, which can restrict growth capital and increase personal financial exposure.',
    guidance:
      'A strong business credit profile unlocks better financing terms and reduces dependence on personal guarantees.',
    recommendations: [
      'Establish and monitor a dedicated business credit profile.',
      'Review lending relationships and lines of credit annually.',
    ],
  },
  {
    id: 'retirement',
    title: 'Retirement',
    grade: 'B-',
    score: 76,
    status: 'neutral',
    summary: 'Owner retirement savings are in progress but behind target.',
    explanation:
      'You are contributing to retirement, but current savings may not support your long-term personal income goals outside the business.',
    guidance:
      'Owner retirement planning ensures your personal financial future is not entirely dependent on a future business sale or succession event.',
    recommendations: [
      'Increase tax-advantaged retirement contributions where cash flow allows.',
      'Align investment allocation with your personal time horizon and risk tolerance.',
    ],
  },
  {
    id: 'risk',
    title: 'Risk Management',
    grade: 'B',
    score: 80,
    status: 'neutral',
    summary: 'Core policies exist, but coverage gaps may remain.',
    explanation:
      'General liability and property coverage are in place, but specialized risks tied to operations, cyber exposure, or key contracts may need review.',
    guidance:
      'Comprehensive risk management protects the enterprise you\'ve built from operational, legal, and financial threats that can erode value overnight.',
    recommendations: [
      'Conduct an annual business insurance and liability review.',
      'Evaluate cyber, E&O, and umbrella coverage relative to business size.',
    ],
  },
  {
    id: 'exit',
    title: 'Exit Planning',
    grade: 'C',
    score: 68,
    status: 'opportunity',
    summary: 'Succession and exit strategy need clearer definition.',
    explanation:
      'Your business may lack a documented succession plan, valuation baseline, or buy-sell agreement aligned with current ownership and growth goals.',
    guidance:
      'Exit planning begins long before a sale — it increases enterprise value, reduces transition risk, and protects what you\'ve built.',
    recommendations: [
      'Document a succession timeline and identify potential successors or buyers.',
      'Establish a business valuation baseline and buy-sell funding strategy.',
    ],
  },
]

export const BUSINESS_TOP_PRIORITIES: PriorityRecommendation[] = [
  {
    level: 'Critical',
    title: 'Protect Key Revenue',
    why: 'A loss of a key owner or revenue-driving employee could disrupt operations and reduce enterprise value before you have time to recover.',
    timeline: 'Recommended within 30 days',
    impact:
      'Helps preserve revenue continuity, protect enterprise value, and stabilize operations during unexpected leadership transitions.',
  },
  {
    level: 'Important',
    title: 'Improve Cash Flow',
    why: 'Optimizing cash reserves and forecasting strengthens your ability to invest in growth while weathering seasonal or economic downturns.',
    timeline: 'Recommended within 30–60 days',
    impact:
      'Creates financial flexibility for reinvestment, debt reduction, and strategic initiatives without overextending the business.',
  },
  {
    level: 'Long-Term',
    title: 'Strengthen Exit Planning',
    why: 'A documented succession and valuation strategy increases what your business is worth when you are ready to transition or sell.',
    timeline: 'Recommended over the next 90 days',
    impact:
      'Builds long-term enterprise value and reduces uncertainty for owners, partners, and key stakeholders.',
  },
]

export const BUSINESS_ACTION_PLAN = {
  immediate: [
    'Review your Business Protection Rating and identify key revenue dependencies.',
    'Confirm business and personal accounts, assets, and liabilities are properly separated.',
    'Save or print this report for your business records.',
  ],
  thirtyDay: [
    'Schedule your complimentary Business Financial Strategy Session™.',
    'Gather entity documents, insurance policies, and tax returns for advisor review.',
    'Set a 30-day milestone to strengthen business cash reserves.',
  ],
  ninetyDay: [
    'Implement your Business Financial Blueprint™ priorities.',
    'Establish or update buy-sell and key person protection strategies.',
    'Establish a quarterly business financial check-in with your leadership team.',
  ],
} as const

export function getBusinessHeroNarrative(businessName: string): string {
  const name = businessName.trim()
  if (name) {
    return `${name} has a solid financial foundation, but several high-impact opportunities could strengthen protection, profitability, and long-term enterprise value.`
  }
  return 'Your business has a solid financial foundation, but several high-impact opportunities could strengthen protection, profitability, and long-term enterprise value.'
}

export function getBusinessReportDashboardData(
  businessName: string,
  greeting: string,
): ReportDashboardData {
  return {
    title: 'Business Financial Report Card™',
    preparedFor: greeting,
    narrative: getBusinessHeroNarrative(businessName),
    scoreLabel: 'Business Financial Score™',
    score: BUSINESS_REPORT_SCORE,
    grade: BUSINESS_REPORT_GRADE,
    level: BUSINESS_REPORT_LEVEL,
    heroMeta: [
      {
        type: 'progress',
        label: 'Business Growth Readiness',
        value: BUSINESS_GROWTH_READINESS,
        copy: 'Measures how prepared your business is to reinvest, expand, and capture new opportunities.',
      },
      {
        type: 'metric',
        label: 'Business Protection Rating',
        value: BUSINESS_PROTECTION_RATING,
        copy: 'Evaluates how well key people, revenue, and ownership continuity are protected.',
      },
    ],
    glanceLead: 'Your business financial foundation across eight categories.',
    categories: BUSINESS_CATEGORY_SCORES,
    prioritiesTitle: 'Top 3 Business Priorities™',
    prioritiesLead: 'Highest-impact recommendations for protecting and growing your business.',
    priorities: BUSINESS_TOP_PRIORITIES,
    impactLabel: 'Business Impact',
    actionPlanTitle: 'Business Action Plan™',
    actionPlanLead: 'Immediate, 30-day, and 90-day next steps.',
    actionPlan: BUSINESS_ACTION_PLAN,
    categoriesTitle: 'Category Details',
    categoriesLead: 'Expand each category for business risk analysis, guidance, and next steps.',
    statusLabels: {
      strength: 'Low Risk',
      opportunity: 'Moderate Risk',
      neutral: 'Attention Needed',
    },
    statusMetricLabel: 'Business Risk',
    recommendationsSubhead: 'Next steps',
    blueprintTitle: 'Business Financial Blueprint™',
    blueprintCopy:
      'This report helps business owners identify strengths, exposures, and the highest-impact opportunities to protect and grow enterprise value.',
    blueprintBullets: [
      'Increase enterprise value',
      'Reduce financial risk',
      'Improve profitability',
      'Protect key people',
      'Reduce taxes',
      'Prepare for succession',
      'Build long-term wealth',
    ],
    footerLines: ['Powered by Valtoris Financial™', 'Helping Business Owners Build Lasting Enterprise Value™'],
    defaultOpenCategory: 'business-protection',
  }
}
