import { formatCurrency } from '../calculator/calculations'
import { scoreRetirementAssessment } from '../assessment/scoring/scoreRetirementAssessment'
import { RetirementAssessmentAnswers } from '../assessment/retirement/types'
import { ReportDashboardData } from '../reportDashboard/types'

export const RETIREMENT_SAMPLE_GREETING = 'Sample Retirement Report Card'

export const DEMO_RETIREMENT_ANSWERS: RetirementAssessmentAnswers = {
  household: {
    firstName: 'Alex',
    lastName: 'Morgan',
    email: 'alex.morgan@example.com',
    phone: '5559876543',
    state: 'TX',
    maritalStatus: 'married',
    alreadyRetired: 'no',
    currentAge: '52',
    targetRetirementAge: '65',
    spouseAge: '50',
    spouseTargetRetirementAge: '65',
  },
  vision: {
    retirementLifestyle: 'comfortable',
    planClarity: 'somewhat-clear',
    primaryMotivation: 'income-security',
  },
  savings: {
    currentRetirementSavings: '425000',
    monthlyContribution: '1100',
    employerMatch: 'full-match',
    contributionConsistency: 'always',
  },
  incomeSources: {
    socialSecurityMonthly: '2400',
    pensionMonthly: '600',
    annuityMonthly: '0',
    rentalIncomeMonthly: '400',
    businessIncomeMonthly: '0',
    otherRecurringIncomeMonthly: '0',
    spouseSocialSecurityMonthly: '1600',
    socialSecurityEstimateReviewed: 'yes',
    pensionElectionUnderstood: 'yes',
    survivorContinuation: 'yes',
    inflationAwareness: 'yes',
    expectsPartTimeWork: 'no',
    estimatedMonthlyPartTimeIncome: '',
    expectedPartTimeWorkYears: '',
  },
  lifestyle: {
    currentAnnualGrossIncome: '165000',
    estimatedMonthlyRetirementSpending: '6800',
    debtBurden: 'low',
  },
  investments: {
    riskTolerance: 'moderate',
    diversification: 'well-diversified',
    allocationReview: 'within-year',
  },
  tax: {
    accountTypes: ['traditional', 'roth', 'taxable'],
    taxPlanning: 'annual-review',
    rothUsage: 'some',
  },
  healthcare: {
    medicareReadiness: 'somewhat',
    longTermCarePlan: 'self-fund',
    hsaBalance: '12000',
  },
  estate: {
    hasWill: 'yes',
    hasTrust: 'no',
    beneficiariesReviewed: 'yes',
    hasPowerOfAttorney: 'yes',
    legacyIntent: 'moderate',
  },
  goals: {
    selected: ['close-income-gap', 'plan-healthcare', 'diversify-taxes'],
  },
  leadDetails: {
    preferredContactMethod: 'email',
    bestContactTime: 'anytime',
    primaryConcern: '',
    consentGiven: 'yes',
  },
}

export function getRetirementReportDashboardData(
  firstName: string,
  greeting: string,
  answers: RetirementAssessmentAnswers,
): ReportDashboardData {
  const scored = scoreRetirementAssessment(answers)
  const { metrics } = scored
  const displayName = firstName.trim() || answers.household.firstName.trim()
  const monthlyGap = Math.round(metrics.annualIncomeGap / 12)
  const fundedRatio = Math.round(metrics.incomeReplacementRatio * 100)
  const savingsRate =
    metrics.currentAnnualGrossIncome > 0
      ? Math.round(((metrics.monthlyContribution * 12) / metrics.currentAnnualGrossIncome) * 100)
      : 0

  return {
    title: 'Retirement Report Card™',
    preparedFor: greeting,
    narrative: scored.narrative,
    scoreLabel: 'Retirement Readiness Score™',
    score: scored.overallScore,
    grade: scored.overallGrade,
    level: scored.currentLevel,
    heroMeta: [
      {
        type: 'metric',
        label: metrics.isAlreadyRetired ? 'Retirement Status' : 'Target Retirement Age',
        value: metrics.isAlreadyRetired ? 'Already Retired' : String(metrics.retirementAge),
        copy: metrics.isAlreadyRetired
          ? 'Analysis emphasizes sustainability, withdrawals, healthcare, taxes, and legacy.'
          : `About ${metrics.yearsUntilRetirement} year${metrics.yearsUntilRetirement === 1 ? '' : 's'} until your stated retirement age.`,
      },
      {
        type: 'metric',
        label: 'Strongest Category',
        value: scored.strongestCategory.title,
        copy: `Score ${scored.strongestCategory.score}/100 (${scored.strongestCategory.grade}).`,
      },
      {
        type: 'metric',
        label: 'Priority Category',
        value: scored.priorityCategory.title,
        copy: `Score ${scored.priorityCategory.score}/100 (${scored.priorityCategory.grade}).`,
      },
      {
        type: 'metric',
        label: 'Estimated Monthly Income Gap',
        value: formatCurrency(monthlyGap),
        copy: `Need ${formatCurrency(metrics.targetMonthlyRetirementSpending)} · Funded ratio about ${fundedRatio}% · Savings rate about ${savingsRate}%.`,
      },
    ],
    glanceLead: 'Your retirement readiness across eight planning categories.',
    strengths: scored.strengths.length > 0 ? scored.strengths : ['Assessment completed'],
    opportunities:
      scored.opportunities.length > 0
        ? scored.opportunities
        : ['Continue refining your retirement income plan'],
    categories: scored.categories,
    prioritiesTitle: 'Top 3 Retirement Priorities™',
    prioritiesLead: 'Highest-impact next steps based on your answers and projection metrics.',
    priorities: scored.priorities,
    impactLabel: 'Retirement Impact',
    actionPlanTitle: 'Retirement Action Plan™',
    actionPlanLead: 'Immediate, 30-day, and 90-day priorities tailored to your profile.',
    actionPlan: scored.actionPlan,
    actionPlanColumnIcons: ['bolt', 'calendar', 'flag'],
    categoriesTitle: 'Category Details',
    categoriesLead:
      'Expand each category for status, guidance, and recommended next steps. Status labels are educational readiness indicators—not guarantees.',
    statusLabels: {
      strength: 'Strength',
      opportunity: 'Opportunity',
      neutral: 'Neutral',
      strong: 'Strong',
      stable: 'Stable',
      'needs-attention': 'Needs Attention',
      'priority-risk': 'Priority Risk',
    },
    recommendationsSubhead: 'Next steps',
    blueprintTitle: 'Retirement Blueprint™',
    blueprintCopy: displayName
      ? `This report helps ${displayName} identify what appears on track, where gaps may exist, and what to address next—using educational estimates, not guarantees.`
      : 'This report helps identify what appears on track, where gaps may exist, and what to address next—using educational estimates, not guarantees.',
    blueprintBullets: scored.blueprintBullets,
    footerLines: [
      'Powered by Valtoris Financial™',
      'Helping Families Plan Retirement Income With Clarity™',
    ],
    defaultOpenCategory: scored.defaultOpenCategory,
  }
}
