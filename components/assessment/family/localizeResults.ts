import { formatCurrency, parseAmount } from '../../calculator/calculations'
import type { CategoryScore } from '../../reportCard/types'
import type {
  PriorityRecommendation,
} from '../../results/PriorityRecommendationCard'
import type {
  ReportActionPlan,
  ReportDashboardChrome,
  ReportDashboardData,
} from '../../reportDashboard/types'
import type { ReportCardCopyFn } from '../reportCardLocale'
import { scoreBand } from '../reportCardLocale'
import { formatSpecializedTemplate } from '../specialized/locale'
import type { DemoAssessmentAnswers } from '../types'
import type { FamilyAssessmentScoreResult } from '../scoring/scoreFamilyAssessment'
import { calculateProtectionNeed, scoreFamilyAssessment } from '../scoring/scoreFamilyAssessment'

/** English priority titles produced by scoreFamilyAssessment, mapped to copy-catalog ids. */
const PRIORITY_ID_BY_ENGLISH_TITLE: Record<string, string> = {
  'Close Your Family Protection Gap': 'protection',
  'Strengthen Your Emergency Fund': 'emergency',
  'Reduce High-Priority Debt Pressure': 'debt',
  'Complete Estate & Legacy Planning': 'estate',
  'Accelerate Retirement Readiness': 'retirement',
  'Improve Monthly Cash Flow': 'cashflow',
}

const BLUEPRINT_KEY_BY_ENGLISH_BULLET: Record<string, string> = {
  'Protect income': 'blueprint.protection',
  'Build emergency savings': 'blueprint.emergency',
  'Eliminate unnecessary debt': 'blueprint.debt',
  'Prepare for retirement': 'blueprint.retirement',
  'Strengthen monthly cash flow': 'blueprint.cashflow',
  'Create an estate plan': 'blueprint.estate',
  'Build generational wealth': 'blueprint.wealth',
}

const CASH_FLOW_PHRASE_VALUES = ['save-most-months', 'break-even', 'overspend']

const RETIREMENT_PHRASE_VALUES = ['not-saving', 'under-3', '3-5', '6-10', '11-15', 'over-15']

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function childCount(answers: DemoAssessmentAnswers): number {
  const count = Number.parseInt(answers.family.numberOfChildren, 10)
  return Number.isFinite(count) && count > 0 ? count : 0
}

function foundationKey(overallScore: number): string {
  if (overallScore >= 90) return 'foundation.legacy_ready'
  if (overallScore >= 80) return 'foundation.strong'
  if (overallScore >= 70) return 'foundation.momentum'
  if (overallScore >= 60) return 'foundation.stabilizing'
  return 'foundation.attention'
}

function narrativeKey(overallScore: number): string {
  if (overallScore >= 85) return 'narrative.high'
  if (overallScore >= 70) return 'narrative.mid'
  return 'narrative.low'
}

/**
 * Re-renders a scored Family Report Card in the active locale.
 * Scores, grades, status ids, and category ordering come straight from
 * scoreFamilyAssessment — only the display strings are rebuilt.
 */
export function localizeFamilyScoreResult(
  scored: FamilyAssessmentScoreResult,
  answers: DemoAssessmentAnswers,
  t: ReportCardCopyFn,
): FamilyAssessmentScoreResult {
  const r = (key: string): string => t('results', key)
  const fill = (key: string, values: Record<string, string | number>): string =>
    formatSpecializedTemplate(r(key), values)
  const answer = (key: string): string => t('answers', key)
  const yesNo = (value: string): string => answer(value === 'yes' ? 'yes' : 'no')

  const income = parseAmount(answers.financial.householdIncome)
  const housing = parseAmount(answers.financial.monthlyHousingPayment)
  const housingRatio = income > 0 ? housing / (income / 12) : 1
  const debt = parseAmount(answers.financial.totalDebt)
  const dti = income > 0 ? debt / income : 2
  const emergencyMonths = Number.parseInt(answers.financial.emergencyFundMonths, 10) || 0
  const children = childCount(answers)
  const protectionNeed = calculateProtectionNeed(answers)
  const coverage = parseAmount(answers.protection.currentLifeInsurance)
  const coverageRatio = protectionNeed > 0 ? coverage / protectionNeed : 0
  const age = answers.family.age.trim()
  const contribution = answers.financial.retirementContribution
  const cashFlowValue = CASH_FLOW_PHRASE_VALUES.includes(answers.financial.monthlyCashFlow)
    ? answers.financial.monthlyCashFlow
    : 'unsure'
  const retirementValue = RETIREMENT_PHRASE_VALUES.includes(contribution)
    ? contribution
    : 'unspecified'

  function explanationFor(category: CategoryScore): string {
    switch (category.id) {
      case 'cashflow':
        return fill('explanation.cashflow', {
          ratio: formatPercent(housingRatio),
          cashFlowPhrase: answer(`cashFlowPhrase.${cashFlowValue}`),
        })
      case 'emergency':
        return fill('explanation.emergency', {
          months: emergencyMonths,
          monthWord: r(emergencyMonths === 1 ? 'month.one' : 'month.many'),
        })
      case 'debt':
        return fill('explanation.debt', {
          debt: formatCurrency(debt),
          income: formatCurrency(income),
          dti: formatPercent(dti),
        })
      case 'protection':
        return fill('explanation.protection', {
          children,
          childWord: r(children === 1 ? 'child.one' : 'child.many'),
          need: formatCurrency(protectionNeed),
          coverage: formatCurrency(coverage),
          coverageRatio: formatPercent(coverageRatio),
          disability: yesNo(answers.protection.hasDisabilityProtection),
        })
      case 'retirement': {
        const base = fill('explanation.retirement', {
          contributionPhrase: answer(`retirementPhrase.${retirementValue}`),
        })
        return age ? `${base} ${fill('explanation.retirementAge', { age })}` : base
      }
      case 'estate': {
        const base = fill('explanation.estate', {
          will: yesNo(answers.protection.hasWill),
          trust: yesNo(answers.protection.hasTrust),
          beneficiaries: yesNo(answers.protection.beneficiariesReviewed),
        })
        if (children <= 0) return base
        const guardian = fill('explanation.estateGuardian', {
          guardian: yesNo(answers.protection.guardianDocumented),
        })
        return `${base} ${guardian}`
      }
      default:
        return category.explanation
    }
  }

  function recommendationsFor(category: CategoryScore): string[] {
    const isHigh = category.score >= 80
    switch (category.id) {
      case 'cashflow':
        if (isHigh) return [r('rec.cashflow.high1'), r('rec.cashflow.high2')]
        if (housingRatio > 0.36) return [r('rec.cashflow.ratio1'), r('rec.cashflow.ratio2')]
        return [r('rec.cashflow.low1'), r('rec.cashflow.low2')]
      case 'emergency':
        if (isHigh) return [r('rec.emergency.high1'), r('rec.emergency.high2')]
        if (emergencyMonths < 3) {
          return [r('rec.emergency.lowMonths1'), r('rec.emergency.lowMonths2')]
        }
        return [r('rec.emergency.low1'), r('rec.emergency.low2')]
      case 'debt':
        return isHigh
          ? [r('rec.debt.high1'), r('rec.debt.high2')]
          : [r('rec.debt.low1'), r('rec.debt.low2')]
      case 'protection':
        return scored.protectionGapAmount > 0
          ? [
              fill('rec.protection.gap1', { gap: scored.protectionGapFormatted }),
              answers.protection.hasDisabilityProtection === 'yes'
                ? r('rec.protection.disabilityYes')
                : r('rec.protection.disabilityNo'),
            ]
          : [r('rec.protection.ok1'), r('rec.protection.ok2')]
      case 'retirement':
        if (isHigh) return [r('rec.retirement.high1'), r('rec.retirement.high2')]
        if (contribution === 'not-saving') {
          return [r('rec.retirement.notSaving1'), r('rec.retirement.notSaving2')]
        }
        return [r('rec.retirement.increase1'), r('rec.retirement.increase2')]
      case 'estate':
        if (isHigh) return [r('rec.estate.high1'), r('rec.estate.high2')]
        return [
          r('rec.estate.low1'),
          children > 0 ? r('rec.estate.children') : r('rec.estate.noChildren'),
        ]
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
  const protection = byId.protection

  const actionPlan: ReportActionPlan = {
    immediate: [
      weakest?.recommendations[0] ?? r('action.highestRisk'),
      second?.recommendations[0] ?? r('action.emergencyMomentum'),
      protection && protection.score < 70
        ? fill('action.reviewGap', { gap: scored.protectionGapFormatted })
        : r('action.reviewBeneficiaries'),
    ],
    thirtyDay: [
      r('action.meetStrategist'),
      third?.recommendations[0] ?? r('action.debtOrSavings'),
      ranked.find((category) => category.id === 'retirement')?.recommendations[0] ??
        r('action.retirementTarget'),
    ],
    ninetyDay: [
      byId.estate?.recommendations[0] ?? r('action.willTrust'),
      answers.goals.selected.includes('college')
        ? r('action.college')
        : (ranked[3]?.recommendations[0] ?? r('action.wealth')),
      r('action.annualPlan'),
    ],
  }

  const blueprintBullets = scored.blueprintBullets.map((bullet) => {
    const key = BLUEPRINT_KEY_BY_ENGLISH_BULLET[bullet]
    return key ? r(key) : bullet
  })

  const firstName = answers.family.firstName.trim()
  const prefix = firstName
    ? formatSpecializedTemplate(r('narrative.prefixNamed'), { name: firstName })
    : r('narrative.prefixGeneric')

  return {
    ...scored,
    currentLevel: r(foundationKey(scored.overallScore)),
    categories,
    priorities,
    strengths: categories.filter((category) => category.score >= 80).map((c) => c.title),
    opportunities: categories.filter((category) => category.score < 65).map((c) => c.title),
    actionPlan,
    blueprintBullets,
    narrative: fill(narrativeKey(scored.overallScore), { prefix }),
  }
}

export function familyDashboardChrome(t: ReportCardCopyFn): ReportDashboardChrome {
  const r = (key: string): string => t('results', key)

  return {
    currentScore: r('chrome.currentScore'),
    letterGrade: r('chrome.letterGrade'),
    atAGlance: r('chrome.atAGlance'),
    insightsTitle: r('chrome.insightsTitle'),
    insightsLead: r('chrome.insightsLead'),
    greatestStrengths: r('chrome.greatestStrengths'),
    biggestOpportunities: r('chrome.biggestOpportunities'),
    protectionTitle: r('chrome.protectionTitle'),
    protectionLead: r('chrome.protectionLead'),
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

/** Localized counterpart of getFamilyReportDashboardData for a completed assessment. */
export function buildLocalizedFamilyDashboard(
  firstName: string,
  greeting: string,
  answers: DemoAssessmentAnswers,
  t: ReportCardCopyFn,
): ReportDashboardData {
  const r = (key: string): string => t('results', key)
  const scored = localizeFamilyScoreResult(scoreFamilyAssessment(answers), answers, t)
  const name = firstName.trim()
  const preparedFor =
    greeting ||
    (name
      ? formatSpecializedTemplate(t('ui', 'preparedFor'), { name })
      : t('ui', 'sampleGreeting'))

  return {
    title: r('title'),
    preparedFor,
    narrative: scored.narrative,
    chrome: familyDashboardChrome(t),
    scoreLabel: r('scoreLabel'),
    score: scored.overallScore,
    grade: scored.overallGrade,
    level: scored.currentLevel,
    heroMeta: [
      {
        type: 'progress',
        label: r('hero.progressLabel'),
        value: scored.overallScore,
        copy: r('hero.progressCopy'),
      },
      {
        type: 'metric',
        label: r('hero.gapLabel'),
        value: scored.protectionGapFormatted,
        copy: r('hero.gapCopy'),
      },
    ],
    glanceLead: r('glanceLead'),
    strengths: scored.strengths.length > 0 ? scored.strengths : [r('fallback.strength')],
    opportunities:
      scored.opportunities.length > 0 ? scored.opportunities : [r('fallback.opportunity')],
    protectionAnalysis: {
      label: r('protection.label'),
      value: scored.protectionGapFormatted,
      note: r('protection.note'),
    },
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
    },
    statusMetricLabel: r('statusMetricLabel'),
    recommendationsSubhead: r('recommendationsSubhead'),
    blueprintTitle: r('blueprintTitle'),
    blueprintCopy: r('blueprintCopy'),
    blueprintBullets: scored.blueprintBullets,
    footerLines: [r('footer1'), r('footer2')],
    defaultOpenCategory: scored.defaultOpenCategory,
  }
}
