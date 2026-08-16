import CompensationStatusBadge from './CompensationStatusBadge'
import {
  formatCommissionBpsPercent,
  formatExpectedReviewReason,
  formatExpectedStatusLabel,
  formatExpectedUnavailableOrReviewCopy,
  formatWritingContractLevel,
  formatWritingRatePercent,
} from './compensationLabels'
import {
  countCurrentWritingAdvisors,
  deriveExpectedListPresentation,
  expectedEmptyMessage,
} from './compensationView'
import { formatCents, formatProductionDateTime } from './productionApi'
import type {
  CompensationViewer,
  LiveExpectedCompensationRow,
  ProductionAllocation,
  ProductionStage,
} from './types'

type ExpectedCompensationPanelProps = {
  viewer: CompensationViewer
  productionStage: ProductionStage | string
  allocations: readonly ProductionAllocation[]
  liveRows: readonly LiveExpectedCompensationRow[]
  loading: boolean
  error: string | null
}

export default function ExpectedCompensationPanel({
  viewer,
  productionStage,
  allocations,
  liveRows,
  loading,
  error,
}: ExpectedCompensationPanelProps) {
  const presentation = deriveExpectedListPresentation({
    viewer,
    productionStage,
    liveRows,
    writingAdvisorCount: countCurrentWritingAdvisors(allocations),
  })
  const empty = expectedEmptyMessage({
    productionStage,
    liveRows,
    status: presentation.status,
  })

  return (
    <section className="crm-panel" aria-labelledby="pp-expected-heading">
      <div className="crm-panel-head">
        <h2 id="pp-expected-heading">Expected compensation</h2>
      </div>

      {loading ? <p className="crm-muted">Loading expected compensation…</p> : null}

      {error ? (
        <div className="crm-banner crm-banner-error" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <p className="crm-production-comp-summary">
            <CompensationStatusBadge status={presentation.status} review={presentation.review} />
            {presentation.split ? (
              <span className="crm-production-linked-pill">Split writing</span>
            ) : null}
          </p>

          {empty ? <p>{empty}</p> : null}

          {liveRows.length > 0 ? (
            viewer === 'advisor' ? (
              <div className="crm-production-advisor-expected">
                {liveRows.map((row) => (
                  <AdvisorExpectedBody key={row.id} row={row} />
                ))}
              </div>
            ) : (
              <OwnerExpectedTable rows={liveRows} />
            )
          ) : null}
        </>
      ) : null}
    </section>
  )
}

function AdvisorExpectedBody({ row }: { row: LiveExpectedCompensationRow }) {
  const explanation = formatExpectedUnavailableOrReviewCopy(
    row.calculation_status,
    row.review_reason,
  )
  return (
    <dl className="crm-production-detail-grid">
      <div>
        <dt>Your expected compensation</dt>
        <dd className="crm-production-money">
          {row.expected_compensation_cents == null
            ? '—'
            : formatCents(row.expected_compensation_cents)}
        </dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>
          {formatExpectedStatusLabel(
            row.calculation_status === 'unavailable'
              ? 'no_rate'
              : row.calculation_status === 'resolved'
                ? 'expected'
                : 'review_required',
          )}
        </dd>
      </div>
      <div>
        <dt>Allocation</dt>
        <dd>{formatCommissionBpsPercent(row.commission_bps)}</dd>
      </div>
      {explanation ? (
        <div>
          <dt>Explanation</dt>
          <dd>{explanation}</dd>
        </div>
      ) : null}
    </dl>
  )
}

function OwnerExpectedTable({ rows }: { rows: readonly LiveExpectedCompensationRow[] }) {
  return (
    <div className="crm-opportunities-table-wrap" role="region" aria-label="Expected compensation by writing advisor">
      <table className="crm-opportunities-table crm-production-comp-table">
        <thead>
          <tr>
            <th scope="col">Advisor</th>
            <th scope="col">Allocation</th>
            <th scope="col">Writing rank</th>
            <th scope="col">Writing rate</th>
            <th scope="col">Compensation base</th>
            <th scope="col">Expected</th>
            <th scope="col">Status</th>
            <th scope="col">Calculated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.advisor_display_name?.trim() || 'Advisor'}</td>
              <td>{formatCommissionBpsPercent(row.commission_bps)}</td>
              <td>{formatWritingContractLevel(row.writing_contract_level)}</td>
              <td>{formatWritingRatePercent(row.writing_rate)}</td>
              <td className="crm-production-money">
                {row.compensation_base_cents == null ? '—' : formatCents(row.compensation_base_cents)}
              </td>
              <td className="crm-production-money">
                {row.expected_compensation_cents == null
                  ? '—'
                  : formatCents(row.expected_compensation_cents)}
              </td>
              <td>
                <div>
                  {formatExpectedStatusLabel(
                    row.calculation_status === 'unavailable'
                      ? 'no_rate'
                      : row.calculation_status === 'resolved'
                        ? 'expected'
                        : 'review_required',
                  )}
                </div>
                {row.review_reason ? (
                  <div className="crm-muted">{formatExpectedReviewReason(row.review_reason)}</div>
                ) : null}
              </td>
              <td>{formatProductionDateTime(row.calculated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
