import { PriorityRecommendation } from '../../results/PriorityRecommendationCard'
import { CategoryScore } from '../../reportCard/types'
import { ReportActionPlan } from '../../reportDashboard/types'
import { BusinessAssessmentAnswers } from '../business/types'
import { scoreToGrade } from './scoreFamilyAssessment'

export type BusinessAssessmentScoreResult = {
  overallScore: number
  overallGrade: string
  currentLevel: string
  growthReadiness: number
  protectionRating: string
  categories: CategoryScore[]
  priorities: PriorityRecommendation[]
  actionPlan: ReportActionPlan
  blueprintBullets: string[]
  defaultOpenCategory: string
  narrative: string
}

const CATEGORY_WEIGHTS = {
  'business-protection': 0.15,
  cashflow: 0.15,
  structure: 0.1,
  tax: 0.1,
  credit: 0.12,
  retirement: 0.1,
  risk: 0.13,
  exit: 0.15,
} as const

const GOAL_CATEGORY_BOOST: Record<string, keyof typeof CATEGORY_WEIGHTS> = {
  'protect-key-people': 'business-protection',
  'improve-cash-flow': 'cashflow',
  'reduce-taxes': 'tax',
  'strengthen-credit': 'credit',
  'build-owner-wealth': 'retirement',
  'plan-exit': 'exit',
  'reduce-risk': 'risk',
  'optimize-structure': 'structure',
}

const BLUEPRINT_BY_CATEGORY: Record<string, string> = {
  'business-protection': 'Protect key people & revenue',
  cashflow: 'Strengthen operating cash flow',
  structure: 'Optimize business structure',
  tax: 'Reduce business taxes',
  credit: 'Improve credit & funding access',
  retirement: 'Build owner wealth outside the business',
  risk: 'Reduce operational risk',
  exit: 'Prepare for succession',
}

const MERCHANT_PROCESSING_RECOMMENDATION =
  'Review your merchant processing statements to identify unnecessary fees and potential savings.'

const LEGAL_ENTITY_STRUCTURE_POINTS: Record<string, number> = {
  'sole-prop': 50,
  'single-member-llc': 82,
  'multi-member-llc': 85,
  's-corp': 90,
  'c-corp': 85,
  partnership: 72,
  nonprofit: 78,
  'not-sure': 40,
}

const OPERATING_DOCS_POINTS: Record<string, number> = {
  current: 100,
  'needs-update': 65,
  none: 25,
  unsure: 40,
}

const FINANCE_SEPARATION_POINTS: Record<string, number> = {
  'fully-separated': 95,
  'mostly-separated': 75,
  'some-mingled': 45,
  'not-separated': 20,
}

const OPERATING_CASH_FLOW_POINTS: Record<string, number> = {
  'positive-reinvest': 95,
  'break-even': 70,
  'tight-seasonal': 50,
  negative: 25,
  unsure: 45,
}

const RESERVE_MONTHS_POINTS: Record<string, number> = {
  '6plus': 95,
  '3-5': 80,
  '1-2': 55,
  none: 25,
}

const REVENUE_PREDICTABILITY_POINTS: Record<string, number> = {
  'very-predictable': 90,
  'mostly-predictable': 75,
  seasonal: 55,
  unpredictable: 35,
}

const LAST_PROCESSING_REVIEW_POINTS: Record<string, number> = {
  'within-6mo': 95,
  '6-12mo': 80,
  'over-12mo': 55,
  never: 35,
  unsure: 45,
}

const TAX_PLANNING_POINTS: Record<string, number> = {
  proactive: 90,
  'annual-review': 70,
  'compliance-only': 45,
  none: 20,
}

const TAX_BENEFIT_STRATEGIES_POINTS: Record<string, number> = {
  'yes-multiple': 90,
  'yes-basic': 70,
  considering: 50,
  no: 25,
}

const OWNER_COMPENSATION_POINTS: Record<string, number> = {
  payroll: 88,
  'owners-draw': 72,
  distributions: 72,
  'salary-plus-distributions': 92,
  'irregular-transfers': 42,
  'not-consistent': 28,
  'not-sure': 38,
}

const KEY_PERSON_BUYSELL_POINTS: Record<string, number> = {
  'yes-funded': 95,
  'yes-unfunded': 60,
  planning: 40,
  no: 15,
  unsure: 30,
}

const CONTINUITY_PLAN_POINTS: Record<string, number> = {
  documented: 90,
  informal: 55,
  no: 20,
  unsure: 35,
}

const CORE_INSURANCE_POINTS: Record<string, number> = {
  'yes-reviewed': 90,
  'yes-basic': 70,
  partial: 45,
  no: 15,
  unsure: 35,
}

const SPECIALIZED_COVERAGE_POINTS: Record<string, number> = {
  comprehensive: 95,
  standard: 75,
  partial: 50,
  no: 20,
  unsure: 40,
}

const OWNER_RETIREMENT_SAVINGS_POINTS: Record<string, number> = {
  'over-15': 95,
  '11-15': 80,
  '6-10': 65,
  'under-5': 40,
  'not-saving': 15,
}

const BUSINESS_CREDIT_POINTS: Record<string, number> = {
  established: 90,
  building: 65,
  personal: 35,
  unsure: 45,
}

const GROWTH_CAPITAL_POINTS: Record<string, number> = {
  readily: 90,
  limited: 65,
  'personal-guarantee': 40,
  difficult: 20,
}

const SUCCESSION_PLAN_POINTS: Record<string, number> = {
  documented: 95,
  informal: 55,
  none: 15,
  unsure: 30,
}

const VALUATION_BASELINE_POINTS: Record<string, number> = {
  recent: 90,
  outdated: 60,
  no: 20,
  unsure: 35,
}

const LEGAL_ENTITY_LABELS: Record<string, string> = {
  'sole-prop': 'a sole proprietorship',
  'single-member-llc': 'a single-member LLC',
  'multi-member-llc': 'a multi-member LLC',
  's-corp': 'an S Corporation',
  'c-corp': 'a C Corporation',
  partnership: 'a partnership',
  nonprofit: 'a nonprofit',
  'not-sure': 'an uncertain legal structure',
}

const INDUSTRY_LABELS: Record<string, string> = {
  'financial-insurance': 'Financial Services / Insurance',
  'professional-services': 'Professional Services',
  'construction-trades': 'Construction / Trades',
  'real-estate': 'Real Estate',
  healthcare: 'Healthcare',
  'retail-ecommerce': 'Retail / E-commerce',
  'restaurant-food': 'Restaurant / Food Service',
  'transportation-logistics': 'Transportation / Logistics',
  technology: 'Technology',
  'personal-services': 'Personal Services',
  other: 'another industry',
}

const GROSS_REVENUE_LABELS: Record<string, string> = {
  'pre-revenue': 'pre-revenue',
  'under-100k': 'under $100,000',
  '100k-249k': '$100,000–$249,999',
  '250k-499k': '$250,000–$499,999',
  '500k-999k': '$500,000–$999,999',
  '1m-2.49m': '$1 million–$2.49 million',
  '2.5m-4.99m': '$2.5 million–$4.99 million',
  '5m-plus': '$5 million+',
  'prefer-not-to-say': 'an undisclosed revenue range',
}

const OWNER_COMPENSATION_LABELS: Record<string, string> = {
  payroll: 'regular payroll / W-2 salary',
  'owners-draw': "an owner's draw",
  distributions: 'distributions',
  'salary-plus-distributions': 'salary plus distributions',
  'irregular-transfers': 'irregular transfers when cash is available',
  'not-consistent': 'no consistent owner pay',
  'not-sure': 'uncertainty about how you pay yourself',
}

const OWNER_INCOME_LABELS: Record<string, string> = {
  zero: '$0 / not currently taking income',
  'under-50k': 'under $50,000',
  '50k-99k': '$50,000–$99,999',
  '100k-199k': '$100,000–$199,999',
  '200k-499k': '$200,000–$499,999',
  '500k-plus': '$500,000+',
  'prefer-not-to-say': 'an undisclosed personal income range',
}

const OPERATING_DOCS_LABELS: Record<string, string> = {
  current: 'reviewed within the last 2 years',
  'needs-update': 'in place but may need updates',
  none: 'not formally in place',
  unsure: 'uncertain',
}

const FINANCE_SEPARATION_LABELS: Record<string, string> = {
  'fully-separated': 'fully separated',
  'mostly-separated': 'mostly separated',
  'some-mingled': 'partially mingled',
  'not-separated': 'not meaningfully separated',
}

const OPERATING_CASH_FLOW_LABELS: Record<string, string> = {
  'positive-reinvest': 'consistently positive with room to reinvest',
  'break-even': 'generally break even',
  'tight-seasonal': 'tight or highly seasonal',
  negative: 'often negative or cash-strapped',
  unsure: 'uncertain',
}

const RESERVE_MONTHS_LABELS: Record<string, string> = {
  '6plus': '6+ months',
  '3-5': '3–5 months',
  '1-2': '1–2 months',
  none: 'no dedicated reserves',
}

const REVENUE_PREDICTABILITY_LABELS: Record<string, string> = {
  'very-predictable': 'very predictable',
  'mostly-predictable': 'mostly predictable',
  seasonal: 'seasonal or cyclical',
  unpredictable: 'highly unpredictable',
}

const CARD_SALES_PERCENTAGE_LABELS: Record<string, string> = {
  'under-25': 'less than 25%',
  '25-49': '25–49%',
  '50-74': '50–74%',
  '75-100': '75–100%',
  unsure: 'uncertain',
}

const PROCESSING_RATE_LABELS: Record<string, string> = {
  'under-2': 'under 2%',
  '2-2.49': '2.00–2.49%',
  '2.5-2.99': '2.50–2.99%',
  '3-3.49': '3.00–3.49%',
  '3.5-plus': '3.50% or higher',
  unsure: 'uncertain',
}

const PROCESSING_REVIEW_LABELS: Record<string, string> = {
  'within-6mo': 'within the last 6 months',
  '6-12mo': '6–12 months ago',
  'over-12mo': 'more than 12 months ago',
  never: 'never reviewed',
  unsure: 'uncertain',
}

const TAX_PLANNING_LABELS: Record<string, string> = {
  proactive: 'proactive strategies reviewed annually with an advisor',
  'annual-review': 'annual tax review with limited proactive planning',
  'compliance-only': 'compliance-focused (file and pay)',
  none: 'no formal tax planning',
}

const TAX_BENEFIT_STRATEGIES_LABELS: Record<string, string> = {
  'yes-multiple': 'multiple retirement or benefit strategies',
  'yes-basic': 'basic retirement or benefit strategies',
  considering: 'considering strategies but not yet implemented',
  no: 'no retirement or benefit strategies for tax reduction',
}

const KEY_PERSON_BUYSELL_LABELS: Record<string, string> = {
  'yes-funded': 'funded and documented',
  'yes-unfunded': 'documented but not fully funded',
  planning: 'in planning',
  no: 'not in place',
  unsure: 'uncertain',
}

const CONTINUITY_PLAN_LABELS: Record<string, string> = {
  documented: 'a documented continuity plan',
  informal: 'informal arrangements only',
  no: 'no meaningful continuity plan',
  unsure: 'uncertainty about continuity',
}

const CORE_INSURANCE_LABELS: Record<string, string> = {
  'yes-reviewed': 'reviewed annually for business size',
  'yes-basic': 'basic coverage in place',
  partial: 'partial coverage or unknown limits',
  no: 'no commercial coverage',
  unsure: 'uncertain about coverage adequacy',
}

const SPECIALIZED_COVERAGE_LABELS: Record<string, string> = {
  comprehensive: 'a comprehensive review within 2 years',
  standard: 'a standard review',
  partial: 'partial review with identified gaps',
  no: 'no specialized review',
  unsure: 'uncertainty about specialized coverage',
}

const OWNER_RETIREMENT_SAVINGS_LABELS: Record<string, string> = {
  'over-15': 'more than 15% of personal income',
  '11-15': '11–15% of personal income',
  '6-10': '6–10% of personal income',
  'under-5': 'less than 5% of personal income',
  'not-saving': 'not currently saving outside the business',
}

const BUSINESS_CREDIT_LABELS: Record<string, string> = {
  established: 'established and monitored regularly',
  building: 'actively building',
  personal: 'primarily relying on personal credit',
  unsure: 'uncertain about the business credit profile',
}

const GROWTH_CAPITAL_LABELS: Record<string, string> = {
  readily: 'readily available',
  limited: 'available but limited',
  'personal-guarantee': 'only available with personal guarantees',
  difficult: 'difficult to access',
}

const SUCCESSION_PLAN_LABELS: Record<string, string> = {
  documented: 'documented and reviewed within 2 years',
  informal: 'informally discussed but not documented',
  none: 'not addressed',
  unsure: 'uncertain',
}

const VALUATION_BASELINE_LABELS: Record<string, string> = {
  recent: 'established within the last 2 years',
  outdated: 'established but outdated',
  no: 'not established',
  unsure: 'uncertain',
}

function points(map: Record<string, number>, value: string): number {
  return map[value] ?? 0
}

function scoreToStatus(score: number): CategoryScore['status'] {
  if (score >= 80) return 'strength'
  if (score >= 65) return 'neutral'
  return 'opportunity'
}

function scoreToBusinessLevel(score: number): string {
  if (score >= 88) return 'Enterprise Ready™ Track'
  if (score >= 78) return 'Solid Foundation with Growth Potential'
  if (score >= 68) return 'Building Business Momentum'
  if (score >= 58) return 'Stabilizing Operations'
  return 'Needs Immediate Attention'
}

function protectionRatingLabel(score: number): string {
  if (score >= 80) return 'Strong Protection'
  if (score >= 65) return 'Moderate Protection'
  if (score >= 50) return 'Limited Protection'
  return 'Insufficient Protection'
}

function isMultiOwnerEntity(answers: BusinessAssessmentAnswers): boolean {
  const entity = answers.foundation.entityStructure
  return entity === 'partnership' || entity === 'multi-member-llc'
}

function hasMultipleEmployees(answers: BusinessAssessmentAnswers): boolean {
  return answers.business.employees !== 'solo' && answers.business.employees !== ''
}

function isMatureBusiness(answers: BusinessAssessmentAnswers): boolean {
  return answers.business.yearsInBusiness === '11-20' || answers.business.yearsInBusiness === 'over-20'
}

function isHighRevenueBusiness(revenue: string): boolean {
  return revenue === '1m-2.49m' || revenue === '2.5m-4.99m' || revenue === '5m-plus'
}

function hasSignificantCardVolume(cardSalesPercentage: string): boolean {
  return cardSalesPercentage === '50-74' || cardSalesPercentage === '75-100'
}

function needsCompensationReview(compensationMethod: string): boolean {
  return (
    compensationMethod === 'not-sure' ||
    compensationMethod === 'not-consistent' ||
    compensationMethod === 'irregular-transfers'
  )
}

function processingRateAwarenessScore(rate: string): number {
  return rate === 'unsure' ? 40 : rate ? 85 : 0
}

function cardVolumeAwarenessScore(percentage: string): number {
  return percentage === 'unsure' ? 45 : percentage ? 80 : 0
}

function calculateMerchantAwarenessScore(answers: BusinessAssessmentAnswers): number {
  const { cashFlowTax } = answers
  const rateScore = processingRateAwarenessScore(cashFlowTax.estimatedProcessingRate)
  const reviewScore = points(LAST_PROCESSING_REVIEW_POINTS, cashFlowTax.lastProcessingReview)
  const volumeScore = cardVolumeAwarenessScore(cashFlowTax.cardSalesPercentage)
  return Math.round(rateScore * 0.35 + reviewScore * 0.45 + volumeScore * 0.2)
}

function shouldRecommendProcessingReview(answers: BusinessAssessmentAnswers): boolean {
  const { cashFlowTax } = answers
  if (cashFlowTax.acceptsCardPayments !== 'yes') return false

  const unknownRate = cashFlowTax.estimatedProcessingRate === 'unsure'
  const highRate = cashFlowTax.estimatedProcessingRate === '3.5-plus'
  const staleReview = ['over-12mo', 'never', 'unsure'].includes(cashFlowTax.lastProcessingReview)
  const significantVolume = hasSignificantCardVolume(cashFlowTax.cardSalesPercentage)

  return unknownRate || staleReview || (highRate && significantVolume)
}

function shouldFlagHighRevenueNoRetirement(answers: BusinessAssessmentAnswers): boolean {
  const savings = answers.retirementFundingExit.ownerRetirementSavings
  return isHighRevenueBusiness(answers.business.grossAnnualRevenue) && (savings === 'not-saving' || savings === 'under-5')
}

function appendUniqueRecommendation(recommendations: string[], item: string): string[] {
  return recommendations.includes(item) ? recommendations : [...recommendations, item]
}

function buildStructureCategory(answers: BusinessAssessmentAnswers): CategoryScore {
  const { foundation } = answers
  const entityScore = points(LEGAL_ENTITY_STRUCTURE_POINTS, foundation.entityStructure)
  const docsScore = points(OPERATING_DOCS_POINTS, foundation.operatingDocs)
  const separationScore = points(FINANCE_SEPARATION_POINTS, foundation.financeSeparation)
  const score = Math.round(entityScore * 0.3 + docsScore * 0.35 + separationScore * 0.35)

  const recommendations =
    score >= 80
      ? [
          'Review operating agreements and ownership documents with legal counsel every 2–3 years.',
          'Confirm personal and business assets remain properly separated.',
        ]
      : foundation.financeSeparation === 'not-separated' || foundation.financeSeparation === 'some-mingled'
        ? [
            'Separate business and personal accounts, records, and tax filings immediately.',
            'Review legal structure and operating agreements with qualified advisors.',
          ]
        : foundation.entityStructure === 'not-sure'
          ? [
              'Confirm your legal entity structure with a qualified advisor.',
              'Review operating agreements and ownership documents with legal counsel.',
            ]
          : [
              'Review operating agreements and ownership documents with legal counsel.',
              'Confirm personal and business assets are properly separated.',
            ]

  return {
    id: 'structure',
    title: 'Business Structure',
    grade: scoreToGrade(score),
    score,
    status: scoreToStatus(score),
    summary:
      score >= 80
        ? 'Legal structure and ownership documents appear well aligned with operations.'
        : score >= 65
          ? 'Legal structure is in place but may need optimization.'
          : 'Business structure and financial separation need meaningful attention.',
    explanation: `You reported ${LEGAL_ENTITY_LABELS[foundation.entityStructure] ?? 'your current legal structure'}, operating documents ${OPERATING_DOCS_LABELS[foundation.operatingDocs] ?? 'with unknown status'}, and personal/business finances ${FINANCE_SEPARATION_LABELS[foundation.financeSeparation] ?? 'with unknown separation'}.`,
    guidance:
      'The right legal structure protects personal assets, clarifies ownership, and creates a stronger foundation for growth and exit planning.',
    recommendations,
  }
}

function buildCashflowCategory(answers: BusinessAssessmentAnswers): CategoryScore {
  const { cashFlowTax, business } = answers
  const flowScore = points(OPERATING_CASH_FLOW_POINTS, cashFlowTax.operatingCashFlow)
  const reserveScore = points(RESERVE_MONTHS_POINTS, cashFlowTax.reserveMonths)
  const predictabilityScore = points(REVENUE_PREDICTABILITY_POINTS, cashFlowTax.revenuePredictability)
  const compensationScore = points(OWNER_COMPENSATION_POINTS, business.ownerCompensationMethod)

  let score: number
  if (cashFlowTax.acceptsCardPayments === 'yes') {
    const merchantScore = calculateMerchantAwarenessScore(answers)
    score = Math.round(
      flowScore * 0.28 +
        reserveScore * 0.24 +
        predictabilityScore * 0.18 +
        merchantScore * 0.18 +
        compensationScore * 0.12,
    )
  } else {
    score = Math.round(
      flowScore * 0.36 + reserveScore * 0.3 + predictabilityScore * 0.22 + compensationScore * 0.12,
    )
  }

  let recommendations =
    score >= 80
      ? [
          'Maintain 3–6 months of operating expenses in business reserves.',
          'Review cash flow forecasting quarterly to anticipate capital needs.',
        ]
      : cashFlowTax.reserveMonths === 'none' || cashFlowTax.reserveMonths === '1-2'
        ? [
            'Build toward 3–6 months of operating expenses in dedicated business reserves.',
            'Review cash flow forecasting quarterly to anticipate capital needs.',
          ]
        : [
            'Strengthen monthly cash flow discipline and reserve targets.',
            'Identify seasonal or variable revenue patterns and plan accordingly.',
          ]

  if (needsCompensationReview(business.ownerCompensationMethod)) {
    recommendations = appendUniqueRecommendation(
      recommendations,
      'Establish a consistent owner compensation approach with help from your accountant or advisor.',
    )
  }

  if (shouldRecommendProcessingReview(answers)) {
    recommendations = appendUniqueRecommendation(recommendations, MERCHANT_PROCESSING_RECOMMENDATION)
  }

  const merchantExplanation =
    cashFlowTax.acceptsCardPayments === 'yes'
      ? ` Card sales represent ${CARD_SALES_PERCENTAGE_LABELS[cashFlowTax.cardSalesPercentage] ?? 'an unknown share'} of revenue, your estimated effective processing rate is ${PROCESSING_RATE_LABELS[cashFlowTax.estimatedProcessingRate] ?? 'uncertain'}, and your last statement review was ${PROCESSING_REVIEW_LABELS[cashFlowTax.lastProcessingReview] ?? 'uncertain'}.`
      : ' You reported that the business does not accept card payments.'

  return {
    id: 'cashflow',
    title: 'Cash Flow',
    grade: scoreToGrade(score),
    score,
    status: scoreToStatus(score),
    summary:
      score >= 80
        ? 'Healthy operating cash flow with predictable revenue patterns.'
        : score >= 65
          ? 'Cash flow is manageable, but reserves, pay patterns, or processing awareness may need attention.'
          : 'Operating cash flow, reserves, or cost awareness may be putting pressure on the business.',
    explanation: `You reported operating cash flow as ${OPERATING_CASH_FLOW_LABELS[cashFlowTax.operatingCashFlow] ?? 'uncertain'}, ${RESERVE_MONTHS_LABELS[cashFlowTax.reserveMonths] ?? 'unknown reserves'} of operating reserves, revenue predictability as ${REVENUE_PREDICTABILITY_LABELS[cashFlowTax.revenuePredictability] ?? 'uncertain'}, and owner pay via ${OWNER_COMPENSATION_LABELS[business.ownerCompensationMethod] ?? 'an unspecified method'}.${merchantExplanation}`,
    guidance:
      'Strong cash flow is the engine of business growth — it funds expansion, reserves, and strategic initiatives without overreliance on debt.',
    recommendations,
  }
}

function buildTaxCategory(answers: BusinessAssessmentAnswers): CategoryScore {
  const { cashFlowTax, business } = answers
  const planningScore = points(TAX_PLANNING_POINTS, cashFlowTax.taxPlanning)
  const benefitScore = points(TAX_BENEFIT_STRATEGIES_POINTS, cashFlowTax.taxBenefitStrategies)
  const compensationScore = points(OWNER_COMPENSATION_POINTS, business.ownerCompensationMethod)
  const score = Math.round(planningScore * 0.45 + benefitScore * 0.35 + compensationScore * 0.2)

  let recommendations =
    score >= 80
      ? [
          'Review tax strategies annually before year-end planning deadlines.',
          'Evaluate new retirement and benefit strategies as the business grows.',
        ]
      : [
          'Schedule a proactive tax review before year-end planning deadlines.',
          'Evaluate retirement and benefit strategies that reduce taxable income.',
        ]

  if (needsCompensationReview(business.ownerCompensationMethod)) {
    recommendations = appendUniqueRecommendation(
      recommendations,
      'Review how you pay yourself with a tax professional to confirm your approach fits your legal structure.',
    )
  }

  return {
    id: 'tax',
    title: 'Tax Strategy',
    grade: scoreToGrade(score),
    score,
    status: scoreToStatus(score),
    summary:
      score >= 80
        ? 'Proactive tax strategies appear aligned with business growth goals.'
        : score >= 65
          ? 'Tax planning exists, but optimization opportunities remain.'
          : 'Tax strategy may be limited to compliance without proactive planning.',
    explanation: `You reported tax planning as ${TAX_PLANNING_LABELS[cashFlowTax.taxPlanning] ?? 'unspecified'}, ${TAX_BENEFIT_STRATEGIES_LABELS[cashFlowTax.taxBenefitStrategies] ?? 'unspecified benefit strategies'}, and owner compensation via ${OWNER_COMPENSATION_LABELS[business.ownerCompensationMethod] ?? 'an unspecified method'}.`,
    guidance:
      'Strategic tax planning keeps more capital working inside your business — fueling expansion, reserves, and long-term wealth building.',
    recommendations,
  }
}

function buildProtectionCategory(answers: BusinessAssessmentAnswers): CategoryScore {
  const { protectionRisk, business } = answers
  const keyPersonScore = points(KEY_PERSON_BUYSELL_POINTS, protectionRisk.keyPersonBuySell)
  const continuityScore = points(CONTINUITY_PLAN_POINTS, protectionRisk.continuityPlan)
  const score = Math.round(keyPersonScore * 0.55 + continuityScore * 0.45)

  const industryNote = business.industry
    ? ` Your business operates in ${INDUSTRY_LABELS[business.industry] ?? 'your reported industry'}.`
    : ''

  return {
    id: 'business-protection',
    title: 'Business Protection',
    grade: scoreToGrade(score),
    score,
    status: scoreToStatus(score),
    summary:
      score >= 80
        ? 'Key people and continuity planning appear reasonably protected.'
        : score >= 65
          ? 'Protection strategies exist, but key revenue dependencies may remain exposed.'
          : 'Key revenue and leadership roles may be underprotected.',
    explanation: `You reported key person or buy-sell protection as ${KEY_PERSON_BUYSELL_LABELS[protectionRisk.keyPersonBuySell] ?? 'uncertain'} and continuity planning as ${CONTINUITY_PLAN_LABELS[protectionRisk.continuityPlan] ?? 'uncertain'}.${industryNote}`,
    guidance:
      'Business protection helps preserve operations, revenue, and enterprise value when unexpected events disrupt leadership or key talent.',
    recommendations:
      score >= 80
        ? [
            'Review key person and buy-sell funding strategies annually with your advisor.',
            'Update continuity plans as leadership roles and revenue drivers change.',
          ]
        : [
            'Identify revenue tied to key people and quantify potential disruption.',
            'Review key person and buy-sell funding strategies with your advisor.',
          ],
  }
}

function buildRiskCategory(answers: BusinessAssessmentAnswers): CategoryScore {
  const { protectionRisk } = answers
  const coreScore = points(CORE_INSURANCE_POINTS, protectionRisk.coreInsurance)
  const specializedScore = points(SPECIALIZED_COVERAGE_POINTS, protectionRisk.specializedCoverage)
  const score = Math.round(coreScore * 0.5 + specializedScore * 0.5)

  return {
    id: 'risk',
    title: 'Risk Management',
    grade: scoreToGrade(score),
    score,
    status: scoreToStatus(score),
    summary:
      score >= 80
        ? 'Core and specialized coverage appear aligned with business operations.'
        : score >= 65
          ? 'Core policies exist, but coverage gaps may remain.'
          : 'Operational insurance and liability coverage need review.',
    explanation: `You reported core commercial insurance as ${CORE_INSURANCE_LABELS[protectionRisk.coreInsurance] ?? 'uncertain'} and specialized coverage review as ${SPECIALIZED_COVERAGE_LABELS[protectionRisk.specializedCoverage] ?? 'uncertain'}.`,
    guidance:
      "Comprehensive risk management protects the enterprise you've built from operational, legal, and financial threats that can erode value overnight.",
    recommendations:
      score >= 80
        ? [
            'Conduct an annual business insurance and liability review.',
            'Reassess cyber, E&O, and umbrella coverage as operations scale.',
          ]
        : [
            'Conduct an annual business insurance and liability review.',
            'Evaluate cyber, E&O, and umbrella coverage relative to business size.',
          ],
  }
}

function buildRetirementCategory(answers: BusinessAssessmentAnswers): CategoryScore {
  const { retirementFundingExit, business } = answers
  const score = points(OWNER_RETIREMENT_SAVINGS_POINTS, retirementFundingExit.ownerRetirementSavings)

  let recommendations =
    score >= 80
      ? [
          'Maintain or increase tax-advantaged retirement contributions with income growth.',
          'Align investment allocation with your personal time horizon and risk tolerance.',
        ]
      : retirementFundingExit.ownerRetirementSavings === 'not-saving'
        ? [
            'Start owner retirement contributions through SEP, SIMPLE, or Solo 401(k) plans.',
            'Automate contributions each month, even at a modest percentage.',
          ]
        : [
            'Increase tax-advantaged retirement contributions where cash flow allows.',
            'Align investment allocation with your personal time horizon and risk tolerance.',
          ]

  if (shouldFlagHighRevenueNoRetirement(answers)) {
    recommendations = appendUniqueRecommendation(
      recommendations,
      'With meaningful business revenue, building owner retirement savings outside the business deserves priority review.',
    )
  }

  return {
    id: 'retirement',
    title: 'Retirement & Wealth',
    grade: scoreToGrade(score),
    score,
    status: scoreToStatus(score),
    summary:
      score >= 80
        ? 'Owner retirement savings outside the business appear strong.'
        : score >= 65
          ? 'Owner retirement savings are in progress but may be behind target.'
          : 'Owner wealth outside the business needs stronger attention.',
    explanation: `You reported gross business revenue of ${GROSS_REVENUE_LABELS[business.grossAnnualRevenue] ?? 'an unspecified range'}, personal income from the business of ${OWNER_INCOME_LABELS[business.ownerPersonalIncome] ?? 'an unspecified range'}, and retirement savings of ${OWNER_RETIREMENT_SAVINGS_LABELS[retirementFundingExit.ownerRetirementSavings] ?? 'an unspecified amount'} outside the business.`,
    guidance:
      'Owner retirement planning ensures your personal financial future is not entirely dependent on a future business sale or succession event.',
    recommendations,
  }
}

function buildCreditCategory(answers: BusinessAssessmentAnswers): CategoryScore {
  const { retirementFundingExit } = answers
  const creditScore = points(BUSINESS_CREDIT_POINTS, retirementFundingExit.businessCredit)
  const capitalScore = points(GROWTH_CAPITAL_POINTS, retirementFundingExit.growthCapital)
  const score = Math.round(creditScore * 0.5 + capitalScore * 0.5)

  return {
    id: 'credit',
    title: 'Credit & Funding',
    grade: scoreToGrade(score),
    score,
    status: scoreToStatus(score),
    summary:
      score >= 80
        ? 'Business credit and funding access appear strong for growth.'
        : score >= 65
          ? 'Business credit profile has room to strengthen.'
          : 'Business credit and capital access may be limiting growth.',
    explanation: `You reported business credit as ${BUSINESS_CREDIT_LABELS[retirementFundingExit.businessCredit] ?? 'uncertain'} and growth capital access as ${GROWTH_CAPITAL_LABELS[retirementFundingExit.growthCapital] ?? 'uncertain'}.`,
    guidance:
      'A strong business credit profile unlocks better financing terms and reduces dependence on personal guarantees.',
    recommendations:
      score >= 80
        ? [
            'Monitor business credit profiles and lending relationships annually.',
            'Review financing terms as the business scales.',
          ]
        : [
            'Establish and monitor a dedicated business credit profile.',
            'Review lending relationships and lines of credit annually.',
          ],
  }
}

function buildExitCategory(answers: BusinessAssessmentAnswers): CategoryScore {
  const { retirementFundingExit } = answers
  const successionScore = points(SUCCESSION_PLAN_POINTS, retirementFundingExit.successionPlan)
  const valuationScore = points(VALUATION_BASELINE_POINTS, retirementFundingExit.valuationBaseline)
  const score = Math.round(successionScore * 0.55 + valuationScore * 0.45)

  return {
    id: 'exit',
    title: 'Exit Planning',
    grade: scoreToGrade(score),
    score,
    status: scoreToStatus(score),
    summary:
      score >= 80
        ? 'Succession and valuation planning appear well established.'
        : score >= 65
          ? 'Exit planning is started but may need clearer documentation.'
          : 'Succession and exit strategy need clearer definition.',
    explanation: `You reported succession planning as ${SUCCESSION_PLAN_LABELS[retirementFundingExit.successionPlan] ?? 'uncertain'} and a business valuation baseline as ${VALUATION_BASELINE_LABELS[retirementFundingExit.valuationBaseline] ?? 'uncertain'}.`,
    guidance:
      "Exit planning begins long before a sale — it increases enterprise value, reduces transition risk, and protects what you've built.",
    recommendations:
      score >= 80
        ? [
            'Review succession and valuation assumptions every 2–3 years.',
            'Align buy-sell and key person strategies with ownership changes.',
          ]
        : [
            'Document a succession timeline and identify potential successors or buyers.',
            'Establish a business valuation baseline and buy-sell funding strategy.',
          ],
  }
}

function buildPriorities(
  categories: CategoryScore[],
  answers: BusinessAssessmentAnswers,
): PriorityRecommendation[] {
  const ranked = [...categories].sort((a, b) => a.score - b.score)
  const rankAdjustments = new Map<string, number>()

  for (const goal of answers.goals.selected) {
    const categoryId = GOAL_CATEGORY_BOOST[goal]
    if (categoryId) {
      rankAdjustments.set(categoryId, (rankAdjustments.get(categoryId) ?? 0) - 1)
    }
  }

  const protection = categories.find((c) => c.id === 'business-protection')!
  const cashflow = categories.find((c) => c.id === 'cashflow')!
  const exit = categories.find((c) => c.id === 'exit')!
  if (protection.score < 50) {
    rankAdjustments.set('business-protection', (rankAdjustments.get('business-protection') ?? 0) - 2)
  }
  if (cashflow.score < 40) {
    rankAdjustments.set('cashflow', (rankAdjustments.get('cashflow') ?? 0) - 2)
  }
  if (exit.score < 50 && isMatureBusiness(answers)) {
    rankAdjustments.set('exit', (rankAdjustments.get('exit') ?? 0) - 2)
  }
  if (
    isMultiOwnerEntity(answers) &&
    hasMultipleEmployees(answers) &&
    answers.protectionRisk.keyPersonBuySell === 'no'
  ) {
    rankAdjustments.set('business-protection', (rankAdjustments.get('business-protection') ?? 0) - 2)
  }
  if (shouldFlagHighRevenueNoRetirement(answers)) {
    rankAdjustments.set('retirement', (rankAdjustments.get('retirement') ?? 0) - 5)
  }
  if (shouldRecommendProcessingReview(answers) && hasSignificantCardVolume(answers.cashFlowTax.cardSalesPercentage)) {
    rankAdjustments.set('cashflow', (rankAdjustments.get('cashflow') ?? 0) - 1)
  }
  if (needsCompensationReview(answers.business.ownerCompensationMethod)) {
    rankAdjustments.set('tax', (rankAdjustments.get('tax') ?? 0) - 1)
    rankAdjustments.set('cashflow', (rankAdjustments.get('cashflow') ?? 0) - 1)
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
    'business-protection': {
      title: 'Protect Key Revenue & Leadership',
      why: 'A loss of a key owner or revenue-driving employee could disrupt operations and reduce enterprise value.',
      impact:
        'Helps preserve revenue continuity, protect enterprise value, and stabilize operations during unexpected leadership transitions.',
      timeline: 'Recommended within 30 days',
    },
    cashflow: {
      title: 'Strengthen Operating Cash Reserves',
      why: 'Optimizing cash reserves, pay patterns, and cost awareness strengthens your ability to invest in growth while weathering downturns.',
      impact:
        'Creates financial flexibility for reinvestment, debt reduction, and strategic initiatives without overextending the business.',
      timeline: 'Recommended within 30–60 days',
    },
    structure: {
      title: 'Optimize Entity & Ownership Structure',
      why: 'Legal structure and financial separation may not fully reflect how the business operates today.',
      impact:
        'Protects personal assets, clarifies ownership, and strengthens the foundation for growth and exit planning.',
      timeline: 'Recommended within 30–60 days',
    },
    tax: {
      title: 'Implement Proactive Tax Strategies',
      why: 'Proactive tax planning and compensation clarity could reduce liability and improve retained earnings for growth.',
      impact: 'Keeps more capital working inside the business for expansion, reserves, and wealth building.',
      timeline: 'Recommended within 30–60 days',
    },
    credit: {
      title: 'Strengthen Business Credit & Funding Access',
      why: 'Business credit and capital access may be restricting growth or increasing personal financial exposure.',
      impact: 'Unlocks better financing terms and reduces dependence on personal guarantees.',
      timeline: 'Recommended within 30–60 days',
    },
    retirement: {
      title: 'Build Owner Wealth Outside the Business',
      why: 'Owner retirement savings outside the business may not support long-term personal income goals.',
      impact:
        'Reduces dependence on a future business sale and builds personal financial independence.',
      timeline: 'Recommended within 60–90 days',
    },
    risk: {
      title: 'Close Operational Coverage Gaps',
      why: 'Specialized operational risks tied to your business size and contracts may need review.',
      impact:
        'Protects the enterprise from operational, legal, and financial threats that can erode value overnight.',
      timeline: 'Recommended within 30–60 days',
    },
    exit: {
      title: 'Document Succession & Exit Strategy',
      why: 'A documented succession and valuation strategy increases enterprise value and reduces transition risk.',
      impact:
        'Builds long-term enterprise value and reduces uncertainty for owners, partners, and key stakeholders.',
      timeline: 'Recommended over the next 90 days',
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

export function buildBusinessActionPlanFromCategories(
  categories: CategoryScore[],
  answers: BusinessAssessmentAnswers,
): ReportActionPlan {
  const byId = Object.fromEntries(categories.map((category) => [category.id, category]))
  const ranked = [...categories].sort((a, b) => a.score - b.score)
  const weakest = ranked[0]
  const second = ranked[1]
  const third = ranked[2]
  const protection = byId['business-protection']
  const cashflow = byId.cashflow

  const immediate: string[] = [
    weakest?.recommendations[0] ?? 'Address your highest-risk business financial category.',
    second?.recommendations[0] ?? 'Review business cash reserves and forecasting.',
    protection && protection.score < 70
      ? 'Review your Business Protection Rating and identify key revenue dependencies.'
      : 'Confirm business and personal accounts, assets, and liabilities are properly separated.',
  ]

  const thirtyDay: string[] = [
    'Schedule your complimentary Business Financial Strategy Session™.',
    third?.recommendations[0] ?? 'Gather entity documents, insurance policies, and tax returns for advisor review.',
    cashflow?.recommendations[0] ?? 'Set a 30-day milestone to strengthen business cash reserves.',
  ]

  if (shouldRecommendProcessingReview(answers)) {
    thirtyDay.push(MERCHANT_PROCESSING_RECOMMENDATION)
  }

  const ninetyDay: string[] = [
    byId.exit?.recommendations[0] ?? 'Document succession and exit planning priorities.',
    answers.goals.selected.includes('plan-exit')
      ? 'Establish or update buy-sell and key person protection strategies.'
      : (ranked[3]?.recommendations[0] ?? 'Implement your Business Financial Blueprint™ priorities.'),
    'Establish a quarterly business financial check-in with your leadership team.',
  ]

  return { immediate, thirtyDay, ninetyDay }
}

function buildBlueprintBullets(categories: CategoryScore[]): string[] {
  const sorted = [...categories].sort((a, b) => a.score - b.score)
  const bullets = sorted
    .map((category) => BLUEPRINT_BY_CATEGORY[category.id])
    .filter((bullet): bullet is string => Boolean(bullet))

  if (!bullets.includes('Increase enterprise value')) {
    bullets.push('Increase enterprise value')
  }

  return bullets
}

function buildNarrative(businessName: string, overallScore: number): string {
  const name = businessName.trim()
  const subject = name ? `${name}` : 'Your business'

  if (overallScore >= 85) {
    return `${subject} shows strong financial fundamentals with targeted opportunities to increase enterprise value.`
  }
  if (overallScore >= 70) {
    return `${subject} has a solid financial foundation, but several high-impact opportunities could strengthen protection, profitability, and long-term enterprise value.`
  }
  return `${subject} shows meaningful financial vulnerabilities that should be addressed promptly to protect revenue and enterprise value.`
}

export function scoreBusinessAssessment(
  answers: BusinessAssessmentAnswers,
): BusinessAssessmentScoreResult {
  const categories = [
    buildProtectionCategory(answers),
    buildCashflowCategory(answers),
    buildStructureCategory(answers),
    buildTaxCategory(answers),
    buildCreditCategory(answers),
    buildRetirementCategory(answers),
    buildRiskCategory(answers),
    buildExitCategory(answers),
  ]

  const byId = Object.fromEntries(categories.map((category) => [category.id, category]))

  const overallScore = Math.round(
    byId['business-protection'].score * CATEGORY_WEIGHTS['business-protection'] +
      byId.cashflow.score * CATEGORY_WEIGHTS.cashflow +
      byId.structure.score * CATEGORY_WEIGHTS.structure +
      byId.tax.score * CATEGORY_WEIGHTS.tax +
      byId.credit.score * CATEGORY_WEIGHTS.credit +
      byId.retirement.score * CATEGORY_WEIGHTS.retirement +
      byId.risk.score * CATEGORY_WEIGHTS.risk +
      byId.exit.score * CATEGORY_WEIGHTS.exit,
  )

  const growthReadiness = Math.round(
    (byId.cashflow.score + byId.credit.score + byId.tax.score + byId.structure.score) / 4,
  )

  const protectionAvg = Math.round(
    (byId['business-protection'].score + byId.risk.score) / 2,
  )

  const overallGrade = scoreToGrade(overallScore)
  const currentLevel = scoreToBusinessLevel(overallScore)
  const protectionRating = protectionRatingLabel(protectionAvg)
  const priorities = buildPriorities(categories, answers)
  const actionPlan = buildBusinessActionPlanFromCategories(categories, answers)
  const blueprintBullets = buildBlueprintBullets(categories)
  const defaultOpenCategory =
    [...categories].sort((a, b) => a.score - b.score)[0]?.id ?? 'business-protection'

  return {
    overallScore,
    overallGrade,
    currentLevel,
    growthReadiness,
    protectionRating,
    categories,
    priorities,
    actionPlan,
    blueprintBullets,
    defaultOpenCategory,
    narrative: buildNarrative(answers.business.name, overallScore),
  }
}
