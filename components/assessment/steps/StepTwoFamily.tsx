import QuestionCard from '../QuestionCard'
import SelectInput from '../SelectInput'
import TextInput from '../TextInput'
import { MARITAL_STATUS_OPTIONS, US_STATES } from '../constants'
import { localizedOptions, type ReportCardCopyFn } from '../reportCardLocale'
import { FamilyAnswers } from '../types'

type StepTwoFamilyProps = {
  answers: FamilyAnswers
  onChange: (field: keyof FamilyAnswers, value: string) => void
  t: ReportCardCopyFn
}

export default function StepTwoFamily({ answers, onChange, t }: StepTwoFamilyProps) {
  return (
    <QuestionCard title={t('ui', 'step2Title')} description={t('helpers', 'step2')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <TextInput
          label={t('fields', 'firstName')}
          name="firstName"
          value={answers.firstName}
          onChange={(value) => onChange('firstName', value)}
          placeholder={t('placeholders', 'firstName')}
          required
        />
        <TextInput
          label={t('fields', 'lastName')}
          name="lastName"
          value={answers.lastName}
          onChange={(value) => onChange('lastName', value)}
          placeholder={t('placeholders', 'lastName')}
          required
        />
        <TextInput
          label={t('fields', 'email')}
          name="email"
          type="email"
          value={answers.email}
          onChange={(value) => onChange('email', value)}
          placeholder={t('placeholders', 'email')}
          required
        />
        <TextInput
          label={t('fields', 'phone')}
          name="phone"
          type="tel"
          value={answers.phone}
          onChange={(value) => onChange('phone', value)}
          placeholder={t('placeholders', 'phone')}
          required
        />
        <TextInput
          label={t('fields', 'age')}
          name="age"
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
          name="state"
          value={answers.state}
          onChange={(value) => onChange('state', value)}
          options={US_STATES}
          required
        />
        <SelectInput
          label={t('fields', 'maritalStatus')}
          name="maritalStatus"
          value={answers.maritalStatus}
          onChange={(value) => onChange('maritalStatus', value)}
          options={localizedOptions(MARITAL_STATUS_OPTIONS, t, 'maritalStatus')}
          required
        />
        <TextInput
          label={t('fields', 'numberOfChildren')}
          name="numberOfChildren"
          type="number"
          value={answers.numberOfChildren}
          onChange={(value) => onChange('numberOfChildren', value)}
          placeholder={t('placeholders', 'children')}
          min={0}
          max={20}
          required
        />
      </form>
    </QuestionCard>
  )
}
