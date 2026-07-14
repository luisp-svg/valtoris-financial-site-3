import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { CALCULATOR_SUBMISSION_WARNING } from '../constants/urls'
import AssessmentLayout from '../components/assessment/AssessmentLayout'
import NavigationButtons from '../components/assessment/NavigationButtons'
import {
  RETIREMENT_ANSWERS_STORAGE_KEY,
  RETIREMENT_ASSESSMENT_STEPS,
} from '../components/assessment/retirement/constants'
import {
  INITIAL_RETIREMENT_ANSWERS,
  RetirementAssessmentAnswers,
  isRetirementStepComplete,
} from '../components/assessment/retirement/types'
import { submitRetirementReportCardLead } from '../components/reportCard/submitReportCardLead'
import StepRetirementWelcome from '../components/assessment/steps/retirement/StepRetirementWelcome'
import StepRetirementHousehold from '../components/assessment/steps/retirement/StepRetirementHousehold'
import StepRetirementSpending from '../components/assessment/steps/retirement/StepRetirementSpending'
import StepRetirementSavings from '../components/assessment/steps/retirement/StepRetirementSavings'
import StepRetirementIncomeSources from '../components/assessment/steps/retirement/StepRetirementIncomeSources'
import StepRetirementSustainability from '../components/assessment/steps/retirement/StepRetirementSustainability'
import StepRetirementInvestmentsTax from '../components/assessment/steps/retirement/StepRetirementInvestmentsTax'
import StepRetirementHealthcareLegacy from '../components/assessment/steps/retirement/StepRetirementHealthcareLegacy'
import StepRetirementContact from '../components/assessment/steps/retirement/StepRetirementContact'

export default function RetirementAssessment() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [answers, setAnswers] = useState<RetirementAssessmentAnswers>(INITIAL_RETIREMENT_ANSWERS)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const answersRef = useRef(answers)

  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  const canContinue = useMemo(
    () => isRetirementStepComplete(currentStep, answers),
    [currentStep, answers],
  )

  function updateHousehold(
    field: keyof RetirementAssessmentAnswers['household'],
    value: string,
  ) {
    setAnswers((current) => {
      const nextHousehold = { ...current.household, [field]: value }
      if (field === 'maritalStatus' && value !== 'married') {
        nextHousehold.spouseAge = ''
        nextHousehold.spouseTargetRetirementAge = ''
      }
      if (field === 'alreadyRetired' && value === 'yes') {
        // Keep any existing target age for reference but it is not required.
      }
      return { ...current, household: nextHousehold }
    })
  }

  function updateVision(field: keyof RetirementAssessmentAnswers['vision'], value: string) {
    setAnswers((current) => ({
      ...current,
      vision: { ...current.vision, [field]: value },
    }))
  }

  function updateLifestyle(field: keyof RetirementAssessmentAnswers['lifestyle'], value: string) {
    setAnswers((current) => ({
      ...current,
      lifestyle: { ...current.lifestyle, [field]: value },
    }))
  }

  function updateSavings(field: keyof RetirementAssessmentAnswers['savings'], value: string) {
    setAnswers((current) => ({
      ...current,
      savings: { ...current.savings, [field]: value },
    }))
  }

  function updateIncomeSources(
    field: keyof RetirementAssessmentAnswers['incomeSources'],
    value: string,
  ) {
    setAnswers((current) => {
      const next = { ...current.incomeSources, [field]: value }
      if (field === 'expectsPartTimeWork' && value !== 'yes') {
        next.estimatedMonthlyPartTimeIncome = ''
        next.expectedPartTimeWorkYears = ''
      }
      return { ...current, incomeSources: next }
    })
  }

  function updateInvestments(
    field: keyof RetirementAssessmentAnswers['investments'],
    value: string,
  ) {
    setAnswers((current) => ({
      ...current,
      investments: { ...current.investments, [field]: value },
    }))
  }

  function updateTax(field: keyof RetirementAssessmentAnswers['tax'], value: string) {
    setAnswers((current) => ({
      ...current,
      tax: { ...current.tax, [field]: value },
    }))
  }

  function updateAccountTypes(selected: string[]) {
    setAnswers((current) => ({
      ...current,
      tax: { ...current.tax, accountTypes: selected },
    }))
  }

  function updateHealthcare(
    field: keyof RetirementAssessmentAnswers['healthcare'],
    value: string,
  ) {
    setAnswers((current) => ({
      ...current,
      healthcare: { ...current.healthcare, [field]: value },
    }))
  }

  function updateEstate(field: keyof RetirementAssessmentAnswers['estate'], value: string) {
    setAnswers((current) => ({
      ...current,
      estate: { ...current.estate, [field]: value },
    }))
  }

  function updateGoals(selected: string[]) {
    setAnswers((current) => ({
      ...current,
      goals: { selected },
    }))
  }

  function updateLeadDetails(
    field: keyof RetirementAssessmentAnswers['leadDetails'],
    value: string,
  ) {
    setAnswers((current) => ({
      ...current,
      leadDetails: { ...current.leadDetails, [field]: value },
    }))
  }

  function handleBack() {
    if (currentStep === 1) {
      navigate(ROUTES.retirementReportCard)
      return
    }
    setCurrentStep((step) => step - 1)
  }

  async function completeRetirementAssessment(finalAnswers: RetirementAssessmentAnswers) {
    let submissionWarning: string | undefined

    try {
      sessionStorage.setItem(RETIREMENT_ANSWERS_STORAGE_KEY, JSON.stringify(finalAnswers))

      const submission = await submitRetirementReportCardLead(finalAnswers)
      if (!submission.ok) {
        console.error('Google Sheets submission failed:', submission.error)
        submissionWarning = CALCULATOR_SUBMISSION_WARNING
      }
    } catch (error) {
      console.error('Google Sheets submission failed:', error)
      submissionWarning = CALCULATOR_SUBMISSION_WARNING
    } finally {
      navigate(ROUTES.retirementReportCardResults, {
        state: { answers: finalAnswers, submissionWarning },
      })
    }
  }

  async function handleContinue() {
    if (!canContinue || isSubmitting) return

    if (currentStep < RETIREMENT_ASSESSMENT_STEPS) {
      setCurrentStep((step) => step + 1)
      return
    }

    setIsSubmitting(true)
    await completeRetirementAssessment(answersRef.current)
  }

  return (
    <AssessmentLayout
      currentStep={currentStep}
      totalSteps={RETIREMENT_ASSESSMENT_STEPS}
      footer={
        currentStep === 1 ? null : (
          <NavigationButtons
            onBack={handleBack}
            onContinue={handleContinue}
            continueDisabled={!canContinue || isSubmitting}
            continueLabel={
              isSubmitting
                ? 'Saving...'
                : currentStep === RETIREMENT_ASSESSMENT_STEPS
                  ? 'View My Retirement Report Card'
                  : 'Continue'
            }
          />
        )
      }
    >
      {currentStep === 1 && (
        <StepRetirementWelcome
          onBegin={() => setCurrentStep(2)}
          onBack={() => navigate(ROUTES.retirementReportCard)}
        />
      )}
      {currentStep === 2 && (
        <StepRetirementHousehold
          household={answers.household}
          vision={answers.vision}
          onHouseholdChange={updateHousehold}
          onVisionChange={updateVision}
        />
      )}
      {currentStep === 3 && (
        <StepRetirementSpending lifestyle={answers.lifestyle} onChange={updateLifestyle} />
      )}
      {currentStep === 4 && (
        <StepRetirementSavings savings={answers.savings} onChange={updateSavings} />
      )}
      {currentStep === 5 && (
        <StepRetirementIncomeSources
          household={answers.household}
          incomeSources={answers.incomeSources}
          onChange={updateIncomeSources}
        />
      )}
      {currentStep === 6 && (
        <StepRetirementSustainability
          goals={answers.goals}
          incomeSources={answers.incomeSources}
          onGoalsChange={updateGoals}
          onIncomeSourcesChange={updateIncomeSources}
        />
      )}
      {currentStep === 7 && (
        <StepRetirementInvestmentsTax
          investments={answers.investments}
          tax={answers.tax}
          onInvestmentsChange={updateInvestments}
          onTaxChange={updateTax}
          onAccountTypesChange={updateAccountTypes}
        />
      )}
      {currentStep === 8 && (
        <StepRetirementHealthcareLegacy
          healthcare={answers.healthcare}
          estate={answers.estate}
          onHealthcareChange={updateHealthcare}
          onEstateChange={updateEstate}
        />
      )}
      {currentStep === 9 && (
        <StepRetirementContact
          household={answers.household}
          leadDetails={answers.leadDetails}
          onHouseholdChange={updateHousehold}
          onLeadDetailsChange={updateLeadDetails}
        />
      )}
    </AssessmentLayout>
  )
}
