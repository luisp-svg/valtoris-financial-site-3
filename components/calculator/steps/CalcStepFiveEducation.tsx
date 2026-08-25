import CurrencyInput from '../../assessment/CurrencyInput'
import TextInput from '../../assessment/TextInput'
import type { ReportCardCopyFn } from '../../assessment/reportCardLocale'
import { CalculatorQuestionCard } from '../CalculatorHelpers'
import OptionGroup from '../OptionGroup'
import { COLLEGE_FUND_OPTIONS } from '../constants'
import { localizeCalculatorOptions } from '../protectionCopy'
import { EducationStepAnswers } from '../types'

type CalcStepFiveEducationProps = {
  answers: EducationStepAnswers
  onChange: (field: keyof EducationStepAnswers, value: string) => void
  t: ReportCardCopyFn
}

export default function CalcStepFiveEducation({
  answers,
  onChange,
  t,
}: CalcStepFiveEducationProps) {
  return (
    <CalculatorQuestionCard title={t('ui', 'step5Title')} description={t('helpers', 'step5')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <TextInput
          label={t('fields', 'educationChildren')}
          name="calcEduChildren"
          type="number"
          value={answers.numberOfChildren}
          onChange={(value) => onChange('numberOfChildren', value)}
          placeholder={t('placeholders', 'children')}
          min={0}
          max={20}
          required
        />
        <OptionGroup
          label={t('fields', 'collegeFundPerChild')}
          name="collegeFund"
          options={localizeCalculatorOptions(COLLEGE_FUND_OPTIONS, t, 'collegeFundPerChild')}
          value={answers.collegeFundPerChild}
          onChange={(value) => onChange('collegeFundPerChild', value)}
          required
        />
        {answers.collegeFundPerChild === 'custom' && (
          <CurrencyInput
            label={t('fields', 'customCollegeFund')}
            name="calcCustomCollege"
            value={answers.customCollegeFund}
            onChange={(value) => onChange('customCollegeFund', value)}
            placeholder={t('placeholders', 'collegeFund')}
            required
          />
        )}
      </form>
    </CalculatorQuestionCard>
  )
}
