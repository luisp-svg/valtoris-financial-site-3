import CurrencyInput from '../../assessment/CurrencyInput'
import { CalculatorQuestionCard, TotalDisplay } from '../CalculatorHelpers'
import { formatCurrency, getTotalDebt } from '../calculations'
import { CalculatorAnswers, DebtStepAnswers } from '../types'

type CalcStepFourDebtProps = {
  answers: DebtStepAnswers
  allAnswers: CalculatorAnswers
  onChange: (field: keyof DebtStepAnswers, value: string) => void
}

export default function CalcStepFourDebt({ answers, allAnswers, onChange }: CalcStepFourDebtProps) {
  const totalDebt = getTotalDebt({ ...allAnswers, debt: answers })

  return (
    <CalculatorQuestionCard title="Outstanding Debt">
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <CurrencyInput
          label="Credit Card Debt"
          name="calcCreditCards"
          value={answers.creditCardDebt}
          onChange={(value) => onChange('creditCardDebt', value)}
          placeholder="0"
          required
        />
        <CurrencyInput
          label="Auto Loans"
          name="calcAutoLoans"
          value={answers.autoLoans}
          onChange={(value) => onChange('autoLoans', value)}
          placeholder="0"
          required
        />
        <CurrencyInput
          label="Personal Loans"
          name="calcPersonalLoans"
          value={answers.personalLoans}
          onChange={(value) => onChange('personalLoans', value)}
          placeholder="0"
          required
        />
        <CurrencyInput
          label="Student Loans"
          name="calcStudentLoans"
          value={answers.studentLoans}
          onChange={(value) => onChange('studentLoans', value)}
          placeholder="0"
          required
        />
        <TotalDisplay label="Total Debt" value={formatCurrency(totalDebt)} />
      </form>
    </CalculatorQuestionCard>
  )
}
