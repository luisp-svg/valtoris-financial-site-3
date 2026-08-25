import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { familyCopy } from '../components/assessment/family/copy'
import { useReportCardCopy } from '../components/assessment/reportCardLocale'
import { formatSpecializedTemplate } from '../components/assessment/specialized/locale'
import SpecializedLocaleSwitcher from '../components/assessment/specialized/SpecializedLocaleSwitcher'
import AssessmentLayout from '../components/assessment/AssessmentLayout'
import NavigationButtons from '../components/assessment/NavigationButtons'
import { DEMO_ANSWERS_STORAGE_KEY, DEMO_ASSESSMENT_STEPS } from '../components/assessment/constants'
import { completeFamilyReportCardCrmSubmission } from '../components/reportCard/familyIngest/completeFamilyReportCardSubmission'
import {
  applyPhoneChangeToConsent,
  INITIAL_FAMILY_CONSENT_STATE,
  type FamilyConsentField,
  type FamilyConsentState,
} from '../components/reportCard/familyIngest/familyConsent'
import {
  beginNewFamilyAssessmentSession,
  ensureFamilyIngestSession,
  type FamilyIngestSession,
} from '../components/reportCard/familyIngest/submissionSession'
import FamilyConsentSection from '../components/assessment/steps/FamilyConsentSection'
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

function readBrowserSearch(): string {
  if (typeof window === 'undefined') return ''
  return window.location.search
}

function readBrowserReferrer(): string | null {
  if (typeof document === 'undefined') return null
  return document.referrer || null
}

export default function FinancialProtectionAssessment() {
  const navigate = useNavigate()
  const { locale, t, withLocale } = useReportCardCopy(familyCopy)
  const [currentStep, setCurrentStep] = useState(1)
  const [protectionSubStep, setProtectionSubStep] = useState<1 | 2>(1)
  const [answers, setAnswers] = useState<DemoAssessmentAnswers>(INITIAL_DEMO_ANSWERS)
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
      search: readBrowserSearch(),
      referrer: readBrowserReferrer(),
    }),
  )
  const answersRef = useRef(answers)
  const consentRef = useRef(consent)
  const sessionRef = useRef(ingestSession)
  const honeypotRef = useRef(honeypotWebsite)
  const previousStepRef = useRef(currentStep)
  const statusRegionRef = useRef<HTMLParagraphElement | null>(null)

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
    if (submitError && statusRegionRef.current) {
      statusRegionRef.current.focus()
    }
  }, [submitError])

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
    setAnswers((current) => {
      const nextFamily = { ...current.family, [field]: value }
      if (field === 'phone') {
        setConsent((prev) => applyPhoneChangeToConsent(prev, value))
      }
      return {
        ...current,
        family: nextFamily,
      }
    })
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

  function updateConsent(field: FamilyConsentField, value: boolean) {
    setConsent((current) => {
      if (field === 'smsMarketingConsent' && value && answersRef.current.family.phone.trim() === '') {
        return current
      }
      return { ...current, [field]: value }
    })
    setShowConsentErrors(false)
    setConsentMissing([])
    setSubmitError(null)
  }

  function handleBeginAssessment() {
    const session = beginNewFamilyAssessmentSession({
      search: readBrowserSearch(),
      referrer: readBrowserReferrer(),
    })
    setIngestSession(session)
    setConsent(INITIAL_FAMILY_CONSENT_STATE)
    setHoneypotWebsite('')
    setSubmitError(null)
    setShowConsentErrors(false)
    setConsentMissing([])
    setIsSubmitting(false)
    setCurrentStep(2)
  }

  function handleBack() {
    if (currentStep === 4 && protectionSubStep === 2) {
      setProtectionSubStep(1)
      return
    }

    if (currentStep === 1) {
      navigate(withLocale(ROUTES.reportCard))
      return
    }
    setCurrentStep((step) => step - 1)
  }

  async function completeFamilyAssessment(finalAnswers: DemoAssessmentAnswers) {
    setSubmitError(null)

    // Preserve answers locally for the results page (results still compute client-side).
    try {
      sessionStorage.setItem(DEMO_ANSWERS_STORAGE_KEY, JSON.stringify(finalAnswers))
    } catch {
      // Non-fatal — navigation state still carries answers on success.
    }

    const { result, session } = await completeFamilyReportCardCrmSubmission({
      answers: finalAnswers,
      consent: consentRef.current,
      session: sessionRef.current,
      honeypotWebsite: honeypotRef.current,
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

    // CRM success (Sheets may have failed server-side) → results.
    // Do not surface Sheets sync errors to the visitor.
    navigate(withLocale(ROUTES.reportCardResults), {
      state: {
        answers: finalAnswers,
        submissionSaved: true,
        submissionId: result.submissionId,
      },
    })
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

  async function handleRetrySubmit() {
    if (isSubmitting) return
    setIsSubmitting(true)
    await completeFamilyAssessment(answersRef.current)
  }

  const displayError =
    submitError === 'Please confirm the required acknowledgments before viewing your report.'
      ? t('validation', 'consentRequired')
      : submitError
        ? t('validation', 'submitFailed')
        : null

  return (
    <AssessmentLayout
      currentStep={currentStep}
      totalSteps={DEMO_ASSESSMENT_STEPS}
      stepIndicator={formatSpecializedTemplate(t('ui', 'stepIndicator'), {
        current: currentStep,
        total: DEMO_ASSESSMENT_STEPS,
      })}
      headerExtra={
        <SpecializedLocaleSwitcher
          locale={locale}
          groupLabel={t('ui', 'languageGroupLabel')}
          englishLabel={t('ui', 'languageEnglish')}
          spanishLabel={t('ui', 'languageSpanish')}
        />
      }
      footer={
        currentStep === 1 ? null : (
          <NavigationButtons
            onBack={handleBack}
            onContinue={handleContinue}
            continueDisabled={!canContinue || isSubmitting}
            backLabel={t('ui', 'back')}
            continueLabel={
              isSubmitting
                ? t('ui', 'saving')
                : currentStep === DEMO_ASSESSMENT_STEPS
                  ? t('ui', 'viewResults')
                  : t('ui', 'continue')
            }
          />
        )
      }
    >
      {currentStep === 1 && (
        <StepWelcome
          t={t}
          onBegin={handleBeginAssessment}
          onBack={() => navigate(withLocale(ROUTES.reportCard))}
        />
      )}
      {currentStep === 2 && <StepTwoFamily t={t} answers={answers.family} onChange={updateFamily} />}
      {currentStep === 3 && (
        <StepThreeFinancial t={t} answers={answers.financial} onChange={updateFinancial} />
      )}
      {currentStep === 4 && protectionSubStep === 1 && (
        <StepFourProtection t={t} answers={answers.protection} onChange={updateProtection} />
      )}
      {currentStep === 4 && protectionSubStep === 2 && (
        <StepFourGuardian t={t} answers={answers.protection} onChange={updateProtection} />
      )}
      {currentStep === 5 && (
        <>
          <StepFiveGoals t={t} answers={answers.goals} onChange={updateGoals} />
          <FamilyConsentSection
            consent={consent}
            phone={answers.family.phone}
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
          {isSubmitting ? (
            <p className="family-submit-status" role="status" aria-live="polite">
              {t('ui', 'saving')}
            </p>
          ) : null}
          {displayError ? (
            <div className="family-submit-error-panel">
              <p
                ref={statusRegionRef}
                className="family-submit-error"
                role="alert"
                tabIndex={-1}
              >
                {displayError}
              </p>
              <button
                type="button"
                className="platform-btn platform-btn-outline family-submit-retry"
                onClick={handleRetrySubmit}
                disabled={isSubmitting}
              >
                {t('validation', 'retry')}
              </button>
            </div>
          ) : null}
        </>
      )}
    </AssessmentLayout>
  )
}
