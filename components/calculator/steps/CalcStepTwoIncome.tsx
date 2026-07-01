import CurrencyInput from '../../assessment/CurrencyInput'
import TextInput from '../../assessment/TextInput'
import { CalculatorQuestionCard, FormulaNote } from '../CalculatorHelpers'
import OptionGroup from '../OptionGroup'
import { INCOME_REPLACEMENT_OPTIONS } from '../constants'
import { IncomeStepAnswers } from '../types'

type CalcStepTwoIncomeProps = {
  answers: IncomeStepAnswers
  onChange: (field: keyof IncomeStepAnswers, value: string) => void
}

export default function CalcStepTwoIncome({ answers, onChange }: CalcStepTwoIncomeProps) {
  return (
    <CalculatorQuestionCard title="Income Protection">
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <CurrencyInput
          label="Annual Household Income"
          name="calcAnnualIncome"
          value={answers.annualHouseholdIncome}
          onChange={(value) => onChange('annualHouseholdIncome', value)}
          required
        />
        <OptionGroup
          label="Years of Income Replacement"
          name="incomeYears"
          options={INCOME_REPLACEMENT_OPTIONS}
          value={answers.incomeReplacementYears}
          onChange={(value) => onChange('incomeReplacementYears', value)}
          required
        />
        {answers.incomeReplacementYears === 'custom' && (
          <TextInput
            label="Custom Years"
            name="calcCustomIncomeYears"
            type="number"
            value={answers.customIncomeYears}
            onChange={(value) => onChange('customIncomeYears', value)}
            min={1}
            max={40}
            required
          />
        )}
        <FormulaNote label="Income Protection" formula="Annual Income × Selected Years" />
      </form>
    </CalculatorQuestionCard>
  )
}
