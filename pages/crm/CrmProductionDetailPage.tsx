import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CaseAttentionFlagList from '../../crm/production/CaseAttentionFlagList'
import {
  caseAttentionFlags,
  formatCaseAttentionLabels,
  formatCaseDeliveryStatusLabel,
  formatCaseProductLineLabel,
  formatCaseStageLabel,
} from '../../crm/production/caseWorkspace'
import {
  computeDaysInStage,
  formatMemberDisplayName,
  getActiveLinkedPolicy,
  getCurrentAllocations,
  getCurrentParticipants,
  isFollowUpOverdue,
  isStaleDaysInStage,
} from '../../crm/production/daysInStage'
import {
  formatProductionDeliveryLabel,
  formatProductionDispositionLabel,
  formatProductionParticipantRoleLabel,
  formatProductionStageLabel,
} from '../../crm/production/labels'
import { getProductionDetailViewState } from '../../crm/production/listLoadState'
import StageBadge from '../../crm/production/StageBadge'
import PolicyLifecycleBadge from '../../crm/production/PolicyLifecycleBadge'
import {
  POLICY_LIFECYCLE_CHARGEBACK_NOTE,
  isPlacedApplication,
  policyLifecycleDetailModel,
} from '../../crm/production/policyLifecycle'
import {
  fetchProductionApplicationById,
  formatCents,
  formatProductionDate,
  formatProductionDateTime,
  formatProductionSupabaseError,
} from '../../crm/production/productionApi'
import type { ProductionApplicationDetail } from '../../crm/production/types'
import { PRODUCTION_STALE_DAYS_IN_STAGE } from '../../crm/production/types'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import { formatOpportunityStatusLabel } from '../../crm/opportunities/opportunitiesApi'
import { crmNoteAuthorUserId } from '../../crm/households/noteAuthor'
import OperationalNotesPanel from '../../crm/households/OperationalNotesPanel'
import {
  ROUTES,
  crmHouseholdPath,
  crmOpportunityPath,
  crmProductionEditPath,
} from '../../constants/routes'
import ActualCommissionPanel from '../../crm/production/ActualCommissionPanel'
import ExpectedCompensationPanel from '../../crm/production/ExpectedCompensationPanel'
import {
  fetchLiveExpectedCompensations,
  fetchWritingCommissionSnapshot,
  formatCompensationDevError,
  type WritingCommissionSnapshotView,
} from '../../crm/production/compensationApi'
import { ACTUAL_LOAD_ERROR, formatCompensationUserError } from '../../crm/production/compensationErrors'
import type { CompensationViewer, LiveExpectedCompensationRow } from '../../crm/production/types'
import { isIncompleteDraft, canShowProductionEditAction } from '../../crm/production/applicationEditView'
import { transitionPolicyApplicationStage } from '../../crm/production/applicationApi'
import StageTransitionPanel from '../../crm/production/StageTransitionPanel'
import RequirementSection from '../../crm/production/RequirementSection'
import CaseOperationsSection from '../../crm/production/CaseOperationsSection'
import {
  defaultStageTransitionReason,
  type StageTransitionAction,
} from '../../crm/production/stageTransitionView'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

function householdWorkspaceTab(householdId: string, tab: string): string {
  return `${crmHouseholdPath(householdId)}?tab=${encodeURIComponent(tab)}`
}

export default function CrmProductionDetailPage() {
  const { applicationId = '' } = useParams<{ applicationId: string }>()
  const { role, profile } = useCrmAuth()
  const viewer: CompensationViewer = role === 'owner' ? 'owner' : 'advisor'
  const [application, setApplication] = useState<ProductionApplicationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [expectedRows, setExpectedRows] = useState<LiveExpectedCompensationRow[]>([])
  const [expectedLoading, setExpectedLoading] = useState(false)
  const [expectedError, setExpectedError] = useState<string | null>(null)
  const [actualSnapshot, setActualSnapshot] = useState<WritingCommissionSnapshotView | null>(null)
  const [actualLoading, setActualLoading] = useState(false)
  const [actualError, setActualError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [pendingAction, setPendingAction] = useState<StageTransitionAction | null>(null)
  const [stageSubmitting, setStageSubmitting] = useState(false)
  const [stageError, setStageError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
        setNotFound(false)
        setApplication(null)
        setExpectedRows([])
        setActualSnapshot(null)
        setExpectedError(null)
        setActualError(null)
        setPendingAction(null)
        setStageSubmitting(false)
        setStageError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const result = await fetchProductionApplicationById(supabase, applicationId)
        if (cancelled) return
        if (!result.ok && result.kind === 'not_found') {
          setNotFound(true)
          return
        }
        if (!result.ok) {
          setError(result.message)
          return
        }
        setApplication(result.application)
        setLoading(false)
        setExpectedLoading(true)
        setActualLoading(true)
        setExpectedError(null)
        setActualError(null)
        const [expectedResult, actualResult] = await Promise.allSettled([
          fetchLiveExpectedCompensations(supabase, [result.application.id]),
          fetchWritingCommissionSnapshot(supabase, result.application.id),
        ])
        if (cancelled) return
        if (expectedResult.status === 'fulfilled') {
          setExpectedRows(expectedResult.value.get(result.application.id) ?? [])
        } else {
          setExpectedRows([])
          setExpectedError(formatCompensationUserError(expectedResult.reason))
          if (import.meta.env.DEV) {
            console.error(
              '[crm/production/expected]',
              formatCompensationDevError('production-expected-detail', expectedResult.reason),
            )
          }
        }
        if (actualResult.status === 'fulfilled') {
          if (actualResult.value.ok) {
            setActualSnapshot(actualResult.value.snapshot)
          } else {
            setActualSnapshot(null)
            setActualError(actualResult.value.message)
          }
        } else {
          setActualSnapshot(null)
          setActualError(ACTUAL_LOAD_ERROR)
          if (import.meta.env.DEV) {
            console.error(
              '[crm/production/actual]',
              formatCompensationDevError('production-actual-detail', actualResult.reason),
            )
          }
        }
        setExpectedLoading(false)
        setActualLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError('Unable to load this production application.')
          if (import.meta.env.DEV) {
            console.error(
              '[crm/production/detail]',
              formatProductionSupabaseError('production-detail', err),
            )
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applicationId, reloadKey])

  const viewState = getProductionDetailViewState({
    loading,
    error,
    notFound,
    hasApplication: application != null,
  })

  if (viewState.kind === 'loading') {
    return (
      <div className="crm-page crm-production-page">
        <p className="crm-muted">Loading production application…</p>
      </div>
    )
  }

  if (viewState.kind === 'error') {
    return (
      <div className="crm-page crm-production-page">
        <div className="crm-banner crm-banner-error" role="alert">
          {viewState.message}
        </div>
        <Link to={ROUTES.crmProduction} className="crm-secondary-btn">
          Back to Production
        </Link>
      </div>
    )
  }

  if (viewState.kind === 'not_found' || !application) {
    return (
      <div className="crm-page crm-production-page">
        <header className="crm-page-header">
          <div>
            <p className="crm-page-eyebrow">Production</p>
            <h1 className="crm-page-title">Application not found</h1>
            <p className="crm-page-subtitle">
              This production application does not exist or is not visible for your account.
            </p>
          </div>
        </header>
        <Link to={ROUTES.crmProduction} className="crm-secondary-btn">
          Back to Production
        </Link>
      </div>
    )
  }

  const now = new Date()
  const { days, source: daysSource } = computeDaysInStage({
    productionStage: application.production_stage,
    stageHistory: application.stage_history,
    updatedAt: application.updated_at,
    now,
  })
  const stale = isStaleDaysInStage(days)
  const overdue = isFollowUpOverdue(application.next_follow_up_date, now)
  const attention = formatCaseAttentionLabels(caseAttentionFlags(application, now), application.product_line)
  const linked = getActiveLinkedPolicy(application)
  const lifecycle = policyLifecycleDetailModel(application)
  const participants = getCurrentParticipants(application.participants)
  const allocations = getCurrentAllocations(application.allocations)
  const isFia = application.product_line === 'fia'
  const householdName = application.household?.display_name?.trim() || 'Household'
  const history = application.stage_history
    .slice()
    .sort((a, b) => a.changed_at.localeCompare(b.changed_at))
  const incompleteDraft = isIncompleteDraft(application)
  const showEdit = canShowProductionEditAction({
    role,
    stage: application.production_stage,
    deletedAt: application.deleted_at,
  })
  const caseApplication = application

  async function runStageTransition(
    action: StageTransitionAction,
    input: { reason: string; policyNumber: string },
  ) {
    if (stageSubmitting) return
    setStageSubmitting(true)
    setStageError(null)
    const supabase = createSupabaseBrowserClient()
    const fields: Record<string, unknown> = {}
    const policyNumber = input.policyNumber.trim() || caseApplication.policy_number?.trim() || ''
    if (action.toStage === 'issued' && policyNumber) {
      fields.policy_number = policyNumber
    }
    const result = await transitionPolicyApplicationStage(supabase, {
      applicationId: caseApplication.id,
      toStage: action.toStage,
      reason: input.reason.trim() || defaultStageTransitionReason(action.toStage),
      fields,
    })
    if (!result.ok) {
      setStageError(result.message)
      setStageSubmitting(false)
      return
    }
    setPendingAction(null)
    setStageSubmitting(false)
    setReloadKey((n) => n + 1)
  }

  return (
    <div className="crm-page crm-production-page">
      <header className="crm-page-header">
        <div>
          <p className="crm-page-eyebrow">
            <Link to={ROUTES.crmProduction}>Production</Link>
            {' · '}
            Case workspace
          </p>
          <h1 className="crm-page-title">{householdName}</h1>
          <p className="crm-page-subtitle">
            {application.carrier?.name ?? 'Carrier'} · {application.product?.name ?? 'Product'} ·{' '}
            {formatCaseProductLineLabel(application.product_line)}
          </p>
        </div>
        <div className="crm-production-header-actions">
          <StageBadge stage={application.production_stage} />
          {lifecycle.statusLabel ? <PolicyLifecycleBadge status={linked?.status} /> : null}
          {showEdit ? (
            <Link to={crmProductionEditPath(application.id)} className="crm-primary-btn">
              Edit Application
            </Link>
          ) : null}
        </div>
      </header>

      {incompleteDraft ? (
        <div className="crm-banner crm-banner-warning" role="status">
          Incomplete draft — required participants or writing allocations are missing. Use Edit
          Application to finish this case.
        </div>
      ) : null}

      {application.deleted_at ? (
        <div className="crm-banner crm-banner-warning" role="status">
          This application is soft-deleted and is hidden from the default Production queue.
        </div>
      ) : null}

      <section className="crm-panel" aria-labelledby="pp-summary-heading">
        <div className="crm-panel-head">
          <h2 id="pp-summary-heading">Case summary</h2>
        </div>
        <p className="crm-muted">
          This application is the Case record. Track administrative carrier requirements in the
          section below. Application-scoped tasks and documents remain household-level for now.
        </p>
        <CaseAttentionFlagList labels={attention} />
        <dl className="crm-production-detail-grid">
          <div>
            <dt>Stage</dt>
            <dd>{formatCaseStageLabel(application.production_stage)}</dd>
          </div>
          <div>
            <dt>Days in stage</dt>
            <dd>
              {days}
              {stale ? ` · ${PRODUCTION_STALE_DAYS_IN_STAGE}+ days in stage` : ''}
              <span className="crm-muted">
                {' '}
                (
                {daysSource === 'stage_history'
                  ? 'from stage history'
                  : 'fallback: last update'}
                )
              </span>
            </dd>
          </div>
          <div>
            <dt>Next follow-up</dt>
            <dd className={overdue ? 'crm-production-overdue' : undefined}>
              {formatProductionDate(application.next_follow_up_date)}
              {overdue ? ' (overdue)' : ''}
            </dd>
          </div>
          <div>
            <dt>Last update</dt>
            <dd>{formatProductionDateTime(application.updated_at)}</dd>
          </div>
          <div>
            <dt>State</dt>
            <dd>{application.state || '—'}</dd>
          </div>
          <div>
            <dt>Replacement / exchange</dt>
            <dd>
              {application.is_replacement ? 'Replacement' : 'Not a replacement'}
              {' · '}
              {application.is_exchange_or_transfer ? 'Exchange/transfer' : 'No exchange/transfer'}
            </dd>
          </div>
        </dl>
      </section>

      <CaseOperationsSection
        application={application}
        role={role}
        onSaved={() => setReloadKey((n) => n + 1)}
      />

      <RequirementSection
        applicationId={application.id}
        productLine={application.product_line}
        productionStage={application.production_stage}
        deletedAt={application.deleted_at}
        submissionDate={application.submission_date}
        role={role}
      />

      <StageTransitionPanel
        application={application}
        role={role}
        submitting={stageSubmitting}
        error={stageError}
        pendingAction={pendingAction}
        onSelect={(action) => {
          if (stageSubmitting) return
          setStageError(null)
          if (action.consequential || action.needsReason || action.needsPolicyNumber) {
            setPendingAction(action)
            return
          }
          void runStageTransition(action, { reason: '', policyNumber: application.policy_number ?? '' })
        }}
        onCancel={() => {
          if (stageSubmitting) return
          setPendingAction(null)
          setStageError(null)
        }}
        onConfirm={(input) => {
          if (!pendingAction) return
          void runStageTransition(pendingAction, input)
        }}
      />

      <section className="crm-panel" aria-labelledby="pp-household-heading">
        <div className="crm-panel-head">
          <h2 id="pp-household-heading">Household / client</h2>
        </div>
        <p>
          <Link to={crmHouseholdPath(application.household_id)} className="crm-opportunities-name-link">
            {householdName}
          </Link>
        </p>
        {application.opportunity_id ? (
          <div className="crm-production-linked-opportunity">
            <dl className="crm-opportunity-overview-grid">
              <div>
                <dt>Linked opportunity</dt>
                <dd>
                  {application.linked_opportunity?.title?.trim()
                    ? application.linked_opportunity.title
                    : 'Opportunity'}
                </dd>
              </div>
              {application.linked_opportunity?.vertical_name ? (
                <div>
                  <dt>Primary Product / Service</dt>
                  <dd>{application.linked_opportunity.vertical_name}</dd>
                </div>
              ) : null}
              {application.linked_opportunity?.status === 'open' ||
              application.linked_opportunity?.status === 'won' ||
              application.linked_opportunity?.status === 'lost' ||
              application.linked_opportunity?.status === 'on_hold' ? (
                <div>
                  <dt>Sales status</dt>
                  <dd>{formatOpportunityStatusLabel(application.linked_opportunity.status)}</dd>
                </div>
              ) : null}
              {application.linked_opportunity?.stage_name ? (
                <div>
                  <dt>Sales stage</dt>
                  <dd>{application.linked_opportunity.stage_name}</dd>
                </div>
              ) : null}
              {application.linked_opportunity?.advisor_name ? (
                <div>
                  <dt>Assigned advisor</dt>
                  <dd>{application.linked_opportunity.advisor_name}</dd>
                </div>
              ) : null}
            </dl>
            <p>
              <Link
                to={crmOpportunityPath(application.opportunity_id)}
                className="crm-opportunities-secondary-link"
              >
                Open Opportunity
              </Link>
            </p>
          </div>
        ) : (
          <p className="crm-muted">No linked opportunity.</p>
        )}
      </section>

      <section className="crm-panel" aria-labelledby="pp-participants-heading">
        <div className="crm-panel-head">
          <h2 id="pp-participants-heading">Participants</h2>
        </div>
        {participants.length === 0 ? (
          <p className="crm-muted">No current participants on this application.</p>
        ) : (
          <ul className="crm-production-simple-list">
            {participants.map((row) => (
              <li key={row.id}>
                <strong>{formatProductionParticipantRoleLabel(row.role)}</strong>
                {' — '}
                {formatMemberDisplayName(row.member)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="crm-panel" aria-labelledby="pp-product-heading">
        <div className="crm-panel-head">
          <h2 id="pp-product-heading">Carrier / product</h2>
        </div>
        <dl className="crm-production-detail-grid">
          <div>
            <dt>Carrier</dt>
            <dd>{application.carrier?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>Product</dt>
            <dd>{application.product?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>Product line</dt>
            <dd>{formatCaseProductLineLabel(application.product_line)}</dd>
          </div>
          <div>
            <dt>Application state</dt>
            <dd>{application.state || '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="crm-panel" aria-labelledby="pp-money-heading">
        <div className="crm-panel-head">
          <h2 id="pp-money-heading">{isFia ? 'FIA deposit' : 'Life premium / face'}</h2>
        </div>
        {isFia ? (
          <dl className="crm-production-detail-grid">
            <div>
              <dt>Annuity deposit</dt>
              <dd>{formatCents(application.annuity_deposit_cents)}</dd>
            </div>
          </dl>
        ) : (
          <dl className="crm-production-detail-grid">
            <div>
              <dt>Face amount</dt>
              <dd>{formatCents(application.face_amount_cents)}</dd>
            </div>
            <div>
              <dt>Submitted premium</dt>
              <dd>{formatCents(application.submitted_premium_cents)}</dd>
            </div>
            <div>
              <dt>Target premium</dt>
              <dd>{formatCents(application.target_premium_cents)}</dd>
            </div>
            <div>
              <dt>Premium mode</dt>
              <dd>{application.premium_mode ?? '—'}</dd>
            </div>
          </dl>
        )}
        <p className="crm-muted">
          Production points (scaled): {application.total_points_scaled ?? '—'}
        </p>
      </section>

      <section className="crm-panel" aria-labelledby="pp-alloc-heading">
        <div className="crm-panel-head">
          <h2 id="pp-alloc-heading">Allocations</h2>
        </div>
        {allocations.length === 0 ? (
          <p className="crm-muted">No current writing or servicing allocations.</p>
        ) : (
          <ul className="crm-production-simple-list">
            {allocations.map((row) => (
              <li key={row.id}>
                <strong>
                  {row.allocation_role === 'writing' ? 'Writing' : 'Servicing'}
                </strong>
                {' · '}
                {row.recipient_type === 'house'
                  ? 'House'
                  : row.advisor?.display_name?.trim() || 'Advisor'}
                {' — '}
                commission {row.commission_bps} bps, production credit{' '}
                {row.production_credit_bps} bps
              </li>
            ))}
          </ul>
        )}
      </section>

      <ExpectedCompensationPanel
        viewer={viewer}
        productionStage={application.production_stage}
        allocations={allocations}
        liveRows={expectedRows}
        loading={expectedLoading}
        error={expectedError}
        writingReceivableExpected={application.writing_receivable_expected}
      />

      <ActualCommissionPanel
        viewer={viewer}
        snapshot={actualSnapshot}
        loading={actualLoading}
        error={actualError}
      />

      {lifecycle.visible ? (
        <section className="crm-panel crm-policy-lifecycle-section" aria-labelledby="pp-lifecycle-heading">
          <div className="crm-panel-head">
            <h2 id="pp-lifecycle-heading">Policy Lifecycle</h2>
          </div>
          <dl className="crm-production-detail-grid">
            <div>
              <dt>Current policy status</dt>
              <dd>
                {lifecycle.statusLabel ? (
                  <PolicyLifecycleBadge status={linked?.status} />
                ) : (
                  '—'
                )}
              </dd>
            </div>
            {lifecycle.showTerminationFacts ? (
              <>
                <div>
                  <dt>Terminated on</dt>
                  <dd>{formatProductionDate(lifecycle.terminatedOn)}</dd>
                </div>
                <div>
                  <dt>Termination reason</dt>
                  <dd>{lifecycle.terminationReason || '—'}</dd>
                </div>
              </>
            ) : null}
          </dl>
          <p className="crm-production-kpi-caption">{POLICY_LIFECYCLE_CHARGEBACK_NOTE}</p>
        </section>
      ) : null}

      <section className="crm-panel" aria-labelledby="pp-ids-heading">
        <div className="crm-panel-head">
          <h2 id="pp-ids-heading">Identifiers</h2>
        </div>
        <dl className="crm-production-detail-grid">
          <div>
            <dt>Application number</dt>
            <dd>{application.application_number ?? '—'}</dd>
          </div>
          <div>
            <dt>Application policy number</dt>
            <dd>{application.policy_number ?? '—'}</dd>
          </div>
          <div>
            <dt>Linked issued policy</dt>
            <dd>
              {linked
                ? `${linked.policy_number ?? 'No policy number'} (${linked.id})`
                : 'None'}
            </dd>
          </div>
          <div>
            <dt>Linked policy status</dt>
            <dd>
              {isPlacedApplication(application) && lifecycle.statusLabel
                ? lifecycle.statusLabel
                : (linked?.status ?? '—')}
            </dd>
          </div>
        </dl>
      </section>

      <section className="crm-panel" aria-labelledby="pp-dates-heading">
        <div className="crm-panel-head">
          <h2 id="pp-dates-heading">Production dates</h2>
        </div>
        <dl className="crm-production-detail-grid">
          <div>
            <dt>Submitted</dt>
            <dd>{formatProductionDate(application.submission_date)}</dd>
          </div>
          <div>
            <dt>Decision</dt>
            <dd>{formatProductionDate(application.decision_date)}</dd>
          </div>
          <div>
            <dt>Issue</dt>
            <dd>{formatProductionDate(application.issue_date)}</dd>
          </div>
          <div>
            <dt>In force</dt>
            <dd>{formatProductionDate(application.in_force_date)}</dd>
          </div>
          <div>
            <dt>Production month</dt>
            <dd>{formatProductionDate(application.production_month)}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatProductionDateTime(application.created_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="crm-panel" aria-labelledby="pp-status-heading">
        <div className="crm-panel-head">
          <h2 id="pp-status-heading">Approval / issue / delivery / in force</h2>
        </div>
        <dl className="crm-production-detail-grid">
          <div>
            <dt>Underwriting disposition</dt>
            <dd>{formatProductionDispositionLabel(application.underwriting_disposition)}</dd>
          </div>
          <div>
            <dt>{formatCaseDeliveryStatusLabel(application.product_line)}</dt>
            <dd>{formatProductionDeliveryLabel(application.delivery_status)}</dd>
          </div>
          <div>
            <dt>Production stage</dt>
            <dd>{formatProductionStageLabel(application.production_stage)}</dd>
          </div>
        </dl>
        <p className="crm-muted">
          Stage, delivery, and in-force actions stay in this Case workspace. Edit Application
          changes application details only. Issued and in-force historical corrections are not
          handled there.
        </p>
      </section>

      <section className="crm-panel" aria-labelledby="pp-history-heading">
        <div className="crm-panel-head">
          <h2 id="pp-history-heading">Stage history</h2>
        </div>
        {history.length === 0 ? (
          <p className="crm-muted">No stage-history rows are available for this application.</p>
        ) : (
          <ol className="crm-production-timeline">
            {history.map((entry) => (
              <li key={entry.id}>
                <div className="crm-production-timeline-when">
                  {formatProductionDateTime(entry.changed_at)}
                </div>
                <div>
                  {entry.from_stage
                    ? `${formatProductionStageLabel(entry.from_stage)} → `
                    : ''}
                  <strong>{formatProductionStageLabel(entry.to_stage)}</strong>
                </div>
                <div className="crm-muted">
                  Disposition:{' '}
                  {formatProductionDispositionLabel(entry.to_disposition ?? undefined)}
                  {' · '}
                  Delivery:{' '}
                  {formatProductionDeliveryLabel(entry.to_delivery_status ?? undefined)}
                </div>
                {entry.reason ? <div>Reason: {entry.reason}</div> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="crm-panel" aria-labelledby="pp-operational-notes-heading">
        <div className="crm-panel-head">
          <h2 id="pp-operational-notes-heading">Household Operational Notes — {householdName}</h2>
        </div>
        <p className="crm-muted">
          Client/household-level notes. The application note in Case Operations above is specific
          to this case and is not this timeline.
        </p>
        <OperationalNotesPanel
          householdId={application.household_id}
          householdName={householdName}
          authorUserId={crmNoteAuthorUserId(profile)}
        />
        <p>
          <Link to={householdWorkspaceTab(application.household_id, 'notes')}>
            Open full Household Operational Notes in household workspace
          </Link>
        </p>
      </section>

      <section className="crm-panel" aria-labelledby="pp-links-heading">
        <div className="crm-panel-head">
          <h2 id="pp-links-heading">Household workspace</h2>
        </div>
        <ul className="crm-production-simple-list">
          <li>
            <Link to={householdWorkspaceTab(application.household_id, 'notes')}>
              Household Operational Notes
            </Link>
          </li>
          <li>
            <Link to={householdWorkspaceTab(application.household_id, 'tasks')}>
              Household tasks
            </Link>
          </li>
          <li>
            <Link to={householdWorkspaceTab(application.household_id, 'documents')}>
              Household documents
            </Link>
          </li>
          <li>
            <Link to={householdWorkspaceTab(application.household_id, 'timeline')}>
              Household activity / timeline
            </Link>
          </li>
          <li>
            <Link to={crmHouseholdPath(application.household_id)}>Open household workspace</Link>
          </li>
        </ul>
      </section>
    </div>
  )
}
