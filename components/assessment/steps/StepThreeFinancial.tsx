import CurrencyInput from '../CurrencyInput'
import QuestionCard from '../QuestionCard'
import TextInput from '../TextInput'
import { FinancialAnswers } from '../types'

type StepThreeFinancialProps = {
  answers: FinancialAnswers
  onChange: (field: keyof FinancialAnswers, value: string) => void
}

export default function StepThreeFinancial({ answers, onChange }: StepThreeFinancialProps) {
  return (
    <QuestionCard
      title="Financial Foundation"
      description="Help us understand your household's financial starting point."
    >
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <CurrencyInput
          label="Household Income"
          name="householdIncome"
          value={answers.householdIncome}
          onChange={(value) => onChange('householdIncome', value)}
          placeholder="120,000"
          required
        />
        <CurrencyInput
          label="Monthly Housing Payment"
          name="monthlyHousingPayment"
          value={answers.monthlyHousingPayment}
          onChange={(value) => onChange('monthlyHousingPayment', value)}
          placeholder="2,500"
          required
        />
        <CurrencyInput
          label="Total Debt"
          name="totalDebt"
          value={answers.totalDebt}
          onChange={(value) => onChange('totalDebt', value)}
          placeholder="45,000"
          required
        />
        <TextInput
          label="Emergency Fund Months"
          name="emergencyFundMonths"
          type="number"
          value={answers.emergencyFundMonths}
          onChange={(value) => onChange('emergencyFundMonths', value)}
          placeholder="3"
          min={0}
          max={24}
          required
        />
      </form>
    </QuestionCard>
  )
}
