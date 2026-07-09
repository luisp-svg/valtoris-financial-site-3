import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import AssessmentLayout from '../components/assessment/AssessmentLayout'
import NavigationButtons from '../components/assessment/NavigationButtons'
import { DEMO_ANSWERS_STORAGE_KEY, DEMO_ASSESSMENT_STEPS } from '../components/assessment/constants'
import { submitFamilyReportCardLead } from '../components/reportCard/submitReportCardLead'
import StepFiveGoals from '../components/assessment/steps/StepFiveGoals'
import StepFourGuardian from '../components/assessment/steps/StepFourGuardian'
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
  isGuardianComplete,
} from '../components/assessment/types'

function childCount(family: FamilyAnswers): number {
  const count = Number.parseInt(family.numberOfChildren, 10)
  return Number.isFinite(count) && count > 0 ? count : 0
}

export default function FinancialProtectionAssessment() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [protectionSubStep, setProtectionSubStep] = useState<1 | 2>(1)
  const [answers, setAnswers] = useState<DemoAssessmentAnswers>(INITIAL_DEMO_ANSWERS)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const answersRef = useRef(answers)
  const previousStepRef = useRef(currentStep)

  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  const hasChildren = childCount(answers.family) > 0

  useEffect(() => {
    if (currentStep === 4 && previousStepRef.current !== 4) {
      setProtectionSubStep(1)
    }
    previousStepRef.current = currentStep
  }, [currentStep])

  const canContinue = useMemo(() => {
    if (currentStep === 4 && protectionSubStep === 2) {
      return isGuardianComplete(answers.protection)
    }
    return isDemoStepComplete(currentStep, answers)
  }, [currentStep, protectionSubStep, answers])

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
    if (currentStep === 4 && protectionSubStep === 2) {
      setProtectionSubStep(1)
      return
    }

    if (currentStep === 1) {
      navigate(ROUTES.reportCard)
      return
    }
    setCurrentStep((step) => step - 1)
  }

  async function completeFamilyAssessment(finalAnswers: DemoAssessmentAnswers) {
    console.log('FAMILY SUBMIT START')

    try {
      sessionStorage.setItem(DEMO_ANSWERS_STORAGE_KEY, JSON.stringify(finalAnswers))

      const submission = await submitFamilyReportCardLead(finalAnswers)
      if (!submission.ok) {
        console.error('Google Sheets submission failed:', submission.error)
      }
    } catch (error) {
      console.error('Google Sheets submission failed:', error)
    } finally {
      console.log('NAVIGATING TO FAMILY RESULTS')
      navigate(ROUTES.reportCardResults, { state: { answers: finalAnswers } })
    }
  }

  async function handleContinue() {
    if (!canContinue || isSubmitting) return

    if (currentStep === 4 && protectionSubStep === 1 && hasChildren) {
      setProtectionSubStep(2)
      return
    }

    if (currentStep < DEMO_ASSESSMENT_STEPS) {
      setCurrentStep((step) => step + 1)
      return
    }

    setIsSubmitting(true)
    await completeFamilyAssessment(answersRef.current)
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
            continueDisabled={!canContinue || isSubmitting}
            continueLabel={
              isSubmitting
                ? 'Saving...'
                : currentStep === DEMO_ASSESSMENT_STEPS
                  ? 'View My Report Card'
                  : 'Continue'
            }
          />
        )
      }
    >
      {currentStep === 1 && <StepWelcome onBegin={() => setCurrentStep(2)} />}
      {currentStep === 2 && <StepTwoFamily answers={answers.family} onChange={updateFamily} />}
      {currentStep === 3 && (
        <StepThreeFinancial answers={answers.financial} onChange={updateFinancial} />
      )}
      {currentStep === 4 && protectionSubStep === 1 && (
        <StepFourProtection answers={answers.protection} onChange={updateProtection} />
      )}
      {currentStep === 4 && protectionSubStep === 2 && (
        <StepFourGuardian answers={answers.protection} onChange={updateProtection} />
      )}
      {currentStep === 5 && (
        <StepFiveGoals answers={answers.goals} onChange={updateGoals} />
      )}
    </AssessmentLayout>
  )
}
