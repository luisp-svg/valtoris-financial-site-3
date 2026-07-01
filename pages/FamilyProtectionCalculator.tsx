import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NavigationButtons from '../components/assessment/NavigationButtons'
import CalculatorLayout from '../components/calculator/CalculatorLayout'
import { CALCULATOR_STORAGE_KEY, CALCULATOR_TOTAL_STEPS } from '../components/calculator/constants'
import { submitCalculatorToGoogleSheets } from '../components/calculator/submitCalculatorResults'
import { CALCULATOR_SUBMISSION_WARNING } from '../constants/urls'
import CalcStepFiveEducation from '../components/calculator/steps/CalcStepFiveEducation'
import CalcStepFourDebt from '../components/calculator/steps/CalcStepFourDebt'
import CalcStepOneFamily from '../components/calculator/steps/CalcStepOneFamily'
import CalcStepSevenCoverage from '../components/calculator/steps/CalcStepSevenCoverage'
import CalcStepSixFinalExpenses from '../components/calculator/steps/CalcStepSixFinalExpenses'
import CalcStepThreeHousing from '../components/calculator/steps/CalcStepThreeHousing'
import CalcStepTwoIncome from '../components/calculator/steps/CalcStepTwoIncome'
import {
  CalculatorAnswers,
  INITIAL_CALCULATOR_ANSWERS,
  isCalculatorStepComplete,
} from '../components/calculator/types'

export default function FamilyProtectionCalculator() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [answers, setAnswers] = useState<CalculatorAnswers>(INITIAL_CALCULATOR_ANSWERS)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canContinue = useMemo(
    () => isCalculatorStepComplete(currentStep, answers),
    [currentStep, answers],
  )

  useEffect(() => {
    if (currentStep === 5 && !answers.education.numberOfChildren) {
      setAnswers((current) => ({
        ...current,
        education: {
          ...current.education,
          numberOfChildren: current.family.numberOfChildren,
        },
      }))
    }
  }, [currentStep, answers.education.numberOfChildren, answers.family.numberOfChildren])

  function updateSection<K extends keyof CalculatorAnswers>(
    section: K,
    field: keyof CalculatorAnswers[K],
    value: string,
  ) {
    setAnswers((current) => ({
      ...current,
      [section]: { ...current[section], [field]: value },
    }))
  }

  function handleBack() {
    if (currentStep === 1) {
      navigate('/')
      return
    }
    setCurrentStep((step) => step - 1)
  }

  async function handleContinue() {
    if (!canContinue || isSubmitting) return

    if (currentStep < CALCULATOR_TOTAL_STEPS) {
      setCurrentStep((step) => step + 1)
      return
    }

    setIsSubmitting(true)
    sessionStorage.setItem(CALCULATOR_STORAGE_KEY, JSON.stringify(answers))

    const submission = await submitCalculatorToGoogleSheets(answers)
    let submissionWarning: string | undefined

    if (!submission.ok) {
      console.error('Google Sheets submission failed:', submission.error)
      submissionWarning = CALCULATOR_SUBMISSION_WARNING
    }

    navigate('/protection-results', {
      state: { answers, submissionWarning },
    })
  }

  return (
    <CalculatorLayout
      currentStep={currentStep}
      footer={
        <NavigationButtons
          onBack={handleBack}
          onContinue={handleContinue}
          continueDisabled={!canContinue || isSubmitting}
          continueLabel={
            isSubmitting
              ? 'Saving...'
              : currentStep === CALCULATOR_TOTAL_STEPS
                ? 'View My Protection Analysis'
                : 'Continue'
          }
        />
      }
    >
      {currentStep === 1 && (
        <CalcStepOneFamily
          answers={answers.family}
          onChange={(field, value) => updateSection('family', field, value)}
        />
      )}
      {currentStep === 2 && (
        <CalcStepTwoIncome
          answers={answers.income}
          onChange={(field, value) => updateSection('income', field, value)}
        />
      )}
      {currentStep === 3 && (
        <CalcStepThreeHousing
          answers={answers.housing}
          onChange={(field, value) => updateSection('housing', field, value)}
        />
      )}
      {currentStep === 4 && (
        <CalcStepFourDebt
          answers={answers.debt}
          allAnswers={answers}
          onChange={(field, value) => updateSection('debt', field, value)}
        />
      )}
      {currentStep === 5 && (
        <CalcStepFiveEducation
          answers={answers.education}
          onChange={(field, value) => updateSection('education', field, value)}
        />
      )}
      {currentStep === 6 && (
        <CalcStepSixFinalExpenses
          answers={answers.finalExpenses}
          onChange={(field, value) => updateSection('finalExpenses', field, value)}
        />
      )}
      {currentStep === 7 && (
        <CalcStepSevenCoverage
          answers={answers.coverage}
          onChange={(field, value) => updateSection('coverage', field, value)}
        />
      )}
    </CalculatorLayout>
  )
}
