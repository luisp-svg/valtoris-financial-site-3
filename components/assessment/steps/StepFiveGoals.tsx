import ChoiceGroup from '../ChoiceGroup'
import QuestionCard from '../QuestionCard'
import { GOAL_OPTIONS } from '../constants'
import { localizedOptions, type ReportCardCopyFn } from '../reportCardLocale'
import { GoalsAnswers } from '../types'

type StepFiveGoalsProps = {
  answers: GoalsAnswers
  onChange: (selected: string[]) => void
  t: ReportCardCopyFn
}

export default function StepFiveGoals({ answers, onChange, t }: StepFiveGoalsProps) {
  return (
    <QuestionCard title={t('ui', 'step5Title')} description={t('helpers', 'step5')}>
      <ChoiceGroup
        label={t('fields', 'goals')}
        name="goals"
        options={localizedOptions(GOAL_OPTIONS, t, 'goals')}
        selected={answers.selected}
        onChange={onChange}
        required
      />
    </QuestionCard>
  )
}
