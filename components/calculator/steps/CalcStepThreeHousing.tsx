import CurrencyInput from '../../assessment/CurrencyInput'
import type { ReportCardCopyFn } from '../../assessment/reportCardLocale'
import { CalculatorQuestionCard, FormulaNote } from '../CalculatorHelpers'
import OptionGroup from '../OptionGroup'
import { HOUSING_TYPE_OPTIONS } from '../constants'
import { localizeCalculatorOptions } from '../protectionCopy'
import { HousingStepAnswers } from '../types'

type CalcStepThreeHousingProps = {
  answers: HousingStepAnswers
  onChange: (field: keyof HousingStepAnswers, value: string) => void
  t: ReportCardCopyFn
}

export default function CalcStepThreeHousing({
  answers,
  onChange,
  t,
}: CalcStepThreeHousingProps) {
  return (
    <CalculatorQuestionCard title={t('ui', 'step3Title')} description={t('helpers', 'step3')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <OptionGroup
          label={t('fields', 'housingType')}
          name="housingType"
          options={localizeCalculatorOptions(HOUSING_TYPE_OPTIONS, t, 'housingType')}
          value={answers.housingType}
          onChange={(value) => onChange('housingType', value)}
          required
        />
        {answers.housingType === 'own' && (
          <CurrencyInput
            label={t('fields', 'annualMortgagePayment')}
            name="calcMortgage"
            value={answers.annualMortgagePayment}
            onChange={(value) => onChange('annualMortgagePayment', value)}
            placeholder={t('placeholders', 'mortgage')}
            required
          />
        )}
        {answers.housingType === 'rent' && (
          <CurrencyInput
            label={t('fields', 'annualRentPayment')}
            name="calcRent"
            value={answers.annualRentPayment}
            onChange={(value) => onChange('annualRentPayment', value)}
            placeholder={t('placeholders', 'rent')}
            required
          />
        )}
        <FormulaNote
          label={t('helpers', 'housingFormulaLabel')}
          formula={t('helpers', 'housingFormula')}
        />
      </form>
    </CalculatorQuestionCard>
  )
}
