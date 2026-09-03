import QuestionCard from '../../QuestionCard'
import TextInput from '../../TextInput'
import type { SpecializedCopyFn } from '../../specialized/renderer'
import type { HomeBuyerContactAnswers } from '../../homeBuyer/types'

type StepHomeBuyerContactProps = {
  contact: HomeBuyerContactAnswers
  t: SpecializedCopyFn
  showErrors?: boolean
  onChange: (field: keyof HomeBuyerContactAnswers, value: string) => void
}

function ContactField({
  label,
  name,
  value,
  type,
  placeholder,
  showErrors,
  requiredMessage,
  onChange,
}: {
  label: string
  name: string
  value: string
  type?: 'text' | 'email' | 'tel'
  placeholder: string
  showErrors: boolean
  requiredMessage: string
  onChange: (value: string) => void
}) {
  const invalid = showErrors && value.trim() === ''
  return (
    <div>
      <TextInput
        label={label}
        name={name}
        value={value}
        type={type}
        onChange={onChange}
        placeholder={placeholder}
        required
      />
      {invalid ? (
        <p className="assessment-validation-message" role="alert">
          {requiredMessage}
        </p>
      ) : null}
    </div>
  )
}

export default function StepHomeBuyerContact({
  contact,
  t,
  showErrors = false,
  onChange,
}: StepHomeBuyerContactProps) {
  const requiredMessage = t('validation', 'required')
  return (
    <QuestionCard title={t('ui', 'contactTitle')} description={t('ui', 'contactBody')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <ContactField
          label={t('ui', 'firstName')}
          name="firstName"
          value={contact.firstName}
          placeholder={t('ui', 'firstNamePlaceholder')}
          showErrors={showErrors}
          requiredMessage={requiredMessage}
          onChange={(value) => onChange('firstName', value)}
        />
        <ContactField
          label={t('ui', 'lastName')}
          name="lastName"
          value={contact.lastName}
          placeholder={t('ui', 'lastNamePlaceholder')}
          showErrors={showErrors}
          requiredMessage={requiredMessage}
          onChange={(value) => onChange('lastName', value)}
        />
        <ContactField
          label={t('ui', 'email')}
          name="email"
          value={contact.email}
          type="email"
          placeholder={t('ui', 'emailPlaceholder')}
          showErrors={showErrors}
          requiredMessage={requiredMessage}
          onChange={(value) => onChange('email', value)}
        />
        <ContactField
          label={t('ui', 'phone')}
          name="phone"
          value={contact.phone}
          type="tel"
          placeholder={t('ui', 'phonePlaceholder')}
          showErrors={showErrors}
          requiredMessage={requiredMessage}
          onChange={(value) => onChange('phone', value)}
        />
      </form>
    </QuestionCard>
  )
}
