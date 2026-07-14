import CurrencyInput from '../../CurrencyInput'
import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import YesNoInput from '../../YesNoInput'
import {
  LEGACY_INTENT_OPTIONS,
  LONG_TERM_CARE_OPTIONS,
  MEDICARE_READINESS_OPTIONS,
} from '../../retirement/constants'
import { RetirementEstateAnswers, RetirementHealthcareAnswers } from '../../retirement/types'

type StepRetirementHealthcareLegacyProps = {
  healthcare: RetirementHealthcareAnswers
  estate: RetirementEstateAnswers
  onHealthcareChange: (field: keyof RetirementHealthcareAnswers, value: string) => void
  onEstateChange: (field: keyof RetirementEstateAnswers, value: string) => void
}

export default function StepRetirementHealthcareLegacy({
  healthcare,
  estate,
  onHealthcareChange,
  onEstateChange,
}: StepRetirementHealthcareLegacyProps) {
  return (
    <QuestionCard
      title="Healthcare, Protection & Legacy"
      description="Review healthcare readiness and the documents that protect your family and legacy goals."
    >
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <h3 className="assessment-section-heading">Healthcare & Long-Term Care</h3>
        <OptionGroup
          label="How prepared are you for Medicare enrollment and planning?"
          name="medicareReadiness"
          options={MEDICARE_READINESS_OPTIONS}
          value={healthcare.medicareReadiness}
          onChange={(value) => onHealthcareChange('medicareReadiness', value)}
          required
        />
        <OptionGroup
          label="What is your long-term-care funding approach?"
          name="longTermCarePlan"
          options={LONG_TERM_CARE_OPTIONS}
          value={healthcare.longTermCarePlan}
          onChange={(value) => onHealthcareChange('longTermCarePlan', value)}
          required
        />
        <CurrencyInput
          label="Current HSA Balance"
          name="hsaBalance"
          value={healthcare.hsaBalance}
          onChange={(value) => onHealthcareChange('hsaBalance', value)}
          placeholder="8,000"
          required
        />

        <h3 className="assessment-section-heading">Estate, Beneficiaries & Legacy</h3>
        <YesNoInput
          label="Do you have a will?"
          name="hasWill"
          value={estate.hasWill}
          onChange={(value) => onEstateChange('hasWill', value)}
          required
        />
        <YesNoInput
          label="Do you have a trust?"
          name="hasTrust"
          value={estate.hasTrust}
          onChange={(value) => onEstateChange('hasTrust', value)}
          required
        />
        <YesNoInput
          label="Have you reviewed beneficiaries on major accounts in the last 2–3 years?"
          name="beneficiariesReviewed"
          value={estate.beneficiariesReviewed}
          onChange={(value) => onEstateChange('beneficiariesReviewed', value)}
          required
        />
        <YesNoInput
          label="Do you have a durable power of attorney?"
          name="hasPowerOfAttorney"
          value={estate.hasPowerOfAttorney}
          onChange={(value) => onEstateChange('hasPowerOfAttorney', value)}
          required
        />
        <OptionGroup
          label="How would you describe your legacy / inheritance intent?"
          name="legacyIntent"
          options={LEGACY_INTENT_OPTIONS}
          value={estate.legacyIntent}
          onChange={(value) => onEstateChange('legacyIntent', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
