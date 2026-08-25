import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import SelectInput from '../../SelectInput'
import TextInput from '../../TextInput'
import { MARITAL_STATUS_OPTIONS, US_STATES } from '../../constants'
import { localizedOptions, type ReportCardCopyFn } from '../../reportCardLocale'
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
  t: ReportCardCopyFn
  household: RetirementHouseholdAnswers
  vision: RetirementVisionAnswers
  onHouseholdChange: (field: keyof RetirementHouseholdAnswers, value: string) => void
  onVisionChange: (field: keyof RetirementVisionAnswers, value: string) => void
}

export default function StepRetirementHousehold({
  t,
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
    <QuestionCard title={t('ui', 'step2Title')} description={t('helpers', 'step2')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <SelectInput
          label={t('fields', 'state')}
          name="state"
          value={household.state}
          onChange={(value) => onHouseholdChange('state', value)}
          options={US_STATES}
          required
        />
        <SelectInput
          label={t('fields', 'maritalStatus')}
          name="maritalStatus"
          value={household.maritalStatus}
          onChange={(value) => onHouseholdChange('maritalStatus', value)}
          options={localizedOptions(MARITAL_STATUS_OPTIONS, t, 'maritalStatus')}
          required
        />
        <OptionGroup
          label={t('fields', 'alreadyRetired')}
          name="alreadyRetired"
          options={localizedOptions(ALREADY_RETIRED_OPTIONS, t, 'alreadyRetired')}
          value={household.alreadyRetired}
          onChange={(value) => onHouseholdChange('alreadyRetired', value)}
          required
        />
        <TextInput
          label={t('fields', 'currentAge')}
          name="currentAge"
          type="number"
          value={household.currentAge}
          onChange={(value) => onHouseholdChange('currentAge', value)}
          placeholder={t('placeholders', 'currentAge')}
          min={18}
          max={120}
          required
        />
        {!alreadyRetired ? (
          <TextInput
            label={t('fields', 'targetRetirementAge')}
            name="targetRetirementAge"
            type="number"
            value={household.targetRetirementAge}
            onChange={(value) => onHouseholdChange('targetRetirementAge', value)}
            placeholder={t('placeholders', 'targetRetirementAge')}
            min={18}
            max={120}
            required
          />
        ) : (
          <p className="funnel-microcopy assessment-note">
            {t('helpers', 'alreadyRetiredNote')}
          </p>
        )}
        {showAgeWarning ? (
          <p className="assessment-validation-message" role="alert">
            {t('validation', 'ageOrder')}
          </p>
        ) : null}
        {showSpouse ? (
          <>
            <TextInput
              label={t('fields', 'spouseAge')}
              name="spouseAge"
              type="number"
              value={household.spouseAge}
              onChange={(value) => onHouseholdChange('spouseAge', value)}
              placeholder={t('placeholders', 'spouseAge')}
              min={18}
              max={120}
            />
            <TextInput
              label={t('fields', 'spouseTargetRetirementAge')}
              name="spouseTargetRetirementAge"
              type="number"
              value={household.spouseTargetRetirementAge}
              onChange={(value) => onHouseholdChange('spouseTargetRetirementAge', value)}
              placeholder={t('placeholders', 'spouseTargetRetirementAge')}
              min={18}
              max={120}
            />
          </>
        ) : null}

        <OptionGroup
          label={t('fields', 'retirementLifestyle')}
          name="retirementLifestyle"
          options={localizedOptions(RETIREMENT_LIFESTYLE_OPTIONS, t, 'retirementLifestyle')}
          value={vision.retirementLifestyle}
          onChange={(value) => onVisionChange('retirementLifestyle', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'planClarity')}
          name="planClarity"
          options={localizedOptions(RETIREMENT_PLAN_CLARITY_OPTIONS, t, 'planClarity')}
          value={vision.planClarity}
          onChange={(value) => onVisionChange('planClarity', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'primaryMotivation')}
          name="primaryMotivation"
          options={localizedOptions(RETIREMENT_PRIMARY_MOTIVATION_OPTIONS, t, 'primaryMotivation')}
          value={vision.primaryMotivation}
          onChange={(value) => onVisionChange('primaryMotivation', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
