import QuestionCard from '../../QuestionCard'
import TextInput from '../../TextInput'
import type { SpecializedCopyFn } from '../../specialized/renderer'
import type { StudentLoanContactAnswers } from '../../studentLoan/types'

type StepStudentLoanContactProps = {
  contact: StudentLoanContactAnswers
  t: SpecializedCopyFn
  onChange: (field: keyof StudentLoanContactAnswers, value: string) => void
}

export default function StepStudentLoanContact({
  contact,
  t,
  onChange,
}: StepStudentLoanContactProps) {
  return (
    <QuestionCard title={t('ui', 'contactTitle')} description={t('ui', 'contactBody')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <TextInput
          label={t('ui', 'firstName')}
          name="firstName"
          value={contact.firstName}
          onChange={(value) => onChange('firstName', value)}
          placeholder={t('ui', 'firstNamePlaceholder')}
          required
        />
        <TextInput
          label={t('ui', 'lastName')}
          name="lastName"
          value={contact.lastName}
          onChange={(value) => onChange('lastName', value)}
          placeholder={t('ui', 'lastNamePlaceholder')}
          required
        />
        <TextInput
          label={t('ui', 'email')}
          name="email"
          type="email"
          value={contact.email}
          onChange={(value) => onChange('email', value)}
          placeholder={t('ui', 'emailPlaceholder')}
          required
        />
        <TextInput
          label={t('ui', 'phone')}
          name="phone"
          type="tel"
          value={contact.phone}
          onChange={(value) => onChange('phone', value)}
          placeholder={t('ui', 'phonePlaceholder')}
          required
        />
      </form>
    </QuestionCard>
  )
}
