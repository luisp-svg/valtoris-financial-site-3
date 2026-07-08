import ChoiceGroup from '../../ChoiceGroup'
import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
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
}

const MAX_GOALS = 3

export default function StepRetirementFundingExit({
  answers,
  goals,
  onChange,
  onGoalsChange,
}: StepRetirementFundingExitProps) {
  function handleGoalsChange(selected: string[]) {
    if (selected.length <= MAX_GOALS) {
      onGoalsChange(selected)
      return
    }
    onGoalsChange(selected.slice(-MAX_GOALS))
  }

  return (
    <QuestionCard
      title="Retirement, Funding & Exit Planning"
      description="Review owner wealth, capital access, succession planning, and your top business priorities."
    >
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <OptionGroup
          label="How much do you save for personal retirement outside the business?"
          name="ownerRetirementSavings"
          options={OWNER_RETIREMENT_SAVINGS_OPTIONS}
          value={answers.ownerRetirementSavings}
          onChange={(value) => onChange('ownerRetirementSavings', value)}
          required
        />
        <OptionGroup
          label="How would you describe your business credit profile?"
          name="businessCredit"
          options={BUSINESS_CREDIT_OPTIONS}
          value={answers.businessCredit}
          onChange={(value) => onChange('businessCredit', value)}
          required
        />
        <OptionGroup
          label="How easily can your business access growth capital?"
          name="growthCapital"
          options={GROWTH_CAPITAL_OPTIONS}
          value={answers.growthCapital}
          onChange={(value) => onChange('growthCapital', value)}
          required
        />
        <OptionGroup
          label="Do you have a documented succession or exit plan?"
          name="successionPlan"
          options={SUCCESSION_PLAN_OPTIONS}
          value={answers.successionPlan}
          onChange={(value) => onChange('successionPlan', value)}
          required
        />
        <OptionGroup
          label="Have you established a business valuation baseline?"
          name="valuationBaseline"
          options={VALUATION_BASELINE_OPTIONS}
          value={answers.valuationBaseline}
          onChange={(value) => onChange('valuationBaseline', value)}
          required
        />
        <ChoiceGroup
          label="What are your top business financial priorities? (Select up to 3)"
          name="businessGoals"
          options={BUSINESS_GOAL_OPTIONS}
          selected={goals.selected}
          onChange={handleGoalsChange}
          required
        />
      </form>
    </QuestionCard>
  )
}
