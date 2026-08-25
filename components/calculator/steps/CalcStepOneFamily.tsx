import SelectInput from '../../assessment/SelectInput'
import TextInput from '../../assessment/TextInput'
import type { ReportCardCopyFn } from '../../assessment/reportCardLocale'
import { CalculatorQuestionCard } from '../CalculatorHelpers'
import { MARITAL_STATUS_OPTIONS, US_STATES } from '../constants'
import { localizeCalculatorOptions } from '../protectionCopy'
import { FamilyStepAnswers } from '../types'

type CalcStepOneFamilyProps = {
  answers: FamilyStepAnswers
  onChange: (field: keyof FamilyStepAnswers, value: string) => void
  t: ReportCardCopyFn
}

export default function CalcStepOneFamily({ answers, onChange, t }: CalcStepOneFamilyProps) {
  return (
    <CalculatorQuestionCard title={t('ui', 'step1Title')} description={t('helpers', 'step1')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <TextInput
          label={t('fields', 'firstName')}
          name="calcFirstName"
          value={answers.firstName}
          onChange={(value) => onChange('firstName', value)}
          placeholder={t('placeholders', 'firstName')}
          required
        />
        <TextInput
          label={t('fields', 'lastName')}
          name="calcLastName"
          value={answers.lastName}
          onChange={(value) => onChange('lastName', value)}
          placeholder={t('placeholders', 'lastName')}
          required
        />
        <TextInput
          label={t('fields', 'email')}
          name="calcEmail"
          type="email"
          value={answers.email}
          onChange={(value) => onChange('email', value)}
          placeholder={t('placeholders', 'email')}
          required
        />
        <TextInput
          label={t('fields', 'phone')}
          name="calcPhone"
          type="tel"
          value={answers.phone}
          onChange={(value) => onChange('phone', value)}
          placeholder={t('placeholders', 'phone')}
          required
        />
        <TextInput
          label={t('fields', 'age')}
          name="calcAge"
          type="number"
          value={answers.age}
          onChange={(value) => onChange('age', value)}
          placeholder={t('placeholders', 'age')}
          min={18}
          max={120}
          required
        />
        <SelectInput
          label={t('fields', 'state')}
          name="calcState"
          value={answers.state}
          onChange={(value) => onChange('state', value)}
          options={US_STATES}
          placeholder={t('placeholders', 'selectState')}
          required
        />
        <SelectInput
          label={t('fields', 'maritalStatus')}
          name="calcMaritalStatus"
          value={answers.maritalStatus}
          onChange={(value) => onChange('maritalStatus', value)}
          options={localizeCalculatorOptions(MARITAL_STATUS_OPTIONS, t, 'maritalStatus')}
          placeholder={t('placeholders', 'selectMaritalStatus')}
          required
        />
        <TextInput
          label={t('fields', 'numberOfChildren')}
          name="calcChildren"
          type="number"
          value={answers.numberOfChildren}
          onChange={(value) => onChange('numberOfChildren', value)}
          placeholder={t('placeholders', 'children')}
          min={0}
          max={20}
          required
        />
      </form>
    </CalculatorQuestionCard>
  )
}
