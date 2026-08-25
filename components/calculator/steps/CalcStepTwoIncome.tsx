import CurrencyInput from '../../assessment/CurrencyInput'
import TextInput from '../../assessment/TextInput'
import type { ReportCardCopyFn } from '../../assessment/reportCardLocale'
import { CalculatorQuestionCard, FormulaNote } from '../CalculatorHelpers'
import OptionGroup from '../OptionGroup'
import { INCOME_REPLACEMENT_OPTIONS } from '../constants'
import { localizeCalculatorOptions } from '../protectionCopy'
import { IncomeStepAnswers } from '../types'

type CalcStepTwoIncomeProps = {
  answers: IncomeStepAnswers
  onChange: (field: keyof IncomeStepAnswers, value: string) => void
  t: ReportCardCopyFn
}

export default function CalcStepTwoIncome({ answers, onChange, t }: CalcStepTwoIncomeProps) {
  return (
    <CalculatorQuestionCard title={t('ui', 'step2Title')} description={t('helpers', 'step2')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <CurrencyInput
          label={t('fields', 'annualHouseholdIncome')}
          name="calcAnnualIncome"
          value={answers.annualHouseholdIncome}
          onChange={(value) => onChange('annualHouseholdIncome', value)}
          placeholder={t('placeholders', 'income')}
          required
        />
        <OptionGroup
          label={t('fields', 'incomeReplacementYears')}
          name="incomeYears"
          options={localizeCalculatorOptions(
            INCOME_REPLACEMENT_OPTIONS,
            t,
            'incomeReplacementYears',
          )}
          value={answers.incomeReplacementYears}
          onChange={(value) => onChange('incomeReplacementYears', value)}
          required
        />
        {answers.incomeReplacementYears === 'custom' && (
          <TextInput
            label={t('fields', 'customIncomeYears')}
            name="calcCustomIncomeYears"
            type="number"
            value={answers.customIncomeYears}
            onChange={(value) => onChange('customIncomeYears', value)}
            placeholder={t('placeholders', 'customYears')}
            min={1}
            max={40}
            required
          />
        )}
        <FormulaNote
          label={t('helpers', 'incomeFormulaLabel')}
          formula={t('helpers', 'incomeFormula')}
        />
      </form>
    </CalculatorQuestionCard>
  )
}
