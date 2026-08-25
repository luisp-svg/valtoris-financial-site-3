import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import NavigationButtons from '../components/assessment/NavigationButtons'
import FamilyConsentSection from '../components/assessment/steps/FamilyConsentSection'
import { useReportCardCopy } from '../components/assessment/reportCardLocale'
import { formatSpecializedTemplate } from '../components/assessment/specialized/locale'
import SpecializedLocaleSwitcher from '../components/assessment/specialized/SpecializedLocaleSwitcher'
import CalculatorLayout from '../components/calculator/CalculatorLayout'
import { CALCULATOR_STORAGE_KEY, CALCULATOR_TOTAL_STEPS } from '../components/calculator/constants'
import { protectionCopy } from '../components/calculator/protectionCopy'
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
  const { locale, t, withLocale } = useReportCardCopy(protectionCopy)
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
      navigate(withLocale(ROUTES.protectionAnalysis))
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

    navigate(withLocale(ROUTES.protectionResults), {
      state: { answers, submissionSaved: true, submissionId: result.submissionId },
    })
  }

  const displayError =
    submitError === 'Please confirm the required acknowledgments before viewing your report.'
      ? t('validation', 'consentRequired')
      : submitError
        ? t('validation', 'submitFailed')
        : null

  return (
    <CalculatorLayout
      currentStep={currentStep}
      title={t('ui', 'calculatorTitle')}
      subtitle={t('ui', 'calculatorSubtitle')}
      disclaimer={t('ui', 'calculatorDisclaimer')}
      stepIndicator={formatSpecializedTemplate(t('ui', 'stepIndicator'), {
        current: currentStep,
        total: CALCULATOR_TOTAL_STEPS,
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
        <NavigationButtons
          onBack={handleBack}
          onContinue={handleContinue}
          backLabel={t('ui', 'back')}
          continueDisabled={!canContinue || isSubmitting}
          continueLabel={
            isSubmitting
              ? t('ui', 'saving')
              : currentStep === CALCULATOR_TOTAL_STEPS
                ? t('ui', 'viewResults')
                : currentStep === 1
                  ? t('ui', 'startCta')
                  : t('ui', 'continue')
          }
        />
      }
    >
      {currentStep === 1 && (
        <CalcStepOneFamily
          t={t}
          answers={answers.family}
          onChange={(field, value) => updateSection('family', field, value)}
        />
      )}
      {currentStep === 2 && (
        <CalcStepTwoIncome
          t={t}
          answers={answers.income}
          onChange={(field, value) => updateSection('income', field, value)}
        />
      )}
      {currentStep === 3 && (
        <CalcStepThreeHousing
          t={t}
          answers={answers.housing}
          onChange={(field, value) => updateSection('housing', field, value)}
        />
      )}
      {currentStep === 4 && (
        <CalcStepFourDebt
          t={t}
          answers={answers.debt}
          allAnswers={answers}
          onChange={(field, value) => updateSection('debt', field, value)}
        />
      )}
      {currentStep === 5 && (
        <CalcStepFiveEducation
          t={t}
          answers={answers.education}
          onChange={(field, value) => updateSection('education', field, value)}
        />
      )}
      {currentStep === 6 && (
        <CalcStepSixFinalExpenses
          t={t}
          answers={answers.finalExpenses}
          onChange={(field, value) => updateSection('finalExpenses', field, value)}
        />
      )}
      {currentStep === 7 && (
        <>
          <CalcStepSevenCoverage
            t={t}
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
    </CalculatorLayout>
  )
}
