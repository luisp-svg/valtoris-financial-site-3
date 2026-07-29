import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createSupabaseBrowserClient } from '../../../lib/supabase/client'
import { fetchHouseholdById } from '../householdsApi'
import {
  completeHouseholdOnboardingDraft,
  fetchLatestHouseholdOnboardingDraft,
  formatOnboardingError,
  updateHouseholdOnboardingDraft,
} from '../onboardingApi'
import type { CrmHouseholdDetail, HouseholdOnboardingAssessment } from '../types'
import {
  loadHouseholdOnboardingSession,
  type OnboardingSessionMode,
} from './loadHouseholdOnboarding'
import type {
  HouseholdOnboardingAnswers,
  OnboardingAssetsAnswers,
  OnboardingCashFlowAnswers,
  OnboardingDebtsAnswers,
  OnboardingEstateAnswers,
  OnboardingGoalsAnswers,
  OnboardingIncomeAnswers,
  OnboardingInsuranceAnswers,
  OnboardingMembersAnswers,
  OnboardingOverviewAnswers,
  OnboardingRetirementAnswers,
} from './onboardingFormTypes'
import { crmHouseholdOnboardingPath } from '../../../constants/routes'
import {
  answersToApiPayload,
  buildAnswersDocumentForSave,
  describeDraftFreshnessFailure,
  evaluateDraftFreshness,
  isAnswersDirty,
  serializeAnswersBaseline,
  type PersistDraftIntent,
} from './onboardingPersistence'
import { buildOnboardingProgressSnapshot, deriveCompletedSectionIds } from './onboardingProgress'
import {
  validateOnboardingCompletion,
  type OnboardingCompletionValidation,
} from './onboardingCompletion'
import { normalizeOnboardingAnswers } from './onboardingSchema'
import {
  DEFAULT_ONBOARDING_SECTION_ID,
  ONBOARDING_SECTION_QUERY_PARAM,
  getAdjacentOnboardingSection,
  isOnboardingSectionId,
  sectionIdFromSearchParams,
  type OnboardingSectionId,
} from './onboardingSections'
import { validateOnboardingSection } from './onboardingValidation'
import { useOnboardingNavigationGuardRegistration } from './useOnboardingNavigationGuardRegistration'

export type SaveDraftResult =
  | { ok: true; answers: HouseholdOnboardingAnswers }
  | { ok: false; message: string; conflict?: boolean }

export type CompleteOnboardingResult =
  | { ok: true; assessment: HouseholdOnboardingAssessment }
  | {
      ok: false
      message: string
      conflict?: boolean
      validation?: OnboardingCompletionValidation
    }

export type HouseholdOnboardingHookState = {
  loading: boolean
  error: string | null
  notFound: boolean
  household: CrmHouseholdDetail | null
  assessment: HouseholdOnboardingAssessment | null
  answers: HouseholdOnboardingAnswers | null
  mode: OnboardingSessionMode | null
  currentSectionId: OnboardingSectionId
  readOnly: boolean
  progress: ReturnType<typeof buildOnboardingProgressSnapshot> | null
  previousSectionId: OnboardingSectionId | null
  nextSectionId: OnboardingSectionId | null
  isDirty: boolean
  saving: boolean
  completing: boolean
  saveError: string | null
  saveConflict: boolean
  completeError: string | null
  lastSaveIntent: PersistDraftIntent | null
  currentSectionValidation: ReturnType<typeof validateOnboardingSection> | null
  completion: OnboardingCompletionValidation | null
  reload: () => Promise<void>
  refreshHousehold: () => Promise<void>
  goToSection: (sectionId: OnboardingSectionId) => void
  goToAdjacentSection: (direction: 'previous' | 'next') => void
  saveDraft: (options?: { forceOverwrite?: boolean }) => Promise<SaveDraftResult>
  saveAndContinue: (options?: { forceOverwrite?: boolean }) => Promise<SaveDraftResult>
  completeOnboarding: (options?: { forceOverwrite?: boolean }) => Promise<CompleteOnboardingResult>
  retrySave: () => Promise<SaveDraftResult>
  dismissSaveError: () => void
  dismissCompleteError: () => void
  updateAnswers: (
    updater: (prev: HouseholdOnboardingAnswers) => HouseholdOnboardingAnswers,
  ) => void
  setOverview: (
    overview:
      | OnboardingOverviewAnswers
      | ((prev: OnboardingOverviewAnswers) => OnboardingOverviewAnswers),
  ) => void
  setMembersAnswers: (
    members:
      | OnboardingMembersAnswers
      | ((prev: OnboardingMembersAnswers) => OnboardingMembersAnswers),
  ) => void
  setIncome: (
    income: OnboardingIncomeAnswers | ((prev: OnboardingIncomeAnswers) => OnboardingIncomeAnswers),
  ) => void
  setCashFlow: (
    cashFlow:
      | OnboardingCashFlowAnswers
      | ((prev: OnboardingCashFlowAnswers) => OnboardingCashFlowAnswers),
  ) => void
  setAssets: (
    assets: OnboardingAssetsAnswers | ((prev: OnboardingAssetsAnswers) => OnboardingAssetsAnswers),
  ) => void
  setDebts: (
    debts: OnboardingDebtsAnswers | ((prev: OnboardingDebtsAnswers) => OnboardingDebtsAnswers),
  ) => void
  setInsurance: (
    insurance:
      | OnboardingInsuranceAnswers
      | ((prev: OnboardingInsuranceAnswers) => OnboardingInsuranceAnswers),
  ) => void
  setRetirement: (
    retirement:
      | OnboardingRetirementAnswers
      | ((prev: OnboardingRetirementAnswers) => OnboardingRetirementAnswers),
  ) => void
  setEstate: (
    estate: OnboardingEstateAnswers | ((prev: OnboardingEstateAnswers) => OnboardingEstateAnswers),
  ) => void
  setGoals: (
    goals: OnboardingGoalsAnswers | ((prev: OnboardingGoalsAnswers) => OnboardingGoalsAnswers),
  ) => void
}

/**
 * Onboarding session hook with draft save/resume, dirty tracking, and recovery.
 */
export function useHouseholdOnboarding(
  householdId: string | undefined,
): HouseholdOnboardingHookState {
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [household, setHousehold] = useState<CrmHouseholdDetail | null>(null)
  const [assessment, setAssessment] = useState<HouseholdOnboardingAssessment | null>(null)
  const [answers, setAnswers] = useState<HouseholdOnboardingAnswers | null>(null)
  const [mode, setMode] = useState<OnboardingSessionMode | null>(null)
  const [resumeApplied, setResumeApplied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveConflict, setSaveConflict] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [lastSaveIntent, setLastSaveIntent] = useState<PersistDraftIntent | null>(null)
  const [baselineSerialized, setBaselineSerialized] = useState<string | null>(null)

  const loadGenerationRef = useRef(0)
  const setSearchParamsRef = useRef(setSearchParams)
  setSearchParamsRef.current = setSearchParams
  const answersRef = useRef(answers)
  answersRef.current = answers
  const assessmentRef = useRef(assessment)
  assessmentRef.current = assessment
  const householdRef = useRef(household)
  householdRef.current = household
  const modeRef = useRef(mode)
  modeRef.current = mode

  const applyLoadedSession = useCallback(
    (
      nextHousehold: CrmHouseholdDetail,
      nextAssessment: HouseholdOnboardingAssessment,
      nextAnswers: HouseholdOnboardingAnswers,
      nextMode: OnboardingSessionMode,
    ) => {
      setHousehold(nextHousehold)
      setAssessment(nextAssessment)
      setAnswers(nextAnswers)
      setMode(nextMode)
      setBaselineSerialized(serializeAnswersBaseline(nextAnswers))
      setSaveError(null)
      setSaveConflict(false)
      setCompleteError(null)
      setLastSaveIntent(null)
      setNotFound(false)
      setError(null)
    },
    [],
  )

  const load = useCallback(async () => {
    if (!householdId) {
      setLoading(false)
      setNotFound(true)
      setHousehold(null)
      setAssessment(null)
      setAnswers(null)
      setMode(null)
      setError(null)
      setResumeApplied(false)
      setBaselineSerialized(null)
      return
    }

    const generation = ++loadGenerationRef.current

    setLoading(true)
    setError(null)
    setNotFound(false)
    setResumeApplied(false)

    const supabase = createSupabaseBrowserClient()
    const result = await loadHouseholdOnboardingSession(supabase, householdId)
    if (generation !== loadGenerationRef.current) return

    if (!result.ok) {
      setHousehold(null)
      setAssessment(null)
      setAnswers(null)
      setMode(null)
      setBaselineSerialized(null)
      if (result.reason === 'not_found') {
        setNotFound(true)
        setError(null)
      } else {
        setNotFound(false)
        setError(result.message)
      }
      setLoading(false)
      return
    }

    applyLoadedSession(result.household, result.assessment, result.answers, result.mode)
    setLoading(false)

    setSearchParamsRef.current(
      (current) => {
        const raw = current.get(ONBOARDING_SECTION_QUERY_PARAM)
        if (raw && isOnboardingSectionId(raw)) {
          return current
        }
        const resumeSection = result.answers.meta.lastSection || DEFAULT_ONBOARDING_SECTION_ID
        const next = new URLSearchParams(current)
        next.set(ONBOARDING_SECTION_QUERY_PARAM, resumeSection)
        return next
      },
      { replace: true },
    )
    setResumeApplied(true)
  }, [applyLoadedSession, householdId])

  useEffect(() => {
    void load()
  }, [load])

  const refreshHousehold = useCallback(async () => {
    if (!householdId) return
    const supabase = createSupabaseBrowserClient()
    try {
      const next = await fetchHouseholdById(supabase, householdId)
      if (next) setHousehold(next)
    } catch {
      // Keep existing household snapshot; member form surfaces its own errors.
    }
  }, [householdId])

  const resumeFallback =
    resumeApplied && answers ? answers.meta.lastSection : DEFAULT_ONBOARDING_SECTION_ID
  const currentSectionId = sectionIdFromSearchParams(searchParams, resumeFallback)
  const readOnly = mode === 'completed'
  const isDirty = Boolean(
    answers && !readOnly && isAnswersDirty(answers, baselineSerialized),
  )

  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  // Note: react-router useBlocker requires a data router; this app uses BrowserRouter.
  // In-app exits are guarded by CrmNavigationGuardProvider (sidebar/links/Exit).
  // Browser back is not reliably interceptable here; beforeunload still covers refresh/close.

  const goToSection = useCallback(
    (sectionId: OnboardingSectionId) => {
      setAnswers((prev) =>
        prev
          ? {
              ...prev,
              meta: {
                ...prev.meta,
                lastSection: sectionId,
              },
            }
          : prev,
      )
      const next = new URLSearchParams(searchParams)
      next.set(ONBOARDING_SECTION_QUERY_PARAM, sectionId)
      setSearchParams(next, { replace: false })
    },
    [searchParams, setSearchParams],
  )

  const goToAdjacentSection = useCallback(
    (direction: 'previous' | 'next') => {
      const adjacent = getAdjacentOnboardingSection(currentSectionId, direction)
      if (adjacent) goToSection(adjacent)
    },
    [currentSectionId, goToSection],
  )

  const navigateToSectionClean = useCallback(
    (sectionId: OnboardingSectionId) => {
      const next = new URLSearchParams(searchParams)
      next.set(ONBOARDING_SECTION_QUERY_PARAM, sectionId)
      setSearchParams(next, { replace: false })
    },
    [searchParams, setSearchParams],
  )

  const persistAnswers = useCallback(
    async (args: {
      intent: PersistDraftIntent
      document: HouseholdOnboardingAnswers
      forceOverwrite?: boolean
    }): Promise<SaveDraftResult> => {
      const currentAssessment = assessmentRef.current
      const currentHousehold = householdRef.current
      const currentMode = modeRef.current

      if (!currentAssessment || !currentHousehold || currentMode !== 'draft') {
        const message = 'Only draft onboarding assessments can be saved.'
        setSaveError(message)
        setSaveConflict(false)
        return { ok: false, message }
      }

      setSaving(true)
      setSaveError(null)
      setSaveConflict(false)
      setLastSaveIntent(args.intent)

      const supabase = createSupabaseBrowserClient()

      try {
        if (!args.forceOverwrite) {
          const latest = await fetchLatestHouseholdOnboardingDraft(
            supabase,
            currentHousehold.id,
          )
          const freshness = evaluateDraftFreshness({
            loadedAssessmentId: currentAssessment.id,
            loadedUpdatedAt: currentAssessment.updated_at,
            latest,
          })
          if (freshness.status !== 'fresh') {
            const message = describeDraftFreshnessFailure(freshness)
            setSaveError(message)
            setSaveConflict(freshness.status === 'stale')
            setSaving(false)
            return { ok: false, message, conflict: freshness.status === 'stale' }
          }
        }

        const updated = await updateHouseholdOnboardingDraft(
          supabase,
          currentAssessment.id,
          currentHousehold.id,
          { answers: answersToApiPayload(args.document) },
        )

        const normalized = normalizeOnboardingAnswers(updated.answers)
        setAssessment(updated)
        setAnswers(normalized)
        setBaselineSerialized(serializeAnswersBaseline(normalized))
        setSaveError(null)
        setSaveConflict(false)
        setSaving(false)
        return { ok: true, answers: normalized }
      } catch (err) {
        const message = formatOnboardingError('save_onboarding_draft', err)
        setSaveError(message)
        setSaveConflict(false)
        setSaving(false)
        return { ok: false, message }
      }
    },
    [],
  )

  const saveDraft = useCallback(
    async (options?: { forceOverwrite?: boolean }): Promise<SaveDraftResult> => {
      const current = answersRef.current
      const currentHousehold = householdRef.current
      if (!current || !currentHousehold) {
        const message = 'Nothing to save yet.'
        setSaveError(message)
        return { ok: false, message }
      }

      const completedSectionIds = deriveCompletedSectionIds({
        answers: current,
        assessmentStatus: 'draft',
        currentSectionId,
        household: currentHousehold,
      })

      const document = buildAnswersDocumentForSave({
        answers: current,
        lastSection: currentSectionId,
        completedSectionIds,
      })

      return persistAnswers({
        intent: 'save_draft',
        document,
        forceOverwrite: options?.forceOverwrite,
      })
    },
    [currentSectionId, persistAnswers],
  )

  const saveAndContinue = useCallback(
    async (options?: { forceOverwrite?: boolean }): Promise<SaveDraftResult> => {
      const current = answersRef.current
      const currentHousehold = householdRef.current
      if (!current || !currentHousehold) {
        const message = 'Nothing to save yet.'
        setSaveError(message)
        return { ok: false, message }
      }

      const nextSectionId = getAdjacentOnboardingSection(currentSectionId, 'next')
      const targetSection = nextSectionId ?? currentSectionId

      const completedSectionIds = deriveCompletedSectionIds({
        answers: current,
        assessmentStatus: 'draft',
        currentSectionId,
        household: currentHousehold,
      })

      const document = buildAnswersDocumentForSave({
        answers: current,
        lastSection: targetSection,
        completedSectionIds,
      })

      const result = await persistAnswers({
        intent: 'save_and_continue',
        document,
        forceOverwrite: options?.forceOverwrite,
      })

      if (result.ok && nextSectionId) {
        navigateToSectionClean(nextSectionId)
      }
      return result
    },
    [currentSectionId, navigateToSectionClean, persistAnswers],
  )

  const retrySave = useCallback(async () => {
    if (lastSaveIntent === 'save_and_continue') {
      return saveAndContinue({ forceOverwrite: saveConflict })
    }
    return saveDraft({ forceOverwrite: saveConflict })
  }, [lastSaveIntent, saveAndContinue, saveConflict, saveDraft])

  const dismissSaveError = useCallback(() => {
    setSaveError(null)
    setSaveConflict(false)
  }, [])

  const dismissCompleteError = useCallback(() => {
    setCompleteError(null)
  }, [])

  const completeOnboarding = useCallback(
    async (options?: { forceOverwrite?: boolean }): Promise<CompleteOnboardingResult> => {
      const current = answersRef.current
      const currentHousehold = householdRef.current
      const currentAssessment = assessmentRef.current
      const currentMode = modeRef.current

      if (!current || !currentHousehold || !currentAssessment || currentMode !== 'draft') {
        const message = 'Only draft onboarding assessments can be completed.'
        setCompleteError(message)
        return { ok: false, message }
      }

      const validation = validateOnboardingCompletion(current, { household: currentHousehold })
      if (!validation.canComplete) {
        const message =
          'Onboarding is not ready to complete. Resolve incomplete sections and validation errors first.'
        setCompleteError(message)
        return { ok: false, message, validation }
      }

      setCompleteError(null)

      const completedSectionIds = deriveCompletedSectionIds({
        answers: current,
        assessmentStatus: 'draft',
        currentSectionId: 'review',
        household: currentHousehold,
      })

      const document = buildAnswersDocumentForSave({
        answers: current,
        lastSection: 'review',
        completedSectionIds,
      })

      // Completion API does not persist answers — save the full document first.
      const saveResult = await persistAnswers({
        intent: 'save_draft',
        document,
        forceOverwrite: options?.forceOverwrite,
      })
      if (!saveResult.ok) {
        setCompleteError(saveResult.message)
        return {
          ok: false,
          message: saveResult.message,
          conflict: saveResult.conflict,
          validation,
        }
      }

      setCompleting(true)
      try {
        const supabase = createSupabaseBrowserClient()
        const latestAssessment = assessmentRef.current
        if (!latestAssessment) {
          const message = 'Draft assessment is no longer available.'
          setCompleteError(message)
          setCompleting(false)
          return { ok: false, message, validation }
        }
        const completed = await completeHouseholdOnboardingDraft(
          supabase,
          latestAssessment.id,
          currentHousehold.id,
        )
        const normalized = normalizeOnboardingAnswers(completed.answers)
        setAssessment(completed)
        setAnswers(normalized)
        setMode('completed')
        setBaselineSerialized(serializeAnswersBaseline(normalized))
        setSaveError(null)
        setSaveConflict(false)
        setCompleteError(null)
        setCompleting(false)
        return { ok: true, assessment: completed }
      } catch (err) {
        const message = formatOnboardingError('complete_onboarding', err)
        setCompleteError(message)
        setCompleting(false)
        return { ok: false, message, validation }
      }
    },
    [persistAnswers],
  )

  const saveAndLeave = useCallback(async () => {
    const result = await saveDraft()
    if (result.ok) return { ok: true as const }
    return { ok: false as const, message: result.message }
  }, [saveDraft])

  useOnboardingNavigationGuardRegistration({
    enabled: Boolean(householdId) && mode === 'draft',
    scopePathname: householdId ? crmHouseholdOnboardingPath(householdId) : '',
    isBlocked: isDirty,
    saveAndLeave,
  })

  const updateAnswers = useCallback(
    (updater: (prev: HouseholdOnboardingAnswers) => HouseholdOnboardingAnswers) => {
      setAnswers((prev) => (prev ? updater(prev) : prev))
    },
    [],
  )

  const setOverview = useCallback(
    (
      overview:
        | OnboardingOverviewAnswers
        | ((prev: OnboardingOverviewAnswers) => OnboardingOverviewAnswers),
    ) => {
      updateAnswers((prev) => ({
        ...prev,
        overview: typeof overview === 'function' ? overview(prev.overview) : overview,
      }))
    },
    [updateAnswers],
  )

  const setMembersAnswers = useCallback(
    (
      members:
        | OnboardingMembersAnswers
        | ((prev: OnboardingMembersAnswers) => OnboardingMembersAnswers),
    ) => {
      updateAnswers((prev) => ({
        ...prev,
        members: typeof members === 'function' ? members(prev.members) : members,
      }))
    },
    [updateAnswers],
  )

  const setIncome = useCallback(
    (
      income: OnboardingIncomeAnswers | ((prev: OnboardingIncomeAnswers) => OnboardingIncomeAnswers),
    ) => {
      updateAnswers((prev) => ({
        ...prev,
        income: typeof income === 'function' ? income(prev.income) : income,
      }))
    },
    [updateAnswers],
  )

  const setCashFlow = useCallback(
    (
      cashFlow:
        | OnboardingCashFlowAnswers
        | ((prev: OnboardingCashFlowAnswers) => OnboardingCashFlowAnswers),
    ) => {
      updateAnswers((prev) => ({
        ...prev,
        cashFlow: typeof cashFlow === 'function' ? cashFlow(prev.cashFlow) : cashFlow,
      }))
    },
    [updateAnswers],
  )

  const setAssets = useCallback(
    (
      assets: OnboardingAssetsAnswers | ((prev: OnboardingAssetsAnswers) => OnboardingAssetsAnswers),
    ) => {
      updateAnswers((prev) => ({
        ...prev,
        assets: typeof assets === 'function' ? assets(prev.assets) : assets,
      }))
    },
    [updateAnswers],
  )

  const setDebts = useCallback(
    (
      debts: OnboardingDebtsAnswers | ((prev: OnboardingDebtsAnswers) => OnboardingDebtsAnswers),
    ) => {
      updateAnswers((prev) => ({
        ...prev,
        debts: typeof debts === 'function' ? debts(prev.debts) : debts,
      }))
    },
    [updateAnswers],
  )

  const setInsurance = useCallback(
    (
      insurance:
        | OnboardingInsuranceAnswers
        | ((prev: OnboardingInsuranceAnswers) => OnboardingInsuranceAnswers),
    ) => {
      updateAnswers((prev) => ({
        ...prev,
        insurance: typeof insurance === 'function' ? insurance(prev.insurance) : insurance,
      }))
    },
    [updateAnswers],
  )

  const setRetirement = useCallback(
    (
      retirement:
        | OnboardingRetirementAnswers
        | ((prev: OnboardingRetirementAnswers) => OnboardingRetirementAnswers),
    ) => {
      updateAnswers((prev) => ({
        ...prev,
        retirement: typeof retirement === 'function' ? retirement(prev.retirement) : retirement,
      }))
    },
    [updateAnswers],
  )

  const setEstate = useCallback(
    (
      estate: OnboardingEstateAnswers | ((prev: OnboardingEstateAnswers) => OnboardingEstateAnswers),
    ) => {
      updateAnswers((prev) => ({
        ...prev,
        estate: typeof estate === 'function' ? estate(prev.estate) : estate,
      }))
    },
    [updateAnswers],
  )

  const setGoals = useCallback(
    (
      goals: OnboardingGoalsAnswers | ((prev: OnboardingGoalsAnswers) => OnboardingGoalsAnswers),
    ) => {
      updateAnswers((prev) => ({
        ...prev,
        goals: typeof goals === 'function' ? goals(prev.goals) : goals,
      }))
    },
    [updateAnswers],
  )

  const progress = useMemo(() => {
    if (!answers || !mode || !household) return null
    return buildOnboardingProgressSnapshot({
      answers,
      currentSectionId,
      assessmentStatus: mode === 'completed' ? 'completed' : 'draft',
      household,
    })
  }, [answers, currentSectionId, household, mode])

  const currentSectionValidation = useMemo(() => {
    if (!answers || !household || readOnly) return null
    return validateOnboardingSection(currentSectionId, answers, { household })
  }, [answers, currentSectionId, household, readOnly])

  const completion = useMemo(() => {
    if (!answers || !household) return null
    return validateOnboardingCompletion(answers, { household })
  }, [answers, household])

  return {
    loading,
    error,
    notFound,
    household,
    assessment,
    answers,
    mode,
    currentSectionId,
    readOnly,
    progress,
    previousSectionId: getAdjacentOnboardingSection(currentSectionId, 'previous'),
    nextSectionId: getAdjacentOnboardingSection(currentSectionId, 'next'),
    isDirty,
    saving,
    completing,
    saveError,
    saveConflict,
    completeError,
    lastSaveIntent,
    currentSectionValidation,
    completion,
    reload: load,
    refreshHousehold,
    goToSection,
    goToAdjacentSection,
    saveDraft,
    saveAndContinue,
    completeOnboarding,
    retrySave,
    dismissSaveError,
    dismissCompleteError,
    updateAnswers,
    setOverview,
    setMembersAnswers,
    setIncome,
    setCashFlow,
    setAssets,
    setDebts,
    setInsurance,
    setRetirement,
    setEstate,
    setGoals,
  }
}
