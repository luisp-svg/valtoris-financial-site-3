import type { AdvisorCompensationRow } from '../production/advisorCompensationView'
import { formatSignedCents } from '../production/compensationView'
import { formatCents } from '../production/productionApi'

type CommissionAdvisorBreakdownProps = {
  rows: readonly AdvisorCompensationRow[]
  isOwner: boolean
  selectedAdvisorId: 'all' | 'unattributed' | string
  onSelectAdvisor: (advisorId: 'all' | 'unattributed' | string) => void
  onReviewAdvisor: (advisorId: string | null) => void
}

function reviewCountLabel(count: number): string {
  return count === 1 ? '1 needs review' : `${count} need review`
}

export default function CommissionAdvisorBreakdown({
  rows,
  isOwner,
  selectedAdvisorId,
  onSelectAdvisor,
  onReviewAdvisor,
}: CommissionAdvisorBreakdownProps) {
  if (rows.length === 0) {
    return (
      <section className="crm-panel" aria-labelledby="crm-commissions-advisors-heading">
        <div className="crm-panel-head">
          <h2 id="crm-commissions-advisors-heading">Advisor compensation</h2>
        </div>
        <p className="crm-muted">No writing-advisor compensation in this period.</p>
      </section>
    )
  }

  return (
    <section className="crm-panel" aria-labelledby="crm-commissions-advisors-heading">
      <div className="crm-panel-head">
        <h2 id="crm-commissions-advisors-heading">Advisor compensation</h2>
      </div>
      <p className="crm-production-kpi-caption">
        Writing-advisor compensation only. Override, upline, and additional non-policy commissions
        are not included.
      </p>
      <div
        className="crm-production-comp-grid crm-commissions-advisor-grid"
        role="table"
        aria-label="Advisor compensation by writing advisor"
      >
        <div className="crm-commissions-advisor-row is-head" role="row">
          <div className="is-name" role="columnheader">
            Advisor
          </div>
          <div className="is-money" role="columnheader">
            Expected
          </div>
          <div className="is-money" role="columnheader">
            Outstanding
          </div>
          <div className="is-money" role="columnheader">
            Paid
          </div>
          <div className="is-money" role="columnheader">
            Chargebacks
          </div>
          <div className="is-money" role="columnheader">
            Net Paid
          </div>
          <div className="is-review" role="columnheader">
            Needs Review
          </div>
        </div>
        {rows.map((row) => {
          const value = row.advisorId ?? 'unattributed'
          const selected = selectedAdvisorId === value
          return (
            <div
              key={row.advisorId ?? 'unattributed'}
              className={`crm-commissions-advisor-row${selected ? ' is-selected' : ''}`}
              role="row"
            >
              <div className="is-name" role="cell">
                {isOwner ? (
                  <button
                    type="button"
                    className="crm-commissions-advisor-btn"
                    aria-pressed={selected}
                    onClick={() => onSelectAdvisor(selected ? 'all' : value)}
                  >
                    {row.advisorName}
                  </button>
                ) : (
                  <span className="crm-production-comp-advisor">{row.advisorName}</span>
                )}
              </div>
              <div className="is-money crm-production-money" role="cell" data-label="Expected">
                {formatCents(row.expectedCents)}
              </div>
              <div className="is-money crm-production-money" role="cell" data-label="Outstanding">
                {formatCents(row.outstandingCents)}
              </div>
              <div className="is-money crm-production-money" role="cell" data-label="Paid">
                {formatCents(row.paidCents)}
              </div>
              <div
                className={`is-money crm-production-money${
                  row.chargebackCents < 0 ? ' is-negative' : ''
                }`}
                role="cell"
                data-label="Chargebacks"
              >
                {row.chargebackCents === 0 ? formatCents(0) : formatSignedCents(row.chargebackCents)}
                {row.chargebackCents < 0 ? (
                  <span className="crm-commissions-chargeback-text"> Chargeback</span>
                ) : null}
              </div>
              <div
                className={`is-money crm-production-money${
                  row.netPaidCents < 0 ? ' is-negative' : ''
                }`}
                role="cell"
                data-label="Net Paid"
              >
                {formatSignedCents(row.netPaidCents)}
              </div>
              <div className="is-review" role="cell" data-label="Needs Review">
                {row.reviewCount > 0 ? (
                  <button
                    type="button"
                    className="crm-production-review-btn"
                    onClick={() => onReviewAdvisor(row.advisorId)}
                  >
                    {reviewCountLabel(row.reviewCount)}
                  </button>
                ) : (
                  <span className="crm-muted">None</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
