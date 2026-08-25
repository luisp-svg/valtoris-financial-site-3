import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import AssessmentLayout from '../components/assessment/AssessmentLayout'
import NavigationButtons from '../components/assessment/NavigationButtons'
import FamilyConsentSection from '../components/assessment/steps/FamilyConsentSection'
import { retirementCopy } from '../components/assessment/retirement/copy'
import { useReportCardCopy } from '../components/assessment/reportCardLocale'
import { formatSpecializedTemplate } from '../components/assessment/specialized/locale'
import SpecializedLocaleSwitcher from '../components/assessment/specialized/SpecializedLocaleSwitcher'
import {
  RETIREMENT_ANSWERS_STORAGE_KEY,
  RETIREMENT_ASSESSMENT_STEPS,
} from '../components/assessment/retirement/constants'
import {
  INITIAL_RETIREMENT_ANSWERS,
  RetirementAssessmentAnswers,
  isRetirementStepComplete,
} from '../components/assessment/retirement/types'
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
  RETIREMENT_INGEST_SESSION_KEY,
  type FamilyIngestSession,
} from '../components/reportCard/familyIngest/submissionSession'
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
  const { locale, t, withLocale } = useReportCardCopy(retirementCopy)
  const [currentStep, setCurrentStep] = useState(1)
  const [answers, setAnswers] = useState<RetirementAssessmentAnswers>(INITIAL_RETIREMENT_ANSWERS)
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
      storageKey: RETIREMENT_INGEST_SESSION_KEY,
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
      if (field === 'phone') {
        setConsent((prev) => applyPhoneChangeToConsent(prev, value))
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
      navigate(withLocale(ROUTES.retirementReportCard))
      return
    }
    setCurrentStep((step) => step - 1)
  }

  function updateConsent(field: FamilyConsentField, value: boolean) {
    setConsent((current) => {
      if (field === 'smsMarketingConsent' && value && answersRef.current.household.phone.trim() === '') {
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
      search: typeof window === 'undefined' ? '' : window.location.search,
      referrer: typeof document === 'undefined' ? null : document.referrer || null,
      storageKey: RETIREMENT_INGEST_SESSION_KEY,
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

  async function completeRetirementAssessment(finalAnswers: RetirementAssessmentAnswers) {
    setSubmitError(null)
    try {
      sessionStorage.setItem(RETIREMENT_ANSWERS_STORAGE_KEY, JSON.stringify(finalAnswers))
    } catch {
      // Non-fatal.
    }

    const { result, session } = await completePublicReportCardCrmSubmission({
      assessmentType: 'retirement',
      answers: finalAnswers,
      consent: consentRef.current,
      session: sessionRef.current,
      honeypotWebsite: honeypotRef.current,
      storageKey: RETIREMENT_INGEST_SESSION_KEY,
      phone: finalAnswers.household.phone,
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

    navigate(withLocale(ROUTES.retirementReportCardResults), {
      state: { answers: finalAnswers, submissionSaved: true, submissionId: result.submissionId },
    })
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

  const displayError =
    submitError === 'Please confirm the required acknowledgments before viewing your report.'
      ? t('validation', 'consentRequired')
      : submitError
        ? t('validation', 'submitFailed')
        : null

  return (
    <AssessmentLayout
      currentStep={currentStep}
      totalSteps={RETIREMENT_ASSESSMENT_STEPS}
      stepIndicator={formatSpecializedTemplate(t('ui', 'stepIndicator'), {
        current: currentStep,
        total: RETIREMENT_ASSESSMENT_STEPS,
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
                : currentStep === RETIREMENT_ASSESSMENT_STEPS
                  ? t('ui', 'viewResults')
                  : t('ui', 'continue')
            }
          />
        )
      }
    >
      {currentStep === 1 && (
        <StepRetirementWelcome
          t={t}
          onBegin={handleBegin}
          onBack={() => navigate(withLocale(ROUTES.retirementReportCard))}
        />
      )}
      {currentStep === 2 && (
        <StepRetirementHousehold
          t={t}
          household={answers.household}
          vision={answers.vision}
          onHouseholdChange={updateHousehold}
          onVisionChange={updateVision}
        />
      )}
      {currentStep === 3 && (
        <StepRetirementSpending t={t} lifestyle={answers.lifestyle} onChange={updateLifestyle} />
      )}
      {currentStep === 4 && (
        <StepRetirementSavings t={t} savings={answers.savings} onChange={updateSavings} />
      )}
      {currentStep === 5 && (
        <StepRetirementIncomeSources
          t={t}
          household={answers.household}
          incomeSources={answers.incomeSources}
          onChange={updateIncomeSources}
        />
      )}
      {currentStep === 6 && (
        <StepRetirementSustainability
          t={t}
          goals={answers.goals}
          incomeSources={answers.incomeSources}
          onGoalsChange={updateGoals}
          onIncomeSourcesChange={updateIncomeSources}
        />
      )}
      {currentStep === 7 && (
        <StepRetirementInvestmentsTax
          t={t}
          investments={answers.investments}
          tax={answers.tax}
          onInvestmentsChange={updateInvestments}
          onTaxChange={updateTax}
          onAccountTypesChange={updateAccountTypes}
        />
      )}
      {currentStep === 8 && (
        <StepRetirementHealthcareLegacy
          t={t}
          healthcare={answers.healthcare}
          estate={answers.estate}
          onHealthcareChange={updateHealthcare}
          onEstateChange={updateEstate}
        />
      )}
      {currentStep === 9 && (
        <>
          <StepRetirementContact
            t={t}
            household={answers.household}
            leadDetails={answers.leadDetails}
            onHouseholdChange={updateHousehold}
            onLeadDetailsChange={updateLeadDetails}
          />
          <FamilyConsentSection
            consent={consent}
            phone={answers.household.phone}
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
            <p className="family-submit-error" role="alert">
              {displayError}
            </p>
          ) : null}
        </>
      )}
    </AssessmentLayout>
  )
}
