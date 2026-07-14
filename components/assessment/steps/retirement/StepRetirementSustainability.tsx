import ChoiceGroup from '../../ChoiceGroup'
import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import {
  RETIREMENT_GOAL_OPTIONS,
  RETIREMENT_PROJECTION_ASSUMPTIONS,
  YES_NO_UNSURE_OPTIONS,
} from '../../retirement/constants'
import {
  RetirementGoalsAnswers,
  RetirementIncomeSourceAnswers,
} from '../../retirement/types'

type StepRetirementSustainabilityProps = {
  goals: RetirementGoalsAnswers
  incomeSources: RetirementIncomeSourceAnswers
  onGoalsChange: (selected: string[]) => void
  onIncomeSourcesChange: (field: keyof RetirementIncomeSourceAnswers, value: string) => void
}

const MAX_GOALS = 3

function formatPercent(rate: number) {
  return `${(rate * 100).toFixed((rate * 100) % 1 === 0 ? 0 : 1)}%`
}

export default function StepRetirementSustainability({
  goals,
  incomeSources,
  onGoalsChange,
  onIncomeSourcesChange,
}: StepRetirementSustainabilityProps) {
  function handleGoalsChange(selected: string[]) {
    if (selected.length <= MAX_GOALS) {
      onGoalsChange(selected)
      return
    }
    onGoalsChange(selected.slice(-MAX_GOALS))
  }

  return (
    <QuestionCard
      title="Income Sustainability"
      description="Review the default projection assumptions used in your report, then select your top retirement priorities."
    >
      <div className="retirement-assumption-list" aria-label="Projection assumptions">
        <h3 className="assessment-section-heading">Default Projection Assumptions</h3>
        <ul>
          <li>Inflation: {formatPercent(RETIREMENT_PROJECTION_ASSUMPTIONS.inflation)}</li>
          <li>
            Pre-retirement growth:{' '}
            {formatPercent(RETIREMENT_PROJECTION_ASSUMPTIONS.preRetirementGrowth)}
          </li>
          <li>
            Retirement return: {formatPercent(RETIREMENT_PROJECTION_ASSUMPTIONS.retirementReturn)}
          </li>
          <li>Withdrawal rate: {formatPercent(RETIREMENT_PROJECTION_ASSUMPTIONS.withdrawalRate)}</li>
          <li>Longevity age: {RETIREMENT_PROJECTION_ASSUMPTIONS.longevityAge}</li>
        </ul>
        <p className="funnel-microcopy assessment-note">
          These assumptions produce hypothetical educational estimates. Actual market returns,
          inflation, longevity, and personal circumstances will differ. Results do not guarantee
          retirement outcomes. Version one does not model detailed COLA growth for individual income
          sources.
        </p>
      </div>

      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <OptionGroup
          label="Have you reviewed how inflation may affect your retirement income?"
          name="inflationAwareness"
          options={YES_NO_UNSURE_OPTIONS}
          value={incomeSources.inflationAwareness}
          onChange={(value) => onIncomeSourcesChange('inflationAwareness', value)}
          required
        />
        <ChoiceGroup
          label="What are your top retirement priorities? (Select up to 3)"
          name="retirementGoals"
          options={RETIREMENT_GOAL_OPTIONS}
          selected={goals.selected}
          onChange={handleGoalsChange}
          required
        />
      </form>
    </QuestionCard>
  )
}
