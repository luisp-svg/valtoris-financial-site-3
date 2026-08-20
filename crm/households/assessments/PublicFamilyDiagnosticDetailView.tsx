import { Link } from 'react-router-dom'
import {
  crmHouseholdAssessmentsPath,
  crmHouseholdPath,
  ROUTES,
} from '../../../constants/routes'
import { mapMatchStatusLabel, mapSheetsSyncLabel } from '../../intake/intakeFormatters'
import { formatDiagnosticSubmittedAt } from './diagnosticFormatters'
import type { PublicFamilyDiagnosticDetail } from './types'
import {
  PUBLIC_FAMILY_DIAGNOSTIC_DETAIL_DISCLAIMER,
} from './types'

type Props = {
  detail: PublicFamilyDiagnosticDetail
}

function SnapshotRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <dt>{label}</dt>
      <dd className="crm-ifd-wrap">{value}</dd>
    </div>
  )
}

function ConsentRow({ label, allowed }: { label: string; allowed: boolean }) {
  return (
    <li className={`crm-intake-consent-row${allowed ? ' is-allowed' : ' is-denied'}`}>
      <span className="crm-intake-consent-label">{label}</span>
      <span className="crm-intake-consent-value">{allowed ? 'Yes' : 'No'}</span>
    </li>
  )
}

export default function PublicFamilyDiagnosticDetailView({ detail }: Props) {
  const snapshot = detail.submittedSnapshot
  const consent = detail.consent
  const lead = detail.lead
  const diagnosticPriorities = detail.priorities.filter((item) => item.source === 'diagnostic')
  const submittedGoals = detail.priorities.filter((item) => item.source === 'submitted_goal')

  return (
    <div className="crm-ifd-detail">
      <header className="crm-page-header">
        <div>
          <p className="crm-muted">
            <Link to={crmHouseholdPath(detail.householdId)}>Household overview</Link>
            {' · '}
            <Link to={crmHouseholdAssessmentsPath(detail.householdId)}>Assessment history</Link>
          </p>
          <h1>{detail.productLabel}</h1>
          <p className="crm-page-subtitle">{PUBLIC_FAMILY_DIAGNOSTIC_DETAIL_DISCLAIMER}</p>
        </div>
        <span className="crm-intake-chip">Self-reported · Educational</span>
      </header>

      <section className="crm-panel crm-ifd-detail-section" aria-labelledby="crm-ifd-score-heading">
        <h2 id="crm-ifd-score-heading">Result summary</h2>
        <dl className="crm-client-workspace-info-list">
          <div>
            <dt>{detail.assessmentType === 'protection' ? 'Protection gap' : 'Score'}</dt>
            <dd className="crm-financial-progress-score-emphasis" aria-label="Diagnostic score">
              {detail.assessmentType === 'protection'
                ? detail.protectionGapFormatted ?? '—'
                : detail.overallScore ?? '—'}
            </dd>
          </div>
          {detail.assessmentType === 'protection' ? null : (
            <div>
              <dt>Grade</dt>
              <dd aria-label="Diagnostic grade">{detail.overallGrade ?? '—'}</dd>
            </div>
          )}
          <div>
            <dt>Submitted</dt>
            <dd>{formatDiagnosticSubmittedAt(detail.completedAt)}</dd>
          </div>
          <div>
            <dt>Assessment version</dt>
            <dd>{detail.scoringVersion ?? '—'}</dd>
          </div>
          {detail.currentLevel ? (
            <div>
              <dt>Foundation level</dt>
              <dd>{detail.currentLevel}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="crm-panel crm-ifd-detail-section" aria-labelledby="crm-ifd-categories-heading">
        <h2 id="crm-ifd-categories-heading">Category results</h2>
        {detail.categories.length === 0 ? (
          <p className="crm-muted">No category scores were stored for this diagnostic.</p>
        ) : (
          <ul className="crm-ifd-category-list">
            {detail.categories.map((category) => (
              <li key={category.id}>
                <span>{category.title}</span>
                <span>
                  {category.score ?? '—'}
                  {category.grade ? ` (${category.grade})` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="crm-panel crm-ifd-detail-section" aria-labelledby="crm-ifd-priorities-heading">
        <h2 id="crm-ifd-priorities-heading">Priorities</h2>
        {diagnosticPriorities.length > 0 ? (
          <>
            <h3 className="crm-ifd-subheading">System-generated diagnostic priorities</h3>
            <ol className="crm-ifd-priority-list">
              {diagnosticPriorities.map((item) => (
                <li key={`diag-${item.title}`}>
                  <strong>{item.title}</strong>
                  {item.why ? <p className="crm-muted">{item.why}</p> : null}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="crm-muted">No system-generated priorities were stored.</p>
        )}
        {submittedGoals.length > 0 ? (
          <>
            <h3 className="crm-ifd-subheading">Submitted goals</h3>
            <ul className="crm-ifd-priority-list">
              {submittedGoals.map((item) => (
                <li key={`goal-${item.title}`}>{item.title}</li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section className="crm-panel crm-ifd-detail-section" aria-labelledby="crm-ifd-flags-heading">
        <h2 id="crm-ifd-flags-heading">Diagnostic indicators</h2>
        {detail.flags.length === 0 ? (
          <p className="crm-muted">No additional diagnostic indicators were stored.</p>
        ) : (
          <ul className="crm-ifd-flag-list">
            {detail.flags.map((flag) => (
              <li key={flag.id}>
                <strong>{flag.label}</strong>
                {flag.detail ? <span className="crm-muted"> — {flag.detail}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="crm-panel crm-ifd-detail-section" aria-labelledby="crm-ifd-snapshot-heading">
        <h2 id="crm-ifd-snapshot-heading">Submitted household snapshot</h2>
        <p className="crm-muted">
          Information submitted at the time of this diagnostic. This is not the household’s current
          canonical CRM record.
        </p>
        <dl className="crm-client-workspace-info-list">
          <SnapshotRow
            label="Name"
            value={[snapshot.firstName, snapshot.lastName].filter(Boolean).join(' ') || null}
          />
          <SnapshotRow label="Email" value={snapshot.email} />
          <SnapshotRow label="Phone" value={snapshot.phone} />
          <SnapshotRow label="Age" value={snapshot.age} />
          <SnapshotRow label="State" value={snapshot.state} />
          <SnapshotRow label="Marital status" value={snapshot.maritalStatus} />
          <SnapshotRow label="Dependents" value={snapshot.numberOfChildren} />
          <SnapshotRow label="Household income" value={snapshot.householdIncome} />
          <SnapshotRow label="Monthly housing" value={snapshot.monthlyHousingPayment} />
          <SnapshotRow label="Total debt" value={snapshot.totalDebt} />
          <SnapshotRow label="Emergency fund (months)" value={snapshot.emergencyFundMonths} />
          <SnapshotRow label="Monthly cash flow" value={snapshot.monthlyCashFlow} />
          <SnapshotRow label="Retirement contribution" value={snapshot.retirementContribution} />
          <SnapshotRow label="Life insurance" value={snapshot.currentLifeInsurance} />
          <SnapshotRow label="Disability protection" value={snapshot.hasDisabilityProtection} />
          <SnapshotRow label="Will" value={snapshot.hasWill} />
          <SnapshotRow label="Trust" value={snapshot.hasTrust} />
          <SnapshotRow label="Beneficiaries reviewed" value={snapshot.beneficiariesReviewed} />
          <SnapshotRow label="Guardian documented" value={snapshot.guardianDocumented} />
        </dl>
      </section>

      <section className="crm-panel crm-ifd-detail-section" aria-labelledby="crm-ifd-consent-heading">
        <h2 id="crm-ifd-consent-heading">Consent summary</h2>
        {!consent ? (
          <p className="crm-muted">Consent details are not available for this diagnostic.</p>
        ) : (
          <>
            {!consent.contactPermission ? (
              <p className="crm-banner crm-banner-warning" role="status">
                No contact permission. Do not assume outreach is authorized.
              </p>
            ) : null}
            {!consent.emailMarketingConsent ? (
              <p className="crm-muted" role="status">
                Email marketing consent was not granted.
              </p>
            ) : null}
            {!consent.smsMarketingConsent ? (
              <p className="crm-muted" role="status">
                SMS marketing consent was not granted.
              </p>
            ) : null}
            <ul className="crm-intake-consent-list">
              <ConsentRow
                label="Assessment storage acknowledgment"
                allowed={consent.assessmentStorageAcknowledged}
              />
              <ConsentRow label="Contact permission" allowed={consent.contactPermission} />
              <ConsentRow label="Email marketing" allowed={consent.emailMarketingConsent} />
              <ConsentRow label="SMS marketing" allowed={consent.smsMarketingConsent} />
              <ConsentRow label="Privacy acknowledgment" allowed={consent.privacyAcknowledged} />
            </ul>
            <p className="crm-muted">
              Version: {consent.consentVersion || '—'} · Consented at:{' '}
              {consent.consentedAt ? formatDiagnosticSubmittedAt(consent.consentedAt) : '—'}
            </p>
          </>
        )}
      </section>

      <section className="crm-panel crm-ifd-detail-section" aria-labelledby="crm-ifd-source-heading">
        <h2 id="crm-ifd-source-heading">Source and attribution</h2>
        {lead ? (
          <dl className="crm-client-workspace-info-list">
            <SnapshotRow label="Source page" value={lead.source.sourcePage} />
            <SnapshotRow label="UTM source" value={lead.source.utmSource} />
            <SnapshotRow label="UTM medium" value={lead.source.utmMedium} />
            <SnapshotRow label="UTM campaign" value={lead.source.utmCampaign} />
            <SnapshotRow label="Campaign" value={lead.source.originalCampaign} />
            <SnapshotRow label="Originating advisor" value={lead.source.originalAdvisorSlug} />
            <SnapshotRow label="Referrer host" value={lead.source.referrerHost} />
            <SnapshotRow
              label="Lead submitted"
              value={lead.submittedAt ? formatDiagnosticSubmittedAt(lead.submittedAt) : null}
            />
          </dl>
        ) : (
          <p className="crm-muted">Source attribution is unavailable (no linked lead).</p>
        )}
      </section>

      <section className="crm-panel crm-ifd-detail-section" aria-labelledby="crm-ifd-crm-heading">
        <h2 id="crm-ifd-crm-heading">CRM processing</h2>
        {lead ? (
          <dl className="crm-client-workspace-info-list">
            <div>
              <dt>Match status</dt>
              <dd>{mapMatchStatusLabel(lead.ingestMatchStatus)}</dd>
            </div>
            <div>
              <dt>Lead status</dt>
              <dd>{lead.leadStatus.replace(/_/g, ' ')}</dd>
            </div>
            <div>
              <dt>Assigned advisor</dt>
              <dd>{lead.assignedAdvisorName ?? 'Unassigned'}</dd>
            </div>
            <div>
              <dt>Originating advisor</dt>
              <dd>{lead.source.originalAdvisorSlug ?? '—'}</dd>
            </div>
            <div>
              <dt>Duplicate review</dt>
              <dd>{lead.duplicateReviewStatus.replace(/_/g, ' ')}</dd>
            </div>
            <div>
              <dt>Spreadsheet sync</dt>
              <dd>{mapSheetsSyncLabel(lead.sheetsSyncStatus)}</dd>
            </div>
            <div>
              <dt>Originating lead</dt>
              <dd>
                <Link to={ROUTES.crmIntake}>Open Intake</Link>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="crm-muted">
            This diagnostic has no linked lead. Household linkage remains valid for history.
          </p>
        )}
      </section>
    </div>
  )
}
