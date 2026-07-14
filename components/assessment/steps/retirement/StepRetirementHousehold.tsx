import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import SelectInput from '../../SelectInput'
import TextInput from '../../TextInput'
import { MARITAL_STATUS_OPTIONS, US_STATES } from '../../constants'
import {
  ALREADY_RETIRED_OPTIONS,
  RETIREMENT_LIFESTYLE_OPTIONS,
  RETIREMENT_PLAN_CLARITY_OPTIONS,
  RETIREMENT_PRIMARY_MOTIVATION_OPTIONS,
} from '../../retirement/constants'
import {
  RetirementHouseholdAnswers,
  RetirementVisionAnswers,
  isAlreadyRetiredAnswer,
  isMarried,
  isRetirementAgeValid,
} from '../../retirement/types'

type StepRetirementHouseholdProps = {
  household: RetirementHouseholdAnswers
  vision: RetirementVisionAnswers
  onHouseholdChange: (field: keyof RetirementHouseholdAnswers, value: string) => void
  onVisionChange: (field: keyof RetirementVisionAnswers, value: string) => void
}

export default function StepRetirementHousehold({
  household,
  vision,
  onHouseholdChange,
  onVisionChange,
}: StepRetirementHouseholdProps) {
  const alreadyRetired = isAlreadyRetiredAnswer(household)
  const showSpouse = isMarried(household)
  const ageFieldsStarted =
    household.currentAge.trim() !== '' ||
    (!alreadyRetired && household.targetRetirementAge.trim() !== '')
  const showAgeWarning =
    ageFieldsStarted && household.alreadyRetired === 'no' && !isRetirementAgeValid(household)

  return (
    <QuestionCard
      title="Household & Retirement Timeline"
      description="Tell us about your household and when you plan to retire so we can personalize your projections."
    >
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <SelectInput
          label="State"
          name="state"
          value={household.state}
          onChange={(value) => onHouseholdChange('state', value)}
          options={US_STATES}
          required
        />
        <SelectInput
          label="Marital Status"
          name="maritalStatus"
          value={household.maritalStatus}
          onChange={(value) => onHouseholdChange('maritalStatus', value)}
          options={MARITAL_STATUS_OPTIONS}
          required
        />
        <OptionGroup
          label="Are you already retired?"
          name="alreadyRetired"
          options={ALREADY_RETIRED_OPTIONS}
          value={household.alreadyRetired}
          onChange={(value) => onHouseholdChange('alreadyRetired', value)}
          required
        />
        <TextInput
          label="Current Age"
          name="currentAge"
          type="number"
          value={household.currentAge}
          onChange={(value) => onHouseholdChange('currentAge', value)}
          placeholder="55"
          min={18}
          max={120}
          required
        />
        {!alreadyRetired ? (
          <TextInput
            label="Target Retirement Age"
            name="targetRetirementAge"
            type="number"
            value={household.targetRetirementAge}
            onChange={(value) => onHouseholdChange('targetRetirementAge', value)}
            placeholder="65"
            min={18}
            max={120}
            required
          />
        ) : (
          <p className="funnel-microcopy assessment-note">
            Because you indicated you are already retired, we will focus on sustainability,
            withdrawals, healthcare, taxes, and legacy rather than a future start date.
          </p>
        )}
        {showAgeWarning ? (
          <p className="assessment-validation-message" role="alert">
            Target retirement age must be greater than or equal to your current age.
          </p>
        ) : null}
        {showSpouse ? (
          <>
            <TextInput
              label="Spouse Age (optional)"
              name="spouseAge"
              type="number"
              value={household.spouseAge}
              onChange={(value) => onHouseholdChange('spouseAge', value)}
              placeholder="53"
              min={18}
              max={120}
            />
            <TextInput
              label="Spouse Target Retirement Age (optional)"
              name="spouseTargetRetirementAge"
              type="number"
              value={household.spouseTargetRetirementAge}
              onChange={(value) => onHouseholdChange('spouseTargetRetirementAge', value)}
              placeholder="65"
              min={18}
              max={120}
            />
          </>
        ) : null}

        <OptionGroup
          label="What lifestyle are you planning for in retirement?"
          name="retirementLifestyle"
          options={RETIREMENT_LIFESTYLE_OPTIONS}
          value={vision.retirementLifestyle}
          onChange={(value) => onVisionChange('retirementLifestyle', value)}
          required
        />
        <OptionGroup
          label="How clear is your retirement plan today?"
          name="planClarity"
          options={RETIREMENT_PLAN_CLARITY_OPTIONS}
          value={vision.planClarity}
          onChange={(value) => onVisionChange('planClarity', value)}
          required
        />
        <OptionGroup
          label="What is your primary retirement motivation?"
          name="primaryMotivation"
          options={RETIREMENT_PRIMARY_MOTIVATION_OPTIONS}
          value={vision.primaryMotivation}
          onChange={(value) => onVisionChange('primaryMotivation', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
