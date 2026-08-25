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
  const consentChecked = leadDetails.consentGiven === 'yes'

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
          required
        />
        <OptionGroup
          label={t('fields', 'bestContactTime')}
          name="bestContactTime"
          options={localizedOptions(CONTACT_TIME_OPTIONS, t, 'contactTime')}
          value={leadDetails.bestContactTime}
          onChange={(value) => onLeadDetailsChange('bestContactTime', value)}
          required
        />
        <TextInput
          label={t('fields', 'primaryConcern')}
          name="primaryConcern"
          value={leadDetails.primaryConcern}
          onChange={(value) => onLeadDetailsChange('primaryConcern', value)}
          placeholder={t('placeholders', 'primaryConcern')}
        />
        <div className="assessment-field assessment-consent-field">
          <p className="assessment-field-label" id="assessment-consent-heading">
            {t('fields', 'consent')} *
          </p>
          <label className="assessment-consent-label" htmlFor="assessment-consentGiven">
            <input
              id="assessment-consentGiven"
              type="checkbox"
              name="consentGiven"
              checked={consentChecked}
              aria-labelledby="assessment-consent-heading"
              onChange={(event) =>
                onLeadDetailsChange('consentGiven', event.target.checked ? 'yes' : 'no')
              }
            />
            <span className="assessment-consent-text">{t('validation', 'contactConsent')}</span>
          </label>
        </div>
      </form>
    </QuestionCard>
  )
}
