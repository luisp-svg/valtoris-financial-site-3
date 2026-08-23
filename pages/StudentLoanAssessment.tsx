import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AssessmentLayout from '../components/assessment/AssessmentLayout'
import NavigationButtons from '../components/assessment/NavigationButtons'
import FamilyConsentSection from '../components/assessment/steps/FamilyConsentSection'
import StepStudentLoanContact from '../components/assessment/steps/studentLoan/StepStudentLoanContact'
import StepStudentLoanWelcome from '../components/assessment/steps/studentLoan/StepStudentLoanWelcome'
import { applyFieldChange } from '../components/assessment/specialized/answers'
import { readSpecializedLocale, resolveSpecializedCopy, withSpecializedLocale } from '../components/assessment/specialized/locale'
import SpecializedQuestionRenderer from '../components/assessment/specialized/renderer'
import type { SpecializedCopySection, SpecializedField } from '../components/assessment/specialized/types'
import {
  diagnosticToAnswerMap,
  answerMapToDiagnostic,
  isStudentLoanStepComplete,
} from '../components/assessment/studentLoan/completeness'
import {
  STUDENT_LOAN_ANSWERS_STORAGE_KEY,
  STUDENT_LOAN_ASSESSMENT_STEPS,
  STUDENT_LOAN_CONTACT_STEP,
  STUDENT_LOAN_FIRST_DIAGNOSTIC_STEP,
  STUDENT_LOAN_INGEST_SESSION_KEY,
  STUDENT_LOAN_LAST_DIAGNOSTIC_STEP,
  STUDENT_LOAN_PRODUCT_TITLE,
  STUDENT_LOAN_STORAGE_RESULT_NAME,
  STUDENT_LOAN_WELCOME_STEP,
} from '../components/assessment/studentLoan/constants'
import { studentLoanCopy } from '../components/assessment/studentLoan/copy'
import { canSubmitStudentLoanToCrm } from '../components/assessment/studentLoan/ingestBoundary'
import { STUDENT_LOAN_QUESTIONS } from '../components/assessment/studentLoan/questions'
import { INITIAL_STUDENT_LOAN_ANSWERS, type StudentLoanAssessmentAnswers, type StudentLoanContactAnswers } from '../components/assessment/studentLoan/types'
import {
  applyPhoneChangeToConsent,
  INITIAL_FAMILY_CONSENT_STATE,
  validateRequiredFamilyConsent,
  type FamilyConsentField,
  type FamilyConsentState,
} from '../components/reportCard/familyIngest/familyConsent'
import {
  beginNewFamilyAssessmentSession,
  ensureFamilyIngestSession,
  type FamilyIngestSession,
} from '../components/reportCard/familyIngest/submissionSession'
import { ROUTES } from '../constants/routes'

export default function StudentLoanAssessment() {
  const navigate = useNavigate()
  const location = useLocation()
  const locale = readSpecializedLocale(location.search)
  const [currentStep, setCurrentStep] = useState(STUDENT_LOAN_WELCOME_STEP)
  const [answers, setAnswers] = useState<StudentLoanAssessmentAnswers>(INITIAL_STUDENT_LOAN_ANSWERS)
  const [consent, setConsent] = useState<FamilyConsentState>(INITIAL_FAMILY_CONSENT_STATE)
  const [honeypotWebsite, setHoneypotWebsite] = useState('')
  const [showFieldErrors, setShowFieldErrors] = useState(false)
  const [showConsentErrors, setShowConsentErrors] = useState(false)
  const [consentMissing, setConsentMissing] = useState<
    Array<'assessmentStorageAcknowledged' | 'privacyAcknowledged'>
  >([])
  const [boundaryNotice, setBoundaryNotice] = useState<string | null>(null)
  const [ingestSession, setIngestSession] = useState<FamilyIngestSession>(() =>
    ensureFamilyIngestSession({
      search: location.search,
      referrer: typeof document === 'undefined' ? null : document.referrer || null,
      storageKey: STUDENT_LOAN_INGEST_SESSION_KEY,
    }),
  )
  const answersRef = useRef(answers)

  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  function t(section: SpecializedCopySection, key: string): string {
    return resolveSpecializedCopy(studentLoanCopy, locale, section, key)
  }

  const diagnosticQuestion =
    currentStep >= STUDENT_LOAN_FIRST_DIAGNOSTIC_STEP && currentStep <= STUDENT_LOAN_LAST_DIAGNOSTIC_STEP
      ? STUDENT_LOAN_QUESTIONS[currentStep - STUDENT_LOAN_FIRST_DIAGNOSTIC_STEP]
      : undefined

  const canContinue = useMemo(
    () => isStudentLoanStepComplete(currentStep, answers),
    [currentStep, answers],
  )

  function updateDiagnosticField(field: SpecializedField, value: string | string[]) {
    if (!diagnosticQuestion) return
    setShowFieldErrors(false)
    setAnswers((current) => {
      const nextMap = applyFieldChange(
        diagnosticQuestion,
        field,
        diagnosticToAnswerMap(current.diagnostic),
        value,
      )
      return {
        ...current,
        diagnostic: answerMapToDiagnostic(nextMap, current.diagnostic),
      }
    })
  }

  function updateContact(field: keyof StudentLoanContactAnswers, value: string) {
    setAnswers((current) => {
      if (field === 'phone') {
        setConsent((prev) => applyPhoneChangeToConsent(prev, value))
      }
      return { ...current, contact: { ...current.contact, [field]: value } }
    })
  }

  function updateConsent(field: FamilyConsentField, value: boolean) {
    setConsent((current) => {
      if (field === 'smsMarketingConsent' && value && answersRef.current.contact.phone.trim() === '') {
        return current
      }
      return { ...current, [field]: value }
    })
    setShowConsentErrors(false)
    setConsentMissing([])
    setBoundaryNotice(null)
  }

  function handleBegin() {
    const session = beginNewFamilyAssessmentSession({
      search: location.search,
      referrer: typeof document === 'undefined' ? null : document.referrer || null,
      storageKey: STUDENT_LOAN_INGEST_SESSION_KEY,
    })
    setIngestSession(session)
    setConsent(INITIAL_FAMILY_CONSENT_STATE)
    setHoneypotWebsite('')
    setShowFieldErrors(false)
    setShowConsentErrors(false)
    setConsentMissing([])
    setBoundaryNotice(null)
    setCurrentStep(STUDENT_LOAN_FIRST_DIAGNOSTIC_STEP)
  }

  function handleBack() {
    if (currentStep === STUDENT_LOAN_WELCOME_STEP) {
      navigate(withSpecializedLocale(ROUTES.studentLoanReportCard, locale))
      return
    }
    setShowFieldErrors(false)
    setCurrentStep((step) => step - 1)
  }

  function finishWithoutCrm(finalAnswers: StudentLoanAssessmentAnswers) {
    if (ingestSession.status === 'succeeded') {
      throw new Error('Student Loan CRM ingest must stay disabled in Phase A.')
    }
    try {
      sessionStorage.setItem(STUDENT_LOAN_ANSWERS_STORAGE_KEY, JSON.stringify(finalAnswers))
    } catch {
      // Non-fatal local cache only.
    }
    navigate(withSpecializedLocale(ROUTES.studentLoanReportCardResults, locale), {
      state: { answers: finalAnswers, crmSubmitted: false },
    })
  }

  function handleContinue() {
    if (currentStep < STUDENT_LOAN_CONTACT_STEP) {
      if (!canContinue) {
        setShowFieldErrors(true)
        return
      }
      setCurrentStep((step) => step + 1)
      return
    }

    if (!canContinue) {
      setShowFieldErrors(true)
      return
    }

    const consentResult = validateRequiredFamilyConsent(consent)
    if (!consentResult.ok) {
      setShowConsentErrors(true)
      setConsentMissing(consentResult.missing)
      return
    }

    if (canSubmitStudentLoanToCrm()) {
      throw new Error('Student Loan CRM ingest is not enabled in Phase A.')
    }

    setBoundaryNotice(t('ui', 'ingestUnavailable'))
    finishWithoutCrm(answersRef.current)
  }

  return (
    <AssessmentLayout
      currentStep={currentStep}
      totalSteps={STUDENT_LOAN_ASSESSMENT_STEPS}
      footer={
        currentStep === STUDENT_LOAN_WELCOME_STEP ? null : (
          <NavigationButtons
            onBack={handleBack}
            onContinue={handleContinue}
            continueDisabled={!canContinue && currentStep !== STUDENT_LOAN_CONTACT_STEP}
            continueLabel={t('ui', 'continue')}
          />
        )
      }
    >
      {currentStep === STUDENT_LOAN_WELCOME_STEP ? (
        <StepStudentLoanWelcome
          t={t}
          onBegin={handleBegin}
          onBack={() => navigate(withSpecializedLocale(ROUTES.studentLoanReportCard, locale))}
        />
      ) : null}

      {diagnosticQuestion ? (
        <SpecializedQuestionRenderer
          question={diagnosticQuestion}
          values={diagnosticToAnswerMap(answers.diagnostic)}
          t={t}
          showErrors={showFieldErrors}
          onChange={updateDiagnosticField}
        />
      ) : null}

      {currentStep === STUDENT_LOAN_CONTACT_STEP ? (
        <>
          <StepStudentLoanContact contact={answers.contact} t={t} onChange={updateContact} />
          <FamilyConsentSection
            consent={consent}
            phone={answers.contact.phone}
            showErrors={showConsentErrors}
            missing={consentMissing}
            onChange={updateConsent}
            honeypotValue={honeypotWebsite}
            onHoneypotChange={setHoneypotWebsite}
            productTitle={STUDENT_LOAN_PRODUCT_TITLE}
            storageResultName={STUDENT_LOAN_STORAGE_RESULT_NAME}
            intro={t('ui', 'consentIntro')}
          />
          {boundaryNotice ? (
            <p className="family-submit-status" role="status">
              {boundaryNotice}
            </p>
          ) : null}
        </>
      ) : null}
    </AssessmentLayout>
  )
}
