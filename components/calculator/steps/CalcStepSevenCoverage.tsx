import CurrencyInput from '../../assessment/CurrencyInput'
import { CalculatorQuestionCard } from '../CalculatorHelpers'
import { CoverageStepAnswers } from '../types'

type CalcStepSevenCoverageProps = {
  answers: CoverageStepAnswers
  onChange: (field: keyof CoverageStepAnswers, value: string) => void
}

export default function CalcStepSevenCoverage({ answers, onChange }: CalcStepSevenCoverageProps) {
  return (
    <CalculatorQuestionCard
      title="Current Coverage"
      description="Enter your existing life insurance coverage so we can estimate your protection gap."
    >
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <CurrencyInput
          label="Current Life Insurance Coverage"
          name="calcCurrentCoverage"
          value={answers.currentLifeInsurance}
          onChange={(value) => onChange('currentLifeInsurance', value)}
          placeholder="0"
          required
        />
      </form>
    </CalculatorQuestionCard>
  )
}
