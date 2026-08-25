import CurrencyInput from '../../CurrencyInput'
import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import YesNoInput from '../../YesNoInput'
import { localizedOptions, type ReportCardCopyFn } from '../../reportCardLocale'
import {
  LEGACY_INTENT_OPTIONS,
  LONG_TERM_CARE_OPTIONS,
  MEDICARE_READINESS_OPTIONS,
} from '../../retirement/constants'
import { RetirementEstateAnswers, RetirementHealthcareAnswers } from '../../retirement/types'

type StepRetirementHealthcareLegacyProps = {
  t: ReportCardCopyFn
  healthcare: RetirementHealthcareAnswers
  estate: RetirementEstateAnswers
  onHealthcareChange: (field: keyof RetirementHealthcareAnswers, value: string) => void
  onEstateChange: (field: keyof RetirementEstateAnswers, value: string) => void
}

export default function StepRetirementHealthcareLegacy({
  t,
  healthcare,
  estate,
  onHealthcareChange,
  onEstateChange,
}: StepRetirementHealthcareLegacyProps) {
  const yesLabel = t('answers', 'yes')
  const noLabel = t('answers', 'no')

  return (
    <QuestionCard title={t('ui', 'step8Title')} description={t('helpers', 'step8')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <h3 className="assessment-section-heading">{t('fields', 'healthcareHeading')}</h3>
        <OptionGroup
          label={t('fields', 'medicareReadiness')}
          name="medicareReadiness"
          options={localizedOptions(MEDICARE_READINESS_OPTIONS, t, 'medicareReadiness')}
          value={healthcare.medicareReadiness}
          onChange={(value) => onHealthcareChange('medicareReadiness', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'longTermCarePlan')}
          name="longTermCarePlan"
          options={localizedOptions(LONG_TERM_CARE_OPTIONS, t, 'longTermCarePlan')}
          value={healthcare.longTermCarePlan}
          onChange={(value) => onHealthcareChange('longTermCarePlan', value)}
          required
        />
        <CurrencyInput
          label={t('fields', 'hsaBalance')}
          name="hsaBalance"
          value={healthcare.hsaBalance}
          onChange={(value) => onHealthcareChange('hsaBalance', value)}
          placeholder={t('placeholders', 'hsa')}
          required
        />

        <h3 className="assessment-section-heading">{t('fields', 'estateHeading')}</h3>
        <YesNoInput
          label={t('fields', 'hasWill')}
          name="hasWill"
          value={estate.hasWill}
          onChange={(value) => onEstateChange('hasWill', value)}
          yesLabel={yesLabel}
          noLabel={noLabel}
          required
        />
        <YesNoInput
          label={t('fields', 'hasTrust')}
          name="hasTrust"
          value={estate.hasTrust}
          onChange={(value) => onEstateChange('hasTrust', value)}
          yesLabel={yesLabel}
          noLabel={noLabel}
          required
        />
        <YesNoInput
          label={t('fields', 'beneficiariesReviewed')}
          name="beneficiariesReviewed"
          value={estate.beneficiariesReviewed}
          onChange={(value) => onEstateChange('beneficiariesReviewed', value)}
          yesLabel={yesLabel}
          noLabel={noLabel}
          required
        />
        <YesNoInput
          label={t('fields', 'hasPowerOfAttorney')}
          name="hasPowerOfAttorney"
          value={estate.hasPowerOfAttorney}
          onChange={(value) => onEstateChange('hasPowerOfAttorney', value)}
          yesLabel={yesLabel}
          noLabel={noLabel}
          required
        />
        <OptionGroup
          label={t('fields', 'legacyIntent')}
          name="legacyIntent"
          options={localizedOptions(LEGACY_INTENT_OPTIONS, t, 'legacyIntent')}
          value={estate.legacyIntent}
          onChange={(value) => onEstateChange('legacyIntent', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
