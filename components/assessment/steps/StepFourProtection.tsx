import CurrencyInput from '../CurrencyInput'
import QuestionCard from '../QuestionCard'
import YesNoInput from '../YesNoInput'
import type { ReportCardCopyFn } from '../reportCardLocale'
import { ProtectionAnswers } from '../types'

type StepFourProtectionProps = {
  answers: ProtectionAnswers
  onChange: (field: keyof ProtectionAnswers, value: string) => void
  t: ReportCardCopyFn
}

export default function StepFourProtection({ answers, onChange, t }: StepFourProtectionProps) {
  const yesLabel = t('answers', 'yes')
  const noLabel = t('answers', 'no')

  return (
    <QuestionCard title={t('ui', 'step4Title')} description={t('helpers', 'step4')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <CurrencyInput
          label={t('fields', 'currentLifeInsurance')}
          name="currentLifeInsurance"
          value={answers.currentLifeInsurance}
          onChange={(value) => onChange('currentLifeInsurance', value)}
          placeholder={t('placeholders', 'lifeInsurance')}
          required
        />
        <YesNoInput
          label={t('fields', 'hasDisabilityProtection')}
          name="hasDisabilityProtection"
          value={answers.hasDisabilityProtection}
          onChange={(value) => onChange('hasDisabilityProtection', value)}
          yesLabel={yesLabel}
          noLabel={noLabel}
          required
        />
        <YesNoInput
          label={t('fields', 'hasWill')}
          name="hasWill"
          value={answers.hasWill}
          onChange={(value) => onChange('hasWill', value)}
          yesLabel={yesLabel}
          noLabel={noLabel}
          required
        />
        <YesNoInput
          label={t('fields', 'hasTrust')}
          name="hasTrust"
          value={answers.hasTrust}
          onChange={(value) => onChange('hasTrust', value)}
          yesLabel={yesLabel}
          noLabel={noLabel}
          required
        />
        <YesNoInput
          label={t('fields', 'beneficiariesReviewed')}
          name="beneficiariesReviewed"
          value={answers.beneficiariesReviewed}
          onChange={(value) => onChange('beneficiariesReviewed', value)}
          yesLabel={yesLabel}
          noLabel={noLabel}
          required
        />
      </form>
    </QuestionCard>
  )
}
