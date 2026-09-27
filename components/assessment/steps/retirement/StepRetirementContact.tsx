import QuestionCard from '../../QuestionCard'
import SelectInput from '../../SelectInput'
import TextInput from '../../TextInput'
import OptionGroup from '../../../calculator/OptionGroup'
import { localizedOptions, type ReportCardCopyFn } from '../../reportCardLocale'
import { CONTACT_METHOD_OPTIONS, CONTACT_TIME_OPTIONS } from '../../retirement/constants'
import {
  RetirementHouseholdAnswers,
  RetirementLeadDetails,
} from '../../retirement/types'

type StepRetirementContactProps = {
  t: ReportCardCopyFn
  household: RetirementHouseholdAnswers
  leadDetails: RetirementLeadDetails
  onHouseholdChange: (field: keyof RetirementHouseholdAnswers, value: string) => void
  onLeadDetailsChange: (field: keyof RetirementLeadDetails, value: string) => void
}

export default function StepRetirementContact({
  t,
  household,
  leadDetails,
  onHouseholdChange,
  onLeadDetailsChange,
}: StepRetirementContactProps) {
  return (
    <QuestionCard title={t('ui', 'step9Title')} description={t('helpers', 'step9')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <TextInput
          label={t('fields', 'firstName')}
          name="firstName"
          value={household.firstName}
          onChange={(value) => onHouseholdChange('firstName', value)}
          placeholder={t('placeholders', 'firstName')}
          required
        />
        <TextInput
          label={t('fields', 'lastName')}
          name="lastName"
          value={household.lastName}
          onChange={(value) => onHouseholdChange('lastName', value)}
          placeholder={t('placeholders', 'lastName')}
          required
        />
        <TextInput
          label={t('fields', 'email')}
          name="email"
          type="email"
          value={household.email}
          onChange={(value) => onHouseholdChange('email', value)}
          placeholder={t('placeholders', 'email')}
          required
        />
        <TextInput
          label={t('fields', 'phone')}
          name="phone"
          type="tel"
          value={household.phone}
          onChange={(value) => onHouseholdChange('phone', value)}
          placeholder={t('placeholders', 'phone')}
          required
        />
        <SelectInput
          label={t('fields', 'preferredContactMethod')}
          name="preferredContactMethod"
          value={leadDetails.preferredContactMethod}
          onChange={(value) => onLeadDetailsChange('preferredContactMethod', value)}
          options={localizedOptions(CONTACT_METHOD_OPTIONS, t, 'contactMethod')}
        />
        <OptionGroup
          label={t('fields', 'bestContactTime')}
          name="bestContactTime"
          options={localizedOptions(CONTACT_TIME_OPTIONS, t, 'contactTime')}
          value={leadDetails.bestContactTime}
          onChange={(value) => onLeadDetailsChange('bestContactTime', value)}
        />
        <TextInput
          label={t('fields', 'primaryConcern')}
          name="primaryConcern"
          value={leadDetails.primaryConcern}
          onChange={(value) => onLeadDetailsChange('primaryConcern', value)}
          placeholder={t('placeholders', 'primaryConcern')}
        />
      </form>
    </QuestionCard>
  )
}
