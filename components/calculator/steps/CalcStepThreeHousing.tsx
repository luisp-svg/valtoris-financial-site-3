import CurrencyInput from '../../assessment/CurrencyInput'
import { CalculatorQuestionCard, FormulaNote } from '../CalculatorHelpers'
import OptionGroup from '../OptionGroup'
import { HOUSING_TYPE_OPTIONS } from '../constants'
import { HousingStepAnswers } from '../types'

type CalcStepThreeHousingProps = {
  answers: HousingStepAnswers
  onChange: (field: keyof HousingStepAnswers, value: string) => void
}

export default function CalcStepThreeHousing({ answers, onChange }: CalcStepThreeHousingProps) {
  return (
    <CalculatorQuestionCard title="Housing">
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <OptionGroup
          label="Do you"
          name="housingType"
          options={HOUSING_TYPE_OPTIONS}
          value={answers.housingType}
          onChange={(value) => onChange('housingType', value)}
          required
        />
        {answers.housingType === 'own' && (
          <CurrencyInput
            label="Annual Mortgage Payment"
            name="calcMortgage"
            value={answers.annualMortgagePayment}
            onChange={(value) => onChange('annualMortgagePayment', value)}
            required
          />
        )}
        {answers.housingType === 'rent' && (
          <CurrencyInput
            label="Annual Rent Payment"
            name="calcRent"
            value={answers.annualRentPayment}
            onChange={(value) => onChange('annualRentPayment', value)}
            required
          />
        )}
        <FormulaNote label="Housing Protection" formula="Annual Mortgage or Rent × 5 Years" />
      </form>
    </CalculatorQuestionCard>
  )
}
