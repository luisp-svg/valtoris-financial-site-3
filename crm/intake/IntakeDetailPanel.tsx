import { Link } from 'react-router-dom'
import { crmHouseholdAssessmentDetailPath, crmHouseholdPath } from '../../constants/routes'
import type {
  DuplicateResolutionWriteAction,
  IntakeHouseholdSummary,
  IntakeQueueItem,
} from './types'
import { DUPLICATE_RESOLUTION_OWNER_ONLY_MESSAGE } from './types'
import {
  intakeProductLabel,
  isDigitalIdentityLead,
  mapMatchReasonLabel,
  mapMatchStatusLabel,
  mapSheetsSyncLabel,
} from './intakeFormatters'
import {
  formatTaskDueDate,
  intakeTaskIndicatorLabel,
  mapTaskStatusLabel,
} from './intakeTaskAutomation'

type IntakeDetailPanelProps = {
  item: IntakeQueueItem
  candidateHousehold: IntakeHouseholdSummary | null
  candidateLoading: boolean
  candidateError: string | null
  isOwner: boolean
  resolving: boolean
  resolveError: string | null
  resolveSuccess: {
    action: DuplicateResolutionWriteAction
    resultingHouseholdId: string
    alreadyResolved: boolean
  } | null
  retryingTask?: boolean
  retryTaskMessage?: string | null
  onClose: () => void
  onRequestResolve: (action: DuplicateResolutionWriteAction) => void
  onRetryFollowUpTask?: () => void
}

function ConsentRow({ label, allowed }: { label: string; allowed: boolean }) {
  return (
    <li className={`crm-intake-consent-row${allowed ? ' is-allowed' : ' is-denied'}`}>
      <span className="crm-intake-consent-label">{label}</span>
      <span className="crm-intake-consent-value">{allowed ? 'Yes' : 'No'}</span>
    </li>
  )
}

export default function IntakeDetailPanel({
  item,
  candidateHousehold,
  candidateLoading,
  candidateError,
  isOwner,
  resolving,
  resolveError,
  resolveSuccess,
  retryingTask = false,
  retryTaskMessage = null,
  onClose,
  onRequestResolve,
  onRetryFollowUpTask,
}: IntakeDetailPanelProps) {
  const isDi = isDigitalIdentityLead(item)
  const diagnostic = item.diagnostic
  const digitalIdentity = item.digitalIdentity
  const productLabel = intakeProductLabel(item)
  const showDuplicate =
    item.ingestMatchStatus === 'possible_match' || item.duplicateReview?.status === 'pending'
  const canResolve =
    isOwner &&
    Boolean(item.duplicateReview?.id) &&
    item.duplicateReview?.status === 'pending' &&
    !resolving &&
    !resolveSuccess
  const followUpTask = item.followUpTask
  const showTaskRetry =
    isOwner &&
    Boolean(onRetryFollowUpTask) &&
    (item.followUpTaskAutomationStatus === 'task_failed' ||
      (item.followUpTaskAutomationStatus === 'task_pending' && !followUpTask))

  return (
    <section
      className="crm-panel crm-intake-detail"
      role="dialog"
      aria-modal="false"
      aria-labelledby="crm-intake-detail-title"
    >
      <div className="crm-panel-head">
        <div>
          <p className="crm-muted">Incoming lead review · {productLabel}</p>
          <h2 id="crm-intake-detail-title">{item.submittedFullName || 'Prospect'}</h2>
        </div>
        <button type="button" className="platform-btn platform-btn-outline" onClick={onClose}>
          Close
        </button>
      </div>

      {resolveSuccess ? (
        <p className="crm-banner crm-banner-success" role="status">
          {resolveSuccess.alreadyResolved
            ? 'This duplicate review was already resolved the same way.'
            : resolveSuccess.action === 'confirm_same_household'
              ? isDi
                ? 'Confirmed same household. The Digital Identity lead is linked to the candidate household.'
                : 'Confirmed same household. Lead and Initial Financial Diagnostic are linked to the candidate household.'
              : 'Kept as a separate household. The provisional prospect remains active.'}{' '}
          <Link to={crmHouseholdPath(resolveSuccess.resultingHouseholdId)}>
            Open resulting household
          </Link>
        </p>
      ) : null}

      {resolveError ? (
        <p className="crm-banner crm-banner-error" role="alert">
          {resolveError}
        </p>
      ) : null}

      <div className="crm-intake-detail-grid">
        <section className="crm-intake-detail-section" aria-labelledby="crm-intake-submitted-heading">
          <h3 id="crm-intake-submitted-heading">Submitted contact snapshot</h3>
          <p className="crm-muted">
            {isDi
              ? 'Information provided on Let’s Connect. This is not automatically applied to the canonical household record.'
              : 'Information provided on the public Family Report Card. This is not automatically applied to the canonical household record.'}
          </p>
          <dl className="crm-intake-dl">
            <div>
              <dt>Name</dt>
              <dd>{item.submittedFullName || '—'}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{item.submittedEmail || '—'}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{item.submittedPhone || '—'}</dd>
            </div>
            {isDi && digitalIdentity?.company ? (
              <div>
                <dt>Company</dt>
                <dd>{digitalIdentity.company}</dd>
              </div>
            ) : null}
            {isDi && digitalIdentity?.title ? (
              <div>
                <dt>Job title</dt>
                <dd>{digitalIdentity.title}</dd>
              </div>
            ) : null}
            {isDi && digitalIdentity?.reason ? (
              <div>
                <dt>Reason for connecting</dt>
                <dd>{digitalIdentity.reason}</dd>
              </div>
            ) : null}
            {isDi && digitalIdentity?.preferredFollowUp ? (
              <div>
                <dt>Preferred follow-up</dt>
                <dd>{digitalIdentity.preferredFollowUp}</dd>
              </div>
            ) : null}
            {isDi && digitalIdentity?.note ? (
              <div>
                <dt>Note</dt>
                <dd>{digitalIdentity.note}</dd>
              </div>
            ) : null}
            <div>
              <dt>Submitted</dt>
              <dd>{new Date(item.submittedAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Source page</dt>
              <dd>{item.sourcePage || '—'}</dd>
            </div>
            <div>
              <dt>Campaign</dt>
              <dd>
                {item.originalCampaign ||
                  digitalIdentity?.campaignCode ||
                  String(item.sourceMetadata.utmCampaign ?? '—')}
              </dd>
            </div>
          </dl>
        </section>

        <section className="crm-intake-detail-section" aria-labelledby="crm-intake-crm-heading">
          <h3 id="crm-intake-crm-heading">CRM linkage</h3>
          <dl className="crm-intake-dl">
            <div>
              <dt>Lead type</dt>
              <dd>{productLabel}</dd>
            </div>
            <div>
              <dt>Match status</dt>
              <dd>{mapMatchStatusLabel(item.ingestMatchStatus)}</dd>
            </div>
            <div>
              <dt>Lead status</dt>
              <dd>{item.leadStatus.replace(/_/g, ' ')}</dd>
            </div>
            <div>
              <dt>Assigned advisor</dt>
              <dd>{item.assignedAdvisor?.displayName ?? 'Unassigned'}</dd>
            </div>
            <div>
              <dt>Linked household</dt>
              <dd>
                {item.household ? (
                  <Link to={crmHouseholdPath(item.household.id)}>{item.household.displayName}</Link>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt>Sheets sync</dt>
              <dd>{mapSheetsSyncLabel(item.sheetsSyncStatus)}</dd>
            </div>
            <div>
              <dt>Task automation</dt>
              <dd>{item.followUpTaskAutomationStatus?.replace(/_/g, ' ') || '—'}</dd>
            </div>
          </dl>
        </section>

        {isDi ? (
          <section className="crm-intake-detail-section" aria-labelledby="crm-intake-di-heading">
            <h3 id="crm-intake-di-heading">Digital Identity card</h3>
            <p className="crm-muted">
              Card and campaign context from Let’s Connect. This is not an Initial Financial
              Diagnostic.
            </p>
            <dl className="crm-intake-dl">
              <div>
                <dt>Card owner / advisor slug</dt>
                <dd>
                  {digitalIdentity?.advisorSlug ||
                    item.originalAdvisorSlug ||
                    item.assignedAdvisor?.displayName ||
                    '—'}
                </dd>
              </div>
              <div>
                <dt>Public key</dt>
                <dd>{digitalIdentity?.cardPublicKey || '—'}</dd>
              </div>
              <div>
                <dt>Card slug</dt>
                <dd>{digitalIdentity?.cardSlug || '—'}</dd>
              </div>
              <div>
                <dt>Campaign</dt>
                <dd>{digitalIdentity?.campaignCode || item.originalCampaign || '—'}</dd>
              </div>
              <div>
                <dt>Event</dt>
                <dd>{digitalIdentity?.eventCode || '—'}</dd>
              </div>
            </dl>
          </section>
        ) : null}

        <section className="crm-intake-detail-section" aria-labelledby="crm-intake-task-heading">
          <h3 id="crm-intake-task-heading">Follow-up review task</h3>
          <p className="crm-muted">
            Internal CRM task only. Completing it does not change diagnostic provenance or start
            outreach.
          </p>
          {item.taskIndicators.length > 0 ? (
            <div className="crm-intake-task-indicators" aria-label="Task status indicators">
              {item.taskIndicators
                .filter((indicator) => indicator !== 'no_contact_permission')
                .map((indicator) => (
                  <span key={indicator} className="crm-intake-chip">
                    {intakeTaskIndicatorLabel(indicator)}
                  </span>
                ))}
            </div>
          ) : null}
          {item.taskCreationIssueMessage ? (
            <p className="crm-banner crm-banner-warning" role="status">
              {item.taskCreationIssueMessage}
            </p>
          ) : null}
          {retryTaskMessage ? (
            <p className="crm-banner crm-banner-error" role="alert">
              {retryTaskMessage}
            </p>
          ) : null}
          {followUpTask ? (
            <dl className="crm-intake-dl">
              <div>
                <dt>Title</dt>
                <dd>{followUpTask.title}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{mapTaskStatusLabel(followUpTask.status)}</dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd>{followUpTask.priority}</dd>
              </div>
              <div>
                <dt>Due</dt>
                <dd>{formatTaskDueDate(followUpTask.dueDate)}</dd>
              </div>
              <div>
                <dt>Assignee</dt>
                <dd>{followUpTask.assigneeName ?? 'Unassigned'}</dd>
              </div>
            </dl>
          ) : !item.taskCreationIssueMessage ? (
            <p className="crm-muted">No follow-up review task is linked yet.</p>
          ) : null}
          <div className="crm-intake-resolution-actions">
            {item.householdId ? (
              <Link className="crm-text-btn" to={`${crmHouseholdPath(item.householdId)}?tab=tasks`}>
                Open household Tasks
              </Link>
            ) : null}
            {showTaskRetry ? (
              <button
                type="button"
                className="platform-btn platform-btn-outline"
                disabled={retryingTask}
                onClick={onRetryFollowUpTask}
              >
                {retryingTask ? 'Retrying…' : 'Retry follow-up task'}
              </button>
            ) : null}
          </div>
        </section>

        {!isDi ? (
          <section className="crm-intake-detail-section" aria-labelledby="crm-intake-diagnostic-heading">
            <h3 id="crm-intake-diagnostic-heading">Initial Financial Diagnostic</h3>
            <p className="crm-muted">
              Public self-reported diagnostic. This is not the household Financial Progress Score and
              does not feed Financial Progress evidence.
            </p>
            {diagnostic ? (
              <>
                <p className="crm-intake-score-line">
                  <strong>
                    {diagnostic.overallScore ?? '—'}
                    {diagnostic.overallGrade ? ` · ${diagnostic.overallGrade}` : ''}
                  </strong>
                  <span className="crm-intake-chip">{diagnostic.productLabel}</span>
                </p>
                {diagnostic.topPriorities.length > 0 ? (
                  <ul className="crm-intake-priority-list">
                    {diagnostic.topPriorities.map((priority) => (
                      <li key={priority}>{priority}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="crm-muted">No priority list stored on this submission.</p>
                )}
                {diagnostic.categories.length > 0 ? (
                  <ul className="crm-intake-category-list">
                    {diagnostic.categories.map((category) => (
                      <li key={category.id}>
                        <span>{category.title}</span>
                        <span>
                          {category.score ?? '—'}
                          {category.grade ? ` (${category.grade})` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="crm-muted">Diagnostic assessment details are not available for this lead.</p>
            )}
          </section>
        ) : null}

        <section className="crm-intake-detail-section" aria-labelledby="crm-intake-consent-heading">
          <h3 id="crm-intake-consent-heading">Consent summary</h3>
          {!item.consent.contactPermission ? (
            <p className="crm-banner crm-banner-warning" role="status">
              No contact permission. Do not assume outreach is authorized.
            </p>
          ) : null}
          <ul className="crm-intake-consent-list">
            {!isDi ? (
              <ConsentRow
                label="Assessment storage acknowledgment"
                allowed={item.consent.assessmentStorageAcknowledged}
              />
            ) : null}
            <ConsentRow label="Privacy acknowledgment" allowed={item.consent.privacyAcknowledged} />
            <ConsentRow label="Contact permission" allowed={item.consent.contactPermission} />
            <ConsentRow label="Email marketing" allowed={item.consent.emailMarketingConsent} />
            <ConsentRow label="SMS marketing" allowed={item.consent.smsMarketingConsent} />
          </ul>
          <p className="crm-muted">
            Version: {item.consent.consentVersion || '—'} · Consented at:{' '}
            {item.consent.consentedAt
              ? new Date(item.consent.consentedAt).toLocaleString()
              : '—'}
          </p>
        </section>
      </div>

      {showDuplicate ? (
        <section
          className="crm-intake-detail-section crm-intake-duplicate-section"
          aria-labelledby="crm-intake-duplicate-heading"
        >
          <h3 id="crm-intake-duplicate-heading">Possible duplicate review</h3>
          {!isOwner ? (
            <p className="crm-banner crm-banner-warning" role="status">
              {DUPLICATE_RESOLUTION_OWNER_ONLY_MESSAGE}
            </p>
          ) : null}

          <p>
            <strong>Why it was flagged:</strong>{' '}
            {mapMatchReasonLabel(item.duplicateReview?.matchReason ?? 'possible_contact_match')}
          </p>

          <div className="crm-intake-compare-grid">
            <div className="crm-intake-compare-card">
              <h4>Provisional prospect</h4>
              <p>{item.submittedFullName}</p>
              <p className="crm-muted">{item.submittedEmail || 'No email'}</p>
              <p className="crm-muted">{item.submittedPhone || 'No phone'}</p>
              {item.household ? (
                <Link to={crmHouseholdPath(item.household.id)}>Open provisional household</Link>
              ) : null}
            </div>
            <div className="crm-intake-compare-card">
              <h4>Candidate existing household</h4>
              {candidateLoading ? <p className="crm-muted">Loading candidate…</p> : null}
              {candidateError ? (
                <p className="crm-banner crm-banner-error" role="alert">
                  {candidateError}
                </p>
              ) : null}
              {candidateHousehold ? (
                <>
                  <p>{candidateHousehold.displayName}</p>
                  <p className="crm-muted">{candidateHousehold.primaryEmail || 'No email on file'}</p>
                  <p className="crm-muted">{candidateHousehold.primaryPhone || 'No phone on file'}</p>
                  <p className="crm-muted">
                    Status: {candidateHousehold.status} · Advisor:{' '}
                    {candidateHousehold.assignedAdvisor?.displayName ?? 'Unassigned'}
                  </p>
                  <p className="crm-muted">
                    Email overlap:{' '}
                    {item.normalizedEmail &&
                    candidateHousehold.primaryEmail &&
                    item.normalizedEmail.toLowerCase() ===
                      candidateHousehold.primaryEmail.toLowerCase()
                      ? 'Likely'
                      : 'Not confirmed from primary email'}
                  </p>
                  <p className="crm-muted">
                    Phone overlap:{' '}
                    {item.normalizedPhone &&
                    candidateHousehold.primaryPhone &&
                    item.normalizedPhone.replace(/\D/g, '') ===
                      candidateHousehold.primaryPhone.replace(/\D/g, '')
                      ? 'Likely'
                      : 'Not confirmed from primary phone'}
                  </p>
                  <Link to={crmHouseholdPath(candidateHousehold.id)}>Open candidate household</Link>
                </>
              ) : !candidateLoading && !candidateError ? (
                <p className="crm-muted">
                  {item.duplicateReview?.candidateHouseholdId
                    ? 'Candidate household is not visible under your access.'
                    : 'No candidate household reference is attached.'}
                </p>
              ) : null}
            </div>
          </div>

          <div className="crm-intake-resolution-actions">
            <button
              type="button"
              className="platform-btn platform-btn-outline"
              onClick={onClose}
              disabled={resolving}
            >
              Leave pending
            </button>
            {isOwner ? (
              <>
                <button
                  type="button"
                  className="platform-btn platform-btn-primary"
                  disabled={!canResolve}
                  onClick={() => onRequestResolve('confirm_same_household')}
                >
                  Confirm same household
                </button>
                <button
                  type="button"
                  className="platform-btn platform-btn-outline"
                  disabled={!canResolve}
                  onClick={() => onRequestResolve('keep_separate')}
                >
                  Keep as separate household
                </button>
              </>
            ) : null}
          </div>
          {resolving ? (
            <p className="crm-muted" role="status">
              Resolving duplicate review…
            </p>
          ) : null}
        </section>
      ) : null}

      {item.ingestMatchStatus === 'exact_trusted_match' && item.household ? (
        <p className="crm-intake-exact-note">
          This submission was matched to an existing household. Canonical contact details were not
          overwritten.{' '}
          <Link to={crmHouseholdPath(item.household.id)}>Open linked household</Link>
          {!isDi && item.diagnostic?.assessmentId ? (
            <>
              {' · '}
              <Link
                to={crmHouseholdAssessmentDetailPath(
                  item.household.id,
                  item.diagnostic.assessmentId,
                )}
              >
                View Initial Financial Diagnostic
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {item.ingestMatchStatus === 'new_prospect' && item.household ? (
        <p className="crm-intake-exact-note">
          New provisional prospect household.{' '}
          <Link to={crmHouseholdPath(item.household.id)}>Open household workspace</Link>
          {!isDi && item.diagnostic?.assessmentId ? (
            <>
              {' · '}
              <Link
                to={crmHouseholdAssessmentDetailPath(
                  item.household.id,
                  item.diagnostic.assessmentId,
                )}
              >
                View Initial Financial Diagnostic
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  )
}
