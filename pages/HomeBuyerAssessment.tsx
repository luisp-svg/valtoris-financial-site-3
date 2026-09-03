import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AssessmentLayout from '../components/assessment/AssessmentLayout'
import NavigationButtons from '../components/assessment/NavigationButtons'
import FamilyConsentSection from '../components/assessment/steps/FamilyConsentSection'
import StepHomeBuyerContact from '../components/assessment/steps/homeBuyer/StepHomeBuyerContact'
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
  isHomeBuyerContactComplete,
  isHomeBuyerDiagnosticComplete,
  isHomeBuyerStepComplete,
} from '../components/assessment/homeBuyer/completeness'
import {
  HOME_BUYER_ANSWERS_STORAGE_KEY,
  HOME_BUYER_ASSESSMENT_STEPS,
  HOME_BUYER_CONTACT_STEP,
  HOME_BUYER_FIRST_DIAGNOSTIC_STEP,
  HOME_BUYER_INGEST_SESSION_KEY,
  HOME_BUYER_LAST_DIAGNOSTIC_STEP,
} from '../components/assessment/homeBuyer/constants'
import { homeBuyerCopy } from '../components/assessment/homeBuyer/copy'
import { canSubmitHomeBuyerToCrm } from '../components/assessment/homeBuyer/ingestBoundary'
import { buildHomeBuyerResultsSession } from '../components/assessment/homeBuyer/resultsModel'
import { HOME_BUYER_QUESTIONS } from '../components/assessment/homeBuyer/questions'
import {
  INITIAL_HOME_BUYER_ANSWERS,
  type HomeBuyerAssessmentAnswers,
  type HomeBuyerContactAnswers,
} from '../components/assessment/homeBuyer/types'
import { completePublicReportCardCrmSubmission } from '../components/reportCard/familyIngest/completeFamilyReportCardSubmission'
import {
  applyPhoneChangeToConsent,
  INITIAL_FAMILY_CONSENT_STATE,
  validateRequiredFamilyConsent,
  type FamilyConsentField,
  type FamilyConsentState,
} from '../components/reportCard/familyIngest/familyConsent'
import {
  ensureFamilyIngestSession,
  type FamilyIngestSession,
} from '../components/reportCard/familyIngest/submissionSession'
import { ROUTES } from '../constants/routes'

export default function HomeBuyerAssessment() {
  const navigate = useNavigate()
  const location = useLocation()
  const locale = readSpecializedLocale(location.search)
  useSpecializedDocumentLang(locale)
  const [currentStep, setCurrentStep] = useState(HOME_BUYER_CONTACT_STEP)
  const [answers, setAnswers] = useState<HomeBuyerAssessmentAnswers>(INITIAL_HOME_BUYER_ANSWERS)
  const [consent, setConsent] = useState<FamilyConsentState>(INITIAL_FAMILY_CONSENT_STATE)
  const [honeypotWebsite, setHoneypotWebsite] = useState('')
  const [showFieldErrors, setShowFieldErrors] = useState(false)
  const [showConsentErrors, setShowConsentErrors] = useState(false)
  const [consentMissing, setConsentMissing] = useState<
    Array<'assessmentStorageAcknowledged' | 'privacyAcknowledged'>
  >([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ingestSession, setIngestSession] = useState<FamilyIngestSession>(() =>
    ensureFamilyIngestSession({
      search: location.search,
      referrer: typeof document === 'undefined' ? null : document.referrer || null,
      storageKey: HOME_BUYER_INGEST_SESSION_KEY,
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

  function t(section: SpecializedCopySection, key: string): string {
    return resolveSpecializedCopy(homeBuyerCopy, locale, section, key)
  }

  const diagnosticQuestion =
    currentStep >= HOME_BUYER_FIRST_DIAGNOSTIC_STEP && currentStep <= HOME_BUYER_LAST_DIAGNOSTIC_STEP
      ? HOME_BUYER_QUESTIONS[currentStep - HOME_BUYER_FIRST_DIAGNOSTIC_STEP]
      : undefined

  const canContinue = useMemo(() => isHomeBuyerStepComplete(currentStep, answers), [currentStep, answers])

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

  function updateContact(field: keyof HomeBuyerContactAnswers, value: string) {
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
    setSubmitError(null)
  }

  function handleBack() {
    if (isSubmitting) return
    if (currentStep === HOME_BUYER_CONTACT_STEP) {
      navigate(withSpecializedLocale(ROUTES.homeBuyerReportCard, locale, location.search))
      return
    }
    setShowFieldErrors(false)
    setCurrentStep((step) => step - 1)
  }

  async function completeHomeBuyerAssessment(finalAnswers: HomeBuyerAssessmentAnswers) {
    setSubmitError(null)

    if (!canSubmitHomeBuyerToCrm()) {
      setSubmitError(t('ui', 'ingestUnavailable'))
      setIsSubmitting(false)
      return
    }

    const { result, session } = await completePublicReportCardCrmSubmission({
      assessmentType: 'home_buyer',
      answers: finalAnswers,
      consent: consentRef.current,
      session: sessionRef.current,
      honeypotWebsite: honeypotRef.current,
      storageKey: HOME_BUYER_INGEST_SESSION_KEY,
      phone: finalAnswers.contact.phone,
    })
    setIngestSession(session)

    if (!result.ok) {
      if (result.code === 'consent_required') {
        setShowConsentErrors(true)
        setConsentMissing(result.consentMissing ?? [])
        setSubmitError(t('ui', 'consentRequired'))
        setIsSubmitting(false)
        setCurrentStep(HOME_BUYER_CONTACT_STEP)
        return
      }
      setSubmitError(t('ui', 'submitFailed'))
      setIsSubmitting(false)
      return
    }

    const resultsSession = buildHomeBuyerResultsSession(finalAnswers)
    try {
      sessionStorage.setItem(HOME_BUYER_ANSWERS_STORAGE_KEY, JSON.stringify(resultsSession))
    } catch {
      // Non-fatal local cache only.
    }

    navigate(withSpecializedLocale(ROUTES.homeBuyerReportCardResults, locale, location.search), {
      state: { answers: resultsSession, crmSubmitted: true, submissionId: result.submissionId },
    })
  }

  async function handleContinue() {
    if (currentStep === HOME_BUYER_CONTACT_STEP) {
      if (isSubmitting) return
      if (!isHomeBuyerContactComplete(answersRef.current)) {
        setShowFieldErrors(true)
        return
      }
      const consentResult = validateRequiredFamilyConsent(consent)
      if (!consentResult.ok) {
        setShowConsentErrors(true)
        setConsentMissing(consentResult.missing)
        return
      }
      setShowFieldErrors(false)
      setCurrentStep(HOME_BUYER_FIRST_DIAGNOSTIC_STEP)
      return
    }

    if (currentStep < HOME_BUYER_LAST_DIAGNOSTIC_STEP) {
      if (isSubmitting) return
      if (!canContinue) {
        setShowFieldErrors(true)
        return
      }
      setCurrentStep((step) => step + 1)
      return
    }

    if (!canContinue || !isHomeBuyerContactComplete(answersRef.current) || isSubmitting) {
      setShowFieldErrors(true)
      return
    }

    if (!isHomeBuyerDiagnosticComplete(answersRef.current.diagnostic)) {
      setShowFieldErrors(true)
      return
    }

    const consentResult = validateRequiredFamilyConsent(consent)
    if (!consentResult.ok) {
      setShowConsentErrors(true)
      setConsentMissing(consentResult.missing)
      setCurrentStep(HOME_BUYER_CONTACT_STEP)
      return
    }

    setIsSubmitting(true)
    await completeHomeBuyerAssessment(answersRef.current)
  }

  return (
    <AssessmentLayout
      currentStep={currentStep}
      totalSteps={HOME_BUYER_ASSESSMENT_STEPS}
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
        total: HOME_BUYER_ASSESSMENT_STEPS,
      })}
      footer={
        <NavigationButtons
          onBack={handleBack}
          onContinue={() => {
            void handleContinue()
          }}
          backLabel={t('ui', 'back')}
          continueDisabled={(!canContinue && currentStep !== HOME_BUYER_CONTACT_STEP) || isSubmitting}
          continueLabel={
            isSubmitting
              ? t('ui', 'saving')
              : currentStep === HOME_BUYER_LAST_DIAGNOSTIC_STEP
                ? t('ui', 'viewResults')
                : t('ui', 'continue')
          }
        />
      }
    >
      {currentStep === HOME_BUYER_CONTACT_STEP ? (
        <>
          <StepHomeBuyerContact
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
          {submitError ? (
            <p className="family-submit-error" role="alert">
              {submitError}
            </p>
          ) : null}
        </>
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

      {currentStep === HOME_BUYER_LAST_DIAGNOSTIC_STEP && isSubmitting ? (
        <p className="family-submit-status" role="status" aria-live="polite">
          {t('ui', 'saving')}
        </p>
      ) : null}
      {currentStep === HOME_BUYER_LAST_DIAGNOSTIC_STEP && submitError ? (
        <p className="family-submit-error" role="alert">
          {submitError}
        </p>
      ) : null}
    </AssessmentLayout>
  )
}
