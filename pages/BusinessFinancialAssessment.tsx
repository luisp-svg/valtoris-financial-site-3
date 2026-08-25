import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import AssessmentLayout from '../components/assessment/AssessmentLayout'
import NavigationButtons from '../components/assessment/NavigationButtons'
import FamilyConsentSection from '../components/assessment/steps/FamilyConsentSection'
import SpecializedLocaleSwitcher from '../components/assessment/specialized/SpecializedLocaleSwitcher'
import { businessCopy } from '../components/assessment/business/copy'
import { useReportCardCopy } from '../components/assessment/reportCardLocale'
import { formatSpecializedTemplate } from '../components/assessment/specialized/locale'
import { BUSINESS_ASSESSMENT_STEPS } from '../components/assessment/business/constants'
import {
  BusinessAssessmentAnswers,
  INITIAL_BUSINESS_ANSWERS,
  isBusinessStepComplete,
} from '../components/assessment/business/types'
import { completePublicReportCardCrmSubmission } from '../components/reportCard/familyIngest/completeFamilyReportCardSubmission'
import {
  applyPhoneChangeToConsent,
  INITIAL_FAMILY_CONSENT_STATE,
  type FamilyConsentField,
  type FamilyConsentState,
} from '../components/reportCard/familyIngest/familyConsent'
import {
  beginNewFamilyAssessmentSession,
  BUSINESS_INGEST_SESSION_KEY,
  ensureFamilyIngestSession,
  type FamilyIngestSession,
} from '../components/reportCard/familyIngest/submissionSession'
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

function readBrowserSearch(): string {
  if (typeof window === 'undefined') return ''
  return window.location.search
}

function readBrowserReferrer(): string | null {
  if (typeof document === 'undefined') return null
  return document.referrer || null
}

export default function BusinessFinancialAssessment() {
  const navigate = useNavigate()
  const { locale, t, withLocale } = useReportCardCopy(businessCopy)
  const [currentStep, setCurrentStep] = useState(1)
  const [answers, setAnswers] = useState<BusinessAssessmentAnswers>(INITIAL_BUSINESS_ANSWERS)
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
      storageKey: BUSINESS_INGEST_SESSION_KEY,
    }),
  )
  const answersRef = useRef(answers)
  const consentRef = useRef(consent)
  const sessionRef = useRef(ingestSession)
  const honeypotRef = useRef(honeypotWebsite)
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

  const canContinue = useMemo(
    () => isBusinessStepComplete(currentStep, answers),
    [currentStep, answers],
  )

  function updateOwner(field: keyof BusinessAssessmentAnswers['owner'], value: string) {
    setAnswers((current) => ({
      ...current,
      owner: { ...current.owner, [field]: value },
    }))
    if (field === 'phone') {
      setConsent((prev) => applyPhoneChangeToConsent(prev, value))
    }
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
      navigate(withLocale(ROUTES.businessReportCard))
      return
    }
    setCurrentStep((step) => step - 1)
  }

  function updateConsent(field: FamilyConsentField, value: boolean) {
    setConsent((current) => {
      if (field === 'smsMarketingConsent' && value && answersRef.current.owner.phone.trim() === '') {
        return current
      }
      return { ...current, [field]: value }
    })
    setShowConsentErrors(false)
    setConsentMissing([])
    setSubmitError(null)
  }

  function handleBegin() {
    const session = beginNewFamilyAssessmentSession({
      search: readBrowserSearch(),
      referrer: readBrowserReferrer(),
      storageKey: BUSINESS_INGEST_SESSION_KEY,
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

  async function completeBusinessAssessment(finalAnswers: BusinessAssessmentAnswers) {
    setSubmitError(null)
    try {
      sessionStorage.setItem(BUSINESS_ANSWERS_STORAGE_KEY, JSON.stringify(finalAnswers))
      sessionStorage.setItem(
        BUSINESS_REPORT_STORAGE_KEY,
        JSON.stringify({ businessName: finalAnswers.business.name.trim() }),
      )
    } catch {
      // Non-fatal — navigation state still carries answers on success.
    }

    const { result, session } = await completePublicReportCardCrmSubmission({
      assessmentType: 'business',
      answers: finalAnswers,
      consent: consentRef.current,
      session: sessionRef.current,
      honeypotWebsite: honeypotRef.current,
      storageKey: BUSINESS_INGEST_SESSION_KEY,
      phone: finalAnswers.owner.phone,
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

    navigate(withLocale(ROUTES.businessReportCardResults), {
      state: { answers: finalAnswers, submissionSaved: true, submissionId: result.submissionId },
    })
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

  async function handleRetrySubmit() {
    if (isSubmitting) return
    setIsSubmitting(true)
    await completeBusinessAssessment(answersRef.current)
  }

  const displayError = submitError
    ? submitError === 'Please confirm the required acknowledgments before viewing your report.'
      ? t('validation', 'consentRequired')
      : t('validation', 'submitFailed')
    : null

  return (
    <AssessmentLayout
      currentStep={currentStep}
      totalSteps={BUSINESS_ASSESSMENT_STEPS}
      stepIndicator={formatSpecializedTemplate(t('ui', 'stepIndicator'), {
        current: currentStep,
        total: BUSINESS_ASSESSMENT_STEPS,
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
                : currentStep === BUSINESS_ASSESSMENT_STEPS
                  ? t('ui', 'viewResults')
                  : t('ui', 'continue')
            }
          />
        )
      }
    >
      {currentStep === 1 && (
        <StepBusinessWelcome
          t={t}
          onBegin={handleBegin}
          onBack={() => navigate(withLocale(ROUTES.businessReportCard))}
        />
      )}
      {currentStep === 2 && (
        <StepBusinessInformation
          t={t}
          owner={answers.owner}
          business={answers.business}
          onOwnerChange={updateOwner}
          onBusinessChange={updateBusiness}
        />
      )}
      {currentStep === 3 && (
        <StepBusinessFoundation t={t} answers={answers.foundation} onChange={updateFoundation} />
      )}
      {currentStep === 4 && (
        <StepCashFlowTax t={t} answers={answers.cashFlowTax} onChange={updateCashFlowTax} />
      )}
      {currentStep === 5 && (
        <StepProtectionRisk t={t} answers={answers.protectionRisk} onChange={updateProtectionRisk} />
      )}
      {currentStep === 6 && (
        <>
          <StepRetirementFundingExit
            t={t}
            answers={answers.retirementFundingExit}
            goals={answers.goals}
            onChange={updateRetirementFundingExit}
            onGoalsChange={updateGoals}
          />
          <FamilyConsentSection
            consent={consent}
            phone={answers.owner.phone}
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
