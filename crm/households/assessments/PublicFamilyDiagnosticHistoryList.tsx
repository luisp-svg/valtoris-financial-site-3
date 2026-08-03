import { Link } from 'react-router-dom'
import { crmHouseholdAssessmentDetailPath } from '../../../constants/routes'
import { mapMatchStatusLabel, mapSheetsSyncLabel } from '../../intake/intakeFormatters'
import { formatDiagnosticSubmittedAt } from './diagnosticFormatters'
import type { PublicFamilyDiagnosticListItem } from './types'
import { PUBLIC_FAMILY_DIAGNOSTIC_PRODUCT_LABEL } from './types'

type Props = {
  householdId: string
  items: PublicFamilyDiagnosticListItem[]
}

export default function PublicFamilyDiagnosticHistoryList({ householdId, items }: Props) {
  if (items.length === 0) {
    return (
      <div className="crm-empty-state">
        <h2 className="crm-empty-state-title">No Initial Financial Diagnostics</h2>
        <p>No public Family Financial Report Card has been submitted for this household.</p>
      </div>
    )
  }

  return (
    <>
      <div className="crm-households-table-wrap crm-ifd-history-table-wrap">
        <table className="crm-households-table">
          <thead>
            <tr>
              <th scope="col">Diagnostic</th>
              <th scope="col">Submitted</th>
              <th scope="col">Score</th>
              <th scope="col">Priorities</th>
              <th scope="col">Consent</th>
              <th scope="col">Sheets</th>
              <th scope="col">
                <span className="crm-sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.assessmentId}>
                <td>
                  <strong>{PUBLIC_FAMILY_DIAGNOSTIC_PRODUCT_LABEL}</strong>
                  {item.isLatest ? (
                    <div>
                      <span className="crm-intake-chip is-positive">Latest</span>
                    </div>
                  ) : null}
                  {item.ingestMatchStatus ? (
                    <div className="crm-muted">{mapMatchStatusLabel(item.ingestMatchStatus)}</div>
                  ) : null}
                </td>
                <td>{formatDiagnosticSubmittedAt(item.completedAt)}</td>
                <td>
                  {item.overallScore ?? '—'}
                  {item.overallGrade ? ` · ${item.overallGrade}` : ''}
                </td>
                <td>
                  {item.topPriorities.length > 0 ? item.topPriorities.join('; ') : '—'}
                </td>
                <td>
                  {item.contactPermission == null
                    ? '—'
                    : item.contactPermission
                      ? 'Contact permitted'
                      : 'No contact permission'}
                </td>
                <td>{mapSheetsSyncLabel(item.sheetsSyncStatus)}</td>
                <td>
                  <Link to={crmHouseholdAssessmentDetailPath(householdId, item.assessmentId)}>
                    View detail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="crm-ifd-history-card-list" aria-label="Diagnostic history cards">
        {items.map((item) => (
          <article key={item.assessmentId} className="crm-panel crm-ifd-history-card">
            <h2>
              {PUBLIC_FAMILY_DIAGNOSTIC_PRODUCT_LABEL}
              {item.isLatest ? (
                <span className="crm-intake-chip is-positive">Latest</span>
              ) : null}
            </h2>
            <p className="crm-muted">{formatDiagnosticSubmittedAt(item.completedAt)}</p>
            <p>
              Score:{' '}
              <strong>
                {item.overallScore ?? '—'}
                {item.overallGrade ? ` · ${item.overallGrade}` : ''}
              </strong>
            </p>
            <p>
              {item.contactPermission == null
                ? 'Contact permission unknown'
                : item.contactPermission
                  ? 'Contact permitted'
                  : 'No contact permission'}
            </p>
            <p>Sheets: {mapSheetsSyncLabel(item.sheetsSyncStatus)}</p>
            <Link
              className="platform-btn platform-btn-outline"
              to={crmHouseholdAssessmentDetailPath(householdId, item.assessmentId)}
            >
              View detail
            </Link>
          </article>
        ))}
      </div>
    </>
  )
}
