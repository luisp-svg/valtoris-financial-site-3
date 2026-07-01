import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AssessmentLayout from '../components/assessment/AssessmentLayout'
import NavigationButtons from '../components/assessment/NavigationButtons'
import { DEMO_ANSWERS_STORAGE_KEY, DEMO_ASSESSMENT_STEPS } from '../components/assessment/constants'
import StepFiveGoals from '../components/assessment/steps/StepFiveGoals'
import StepFourProtection from '../components/assessment/steps/StepFourProtection'
import StepThreeFinancial from '../components/assessment/steps/StepThreeFinancial'
import StepTwoFamily from '../components/assessment/steps/StepTwoFamily'
import StepWelcome from '../components/assessment/steps/StepWelcome'
import {
  DemoAssessmentAnswers,
  FamilyAnswers,
  FinancialAnswers,
  INITIAL_DEMO_ANSWERS,
  ProtectionAnswers,
  isDemoStepComplete,
} from '../components/assessment/types'

export default function FinancialProtectionAssessment() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [answers, setAnswers] = useState<DemoAssessmentAnswers>(INITIAL_DEMO_ANSWERS)

  const canContinue = useMemo(
    () => isDemoStepComplete(currentStep, answers),
    [currentStep, answers],
  )

  function updateFamily(field: keyof FamilyAnswers, value: string) {
    setAnswers((current) => ({
      ...current,
      family: { ...current.family, [field]: value },
    }))
  }

  function updateFinancial(field: keyof FinancialAnswers, value: string) {
    setAnswers((current) => ({
      ...current,
      financial: { ...current.financial, [field]: value },
    }))
  }

  function updateProtection(field: keyof ProtectionAnswers, value: string) {
    setAnswers((current) => ({
      ...current,
      protection: { ...current.protection, [field]: value },
    }))
  }

  function updateGoals(selected: string[]) {
    setAnswers((current) => ({
      ...current,
      goals: { selected },
    }))
  }

  function handleBack() {
    if (currentStep === 1) {
      navigate('/')
      return
    }
    setCurrentStep((step) => step - 1)
  }

  function handleContinue() {
    if (!canContinue) return

    if (currentStep < DEMO_ASSESSMENT_STEPS) {
      setCurrentStep((step) => step + 1)
      return
    }

    sessionStorage.setItem(DEMO_ANSWERS_STORAGE_KEY, JSON.stringify(answers))
    navigate('/results', { state: { answers } })
  }

  return (
    <AssessmentLayout
      currentStep={currentStep}
      totalSteps={DEMO_ASSESSMENT_STEPS}
      footer={
        currentStep === 1 ? null : (
          <NavigationButtons
            onBack={handleBack}
            onContinue={handleContinue}
            continueDisabled={!canContinue}
            continueLabel={currentStep === DEMO_ASSESSMENT_STEPS ? 'View My Report Card' : 'Continue'}
          />
        )
      }
    >
      {currentStep === 1 && <StepWelcome onBegin={() => setCurrentStep(2)} />}
      {currentStep === 2 && <StepTwoFamily answers={answers.family} onChange={updateFamily} />}
      {currentStep === 3 && (
        <StepThreeFinancial answers={answers.financial} onChange={updateFinancial} />
      )}
      {currentStep === 4 && (
        <StepFourProtection answers={answers.protection} onChange={updateProtection} />
      )}
      {currentStep === 5 && (
        <StepFiveGoals answers={answers.goals} onChange={updateGoals} />
      )}
    </AssessmentLayout>
  )
}
