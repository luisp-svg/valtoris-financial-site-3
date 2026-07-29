import type { CrmHouseholdDetail } from '../types'
import {
  ESTATE_PLANNING_ITEM_LABELS,
  FORM_SECTION_IDS,
  type HouseholdOnboardingAnswers,
} from './onboardingFormTypes'
import {
  countKnownRetirementAssetBalances,
  getPrimaryMember,
} from './onboardingCrossSection'
import { formatCentsCurrency } from './onboardingMoney'
import type { OnboardingCompletionValidation } from './onboardingCompletion'
import { formatSectionUiState, type OnboardingSectionUiState } from './onboardingProgress'
import { getOnboardingSection, type OnboardingSectionId } from './onboardingSections'
import {
  computeCashFlowTotals,
  computeKnownAssetTotalCents,
  computeKnownDebtTotals,
  memberDisplayLabel,
  validateOnboardingSection,
} from './onboardingValidation'

export type ReviewSectionSummary = {
  sectionId: OnboardingSectionId
  title: string
  status: OnboardingSectionUiState
  statusLabel: string
  missingRequiredFields: string[]
  errors: string[]
  warnings: string[]
  highlights: { label: string; value: string }[]
}

function employmentLabels(answers: HouseholdOnboardingAnswers): string {
  const statuses = answers.income.sources
    .map((source) => source.employmentStatus)
    .filter(Boolean)
  if (statuses.length === 0) return '—'
  return [...new Set(statuses)].join(', ')
}

function buildHighlights(
  sectionId: OnboardingSectionId,
  answers: HouseholdOnboardingAnswers,
  household: CrmHouseholdDetail,
): { label: string; value: string }[] {
  switch (sectionId) {
    case 'overview': {
      const overview = answers.overview
      return [
        { label: 'Household / marital status', value: overview.maritalOrHouseholdStatus || '—' },
        {
          label: 'Dependents',
          value: overview.dependentsCount == null ? '—' : String(overview.dependentsCount),
        },
        { label: 'Preferred contact', value: overview.preferredContactMethod || '—' },
        {
          label: 'Advisor notes',
          value: overview.advisorNotes.trim() ? 'Provided' : 'None',
        },
      ]
    }
    case 'members': {
      const primary = getPrimaryMember(household)
      return [
        { label: 'Active members', value: String(household.members.length) },
        {
          label: 'Primary contact',
          value: primary ? memberDisplayLabel(primary) : '—',
        },
        {
          label: 'Members',
          value:
            household.members.length === 0
              ? '—'
              : household.members
                  .map((member) => `${memberDisplayLabel(member)} (${member.relationship})`)
                  .join('; '),
        },
      ]
    }
    case 'income': {
      const income = answers.income
      if (income.noCurrentIncome) {
        return [{ label: 'Status', value: 'No current income (acknowledged)' }]
      }
      const hasGross = income.sources.some((source) => source.grossAnnualIncomeCents != null)
      const hasNet = income.sources.some((source) => source.netMonthlyIncomeCents != null)
      const gross = income.sources.reduce(
        (sum, source) => sum + (source.grossAnnualIncomeCents ?? 0),
        0,
      )
      const net = income.sources.reduce(
        (sum, source) => sum + (source.netMonthlyIncomeCents ?? 0),
        0,
      )
      return [
        { label: 'Income sources', value: String(income.sources.length) },
        { label: 'Employment classifications', value: employmentLabels(answers) },
        {
          label: 'Known gross annual (client-provided)',
          value: formatCentsCurrency(hasGross ? gross : null),
        },
        {
          label: 'Known net monthly (client-provided)',
          value: formatCentsCurrency(hasNet ? net : null),
        },
      ]
    }
    case 'cash-flow': {
      const totals = computeCashFlowTotals(answers.cashFlow)
      return [
        {
          label: 'Take-home income (estimate)',
          value: formatCentsCurrency(answers.cashFlow.takeHomeIncomeCents),
        },
        {
          label: 'Estimated total expenses',
          value: formatCentsCurrency(totals.totalExpensesCents),
        },
        {
          label: 'Estimated surplus / deficit',
          value:
            totals.surplusOrDeficitCents == null
              ? '—'
              : formatCentsCurrency(totals.surplusOrDeficitCents),
        },
        {
          label: 'Unknown / N/A categories',
          value:
            answers.cashFlow.unknownCategories.length === 0
              ? 'None'
              : String(answers.cashFlow.unknownCategories.length),
        },
      ]
    }
    case 'assets': {
      if (answers.assets.noAssets) {
        return [{ label: 'Status', value: 'No assets (acknowledged)' }]
      }
      const categories = [
        ...new Set(answers.assets.items.map((item) => item.category).filter(Boolean)),
      ]
      const known = computeKnownAssetTotalCents(answers)
      const anyKnown = answers.assets.items.some((item) => item.balanceCents != null)
      return [
        { label: 'Assets listed', value: String(answers.assets.items.length) },
        {
          label: 'Known total (estimated, client-provided)',
          value: formatCentsCurrency(anyKnown ? known : null),
        },
        {
          label: 'Categories',
          value: categories.length ? categories.join(', ') : '—',
        },
      ]
    }
    case 'debts': {
      if (answers.debts.noDebts) {
        return [{ label: 'Status', value: 'No debts (acknowledged)' }]
      }
      const totals = computeKnownDebtTotals(answers)
      const unknownBalances = answers.debts.items.filter((debt) => debt.balanceCents == null).length
      const anyBalance = answers.debts.items.some((debt) => debt.balanceCents != null)
      const anyPayment = answers.debts.items.some((debt) => debt.minimumPaymentCents != null)
      return [
        { label: 'Debts listed', value: String(answers.debts.items.length) },
        {
          label: 'Known total debt (excludes unknowns)',
          value: formatCentsCurrency(anyBalance ? totals.totalBalanceCents : null),
        },
        {
          label: 'Known minimum payments',
          value: formatCentsCurrency(anyPayment ? totals.totalMinimumPaymentCents : null),
        },
        { label: 'Unknown balances', value: String(unknownBalances) },
      ]
    }
    case 'insurance': {
      if (answers.insurance.noCurrentCoverage) {
        return [{ label: 'Status', value: 'No current coverage (acknowledged)' }]
      }
      const types = [
        ...new Set(
          answers.insurance.coverages.map((coverage) => coverage.coverageType).filter(Boolean),
        ),
      ]
      return [
        { label: 'Coverage entries', value: String(answers.insurance.coverages.length) },
        { label: 'Coverage types', value: types.length ? types.join(', ') : '—' },
        {
          label: 'Protection concerns acknowledged',
          value: answers.insurance.protectionConcernsAcknowledged ? 'Yes' : 'No',
        },
        {
          label: 'Beneficiaries reviewed (household)',
          value: answers.insurance.beneficiariesReviewed || '—',
        },
      ]
    }
    case 'retirement': {
      const retirementAssets = countKnownRetirementAssetBalances(answers)
      return [
        { label: 'Planning status', value: answers.retirement.planningStatus || '—' },
        {
          label: 'Desired retirement age',
          value:
            answers.retirement.desiredRetirementAge == null
              ? '—'
              : String(answers.retirement.desiredRetirementAge),
        },
        {
          label: 'Desired monthly income',
          value: answers.retirement.desiredIncomeUnknown
            ? 'Unknown / not discussed'
            : formatCentsCurrency(answers.retirement.desiredMonthlyIncomeCents),
        },
        {
          label: 'Current monthly contribution',
          value: formatCentsCurrency(answers.retirement.currentMonthlyContributionCents),
        },
        {
          label: 'Confidence',
          value: answers.retirement.retirementConfidence || '—',
        },
        {
          label: 'Retirement accounts in Assets',
          value:
            retirementAssets.count === 0
              ? 'None referenced'
              : `${retirementAssets.count} (known balances ${formatCentsCurrency(retirementAssets.knownBalanceCents)})`,
        },
      ]
    }
    case 'estate': {
      const inPlace = answers.estate.items.filter((item) => item.status === 'in_place').length
      const needsReview = answers.estate.items.filter((item) => item.status === 'needs_review').length
      return [
        { label: 'Items in place', value: String(inPlace) },
        { label: 'Items needing review', value: String(needsReview) },
        {
          label: 'Legacy goals',
          value: answers.estate.legacyGoals.trim() ? 'Provided' : '—',
        },
        {
          label: 'Checklist acknowledged',
          value: answers.estate.itemsAcknowledged ? 'Yes' : 'No',
        },
        {
          label: 'Sample statuses',
          value:
            answers.estate.items
              .filter((item) => item.status && item.status !== 'not_applicable')
              .slice(0, 4)
              .map((item) => `${ESTATE_PLANNING_ITEM_LABELS[item.key]}: ${item.status}`)
              .join('; ') || '—',
        },
      ]
    }
    case 'goals': {
      if (answers.goals.noCurrentGoals) {
        return [{ label: 'Status', value: 'No current goals (acknowledged)' }]
      }
      const clientGoals = [
        ...answers.goals.priorities.filter((priority) => priority.source === 'client_stated'),
        ...answers.goals.immediateConcerns.filter((concern) => concern.source === 'client_stated'),
      ]
      const advisorPriorities = answers.goals.priorities.filter(
        (priority) => priority.source === 'advisor_observed',
      )
      const ranked = [...answers.goals.priorities]
        .filter((priority) => priority.rank != null)
        .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      return [
        { label: 'Client-stated items', value: String(clientGoals.length) },
        {
          label: 'Ranked priorities',
          value:
            ranked.length === 0
              ? '—'
              : ranked.map((priority) => `${priority.rank}. ${priority.title || '(untitled)'}`).join('; '),
        },
        {
          label: 'Immediate concerns',
          value: String(answers.goals.immediateConcerns.length),
        },
        {
          label: 'Advisor-observed priorities',
          value:
            advisorPriorities.length === 0
              ? 'None'
              : advisorPriorities.map((priority) => priority.title || '(untitled)').join('; '),
        },
        {
          label: 'Major upcoming events',
          value: answers.goals.majorUpcomingEvents.trim() || '—',
        },
      ]
    }
    default:
      return []
  }
}

export function buildReviewSectionSummaries(args: {
  answers: HouseholdOnboardingAnswers
  household: CrmHouseholdDetail
  completion: OnboardingCompletionValidation
}): ReviewSectionSummary[] {
  return FORM_SECTION_IDS.map((sectionId) => {
    const section = getOnboardingSection(sectionId)
    const result =
      args.completion.sectionResults[sectionId] ??
      validateOnboardingSection(sectionId, args.answers, { household: args.household })
    return {
      sectionId,
      title: section.title,
      status: result.status,
      statusLabel: formatSectionUiState(result.status),
      missingRequiredFields: result.missingRequiredFields,
      errors: Object.values(result.errors),
      warnings: Object.values(result.warnings),
      highlights: buildHighlights(sectionId, args.answers, args.household),
    }
  })
}
