import CurrencyInput from '../../assessment/CurrencyInput'
import { CalculatorQuestionCard } from '../CalculatorHelpers'
import OptionGroup from '../OptionGroup'
import { FINAL_EXPENSE_OPTIONS } from '../constants'
import { FinalExpensesStepAnswers } from '../types'

type CalcStepSixFinalExpensesProps = {
  answers: FinalExpensesStepAnswers
  onChange: (field: keyof FinalExpensesStepAnswers, value: string) => void
}

export default function CalcStepSixFinalExpenses({ answers, onChange }: CalcStepSixFinalExpensesProps) {
  return (
    <CalculatorQuestionCard title="Final Expenses">
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <OptionGroup
          label="Estimated Final Expenses"
          name="finalExpenses"
          options={FINAL_EXPENSE_OPTIONS}
          value={answers.amount}
          onChange={(value) => onChange('amount', value)}
          required
        />
        {answers.amount === 'custom' && (
          <CurrencyInput
            label="Custom Final Expenses"
            name="calcCustomFinal"
            value={answers.customAmount}
            onChange={(value) => onChange('customAmount', value)}
            required
          />
        )}
      </form>
    </CalculatorQuestionCard>
  )
}
