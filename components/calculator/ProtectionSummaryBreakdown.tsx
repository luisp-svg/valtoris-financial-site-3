import { formatCurrency, ProtectionBreakdown } from './calculations'

type ProtectionSummaryBreakdownProps = {
  breakdown: ProtectionBreakdown
  existingCoverage: number
}

export default function ProtectionSummaryBreakdown({
  breakdown,
  existingCoverage,
}: ProtectionSummaryBreakdownProps) {
  const rows = [
    { label: 'Income Protection', value: breakdown.income },
    { label: 'Housing Protection', value: breakdown.housing },
    { label: 'Debt Protection', value: breakdown.debt },
    { label: "Children's Education", value: breakdown.education },
    { label: 'Final Expenses', value: breakdown.finalExpenses },
    { label: 'Existing Life Insurance', value: existingCoverage, isDeduction: true },
  ]

  return (
    <section className="protection-summary-breakdown">
      {rows.map((row) => (
        <div key={row.label} className="protection-summary-row">
          <span className="protection-summary-row-label">{row.label}</span>
          <span
            className={`protection-summary-row-value${row.isDeduction ? ' is-deduction' : ''}`}
          >
            {row.isDeduction ? `−${formatCurrency(row.value)}` : formatCurrency(row.value)}
          </span>
        </div>
      ))}
      <div className="protection-summary-row protection-summary-row-gap">
        <span className="protection-summary-row-label">Protection Gap</span>
        <span className="protection-summary-row-value">{formatCurrency(breakdown.netNeed)}</span>
      </div>
    </section>
  )
}
