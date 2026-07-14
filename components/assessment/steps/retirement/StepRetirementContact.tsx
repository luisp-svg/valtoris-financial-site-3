import QuestionCard from '../../QuestionCard'
import SelectInput from '../../SelectInput'
import TextInput from '../../TextInput'
import OptionGroup from '../../../calculator/OptionGroup'
import { CONTACT_METHOD_OPTIONS, CONTACT_TIME_OPTIONS } from '../../retirement/constants'
import {
  RetirementHouseholdAnswers,
  RetirementLeadDetails,
} from '../../retirement/types'

type StepRetirementContactProps = {
  household: RetirementHouseholdAnswers
  leadDetails: RetirementLeadDetails
  onHouseholdChange: (field: keyof RetirementHouseholdAnswers, value: string) => void
  onLeadDetailsChange: (field: keyof RetirementLeadDetails, value: string) => void
}

export default function StepRetirementContact({
  household,
  leadDetails,
  onHouseholdChange,
  onLeadDetailsChange,
}: StepRetirementContactProps) {
  const consentChecked = leadDetails.consentGiven === 'yes'

  return (
    <QuestionCard
      title="Contact & Results"
      description="Share how we can reach you, then view your personalized Retirement Report Card™."
    >
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <TextInput
          label="First Name"
          name="firstName"
          value={household.firstName}
          onChange={(value) => onHouseholdChange('firstName', value)}
          placeholder="First name"
          required
        />
        <TextInput
          label="Last Name"
          name="lastName"
          value={household.lastName}
          onChange={(value) => onHouseholdChange('lastName', value)}
          placeholder="Last name"
          required
        />
        <TextInput
          label="Email"
          name="email"
          type="email"
          value={household.email}
          onChange={(value) => onHouseholdChange('email', value)}
          placeholder="you@email.com"
          required
        />
        <TextInput
          label="Phone"
          name="phone"
          type="tel"
          value={household.phone}
          onChange={(value) => onHouseholdChange('phone', value)}
          placeholder="(555) 555-5555"
          required
        />
        <SelectInput
          label="Preferred Contact Method"
          name="preferredContactMethod"
          value={leadDetails.preferredContactMethod}
          onChange={(value) => onLeadDetailsChange('preferredContactMethod', value)}
          options={CONTACT_METHOD_OPTIONS}
          required
        />
        <OptionGroup
          label="Best Contact Time"
          name="bestContactTime"
          options={CONTACT_TIME_OPTIONS}
          value={leadDetails.bestContactTime}
          onChange={(value) => onLeadDetailsChange('bestContactTime', value)}
          required
        />
        <TextInput
          label="Primary Retirement Concern (optional)"
          name="primaryConcern"
          value={leadDetails.primaryConcern}
          onChange={(value) => onLeadDetailsChange('primaryConcern', value)}
          placeholder="e.g., closing my income gap"
        />
        <div className="assessment-field assessment-consent-field">
          <p className="assessment-field-label" id="assessment-consent-heading">
            Consent *
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
            <span className="assessment-consent-text">
              I understand these results are educational estimates for planning purposes and do not
              guarantee retirement outcomes. Valtoris may contact me about my Retirement Report
              Card™ using the preferences I provided.
            </span>
          </label>
        </div>
      </form>
    </QuestionCard>
  )
}
