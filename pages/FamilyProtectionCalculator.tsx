import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import NavigationButtons from '../components/assessment/NavigationButtons'
import FamilyConsentSection from '../components/assessment/steps/FamilyConsentSection'
import CalculatorLayout from '../components/calculator/CalculatorLayout'
import { CALCULATOR_STORAGE_KEY, CALCULATOR_TOTAL_STEPS } from '../components/calculator/constants'
import { PROTECTION_CTA } from '../constants/homepage'
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
import { completePublicReportCardCrmSubmission } from '../components/reportCard/familyIngest/completeFamilyReportCardSubmission'
import {
  applyPhoneChangeToConsent,
  INITIAL_FAMILY_CONSENT_STATE,
  type FamilyConsentField,
  type FamilyConsentState,
} from '../components/reportCard/familyIngest/familyConsent'
import {
  beginNewFamilyAssessmentSession,
  ensureFamilyIngestSession,
  PROTECTION_INGEST_SESSION_KEY,
  type FamilyIngestSession,
} from '../components/reportCard/familyIngest/submissionSession'

export default function FamilyProtectionCalculator() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [answers, setAnswers] = useState<CalculatorAnswers>(INITIAL_CALCULATOR_ANSWERS)
  const [consent, setConsent] = useState<FamilyConsentState>(INITIAL_FAMILY_CONSENT_STATE)
  const [honeypotWebsite, setHoneypotWebsite] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [consentMissing, setConsentMissing] = useState<
    Array<'assessmentStorageAcknowledged' | 'privacyAcknowledged'>
  >([])
  const [showConsentErrors, setShowConsentErrors] = useState(false)
  const [ingestSession, setIngestSession] = useState<FamilyIngestSession>(() =>
    ensureFamilyIngestSession({
      search: typeof window === 'undefined' ? '' : window.location.search,
      referrer: typeof document === 'undefined' ? null : document.referrer || null,
      storageKey: PROTECTION_INGEST_SESSION_KEY,
    }),
  )
  const answersRef = useRef(answers)
  const consentRef = useRef(consent)
  const sessionRef = useRef(ingestSession)
  const honeypotRef = useRef(honeypotWebsite)

  useEffect(() => {
    answersRef.current = answers
  }, [answers])
  useEffect(() => {
    consentRef.current = consent
  }, [consent])
  useEffect(() => {
    sessionRef.current = ingestSession
  }, [ingestSession])
  useEffect(() => {
    honeypotRef.current = honeypotWebsite
  }, [honeypotWebsite])

  useEffect(() => {
    if (currentStep === 1 && !ingestSession.formStartedAt) {
      setIngestSession(
        beginNewFamilyAssessmentSession({
          search: typeof window === 'undefined' ? '' : window.location.search,
          referrer: typeof document === 'undefined' ? null : document.referrer || null,
          storageKey: PROTECTION_INGEST_SESSION_KEY,
        }),
      )
    }
  }, [currentStep, ingestSession.formStartedAt])

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
    if (section === 'family' && field === 'phone') {
      setConsent((prev) => applyPhoneChangeToConsent(prev, String(value)))
    }
  }

  function handleBack() {
    if (currentStep === 1) {
      navigate(ROUTES.protectionAnalysis)
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
    setSubmitError(null)
    sessionStorage.setItem(CALCULATOR_STORAGE_KEY, JSON.stringify(answers))

    const { result, session } = await completePublicReportCardCrmSubmission({
      assessmentType: 'protection',
      answers,
      consent: consentRef.current,
      session: sessionRef.current,
      honeypotWebsite: honeypotRef.current,
      storageKey: PROTECTION_INGEST_SESSION_KEY,
      phone: answers.family.phone,
    })
    setIngestSession(session)

    if (!result.ok) {
      if (result.code === 'consent_required') {
        setShowConsentErrors(true)
        setConsentMissing(result.consentMissing ?? [])
      }
      setSubmitError(result.error)
      setIsSubmitting(false)
      return
    }

    navigate(ROUTES.protectionResults, {
      state: { answers, submissionSaved: true, submissionId: result.submissionId },
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
              ? 'Saving your Protection Gap…'
              : currentStep === CALCULATOR_TOTAL_STEPS
                ? 'View My Protection Analysis'
                : currentStep === 1
                  ? PROTECTION_CTA
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
        <>
          <CalcStepSevenCoverage
            answers={answers.coverage}
            onChange={(field, value) => updateSection('coverage', field, value)}
          />
          <FamilyConsentSection
            consent={consent}
            phone={answers.family.phone}
            showErrors={showConsentErrors}
            missing={consentMissing}
            onChange={(field: FamilyConsentField, value: boolean) => {
              setConsent((current) => {
                if (field === 'smsMarketingConsent' && value && answers.family.phone.trim() === '') {
                  return current
                }
                return { ...current, [field]: value }
              })
              setShowConsentErrors(false)
              setConsentMissing([])
              setSubmitError(null)
            }}
            honeypotValue={honeypotWebsite}
            onHoneypotChange={setHoneypotWebsite}
            productTitle="Protection Gap™"
            storageResultName="Protection Gap"
            intro="Your Protection Gap™ estimate is based on the information you shared. Required acknowledgments are marked with an asterisk."
          />
          {isSubmitting ? (
            <p className="family-submit-status" role="status" aria-live="polite">
              Saving your Protection Gap…
            </p>
          ) : null}
          {submitError ? (
            <p className="family-submit-error" role="alert">
              {submitError}
            </p>
          ) : null}
        </>
      )}
    </CalculatorLayout>
  )
}
