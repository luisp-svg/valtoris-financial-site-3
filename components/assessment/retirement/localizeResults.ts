import { formatCurrency, parseAmount } from '../../calculator/calculations'
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
import type { RetirementAssessmentAnswers } from './types'
import type {
  RetirementAssessmentScoreResult,
  RetirementProjectionMetrics,
} from '../scoring/scoreRetirementAssessment'
import { scoreRetirementAssessment } from '../scoring/scoreRetirementAssessment'

/** English priority titles produced by scoreRetirementAssessment, mapped to copy-catalog ids. */
const PRIORITY_ID_BY_ENGLISH_TITLE: Record<string, string> = {
  'Clarify Retirement Vision & Timeline': 'vision',
  'Accelerate Savings & Contributions': 'savings',
  'Strengthen Reliable Retirement Income': 'incomeSources',
  'Close Your Retirement Income Gap': 'incomeAdequacy',
  'Align Investment Risk & Diversification': 'investments',
  'Improve Tax Diversification': 'tax',
  'Prepare Healthcare & Long-Term Care': 'healthcare',
  'Complete Estate & Beneficiary Planning': 'estate',
}

/** Category id backing each priority copy id, used for the "(score: n/100)" suffix. */
const CATEGORY_ID_BY_PRIORITY_ID: Record<string, string> = {
  vision: 'vision',
  savings: 'savings',
  incomeSources: 'income-sources',
  incomeAdequacy: 'income-adequacy',
  investments: 'investments',
  tax: 'tax',
  healthcare: 'healthcare',
  estate: 'estate',
}

const BLUEPRINT_KEY_BY_ENGLISH_BULLET: Record<string, string> = {
  'Clarify your retirement vision and timeline': 'blueprint.vision',
  'Accelerate retirement savings and contributions': 'blueprint.savings',
  'Strengthen reliable retirement income sources': 'blueprint.income-sources',
  'Close your retirement income gap': 'blueprint.income-adequacy',
  'Align investment risk and diversification': 'blueprint.investments',
  'Improve tax diversification and efficiency': 'blueprint.tax',
  'Prepare for healthcare and long-term care costs': 'blueprint.healthcare',
  'Complete estate, beneficiary, and legacy planning': 'blueprint.estate',
  'Build a sustainable lifetime income plan': 'blueprint.lifetimeIncome',
}

/** Categories whose guidance copy differs for already-retired households. */
const RETIRED_AWARE_GUIDANCE = new Set(['savings', 'income-adequacy', 'investments', 'tax'])

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function readinessKey(overallScore: number): string {
  if (overallScore >= 90) return 'readiness.strong'
  if (overallScore >= 80) return 'readiness.onTrack'
  if (overallScore >= 70) return 'readiness.gaps'
  if (overallScore >= 60) return 'readiness.risks'
  return 'readiness.immediate'
}

function narrativeKey(overallScore: number): string {
  if (overallScore >= 85) return 'narrative.high'
  if (overallScore >= 70) return 'narrative.mid'
  return 'narrative.low'
}

/**
 * Re-renders a scored Retirement Report Card in the active locale.
 * Scores, grades, status ids, priority levels, and category ordering come
 * straight from scoreRetirementAssessment — only display strings are rebuilt.
 */
export function localizeRetirementScoreResult(
  scored: RetirementAssessmentScoreResult,
  answers: RetirementAssessmentAnswers,
  t: ReportCardCopyFn,
): RetirementAssessmentScoreResult {
  const r = (key: string): string => t('results', key)
  const fill = (key: string, values: Record<string, string | number>): string =>
    formatSpecializedTemplate(r(key), values)
  const answer = (key: string): string => t('answers', key)
  const metrics = scored.metrics
  const retired = metrics.isAlreadyRetired
  const longevityAge = metrics.assumptions.longevityAge
  const yearWord = (years: number): string => r(years === 1 ? 'year.one' : 'year.many')

  /** Canonical option value → localized label, with an explicit "unspecified" fallback. */
  const optionLabel = (prefix: string, value: string): string =>
    value ? answer(`${prefix}.${value}`) : r('unspecified')
  const yesNoNa = (value: string): string => (value ? answer(`yesNoNaUnsure.${value}`) : r('notAvailable'))

  function explanationFor(category: CategoryScore): string {
    switch (category.id) {
      case 'vision':
        return retired
          ? r('explanation.vision.retired')
          : fill('explanation.vision.working', {
              years: metrics.yearsUntilRetirement,
              yearWord: yearWord(metrics.yearsUntilRetirement),
              currentAge: metrics.currentAge || r('notAvailable'),
              retirementAge: metrics.retirementAge || r('notAvailable'),
            })
      case 'savings':
        return fill('explanation.savings', {
          savings: formatCurrency(metrics.currentSavings),
          contribution: formatCurrency(metrics.monthlyContribution),
        })
      case 'income-sources':
        return fill('explanation.income-sources', {
          guaranteed: formatCurrency(metrics.totalGuaranteedMonthlyIncome),
          coverage: formatPercent(metrics.guaranteedCoveragePercent),
          other: formatCurrency(metrics.totalOtherExpectedMonthlyIncome),
          partTimeNote: metrics.partTimeIncomeIncluded
            ? r('explanation.incomeSourcesPartTime')
            : '',
        })
      case 'income-adequacy':
        return fill('explanation.income-adequacy', {
          target: formatCurrency(metrics.targetMonthlyRetirementSpending),
          beforePortfolio: formatCurrency(metrics.totalExpectedMonthlyIncomeBeforePortfolio),
          total: formatCurrency(metrics.totalProjectedMonthlyIncome),
          gap: formatCurrency(metrics.annualIncomeGap),
        })
      case 'investments':
        return fill('explanation.investments', {
          risk: optionLabel('riskTolerance', answers.investments.riskTolerance),
          diversification: optionLabel('diversification', answers.investments.diversification),
        })
      case 'tax': {
        const types = answers.tax.accountTypes.filter(Boolean)
        return fill('explanation.tax', {
          types:
            types.length > 0
              ? types.map((type) => answer(`accountTypes.${type}`)).join(', ')
              : r('none'),
        })
      }
      case 'healthcare':
        return fill('explanation.healthcare', {
          medicare: optionLabel('medicareReadiness', answers.healthcare.medicareReadiness),
          longTermCare: optionLabel('longTermCarePlan', answers.healthcare.longTermCarePlan),
          hsa: formatCurrency(parseAmount(answers.healthcare.hsaBalance)),
        })
      case 'estate':
        return fill('explanation.estate', {
          will: yesNoNa(answers.estate.hasWill),
          trust: yesNoNa(answers.estate.hasTrust),
          beneficiaries: yesNoNa(answers.estate.beneficiariesReviewed),
          powerOfAttorney: yesNoNa(answers.estate.hasPowerOfAttorney),
        })
      default:
        return category.explanation
    }
  }

  function guidanceFor(category: CategoryScore): string {
    if (!RETIRED_AWARE_GUIDANCE.has(category.id)) return r(`guidance.${category.id}`)
    return r(`guidance.${category.id}.${retired ? 'retired' : 'working'}`)
  }

  function recommendationsFor(category: CategoryScore): string[] {
    const isHigh = category.score >= 80
    switch (category.id) {
      case 'vision':
        return isHigh
          ? [r('rec.vision.high1'), r('rec.vision.high2')]
          : [r('rec.vision.low1'), r('rec.vision.low2')]
      case 'savings':
        if (isHigh) {
          return retired
            ? [r('rec.savings.highRetired1'), r('rec.savings.highRetired2')]
            : [r('rec.savings.highWorking1'), r('rec.savings.highWorking2')]
        }
        if (metrics.currentSavings <= 0) {
          return [r('rec.savings.none1'), r('rec.savings.none2')]
        }
        return retired
          ? [fill('rec.savings.lowRetired1', { longevityAge }), r('rec.savings.lowRetired2')]
          : [r('rec.savings.lowWorking1'), r('rec.savings.lowWorking2')]
      case 'income-sources':
        return isHigh
          ? [r('rec.income-sources.high1'), r('rec.income-sources.high2')]
          : [r('rec.income-sources.low1'), r('rec.income-sources.low2')]
      case 'income-adequacy':
        if (isHigh) {
          return [r('rec.income-adequacy.high1'), r('rec.income-adequacy.high2')]
        }
        return metrics.annualIncomeGap > 0
          ? [
              fill('rec.income-adequacy.gap1', {
                gap: formatCurrency(metrics.annualIncomeGap),
              }),
              r('rec.income-adequacy.gap2'),
            ]
          : [r('rec.income-adequacy.ok1'), r('rec.income-adequacy.ok2')]
      case 'investments':
        return isHigh
          ? [r('rec.investments.high1'), r('rec.investments.high2')]
          : [r('rec.investments.low1'), r('rec.investments.low2')]
      case 'tax':
        return isHigh ? [r('rec.tax.high1'), r('rec.tax.high2')] : [r('rec.tax.low1'), r('rec.tax.low2')]
      case 'healthcare':
        return isHigh
          ? [r('rec.healthcare.high1'), r('rec.healthcare.high2')]
          : [r('rec.healthcare.low1'), r('rec.healthcare.low2')]
      case 'estate':
        return isHigh
          ? [r('rec.estate.high1'), r('rec.estate.high2')]
          : [r('rec.estate.low1'), r('rec.estate.low2')]
      default:
        return [...category.recommendations]
    }
  }

  const categories: CategoryScore[] = scored.categories.map((category) => ({
    ...category,
    title: r(`category.${category.id}`),
    summary: r(`summary.${category.id}.${scoreBand(category.score)}`),
    guidance: guidanceFor(category),
    explanation: explanationFor(category),
    recommendations: recommendationsFor(category),
  }))

  const byId: Record<string, CategoryScore | undefined> = Object.fromEntries(
    categories.map((category) => [category.id, category]),
  )

  const priorities: PriorityRecommendation[] = scored.priorities.map((priority) => {
    const id = PRIORITY_ID_BY_ENGLISH_TITLE[priority.title]
    if (!id) return priority

    const category = byId[CATEGORY_ID_BY_PRIORITY_ID[id] ?? '']
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
      impact: fill(`priority.${id}.impact`, { longevityAge }),
    }
  })

  const ranked = [...categories].sort((a, b) => a.score - b.score)
  const weakest = ranked[0]
  const second = ranked[1]
  const third = ranked[2]

  const actionPlan: ReportActionPlan = {
    immediate: retired
      ? [
          weakest?.recommendations[0] ?? fill('action.retiredWithdrawal', { longevityAge }),
          r('action.retiredSpendingCheck'),
          second?.recommendations[0] ?? r('action.retiredDocument'),
        ]
      : [
          weakest?.recommendations[0] ?? r('action.workingHighestRisk'),
          second?.recommendations[0] ?? r('action.workingContribution'),
          metrics.annualIncomeGap > 0
            ? fill('action.workingGap', { gap: formatCurrency(metrics.annualIncomeGap) })
            : r('action.workingValidate'),
        ],
    thirtyDay: [
      r('action.meetStrategist'),
      third?.recommendations[0] ?? r('action.savingsIncomeList'),
      retired
        ? (byId.tax?.recommendations[0] ?? r('action.taxSequencing'))
        : (byId.investments?.recommendations[0] ?? r('action.reviewAllocation')),
    ],
    ninetyDay: [
      byId.tax?.recommendations[0] ?? r('action.taxDiversification'),
      byId.healthcare?.recommendations[0] ?? r('action.healthcareDocs'),
      byId.estate?.recommendations[0] ?? r('action.estateUpdate'),
    ],
  }

  const blueprintBullets = scored.blueprintBullets.map((bullet) => {
    const key = BLUEPRINT_KEY_BY_ENGLISH_BULLET[bullet]
    return key ? r(key) : bullet
  })

  const firstName = answers.household.firstName.trim()
  const prefix = firstName
    ? formatSpecializedTemplate(r('narrative.prefixNamed'), { name: firstName })
    : r('narrative.prefixGeneric')
  const narrative = [
    fill(narrativeKey(scored.overallScore), { prefix }),
    metrics.annualIncomeGap > 0
      ? fill('narrative.gap', { gap: formatCurrency(metrics.annualIncomeGap) })
      : r('narrative.noGap'),
    retired ? r('narrative.retired') : '',
    r('narrative.disclaimer'),
  ]
    .filter((part) => part !== '')
    .join(' ')

  const strongestCategory =
    byId[scored.strongestCategory.id] ?? categories[0] ?? scored.strongestCategory
  const priorityCategory =
    byId[scored.priorityCategory.id] ?? categories[0] ?? scored.priorityCategory

  return {
    ...scored,
    currentLevel: r(readinessKey(scored.overallScore)),
    categories,
    strongestCategory,
    priorityCategory,
    priorities,
    immediatePriorities: [...actionPlan.immediate],
    actionPlan,
    blueprintRecommendations: blueprintBullets,
    blueprintBullets,
    strengths: categories.filter((category) => category.score >= 80).map((c) => c.title),
    opportunities: categories.filter((category) => category.score < 65).map((c) => c.title),
    narrative,
  }
}

export function retirementDashboardChrome(t: ReportCardCopyFn): ReportDashboardChrome {
  const r = (key: string): string => t('results', key)

  return {
    currentScore: r('chrome.currentScore'),
    letterGrade: r('chrome.letterGrade'),
    atAGlance: r('chrome.atAGlance'),
    insightsTitle: r('chrome.insightsTitle'),
    insightsLead: r('chrome.insightsLead'),
    greatestStrengths: r('chrome.greatestStrengths'),
    biggestOpportunities: r('chrome.biggestOpportunities'),
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

function savingsRatePercent(metrics: RetirementProjectionMetrics): number {
  if (metrics.currentAnnualGrossIncome <= 0) return 0
  return Math.round(((metrics.monthlyContribution * 12) / metrics.currentAnnualGrossIncome) * 100)
}

/** Localized counterpart of getRetirementReportDashboardData for a completed assessment. */
export function buildLocalizedRetirementDashboard(
  firstName: string,
  greeting: string,
  answers: RetirementAssessmentAnswers,
  t: ReportCardCopyFn,
): ReportDashboardData {
  const r = (key: string): string => t('results', key)
  const fill = (key: string, values: Record<string, string | number>): string =>
    formatSpecializedTemplate(r(key), values)
  const scored = localizeRetirementScoreResult(scoreRetirementAssessment(answers), answers, t)
  const metrics = scored.metrics
  const displayName = firstName.trim() || answers.household.firstName.trim()
  const monthlyGap = Math.round(metrics.annualIncomeGap / 12)
  const fundedRatio = Math.round(metrics.incomeReplacementRatio * 100)
  const preparedFor =
    greeting ||
    (displayName
      ? formatSpecializedTemplate(t('ui', 'preparedFor'), { name: displayName })
      : t('ui', 'sampleGreeting'))

  return {
    title: r('title'),
    preparedFor,
    narrative: scored.narrative,
    chrome: retirementDashboardChrome(t),
    scoreLabel: r('scoreLabel'),
    score: scored.overallScore,
    grade: scored.overallGrade,
    level: scored.currentLevel,
    heroMeta: [
      {
        type: 'metric',
        label: metrics.isAlreadyRetired
          ? r('hero.retirementStatusLabel')
          : r('hero.targetAgeLabel'),
        value: metrics.isAlreadyRetired
          ? r('hero.alreadyRetired')
          : String(metrics.retirementAge),
        copy: metrics.isAlreadyRetired
          ? r('hero.retiredCopy')
          : fill('hero.yearsCopy', {
              years: metrics.yearsUntilRetirement,
              yearWord: r(metrics.yearsUntilRetirement === 1 ? 'year.one' : 'year.many'),
            }),
      },
      {
        type: 'metric',
        label: r('hero.strongestLabel'),
        value: scored.strongestCategory.title,
        copy: fill('hero.categoryScoreCopy', {
          score: scored.strongestCategory.score,
          grade: scored.strongestCategory.grade,
        }),
      },
      {
        type: 'metric',
        label: r('hero.priorityLabel'),
        value: scored.priorityCategory.title,
        copy: fill('hero.categoryScoreCopy', {
          score: scored.priorityCategory.score,
          grade: scored.priorityCategory.grade,
        }),
      },
      {
        type: 'metric',
        label: r('hero.gapLabel'),
        value: formatCurrency(monthlyGap),
        copy: fill('hero.gapCopy', {
          need: formatCurrency(metrics.targetMonthlyRetirementSpending),
          fundedRatio,
          savingsRate: savingsRatePercent(metrics),
        }),
      },
    ],
    glanceLead: r('glanceLead'),
    strengths: scored.strengths.length > 0 ? scored.strengths : [r('fallback.strength')],
    opportunities:
      scored.opportunities.length > 0 ? scored.opportunities : [r('fallback.opportunity')],
    categories: scored.categories,
    prioritiesTitle: r('prioritiesTitle'),
    prioritiesLead: r('prioritiesLead'),
    priorities: scored.priorities,
    impactLabel: r('impactLabel'),
    actionPlanTitle: r('actionPlanTitle'),
    actionPlanLead: r('actionPlanLead'),
    actionPlan: scored.actionPlan,
    actionPlanColumnIcons: ['bolt', 'calendar', 'flag'],
    categoriesTitle: r('categoriesTitle'),
    categoriesLead: r('categoriesLead'),
    statusLabels: {
      strength: r('status.strength'),
      opportunity: r('status.opportunity'),
      neutral: r('status.neutral'),
      strong: r('status.strong'),
      stable: r('status.stable'),
      'needs-attention': r('status.needsAttention'),
      'priority-risk': r('status.priorityRisk'),
    },
    statusMetricLabel: r('statusMetricLabel'),
    recommendationsSubhead: r('recommendationsSubhead'),
    blueprintTitle: r('blueprintTitle'),
    blueprintCopy: displayName
      ? fill('blueprintCopyNamed', { name: displayName })
      : r('blueprintCopyGeneric'),
    blueprintBullets: scored.blueprintBullets,
    footerLines: [r('footer1'), r('footer2')],
    defaultOpenCategory: scored.defaultOpenCategory,
  }
}
