import CurrencyInput from '../../assessment/CurrencyInput'
import type { ReportCardCopyFn } from '../../assessment/reportCardLocale'
import { CalculatorQuestionCard, TotalDisplay } from '../CalculatorHelpers'
import { formatCurrency, getTotalDebt } from '../calculations'
import { CalculatorAnswers, DebtStepAnswers } from '../types'

type CalcStepFourDebtProps = {
  answers: DebtStepAnswers
  allAnswers: CalculatorAnswers
  onChange: (field: keyof DebtStepAnswers, value: string) => void
  t: ReportCardCopyFn
}

export default function CalcStepFourDebt({
  answers,
  allAnswers,
  onChange,
  t,
}: CalcStepFourDebtProps) {
  const totalDebt = getTotalDebt({ ...allAnswers, debt: answers })

  return (
    <CalculatorQuestionCard title={t('ui', 'step4Title')} description={t('helpers', 'step4')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <CurrencyInput
          label={t('fields', 'creditCardDebt')}
          name="calcCreditCards"
          value={answers.creditCardDebt}
          onChange={(value) => onChange('creditCardDebt', value)}
          placeholder={t('placeholders', 'debt')}
          required
        />
        <CurrencyInput
          label={t('fields', 'autoLoans')}
          name="calcAutoLoans"
          value={answers.autoLoans}
          onChange={(value) => onChange('autoLoans', value)}
          placeholder={t('placeholders', 'debt')}
          required
        />
        <CurrencyInput
          label={t('fields', 'personalLoans')}
          name="calcPersonalLoans"
          value={answers.personalLoans}
          onChange={(value) => onChange('personalLoans', value)}
          placeholder={t('placeholders', 'debt')}
          required
        />
        <CurrencyInput
          label={t('fields', 'studentLoans')}
          name="calcStudentLoans"
          value={answers.studentLoans}
          onChange={(value) => onChange('studentLoans', value)}
          placeholder={t('placeholders', 'debt')}
          required
        />
        <TotalDisplay label={t('fields', 'totalDebt')} value={formatCurrency(totalDebt)} />
      </form>
    </CalculatorQuestionCard>
  )
}
