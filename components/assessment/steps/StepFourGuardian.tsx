import QuestionCard from '../QuestionCard'
import YesNoInput from '../YesNoInput'
import type { ReportCardCopyFn } from '../reportCardLocale'
import { ProtectionAnswers } from '../types'

type StepFourGuardianProps = {
  answers: ProtectionAnswers
  onChange: (field: keyof ProtectionAnswers, value: string) => void
  t: ReportCardCopyFn
}

export default function StepFourGuardian({ answers, onChange, t }: StepFourGuardianProps) {
  return (
    <QuestionCard title={t('ui', 'step4GuardianTitle')} description={t('helpers', 'step4Guardian')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <YesNoInput
          label={t('fields', 'guardianDocumented')}
          name="guardianDocumented"
          value={answers.guardianDocumented}
          onChange={(value) => onChange('guardianDocumented', value)}
          yesLabel={t('answers', 'yes')}
          noLabel={t('answers', 'no')}
          required
        />
      </form>
    </QuestionCard>
  )
}
