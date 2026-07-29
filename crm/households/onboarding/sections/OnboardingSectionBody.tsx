import type { CrmHouseholdDetail, HouseholdOnboardingAssessment } from '../../types'
import type {
  HouseholdOnboardingAnswers,
  OnboardingAssetsAnswers,
  OnboardingCashFlowAnswers,
  OnboardingDebtsAnswers,
  OnboardingEstateAnswers,
  OnboardingGoalsAnswers,
  OnboardingIncomeAnswers,
  OnboardingInsuranceAnswers,
  OnboardingMembersAnswers,
  OnboardingOverviewAnswers,
  OnboardingRetirementAnswers,
} from '../onboardingFormTypes'
import type { OnboardingSessionMode } from '../loadHouseholdOnboarding'
import type { OnboardingCompletionValidation } from '../onboardingCompletion'
import type { OnboardingSectionConfig, OnboardingSectionId } from '../onboardingSections'
import AssetsSavingsSection from './AssetsSavingsSection'
import CashFlowSection from './CashFlowSection'
import DebtsLiabilitiesSection from './DebtsLiabilitiesSection'
import EstateLegacySection from './EstateLegacySection'
import FinancialProgressReviewSection from './FinancialProgressReviewSection'
import GoalsPrioritiesSection from './GoalsPrioritiesSection'
import HouseholdMembersSection from './HouseholdMembersSection'
import HouseholdOverviewSection from './HouseholdOverviewSection'
import IncomeEmploymentSection from './IncomeEmploymentSection'
import InsuranceProtectionSection from './InsuranceProtectionSection'
import RetirementSection from './RetirementSection'
import SectionPlaceholder from './SectionPlaceholder'

type Updater<T> = T | ((prev: T) => T)

type Props = {
  section: OnboardingSectionConfig
  household: CrmHouseholdDetail
  assessment: HouseholdOnboardingAssessment
  answers: HouseholdOnboardingAnswers
  mode: OnboardingSessionMode
  readOnly: boolean
  completion: OnboardingCompletionValidation | null
  completing: boolean
  onEditSection: (sectionId: OnboardingSectionId) => void
  onComplete: () => Promise<unknown>
  onChangeOverview: (overview: Updater<OnboardingOverviewAnswers>) => void
  onChangeMembersAnswers: (members: Updater<OnboardingMembersAnswers>) => void
  onChangeIncome: (income: Updater<OnboardingIncomeAnswers>) => void
  onChangeCashFlow: (cashFlow: Updater<OnboardingCashFlowAnswers>) => void
  onChangeAssets: (assets: Updater<OnboardingAssetsAnswers>) => void
  onChangeDebts: (debts: Updater<OnboardingDebtsAnswers>) => void
  onChangeInsurance: (insurance: Updater<OnboardingInsuranceAnswers>) => void
  onChangeRetirement: (retirement: Updater<OnboardingRetirementAnswers>) => void
  onChangeEstate: (estate: Updater<OnboardingEstateAnswers>) => void
  onChangeGoals: (goals: Updater<OnboardingGoalsAnswers>) => void
  onHouseholdRefresh: () => Promise<void>
}

export default function OnboardingSectionBody({
  section,
  household,
  assessment,
  answers,
  mode,
  readOnly,
  completion,
  completing,
  onEditSection,
  onComplete,
  onChangeOverview,
  onChangeMembersAnswers,
  onChangeIncome,
  onChangeCashFlow,
  onChangeAssets,
  onChangeDebts,
  onChangeInsurance,
  onChangeRetirement,
  onChangeEstate,
  onChangeGoals,
  onHouseholdRefresh,
}: Props) {
  switch (section.id) {
    case 'overview':
      return (
        <HouseholdOverviewSection
          section={section}
          household={household}
          answers={answers}
          readOnly={readOnly}
          onChangeOverview={onChangeOverview}
        />
      )
    case 'members':
      return (
        <HouseholdMembersSection
          section={section}
          household={household}
          answers={answers}
          readOnly={readOnly}
          onChangeMembersAnswers={onChangeMembersAnswers}
          onHouseholdRefresh={onHouseholdRefresh}
        />
      )
    case 'income':
      return (
        <IncomeEmploymentSection
          section={section}
          household={household}
          answers={answers}
          readOnly={readOnly}
          onChangeIncome={onChangeIncome}
        />
      )
    case 'cash-flow':
      return (
        <CashFlowSection
          section={section}
          answers={answers}
          readOnly={readOnly}
          onChangeCashFlow={onChangeCashFlow}
        />
      )
    case 'assets':
      return (
        <AssetsSavingsSection
          section={section}
          answers={answers}
          readOnly={readOnly}
          onChangeAssets={onChangeAssets}
        />
      )
    case 'debts':
      return (
        <DebtsLiabilitiesSection
          section={section}
          household={household}
          answers={answers}
          readOnly={readOnly}
          onChangeDebts={onChangeDebts}
        />
      )
    case 'insurance':
      return (
        <InsuranceProtectionSection
          section={section}
          household={household}
          answers={answers}
          readOnly={readOnly}
          onChangeInsurance={onChangeInsurance}
        />
      )
    case 'retirement':
      return (
        <RetirementSection
          section={section}
          household={household}
          answers={answers}
          readOnly={readOnly}
          onChangeRetirement={onChangeRetirement}
        />
      )
    case 'estate':
      return (
        <EstateLegacySection
          section={section}
          household={household}
          answers={answers}
          readOnly={readOnly}
          onChangeEstate={onChangeEstate}
        />
      )
    case 'goals':
      return (
        <GoalsPrioritiesSection
          section={section}
          answers={answers}
          readOnly={readOnly}
          onChangeGoals={onChangeGoals}
        />
      )
    case 'review':
      if (!completion) return <SectionPlaceholder section={section} />
      return (
        <FinancialProgressReviewSection
          section={section}
          household={household}
          assessment={assessment}
          answers={answers}
          mode={mode}
          readOnly={readOnly}
          completion={completion}
          completing={completing}
          onEditSection={onEditSection}
          onComplete={onComplete}
        />
      )
    default:
      return <SectionPlaceholder section={section} />
  }
}
