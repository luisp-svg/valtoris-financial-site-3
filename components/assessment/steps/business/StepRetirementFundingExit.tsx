import ChoiceGroup from '../../ChoiceGroup'
import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import { localizedOptions, type ReportCardCopyFn } from '../../reportCardLocale'
import {
  BUSINESS_CREDIT_OPTIONS,
  BUSINESS_GOAL_OPTIONS,
  GROWTH_CAPITAL_OPTIONS,
  OWNER_RETIREMENT_SAVINGS_OPTIONS,
  SUCCESSION_PLAN_OPTIONS,
  VALUATION_BASELINE_OPTIONS,
} from '../../business/constants'
import { BusinessGoalsAnswers, RetirementFundingExitAnswers } from '../../business/types'

type StepRetirementFundingExitProps = {
  answers: RetirementFundingExitAnswers
  goals: BusinessGoalsAnswers
  onChange: (field: keyof RetirementFundingExitAnswers, value: string) => void
  onGoalsChange: (selected: string[]) => void
  t: ReportCardCopyFn
}

const MAX_GOALS = 3

export default function StepRetirementFundingExit({
  answers,
  goals,
  onChange,
  onGoalsChange,
  t,
}: StepRetirementFundingExitProps) {
  function handleGoalsChange(selected: string[]) {
    if (selected.length <= MAX_GOALS) {
      onGoalsChange(selected)
      return
    }
    onGoalsChange(selected.slice(-MAX_GOALS))
  }

  return (
    <QuestionCard title={t('ui', 'step6Title')} description={t('helpers', 'step6')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <OptionGroup
          label={t('fields', 'ownerRetirementSavings')}
          name="ownerRetirementSavings"
          options={localizedOptions(
            OWNER_RETIREMENT_SAVINGS_OPTIONS,
            t,
            'ownerRetirementSavings',
          )}
          value={answers.ownerRetirementSavings}
          onChange={(value) => onChange('ownerRetirementSavings', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'businessCredit')}
          name="businessCredit"
          options={localizedOptions(BUSINESS_CREDIT_OPTIONS, t, 'businessCredit')}
          value={answers.businessCredit}
          onChange={(value) => onChange('businessCredit', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'growthCapital')}
          name="growthCapital"
          options={localizedOptions(GROWTH_CAPITAL_OPTIONS, t, 'growthCapital')}
          value={answers.growthCapital}
          onChange={(value) => onChange('growthCapital', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'successionPlan')}
          name="successionPlan"
          options={localizedOptions(SUCCESSION_PLAN_OPTIONS, t, 'successionPlan')}
          value={answers.successionPlan}
          onChange={(value) => onChange('successionPlan', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'valuationBaseline')}
          name="valuationBaseline"
          options={localizedOptions(VALUATION_BASELINE_OPTIONS, t, 'valuationBaseline')}
          value={answers.valuationBaseline}
          onChange={(value) => onChange('valuationBaseline', value)}
          required
        />
        <ChoiceGroup
          label={t('fields', 'goals')}
          name="businessGoals"
          options={localizedOptions(BUSINESS_GOAL_OPTIONS, t, 'goals')}
          selected={goals.selected}
          onChange={handleGoalsChange}
          required
        />
      </form>
    </QuestionCard>
  )
}
