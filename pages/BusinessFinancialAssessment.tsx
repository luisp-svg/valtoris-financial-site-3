import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import AssessmentLayout from '../components/assessment/AssessmentLayout'
import NavigationButtons from '../components/assessment/NavigationButtons'
import { BUSINESS_ASSESSMENT_STEPS } from '../components/assessment/business/constants'
import {
  BusinessAssessmentAnswers,
  INITIAL_BUSINESS_ANSWERS,
  isBusinessStepComplete,
} from '../components/assessment/business/types'
import { submitBusinessReportCardLead } from '../components/reportCard/submitReportCardLead'
import StepBusinessWelcome from '../components/assessment/steps/business/StepBusinessWelcome'
import StepBusinessInformation from '../components/assessment/steps/business/StepBusinessInformation'
import StepBusinessFoundation from '../components/assessment/steps/business/StepBusinessFoundation'
import StepCashFlowTax from '../components/assessment/steps/business/StepCashFlowTax'
import StepProtectionRisk from '../components/assessment/steps/business/StepProtectionRisk'
import StepRetirementFundingExit from '../components/assessment/steps/business/StepRetirementFundingExit'
import {
  BUSINESS_ANSWERS_STORAGE_KEY,
  BUSINESS_REPORT_STORAGE_KEY,
} from '../components/business/constants'

export default function BusinessFinancialAssessment() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [answers, setAnswers] = useState<BusinessAssessmentAnswers>(INITIAL_BUSINESS_ANSWERS)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const answersRef = useRef(answers)

  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  const canContinue = useMemo(
    () => isBusinessStepComplete(currentStep, answers),
    [currentStep, answers],
  )

  function updateOwner(field: keyof BusinessAssessmentAnswers['owner'], value: string) {
    setAnswers((current) => ({
      ...current,
      owner: { ...current.owner, [field]: value },
    }))
  }

  function updateBusiness(field: keyof BusinessAssessmentAnswers['business'], value: string) {
    setAnswers((current) => ({
      ...current,
      business: { ...current.business, [field]: value },
    }))
  }

  function updateFoundation(field: keyof BusinessAssessmentAnswers['foundation'], value: string) {
    setAnswers((current) => ({
      ...current,
      foundation: { ...current.foundation, [field]: value },
    }))
  }

  function updateCashFlowTax(field: keyof BusinessAssessmentAnswers['cashFlowTax'], value: string) {
    setAnswers((current) => {
      const next = { ...current.cashFlowTax, [field]: value }
      if (field === 'acceptsCardPayments' && value === 'no') {
        next.cardSalesPercentage = ''
        next.estimatedProcessingRate = ''
        next.lastProcessingReview = ''
      }
      return { ...current, cashFlowTax: next }
    })
  }

  function updateProtectionRisk(
    field: keyof BusinessAssessmentAnswers['protectionRisk'],
    value: string,
  ) {
    setAnswers((current) => ({
      ...current,
      protectionRisk: { ...current.protectionRisk, [field]: value },
    }))
  }

  function updateRetirementFundingExit(
    field: keyof BusinessAssessmentAnswers['retirementFundingExit'],
    value: string,
  ) {
    setAnswers((current) => ({
      ...current,
      retirementFundingExit: { ...current.retirementFundingExit, [field]: value },
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
      navigate(ROUTES.businessReportCard)
      return
    }
    setCurrentStep((step) => step - 1)
  }

  async function completeBusinessAssessment(finalAnswers: BusinessAssessmentAnswers) {
    console.log('BUSINESS SUBMIT START')

    try {
      sessionStorage.setItem(BUSINESS_ANSWERS_STORAGE_KEY, JSON.stringify(finalAnswers))
      sessionStorage.setItem(
        BUSINESS_REPORT_STORAGE_KEY,
        JSON.stringify({ businessName: finalAnswers.business.name.trim() }),
      )

      const submission = await submitBusinessReportCardLead(finalAnswers)
      if (!submission.ok) {
        console.error('Google Sheets submission failed:', submission.error)
      }
    } catch (error) {
      console.error('Google Sheets submission failed:', error)
    } finally {
      console.log('NAVIGATING TO BUSINESS RESULTS')
      navigate(ROUTES.businessReportCardResults, { state: { answers: finalAnswers } })
    }
  }

  async function handleContinue() {
    if (!canContinue || isSubmitting) return

    if (currentStep < BUSINESS_ASSESSMENT_STEPS) {
      setCurrentStep((step) => step + 1)
      return
    }

    setIsSubmitting(true)
    await completeBusinessAssessment(answersRef.current)
  }

  return (
    <AssessmentLayout
      currentStep={currentStep}
      totalSteps={BUSINESS_ASSESSMENT_STEPS}
      footer={
        currentStep === 1 ? null : (
          <NavigationButtons
            onBack={handleBack}
            onContinue={handleContinue}
            continueDisabled={!canContinue || isSubmitting}
            continueLabel={
              isSubmitting
                ? 'Saving...'
                : currentStep === BUSINESS_ASSESSMENT_STEPS
                  ? 'View My Report Card'
                  : 'Continue'
            }
          />
        )
      }
    >
      {currentStep === 1 && <StepBusinessWelcome onBegin={() => setCurrentStep(2)} />}
      {currentStep === 2 && (
        <StepBusinessInformation
          owner={answers.owner}
          business={answers.business}
          onOwnerChange={updateOwner}
          onBusinessChange={updateBusiness}
        />
      )}
      {currentStep === 3 && (
        <StepBusinessFoundation answers={answers.foundation} onChange={updateFoundation} />
      )}
      {currentStep === 4 && (
        <StepCashFlowTax answers={answers.cashFlowTax} onChange={updateCashFlowTax} />
      )}
      {currentStep === 5 && (
        <StepProtectionRisk answers={answers.protectionRisk} onChange={updateProtectionRisk} />
      )}
      {currentStep === 6 && (
        <StepRetirementFundingExit
          answers={answers.retirementFundingExit}
          goals={answers.goals}
          onChange={updateRetirementFundingExit}
          onGoalsChange={updateGoals}
        />
      )}
    </AssessmentLayout>
  )
}
