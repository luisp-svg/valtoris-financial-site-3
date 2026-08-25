import CurrencyInput from '../../assessment/CurrencyInput'
import type { ReportCardCopyFn } from '../../assessment/reportCardLocale'
import { CalculatorQuestionCard } from '../CalculatorHelpers'
import { CoverageStepAnswers } from '../types'

type CalcStepSevenCoverageProps = {
  answers: CoverageStepAnswers
  onChange: (field: keyof CoverageStepAnswers, value: string) => void
  t: ReportCardCopyFn
}

export default function CalcStepSevenCoverage({
  answers,
  onChange,
  t,
}: CalcStepSevenCoverageProps) {
  return (
    <CalculatorQuestionCard title={t('ui', 'step7Title')} description={t('helpers', 'step7')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <CurrencyInput
          label={t('fields', 'currentLifeInsurance')}
          name="calcCurrentCoverage"
          value={answers.currentLifeInsurance}
          onChange={(value) => onChange('currentLifeInsurance', value)}
          placeholder={t('placeholders', 'coverage')}
          required
        />
      </form>
    </CalculatorQuestionCard>
  )
}
