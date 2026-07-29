import { Link } from 'react-router-dom'
import { crmHouseholdPath } from '../../../constants/routes'
import { useOptionalCrmNavigationGuard } from '../../navigation/CrmNavigationGuardContext'
import type { CrmHouseholdDetail, HouseholdOnboardingAssessment } from '../types'
import HouseholdOnboardingNavigation from './HouseholdOnboardingNavigation'
import HouseholdOnboardingProgress from './HouseholdOnboardingProgress'
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
import type { OnboardingCompletionValidation } from './onboardingCompletion'
import { formatOnboardingReadiness } from './onboardingCompletion'
import type { OnboardingProgressSnapshot } from './onboardingProgress'
import { getOnboardingSection, type OnboardingSectionId } from './onboardingSections'
import type { OnboardingSessionMode } from './loadHouseholdOnboarding'
import type { SectionValidationResult } from './onboardingValidation'
import OnboardingSectionBody from './sections/OnboardingSectionBody'

type HouseholdOnboardingLayoutProps = {
  household: CrmHouseholdDetail
  assessment: HouseholdOnboardingAssessment
  answers: HouseholdOnboardingAnswers
  mode: OnboardingSessionMode
  currentSectionId: OnboardingSectionId
  progress: OnboardingProgressSnapshot
  previousSectionId: OnboardingSectionId | null
  nextSectionId: OnboardingSectionId | null
  readOnly: boolean
  isDirty: boolean
  saving: boolean
  completing: boolean
  saveError: string | null
  saveConflict: boolean
  completeError: string | null
  currentSectionValidation: SectionValidationResult | null
  completion: OnboardingCompletionValidation | null
  onSelectSection: (sectionId: OnboardingSectionId) => void
  onAdjacentSection: (direction: 'previous' | 'next') => void
  onSaveDraft: (options?: { forceOverwrite?: boolean }) => Promise<unknown>
  onSaveAndContinue: (options?: { forceOverwrite?: boolean }) => Promise<unknown>
  onComplete: (options?: { forceOverwrite?: boolean }) => Promise<unknown>
  onRetrySave: () => Promise<unknown>
  onDismissSaveError: () => void
  onDismissCompleteError: () => void
  onReload: () => Promise<void>
  onChangeOverview: (
    overview:
      | OnboardingOverviewAnswers
      | ((prev: OnboardingOverviewAnswers) => OnboardingOverviewAnswers),
  ) => void
  onChangeMembersAnswers: (
    members:
      | OnboardingMembersAnswers
      | ((prev: OnboardingMembersAnswers) => OnboardingMembersAnswers),
  ) => void
  onChangeIncome: (
    income: OnboardingIncomeAnswers | ((prev: OnboardingIncomeAnswers) => OnboardingIncomeAnswers),
  ) => void
  onChangeCashFlow: (
    cashFlow:
      | OnboardingCashFlowAnswers
      | ((prev: OnboardingCashFlowAnswers) => OnboardingCashFlowAnswers),
  ) => void
  onChangeAssets: (
    assets: OnboardingAssetsAnswers | ((prev: OnboardingAssetsAnswers) => OnboardingAssetsAnswers),
  ) => void
  onChangeDebts: (
    debts: OnboardingDebtsAnswers | ((prev: OnboardingDebtsAnswers) => OnboardingDebtsAnswers),
  ) => void
  onChangeInsurance: (
    insurance:
      | OnboardingInsuranceAnswers
      | ((prev: OnboardingInsuranceAnswers) => OnboardingInsuranceAnswers),
  ) => void
  onChangeRetirement: (
    retirement:
      | OnboardingRetirementAnswers
      | ((prev: OnboardingRetirementAnswers) => OnboardingRetirementAnswers),
  ) => void
  onChangeEstate: (
    estate: OnboardingEstateAnswers | ((prev: OnboardingEstateAnswers) => OnboardingEstateAnswers),
  ) => void
  onChangeGoals: (
    goals: OnboardingGoalsAnswers | ((prev: OnboardingGoalsAnswers) => OnboardingGoalsAnswers),
  ) => void
  onHouseholdRefresh: () => Promise<void>
}

function statusBadgeLabel(mode: OnboardingSessionMode): string {
  return mode === 'completed' ? 'Completed' : 'Draft'
}

export default function HouseholdOnboardingLayout({
  household,
  assessment,
  answers,
  mode,
  currentSectionId,
  progress,
  previousSectionId,
  nextSectionId,
  readOnly,
  isDirty,
  saving,
  completing,
  saveError,
  saveConflict,
  completeError,
  currentSectionValidation,
  completion,
  onSelectSection,
  onAdjacentSection,
  onSaveDraft,
  onSaveAndContinue,
  onComplete,
  onRetrySave,
  onDismissSaveError,
  onDismissCompleteError,
  onReload,
  onChangeOverview,
  onChangeMembersAnswers,
  onChangeIncome,
  onChangeCashFlow,
  onChangeAssets,
  onChangeDebts,
  onChangeInsurance,
  onChangeRetirement,
  onChangeEstate,
  onChangeGoals,
  onHouseholdRefresh,
}: HouseholdOnboardingLayoutProps) {
  const navigationGuard = useOptionalCrmNavigationGuard()
  const section = getOnboardingSection(currentSectionId)
  const householdHref = crmHouseholdPath(household.id)
  const lastSavedLabel = answers.meta.lastSavedAt
    ? new Date(answers.meta.lastSavedAt).toLocaleString()
    : 'Not saved yet'
  const sectionNeedsAttention = currentSectionValidation?.status === 'needs_attention'
  const busy = saving || completing
  const onReview = currentSectionId === 'review'
  const canComplete = Boolean(completion?.canComplete)

  function leaveTo(to: string) {
    if (navigationGuard) {
      navigationGuard.requestNavigation(to)
      return
    }
    window.location.assign(to)
  }

  return (
    <div className="crm-onboarding-page">
      <div className="crm-household-workspace-nav">
        <button
          type="button"
          className="crm-text-btn"
          onClick={() => leaveTo(householdHref)}
        >
          ← Back to household
        </button>
      </div>

      <header className="crm-onboarding-header">
        <div>
          <p className="crm-page-eyebrow">Household Onboarding</p>
          <h1 className="crm-page-title">{household.display_name}</h1>
          <div className="crm-household-workspace-chips" aria-label="Onboarding status">
            <span className="crm-status-chip">{statusBadgeLabel(mode)}</span>
            {readOnly ? (
              <span className="crm-status-chip crm-status-chip-soft">Read only</span>
            ) : null}
            {!readOnly && isDirty ? (
              <span className="crm-status-chip crm-status-chip-soft">Unsaved changes</span>
            ) : null}
            {!readOnly && completion ? (
              <span className="crm-status-chip crm-status-chip-soft">
                {formatOnboardingReadiness(completion.readiness)}
              </span>
            ) : null}
          </div>
        </div>
        <dl className="crm-client-workspace-meta">
          <div>
            <dt>Assessment</dt>
            <dd className="crm-mono">{assessment.id.slice(0, 8)}…</dd>
          </div>
          <div>
            <dt>Last saved</dt>
            <dd>{lastSavedLabel}</dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>{new Date(answers.meta.startedAt).toLocaleString()}</dd>
          </div>
        </dl>
      </header>

      {readOnly ? (
        <p className="crm-banner crm-banner-warning" role="status">
          This onboarding assessment is completed and is shown read-only. A future phase will support
          starting a new onboarding cycle. Return to the household when finished reviewing.
        </p>
      ) : (
        <p className="crm-muted crm-onboarding-session-note" role="status">
          Use Save Draft to persist progress. Save and Continue stores the full answers document,
          then moves to the next section. Incomplete drafts can still be saved. Final completion is
          available on Financial Progress Review when all sections are ready.
        </p>
      )}

      {saveError ? (
        <div className="crm-banner crm-banner-error" role="alert">
          <p>{saveError}</p>
          <div className="crm-onboarding-save-error-actions">
            {saveConflict ? (
              <button
                type="button"
                className="crm-text-btn"
                disabled={busy}
                onClick={() => void onReload()}
              >
                Reload draft
              </button>
            ) : null}
            <button
              type="button"
              className="crm-text-btn"
              disabled={busy}
              onClick={() => void onRetrySave()}
            >
              {saveConflict ? 'Overwrite and save' : 'Retry save'}
            </button>
            <button type="button" className="crm-text-btn" onClick={onDismissSaveError}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {completeError ? (
        <div className="crm-banner crm-banner-error" role="alert">
          <p>{completeError}</p>
          <button type="button" className="crm-text-btn" onClick={onDismissCompleteError}>
            Dismiss
          </button>
        </div>
      ) : null}

      {!readOnly && sectionNeedsAttention ? (
        <p className="crm-banner crm-banner-warning" role="status">
          This section has invalid values that need attention. You can still save the draft; final
          completion requires all sections to be complete.
        </p>
      ) : null}

      <HouseholdOnboardingNavigation
        currentSectionId={currentSectionId}
        progress={progress}
        onSelectSection={onSelectSection}
      />

      <div className="crm-onboarding-layout">
        <HouseholdOnboardingProgress
          progress={progress}
          currentSectionId={currentSectionId}
          statusLabel={statusBadgeLabel(mode)}
          onSelectSection={onSelectSection}
        />

        <div className="crm-onboarding-main">
          <div className="crm-panel crm-onboarding-main-panel">
            <OnboardingSectionBody
              section={section}
              household={household}
              assessment={assessment}
              answers={answers}
              mode={mode}
              readOnly={readOnly}
              completion={completion}
              completing={completing}
              onEditSection={onSelectSection}
              onComplete={onComplete}
              onChangeOverview={onChangeOverview}
              onChangeMembersAnswers={onChangeMembersAnswers}
              onChangeIncome={onChangeIncome}
              onChangeCashFlow={onChangeCashFlow}
              onChangeAssets={onChangeAssets}
              onChangeDebts={onChangeDebts}
              onChangeInsurance={onChangeInsurance}
              onChangeRetirement={onChangeRetirement}
              onChangeEstate={onChangeEstate}
              onChangeGoals={onChangeGoals}
              onHouseholdRefresh={onHouseholdRefresh}
            />
          </div>

          <div className="crm-onboarding-actions">
            <button
              type="button"
              className="crm-secondary-btn"
              disabled={!previousSectionId || busy}
              onClick={() => onAdjacentSection('previous')}
            >
              Previous
            </button>
            <div className="crm-onboarding-actions-end">
              <button
                type="button"
                className="crm-secondary-btn"
                disabled={busy}
                onClick={() => leaveTo(householdHref)}
              >
                Exit onboarding
              </button>
              {!readOnly ? (
                <button
                  type="button"
                  className="crm-secondary-btn"
                  disabled={busy || (!isDirty && Boolean(answers.meta.lastSavedAt))}
                  onClick={() => void onSaveDraft()}
                >
                  {saving ? 'Saving…' : 'Save Draft'}
                </button>
              ) : null}
              {!readOnly && nextSectionId ? (
                <button
                  type="button"
                  className="crm-primary-btn"
                  disabled={busy}
                  onClick={() => void onSaveAndContinue()}
                >
                  {saving ? 'Saving…' : 'Save and Continue'}
                </button>
              ) : null}
              {!readOnly && onReview ? (
                <button
                  type="button"
                  className="crm-primary-btn"
                  disabled={busy || !canComplete}
                  onClick={() => void onComplete()}
                >
                  {completing ? 'Completing…' : 'Complete onboarding'}
                </button>
              ) : null}
              {readOnly ? (
                <Link to={householdHref} className="crm-primary-btn">
                  Return to household
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
