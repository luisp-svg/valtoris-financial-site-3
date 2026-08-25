import type { CategoryScore } from '../../reportCard/types'
import type { PriorityRecommendation } from '../../results/PriorityRecommendationCard'
import type {
  ReportActionPlan,
  ReportDashboardChrome,
  ReportDashboardData,
} from '../../reportDashboard/types'
import type { ReportCardCopyFn } from '../reportCardLocale'
import { scoreBand } from '../reportCardLocale'
import { formatSpecializedTemplate } from '../specialized/locale'
import type { BusinessAssessmentAnswers } from './types'
import type { BusinessAssessmentScoreResult } from '../scoring/scoreBusinessAssessment'
import { scoreBusinessAssessment } from '../scoring/scoreBusinessAssessment'

/** English priority titles produced by scoreBusinessAssessment, mapped to category ids. */
const PRIORITY_ID_BY_ENGLISH_TITLE: Record<string, string> = {
  'Protect Key Revenue & Leadership': 'business-protection',
  'Strengthen Operating Cash Reserves': 'cashflow',
  'Optimize Entity & Ownership Structure': 'structure',
  'Implement Proactive Tax Strategies': 'tax',
  'Strengthen Business Credit & Funding Access': 'credit',
  'Build Owner Wealth Outside the Business': 'retirement',
  'Close Operational Coverage Gaps': 'risk',
  'Document Succession & Exit Strategy': 'exit',
}

const BLUEPRINT_KEY_BY_ENGLISH_BULLET: Record<string, string> = {
  'Protect key people & revenue': 'blueprint.business-protection',
  'Strengthen operating cash flow': 'blueprint.cashflow',
  'Optimize business structure': 'blueprint.structure',
  'Reduce business taxes': 'blueprint.tax',
  'Improve credit & funding access': 'blueprint.credit',
  'Build owner wealth outside the business': 'blueprint.retirement',
  'Reduce operational risk': 'blueprint.risk',
  'Prepare for succession': 'blueprint.exit',
  'Increase enterprise value': 'blueprint.value',
}

const STAGE_KEY_BY_ENGLISH_LEVEL: Record<string, string> = {
  'Enterprise Ready™ Track': 'stage.enterprise',
  'Solid Foundation with Growth Potential': 'stage.solid',
  'Building Business Momentum': 'stage.momentum',
  'Stabilizing Operations': 'stage.stabilizing',
  'Needs Immediate Attention': 'stage.attention',
}

const RATING_KEY_BY_ENGLISH_RATING: Record<string, string> = {
  'Strong Protection': 'rating.strong',
  'Moderate Protection': 'rating.moderate',
  'Limited Protection': 'rating.limited',
  'Insufficient Protection': 'rating.insufficient',
}

function narrativeKey(overallScore: number): string {
  if (overallScore >= 85) return 'narrative.high'
  if (overallScore >= 70) return 'narrative.mid'
  return 'narrative.low'
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
  return (
    isHighRevenueBusiness(answers.business.grossAnnualRevenue) &&
    (savings === 'not-saving' || savings === 'under-5')
  )
}

function appendUnique(recommendations: string[], item: string): string[] {
  return recommendations.includes(item) ? recommendations : [...recommendations, item]
}

/**
 * Re-renders a scored Business Report Card in the active locale.
 * Scores, grades, status ids, priority levels, and category ordering come straight
 * from scoreBusinessAssessment — only the display strings are rebuilt.
 */
export function localizeBusinessScoreResult(
  scored: BusinessAssessmentScoreResult,
  answers: BusinessAssessmentAnswers,
  t: ReportCardCopyFn,
): BusinessAssessmentScoreResult {
  const r = (key: string): string => t('results', key)
  const fill = (key: string, values: Record<string, string | number>): string =>
    formatSpecializedTemplate(r(key), values)

  /** Mirrors the scorer's `LABEL_MAP[value] ?? fallback` lookups. */
  function phrase(prefix: string, value: string): string {
    const key = `${prefix}.${value}`
    const resolved = t('answers', key)
    return resolved === key ? t('answers', `${prefix}.unknown`) : resolved
  }

  const { business, foundation, cashFlowTax, protectionRisk, retirementFundingExit } = answers
  const acceptsCards = cashFlowTax.acceptsCardPayments === 'yes'
  const compensationReview = needsCompensationReview(business.ownerCompensationMethod)
  const processingReview = shouldRecommendProcessingReview(answers)

  function explanationFor(category: CategoryScore): string {
    switch (category.id) {
      case 'business-protection': {
        const base = fill('explanation.business-protection', {
          keyPerson: phrase('keyPersonPhrase', protectionRisk.keyPersonBuySell),
          continuity: phrase('continuityPhrase', protectionRisk.continuityPlan),
        })
        if (!business.industry) return base
        const industryNote = fill('explanation.business-protectionIndustry', {
          industry: phrase('industryPhrase', business.industry),
        })
        return `${base} ${industryNote}`
      }
      case 'cashflow': {
        const base = fill('explanation.cashflow', {
          flow: phrase('cashFlowPhrase', cashFlowTax.operatingCashFlow),
          reserves: phrase('reservePhrase', cashFlowTax.reserveMonths),
          predictability: phrase('predictabilityPhrase', cashFlowTax.revenuePredictability),
          compensation: phrase('compensationPhrase', business.ownerCompensationMethod),
        })
        const merchant = acceptsCards
          ? fill('explanation.cashflowCards', {
              cardShare: phrase('cardSharePhrase', cashFlowTax.cardSalesPercentage),
              rate: phrase('processingRatePhrase', cashFlowTax.estimatedProcessingRate),
              review: phrase('processingReviewPhrase', cashFlowTax.lastProcessingReview),
            })
          : r('explanation.cashflowNoCards')
        return `${base} ${merchant}`
      }
      case 'structure':
        return fill('explanation.structure', {
          entity: phrase('entityPhrase', foundation.entityStructure),
          docs: phrase('operatingDocsPhrase', foundation.operatingDocs),
          separation: phrase('separationPhrase', foundation.financeSeparation),
        })
      case 'tax':
        return fill('explanation.tax', {
          planning: phrase('taxPlanningPhrase', cashFlowTax.taxPlanning),
          benefits: phrase('taxBenefitPhrase', cashFlowTax.taxBenefitStrategies),
          compensation: phrase('compensationPhrase', business.ownerCompensationMethod),
        })
      case 'credit':
        return fill('explanation.credit', {
          credit: phrase('businessCreditPhrase', retirementFundingExit.businessCredit),
          capital: phrase('growthCapitalPhrase', retirementFundingExit.growthCapital),
        })
      case 'retirement':
        return fill('explanation.retirement', {
          revenue: phrase('revenuePhrase', business.grossAnnualRevenue),
          income: phrase('ownerIncomePhrase', business.ownerPersonalIncome),
          savings: phrase(
            'retirementSavingsPhrase',
            retirementFundingExit.ownerRetirementSavings,
          ),
        })
      case 'risk':
        return fill('explanation.risk', {
          core: phrase('coreInsurancePhrase', protectionRisk.coreInsurance),
          specialized: phrase('specializedPhrase', protectionRisk.specializedCoverage),
        })
      case 'exit':
        return fill('explanation.exit', {
          succession: phrase('successionPhrase', retirementFundingExit.successionPlan),
          valuation: phrase('valuationPhrase', retirementFundingExit.valuationBaseline),
        })
      default:
        return category.explanation
    }
  }

  function recommendationsFor(category: CategoryScore): string[] {
    const isHigh = category.score >= 80

    switch (category.id) {
      case 'business-protection':
        return isHigh
          ? [r('rec.business-protection.high1'), r('rec.business-protection.high2')]
          : [r('rec.business-protection.low1'), r('rec.business-protection.low2')]
      case 'cashflow': {
        let recommendations = isHigh
          ? [r('rec.cashflow.high1'), r('rec.cashflow.high2')]
          : cashFlowTax.reserveMonths === 'none' || cashFlowTax.reserveMonths === '1-2'
            ? [r('rec.cashflow.reserve1'), r('rec.cashflow.reserve2')]
            : [r('rec.cashflow.low1'), r('rec.cashflow.low2')]
        if (compensationReview) {
          recommendations = appendUnique(recommendations, r('rec.cashflow.compensation'))
        }
        if (processingReview) {
          recommendations = appendUnique(recommendations, r('rec.cashflow.merchant'))
        }
        return recommendations
      }
      case 'structure':
        if (isHigh) return [r('rec.structure.high1'), r('rec.structure.high2')]
        if (
          foundation.financeSeparation === 'not-separated' ||
          foundation.financeSeparation === 'some-mingled'
        ) {
          return [r('rec.structure.separation1'), r('rec.structure.separation2')]
        }
        if (foundation.entityStructure === 'not-sure') {
          return [r('rec.structure.entity1'), r('rec.structure.entity2')]
        }
        return [r('rec.structure.low1'), r('rec.structure.low2')]
      case 'tax': {
        let recommendations = isHigh
          ? [r('rec.tax.high1'), r('rec.tax.high2')]
          : [r('rec.tax.low1'), r('rec.tax.low2')]
        if (compensationReview) {
          recommendations = appendUnique(recommendations, r('rec.tax.compensation'))
        }
        return recommendations
      }
      case 'credit':
        return isHigh
          ? [r('rec.credit.high1'), r('rec.credit.high2')]
          : [r('rec.credit.low1'), r('rec.credit.low2')]
      case 'retirement': {
        let recommendations = isHigh
          ? [r('rec.retirement.high1'), r('rec.retirement.high2')]
          : retirementFundingExit.ownerRetirementSavings === 'not-saving'
            ? [r('rec.retirement.start1'), r('rec.retirement.start2')]
            : [r('rec.retirement.increase1'), r('rec.retirement.increase2')]
        if (shouldFlagHighRevenueNoRetirement(answers)) {
          recommendations = appendUnique(recommendations, r('rec.retirement.highRevenue'))
        }
        return recommendations
      }
      case 'risk':
        return isHigh
          ? [r('rec.risk.high1'), r('rec.risk.high2')]
          : [r('rec.risk.low1'), r('rec.risk.low2')]
      case 'exit':
        return isHigh
          ? [r('rec.exit.high1'), r('rec.exit.high2')]
          : [r('rec.exit.low1'), r('rec.exit.low2')]
      default:
        return [...category.recommendations]
    }
  }

  const categories: CategoryScore[] = scored.categories.map((category) => ({
    ...category,
    title: r(`category.${category.id}`),
    summary: r(`summary.${category.id}.${scoreBand(category.score)}`),
    guidance: r(`guidance.${category.id}`),
    explanation: explanationFor(category),
    recommendations: recommendationsFor(category),
  }))

  const byId: Record<string, CategoryScore | undefined> = Object.fromEntries(
    categories.map((category) => [category.id, category]),
  )

  const priorities: PriorityRecommendation[] = scored.priorities.map((priority) => {
    const id = PRIORITY_ID_BY_ENGLISH_TITLE[priority.title]
    if (!id) return priority

    const category = byId[id]
    const scoreSuffix = category
      ? fill('priority.whyScore', { title: category.title, score: category.score }).trim()
      : ''
    const why = scoreSuffix
      ? `${r(`priority.${id}.why`)} ${scoreSuffix}`
      : r(`priority.${id}.why`)

    return {
      level: priority.level,
      title: r(`priority.${id}.title`),
      why,
      timeline: r(`priority.${id}.timeline`),
      impact: r(`priority.${id}.impact`),
    }
  })

  const ranked = [...categories].sort((a, b) => a.score - b.score)
  const weakest = ranked[0]
  const second = ranked[1]
  const third = ranked[2]
  const protection = byId['business-protection']
  const cashflow = byId.cashflow

  const thirtyDay = [
    r('action.strategySession'),
    third?.recommendations[0] ?? r('action.gatherDocs'),
    cashflow?.recommendations[0] ?? r('action.reserveMilestone'),
  ]

  if (processingReview) {
    thirtyDay.push(r('rec.cashflow.merchant'))
  }

  const actionPlan: ReportActionPlan = {
    immediate: [
      weakest?.recommendations[0] ?? r('action.highestRisk'),
      second?.recommendations[0] ?? r('action.reserves'),
      protection && protection.score < 70
        ? r('action.protectionRating')
        : r('action.separation'),
    ],
    thirtyDay,
    ninetyDay: [
      byId.exit?.recommendations[0] ?? r('action.exitPriorities'),
      answers.goals.selected.includes('plan-exit')
        ? r('action.buySell')
        : (ranked[3]?.recommendations[0] ?? r('action.blueprint')),
      r('action.quarterly'),
    ],
  }

  const blueprintBullets = scored.blueprintBullets.map((bullet) => {
    const key = BLUEPRINT_KEY_BY_ENGLISH_BULLET[bullet]
    return key ? r(key) : bullet
  })

  const businessName = business.name.trim()
  const subject = businessName || r('narrative.subjectGeneric')
  const stageKey = STAGE_KEY_BY_ENGLISH_LEVEL[scored.currentLevel]
  const ratingKey = RATING_KEY_BY_ENGLISH_RATING[scored.protectionRating]

  return {
    ...scored,
    currentLevel: stageKey ? r(stageKey) : scored.currentLevel,
    protectionRating: ratingKey ? r(ratingKey) : scored.protectionRating,
    categories,
    priorities,
    actionPlan,
    blueprintBullets,
    narrative: fill(narrativeKey(scored.overallScore), { subject }),
  }
}

export function businessDashboardChrome(t: ReportCardCopyFn): ReportDashboardChrome {
  const r = (key: string): string => t('results', key)

  return {
    currentScore: r('chrome.currentScore'),
    letterGrade: r('chrome.letterGrade'),
    atAGlance: r('chrome.atAGlance'),
    immediate: r('chrome.immediate'),
    thirtyDays: r('chrome.thirtyDays'),
    ninetyDays: r('chrome.ninetyDays'),
    whyThisMatters: r('chrome.whyThisMatters'),
    recommendedTimeline: r('chrome.recommendedTimeline'),
    priorityRank: r('chrome.priorityRank'),
    levelCritical: r('level.critical'),
    levelImportant: r('level.important'),
    levelLongTerm: r('level.longTerm'),
  }
}

/** Localized counterpart of getBusinessReportDashboardData for a completed assessment. */
export function buildLocalizedBusinessDashboard(
  businessName: string,
  greeting: string,
  answers: BusinessAssessmentAnswers,
  t: ReportCardCopyFn,
): ReportDashboardData {
  const r = (key: string): string => t('results', key)
  const scored = localizeBusinessScoreResult(scoreBusinessAssessment(answers), answers, t)
  const displayName = businessName.trim() || answers.business.name.trim()
  const preparedFor =
    greeting ||
    (displayName
      ? formatSpecializedTemplate(t('ui', 'preparedFor'), { name: displayName })
      : t('ui', 'sampleGreeting'))

  return {
    title: r('title'),
    preparedFor,
    narrative: scored.narrative,
    chrome: businessDashboardChrome(t),
    scoreLabel: r('scoreLabel'),
    score: scored.overallScore,
    grade: scored.overallGrade,
    level: scored.currentLevel,
    heroMeta: [
      {
        type: 'progress',
        label: r('hero.growthLabel'),
        value: scored.growthReadiness,
        copy: r('hero.growthCopy'),
      },
      {
        type: 'metric',
        label: r('hero.protectionLabel'),
        value: scored.protectionRating,
        copy: r('hero.protectionCopy'),
      },
    ],
    glanceLead: r('glanceLead'),
    categories: scored.categories,
    prioritiesTitle: r('prioritiesTitle'),
    prioritiesLead: r('prioritiesLead'),
    priorities: scored.priorities,
    impactLabel: r('impactLabel'),
    actionPlanTitle: r('actionPlanTitle'),
    actionPlanLead: r('actionPlanLead'),
    actionPlan: scored.actionPlan,
    categoriesTitle: r('categoriesTitle'),
    categoriesLead: r('categoriesLead'),
    statusLabels: {
      strength: r('status.strength'),
      opportunity: r('status.opportunity'),
      neutral: r('status.neutral'),
    },
    statusMetricLabel: r('statusMetricLabel'),
    recommendationsSubhead: r('recommendationsSubhead'),
    blueprintTitle: r('blueprintTitle'),
    blueprintCopy: displayName
      ? formatSpecializedTemplate(r('blueprintCopyNamed'), { name: displayName })
      : r('blueprintCopyGeneric'),
    blueprintBullets: scored.blueprintBullets,
    footerLines: [r('footer1'), r('footer2')],
    defaultOpenCategory: scored.defaultOpenCategory,
  }
}
