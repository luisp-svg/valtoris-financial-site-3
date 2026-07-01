import CurrencyInput from '../../assessment/CurrencyInput'
import TextInput from '../../assessment/TextInput'
import { CalculatorQuestionCard } from '../CalculatorHelpers'
import OptionGroup from '../OptionGroup'
import { COLLEGE_FUND_OPTIONS } from '../constants'
import { EducationStepAnswers } from '../types'

type CalcStepFiveEducationProps = {
  answers: EducationStepAnswers
  onChange: (field: keyof EducationStepAnswers, value: string) => void
}

export default function CalcStepFiveEducation({ answers, onChange }: CalcStepFiveEducationProps) {
  return (
    <CalculatorQuestionCard title="Children's Education">
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <TextInput
          label="Number of Children"
          name="calcEduChildren"
          type="number"
          value={answers.numberOfChildren}
          onChange={(value) => onChange('numberOfChildren', value)}
          min={0}
          max={20}
          required
        />
        <OptionGroup
          label="Desired College Fund Per Child"
          name="collegeFund"
          options={COLLEGE_FUND_OPTIONS}
          value={answers.collegeFundPerChild}
          onChange={(value) => onChange('collegeFundPerChild', value)}
          required
        />
        {answers.collegeFundPerChild === 'custom' && (
          <CurrencyInput
            label="Custom College Fund Per Child"
            name="calcCustomCollege"
            value={answers.customCollegeFund}
            onChange={(value) => onChange('customCollegeFund', value)}
            required
          />
        )}
      </form>
    </CalculatorQuestionCard>
  )
}
