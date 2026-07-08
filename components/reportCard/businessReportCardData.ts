import { BusinessAssessmentAnswers } from '../assessment/business/types'
import { scoreBusinessAssessment } from '../assessment/scoring/scoreBusinessAssessment'
import { ReportDashboardData } from '../reportDashboard/types'

export const BUSINESS_SAMPLE_GREETING = 'Prepared for Your Business'

export const DEMO_BUSINESS_ANSWERS: BusinessAssessmentAnswers = {
  owner: {
    firstName: 'Sample',
    lastName: 'Owner',
    email: 'sample@example.com',
    phone: '5551234567',
  },
  business: {
    name: 'Sample Business LLC',
    industry: 'professional-services',
    yearsInBusiness: '6-10',
    employees: '6-20',
    grossAnnualRevenue: '1m-2.49m',
    ownerCompensationMethod: 'salary-plus-distributions',
    ownerPersonalIncome: '100k-199k',
  },
  foundation: {
    entityStructure: 'multi-member-llc',
    operatingDocs: 'current',
    financeSeparation: 'mostly-separated',
  },
  cashFlowTax: {
    operatingCashFlow: 'positive-reinvest',
    reserveMonths: '3-5',
    revenuePredictability: 'very-predictable',
    acceptsCardPayments: 'yes',
    cardSalesPercentage: '25-49',
    estimatedProcessingRate: '2.5-2.99',
    lastProcessingReview: '6-12mo',
    taxPlanning: 'annual-review',
    taxBenefitStrategies: 'yes-basic',
  },
  protectionRisk: {
    keyPersonBuySell: 'yes-unfunded',
    continuityPlan: 'documented',
    coreInsurance: 'yes-basic',
    specializedCoverage: 'standard',
  },
  retirementFundingExit: {
    ownerRetirementSavings: '6-10',
    businessCredit: 'building',
    growthCapital: 'limited',
    successionPlan: 'informal',
    valuationBaseline: 'outdated',
  },
  goals: {
    selected: ['protect-key-people', 'improve-cash-flow', 'plan-exit'],
  },
}

export function getBusinessReportDashboardData(
  businessName: string,
  greeting: string,
  answers: BusinessAssessmentAnswers,
): ReportDashboardData {
  const scored = scoreBusinessAssessment(answers)
  const displayName = businessName.trim() || answers.business.name.trim()

  return {
    title: 'Business Financial Report Card™',
    preparedFor: greeting,
    narrative: scored.narrative,
    scoreLabel: 'Business Financial Score™',
    score: scored.overallScore,
    grade: scored.overallGrade,
    level: scored.currentLevel,
    heroMeta: [
      {
        type: 'progress',
        label: 'Business Growth Readiness',
        value: scored.growthReadiness,
        copy: 'Measures how prepared your business is to reinvest, expand, and capture new opportunities.',
      },
      {
        type: 'metric',
        label: 'Business Protection Rating',
        value: scored.protectionRating,
        copy: 'Evaluates how well key people, revenue, and ownership continuity are protected.',
      },
    ],
    glanceLead: 'Your business financial foundation across eight categories.',
    categories: scored.categories,
    prioritiesTitle: 'Top 3 Business Priorities™',
    prioritiesLead: 'Highest-impact recommendations for protecting and growing your business.',
    priorities: scored.priorities,
    impactLabel: 'Business Impact',
    actionPlanTitle: 'Business Action Plan™',
    actionPlanLead: 'Immediate, 30-day, and 90-day next steps.',
    actionPlan: scored.actionPlan,
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
    blueprintCopy: displayName
      ? `This report helps ${displayName} identify strengths, exposures, and the highest-impact opportunities to protect and grow enterprise value.`
      : 'This report helps business owners identify strengths, exposures, and the highest-impact opportunities to protect and grow enterprise value.',
    blueprintBullets: scored.blueprintBullets,
    footerLines: ['Powered by Valtoris Financial™', 'Helping Business Owners Build Lasting Enterprise Value™'],
    defaultOpenCategory: scored.defaultOpenCategory,
  }
}
