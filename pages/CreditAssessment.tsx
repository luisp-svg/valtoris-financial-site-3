import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AssessmentLayout from '../components/assessment/AssessmentLayout'
import NavigationButtons from '../components/assessment/NavigationButtons'
import FamilyConsentSection from '../components/assessment/steps/FamilyConsentSection'
import StepCreditContact from '../components/assessment/steps/credit/StepCreditContact'
import StepCreditWelcome from '../components/assessment/steps/credit/StepCreditWelcome'
import { applyFieldChange } from '../components/assessment/specialized/answers'
import SpecializedLocaleSwitcher, {
  useSpecializedDocumentLang,
} from '../components/assessment/specialized/SpecializedLocaleSwitcher'
import {
  formatSpecializedTemplate,
  readSpecializedLocale,
  resolveSpecializedCopy,
  withSpecializedLocale,
} from '../components/assessment/specialized/locale'
import SpecializedQuestionRenderer from '../components/assessment/specialized/renderer'
import type { SpecializedCopySection, SpecializedField } from '../components/assessment/specialized/types'
import {
  answerMapToDiagnostic,
  diagnosticToAnswerMap,
  isCreditContactComplete,
  isCreditDiagnosticComplete,
  isCreditStepComplete,
} from '../components/assessment/credit/completeness'
import {
  CREDIT_ANSWERS_STORAGE_KEY,
  CREDIT_ASSESSMENT_STEPS,
  CREDIT_CONTACT_STEP,
  CREDIT_FIRST_DIAGNOSTIC_STEP,
  CREDIT_INGEST_SESSION_KEY,
  CREDIT_LAST_DIAGNOSTIC_STEP,
  CREDIT_WELCOME_STEP,
} from '../components/assessment/credit/constants'
import { creditCopy } from '../components/assessment/credit/copy'
import { canSubmitCreditToCrm } from '../components/assessment/credit/ingestBoundary'
import { buildCreditResultsSession } from '../components/assessment/credit/resultsModel'
import { CREDIT_QUESTIONS } from '../components/assessment/credit/questions'
import { INITIAL_CREDIT_ANSWERS, type CreditAssessmentAnswers, type CreditContactAnswers } from '../components/assessment/credit/types'
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

export default function CreditAssessment() {
  const navigate = useNavigate()
  const location = useLocation()
  const locale = readSpecializedLocale(location.search)
  useSpecializedDocumentLang(locale)
  const [currentStep, setCurrentStep] = useState(CREDIT_WELCOME_STEP)
  const [answers, setAnswers] = useState<CreditAssessmentAnswers>(INITIAL_CREDIT_ANSWERS)
  const [consent, setConsent] = useState<FamilyConsentState>(INITIAL_FAMILY_CONSENT_STATE)
  const [honeypotWebsite, setHoneypotWebsite] = useState('')
  const [showFieldErrors, setShowFieldErrors] = useState(false)
  const [showConsentErrors, setShowConsentErrors] = useState(false)
  const [consentMissing, setConsentMissing] = useState<
    Array<'assessmentStorageAcknowledged' | 'privacyAcknowledged'>
  >([])
  const [, setIngestSession] = useState<FamilyIngestSession>(() =>
    ensureFamilyIngestSession({
      search: location.search,
      referrer: typeof document === 'undefined' ? null : document.referrer || null,
      storageKey: CREDIT_INGEST_SESSION_KEY,
    }),
  )
  const answersRef = useRef(answers)
  const consentRef = useRef(consent)

  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  useEffect(() => {
    consentRef.current = consent
  }, [consent])

  function t(section: SpecializedCopySection, key: string): string {
    return resolveSpecializedCopy(creditCopy, locale, section, key)
  }

  const diagnosticQuestion =
    currentStep >= CREDIT_FIRST_DIAGNOSTIC_STEP && currentStep <= CREDIT_LAST_DIAGNOSTIC_STEP
      ? CREDIT_QUESTIONS[currentStep - CREDIT_FIRST_DIAGNOSTIC_STEP]
      : undefined

  const canContinue = useMemo(() => isCreditStepComplete(currentStep, answers), [currentStep, answers])

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

  function updateContact(field: keyof CreditContactAnswers, value: string) {
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
  }

  function handleBegin() {
    const session = beginNewFamilyAssessmentSession({
      search: location.search,
      referrer: typeof document === 'undefined' ? null : document.referrer || null,
      storageKey: CREDIT_INGEST_SESSION_KEY,
    })
    setIngestSession(session)
    setConsent(INITIAL_FAMILY_CONSENT_STATE)
    setHoneypotWebsite('')
    setShowFieldErrors(false)
    setShowConsentErrors(false)
    setConsentMissing([])
    setCurrentStep(CREDIT_FIRST_DIAGNOSTIC_STEP)
  }

  function handleBack() {
    if (currentStep === CREDIT_WELCOME_STEP) {
      navigate(withSpecializedLocale(ROUTES.creditReportCard, locale, location.search))
      return
    }
    setShowFieldErrors(false)
    setCurrentStep((step) => step - 1)
  }

  function completeLocalCreditAssessment(finalAnswers: CreditAssessmentAnswers) {
    const resultsSession = buildCreditResultsSession(finalAnswers)
    try {
      sessionStorage.setItem(CREDIT_ANSWERS_STORAGE_KEY, JSON.stringify(resultsSession))
    } catch {
      // Non-fatal local cache only.
    }

    navigate(withSpecializedLocale(ROUTES.creditReportCardResults, locale, location.search), {
      state: {
        answers: resultsSession,
        crmSubmitted: false,
        ingestEnabled: canSubmitCreditToCrm(),
      },
    })
  }

  function handleContinue() {
    if (currentStep < CREDIT_CONTACT_STEP) {
      if (!canContinue) {
        setShowFieldErrors(true)
        return
      }
      setCurrentStep((step) => step + 1)
      return
    }

    if (!canContinue || !isCreditContactComplete(answersRef.current)) {
      setShowFieldErrors(true)
      return
    }

    if (!isCreditDiagnosticComplete(answersRef.current.diagnostic)) {
      setShowFieldErrors(true)
      return
    }

    const consentResult = validateRequiredFamilyConsent(consent)
    if (!consentResult.ok) {
      setShowConsentErrors(true)
      setConsentMissing(consentResult.missing)
      return
    }

    completeLocalCreditAssessment(answersRef.current)
  }

  return (
    <AssessmentLayout
      currentStep={currentStep}
      totalSteps={CREDIT_ASSESSMENT_STEPS}
      headerExtra={
        <SpecializedLocaleSwitcher
          locale={locale}
          groupLabel={t('ui', 'languageGroupLabel')}
          englishLabel={t('ui', 'languageEnglish')}
          spanishLabel={t('ui', 'languageSpanish')}
        />
      }
      stepIndicator={formatSpecializedTemplate(t('ui', 'stepIndicator'), {
        current: currentStep,
        total: CREDIT_ASSESSMENT_STEPS,
      })}
      footer={
        currentStep === CREDIT_WELCOME_STEP ? null : (
          <NavigationButtons
            onBack={handleBack}
            onContinue={handleContinue}
            backLabel={t('ui', 'back')}
            continueDisabled={!canContinue && currentStep !== CREDIT_CONTACT_STEP}
            continueLabel={
              currentStep === CREDIT_CONTACT_STEP ? t('ui', 'viewResults') : t('ui', 'continue')
            }
          />
        )
      }
    >
      {currentStep === CREDIT_WELCOME_STEP ? (
        <StepCreditWelcome
          t={t}
          onBegin={handleBegin}
          onBack={() => navigate(withSpecializedLocale(ROUTES.creditReportCard, locale, location.search))}
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

      {currentStep === CREDIT_CONTACT_STEP ? (
        <>
          <StepCreditContact
            contact={answers.contact}
            t={t}
            showErrors={showFieldErrors}
            onChange={updateContact}
          />
          <FamilyConsentSection
            consent={consent}
            phone={answers.contact.phone}
            showErrors={showConsentErrors}
            missing={consentMissing}
            onChange={updateConsent}
            honeypotValue={honeypotWebsite}
            onHoneypotChange={setHoneypotWebsite}
            productTitle={t('ui', 'productTitle')}
            storageResultName={t('ui', 'storageResultName')}
            intro={t('ui', 'consentIntro')}
            labels={{
              heading: t('ui', 'consentHeading'),
              storage: t('ui', 'consentStorage'),
              storageHint: t('ui', 'consentStorageHint'),
              storageError: t('ui', 'consentStorageError'),
              contact: t('ui', 'consentContact'),
              emailMarketing: t('ui', 'consentEmailMarketing'),
              sms: t('ui', 'consentSms'),
              smsPhoneNote: t('ui', 'consentSmsPhoneNote'),
              privacyBefore: t('ui', 'consentPrivacyBefore'),
              privacyLink: t('ui', 'consentPrivacyLink'),
              privacyAfter: t('ui', 'consentPrivacyAfter'),
              privacyHint: t('ui', 'consentPrivacyHint'),
              privacyError: t('ui', 'consentPrivacyError'),
              disclaimer: t('ui', 'consentDisclaimer'),
              honeypot: t('ui', 'consentHoneypot'),
            }}
          />
        </>
      ) : null}
    </AssessmentLayout>
  )
}
