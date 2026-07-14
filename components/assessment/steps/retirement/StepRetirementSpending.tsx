import CurrencyInput from '../../CurrencyInput'
import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import { DEBT_BURDEN_OPTIONS } from '../../retirement/constants'
import { RetirementLifestyleAnswers } from '../../retirement/types'

type StepRetirementSpendingProps = {
  lifestyle: RetirementLifestyleAnswers
  onChange: (field: keyof RetirementLifestyleAnswers, value: string) => void
}

export default function StepRetirementSpending({ lifestyle, onChange }: StepRetirementSpendingProps) {
  return (
    <QuestionCard
      title="Income & Retirement Spending"
      description="Share your current income and estimated retirement spending so we can model income adequacy."
    >
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <CurrencyInput
          label="Current Annual Gross Household Income"
          name="currentAnnualGrossIncome"
          value={lifestyle.currentAnnualGrossIncome}
          onChange={(value) => onChange('currentAnnualGrossIncome', value)}
          placeholder="150,000"
          required
        />
        <CurrencyInput
          label="Estimated Monthly Retirement Spending"
          name="estimatedMonthlyRetirementSpending"
          value={lifestyle.estimatedMonthlyRetirementSpending}
          onChange={(value) => onChange('estimatedMonthlyRetirementSpending', value)}
          placeholder="6,500"
        />
        <p className="funnel-microcopy assessment-note">
          Optional. If left blank, we estimate retirement spending as 80% of your current annual
          gross income (converted to a monthly amount). You can refine this later.
        </p>
        <OptionGroup
          label="How would you describe your current consumer debt burden?"
          name="debtBurden"
          options={DEBT_BURDEN_OPTIONS}
          value={lifestyle.debtBurden}
          onChange={(value) => onChange('debtBurden', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
