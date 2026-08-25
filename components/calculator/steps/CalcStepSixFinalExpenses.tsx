import CurrencyInput from '../../assessment/CurrencyInput'
import type { ReportCardCopyFn } from '../../assessment/reportCardLocale'
import { CalculatorQuestionCard } from '../CalculatorHelpers'
import OptionGroup from '../OptionGroup'
import { FINAL_EXPENSE_OPTIONS } from '../constants'
import { localizeCalculatorOptions } from '../protectionCopy'
import { FinalExpensesStepAnswers } from '../types'

type CalcStepSixFinalExpensesProps = {
  answers: FinalExpensesStepAnswers
  onChange: (field: keyof FinalExpensesStepAnswers, value: string) => void
  t: ReportCardCopyFn
}

export default function CalcStepSixFinalExpenses({
  answers,
  onChange,
  t,
}: CalcStepSixFinalExpensesProps) {
  return (
    <CalculatorQuestionCard title={t('ui', 'step6Title')} description={t('helpers', 'step6')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <OptionGroup
          label={t('fields', 'finalExpenses')}
          name="finalExpenses"
          options={localizeCalculatorOptions(FINAL_EXPENSE_OPTIONS, t, 'finalExpenses')}
          value={answers.amount}
          onChange={(value) => onChange('amount', value)}
          required
        />
        {answers.amount === 'custom' && (
          <CurrencyInput
            label={t('fields', 'customFinalExpenses')}
            name="calcCustomFinal"
            value={answers.customAmount}
            onChange={(value) => onChange('customAmount', value)}
            placeholder={t('placeholders', 'finalExpenses')}
            required
          />
        )}
      </form>
    </CalculatorQuestionCard>
  )
}
