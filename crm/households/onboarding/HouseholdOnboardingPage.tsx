import { Link } from 'react-router-dom'
import { ROUTES } from '../../../constants/routes'
import HouseholdOnboardingLayout from './HouseholdOnboardingLayout'
import { useHouseholdOnboarding } from './useHouseholdOnboarding'

type HouseholdOnboardingPageProps = {
  householdId: string | undefined
}

export default function HouseholdOnboardingPage({ householdId }: HouseholdOnboardingPageProps) {
  const session = useHouseholdOnboarding(householdId)

  return (
    <div className="crm-household-workspace-page crm-onboarding-page-shell">
      {session.loading ? <p className="crm-muted">Loading household onboarding…</p> : null}

      {session.error ? (
        <div className="crm-banner crm-banner-error" role="alert">
          <p>{session.error}</p>
          <button type="button" className="crm-text-btn" onClick={() => void session.reload()}>
            Retry
          </button>
        </div>
      ) : null}

      {!session.loading && session.notFound ? (
        <section className="crm-panel">
          <div className="crm-empty-state">
            <p className="crm-empty-state-title">Household not found</p>
            <p>
              This household is unavailable or you do not have access. Return to the households list
              to continue.
            </p>
            <Link to={ROUTES.crmHouseholds} className="crm-text-btn">
              View households
            </Link>
          </div>
        </section>
      ) : null}

      {!session.loading &&
      !session.error &&
      !session.notFound &&
      session.household &&
      session.assessment &&
      session.answers &&
      session.mode &&
      session.progress ? (
        <HouseholdOnboardingLayout
          household={session.household}
          assessment={session.assessment}
          answers={session.answers}
          mode={session.mode}
          currentSectionId={session.currentSectionId}
          progress={session.progress}
          previousSectionId={session.previousSectionId}
          nextSectionId={session.nextSectionId}
          readOnly={session.readOnly}
          isDirty={session.isDirty}
          saving={session.saving}
          completing={session.completing}
          saveError={session.saveError}
          saveConflict={session.saveConflict}
          completeError={session.completeError}
          currentSectionValidation={session.currentSectionValidation}
          completion={session.completion}
          onSelectSection={session.goToSection}
          onAdjacentSection={session.goToAdjacentSection}
          onSaveDraft={session.saveDraft}
          onSaveAndContinue={session.saveAndContinue}
          onComplete={session.completeOnboarding}
          onRetrySave={session.retrySave}
          onDismissSaveError={session.dismissSaveError}
          onDismissCompleteError={session.dismissCompleteError}
          onReload={session.reload}
          onChangeOverview={session.setOverview}
          onChangeMembersAnswers={session.setMembersAnswers}
          onChangeIncome={session.setIncome}
          onChangeCashFlow={session.setCashFlow}
          onChangeAssets={session.setAssets}
          onChangeDebts={session.setDebts}
          onChangeInsurance={session.setInsurance}
          onChangeRetirement={session.setRetirement}
          onChangeEstate={session.setEstate}
          onChangeGoals={session.setGoals}
          onHouseholdRefresh={session.refreshHousehold}
        />
      ) : null}
    </div>
  )
}
