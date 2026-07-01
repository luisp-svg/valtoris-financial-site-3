import ChoiceGroup from '../ChoiceGroup'
import QuestionCard from '../QuestionCard'
import { GOAL_OPTIONS } from '../constants'
import { GoalsAnswers } from '../types'

type StepFiveGoalsProps = {
  answers: GoalsAnswers
  onChange: (selected: string[]) => void
}

export default function StepFiveGoals({ answers, onChange }: StepFiveGoalsProps) {
  return (
    <QuestionCard
      title="Goals"
      description="Select all the goals that matter most to your family right now."
    >
      <ChoiceGroup
        label="What are you working toward?"
        name="goals"
        options={GOAL_OPTIONS}
        selected={answers.selected}
        onChange={onChange}
        required
      />
    </QuestionCard>
  )
}
