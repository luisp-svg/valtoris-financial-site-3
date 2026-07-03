import { formatCurrency, ProtectionBreakdown } from './calculations'

type ProtectionSummaryBreakdownProps = {
  breakdown: ProtectionBreakdown
  existingCoverage: number
}

const BREAKDOWN_ROWS = [
  {
    icon: '🛡',
    label: 'Income Protection',
    description: 'Replacement income for your loved ones.',
    getValue: (breakdown: ProtectionBreakdown) => breakdown.income,
  },
  {
    icon: '🏠',
    label: 'Mortgage / Rent Protection (5 Years)',
    description: 'Five years of housing payments.',
    getValue: (breakdown: ProtectionBreakdown) => breakdown.housing,
  },
  {
    icon: '💳',
    label: 'Outstanding Debt',
    description: 'Consumer debt and liabilities.',
    getValue: (breakdown: ProtectionBreakdown) => breakdown.debt,
  },
  {
    icon: '🎓',
    label: "Children's Education",
    description: 'Future education funding.',
    getValue: (breakdown: ProtectionBreakdown) => breakdown.education,
  },
  {
    icon: '⚰',
    label: 'Final Expenses',
    description: 'End-of-life expenses.',
    getValue: (breakdown: ProtectionBreakdown) => breakdown.finalExpenses,
  },
] as const

export default function ProtectionSummaryBreakdown({
  breakdown,
  existingCoverage,
}: ProtectionSummaryBreakdownProps) {
  return (
    <ul className="protection-breakdown-list">
      {BREAKDOWN_ROWS.map((row) => (
        <li key={row.label} className="protection-breakdown-item">
          <span className="protection-breakdown-icon" aria-hidden="true">
            {row.icon}
          </span>
          <div className="protection-breakdown-copy">
            <span className="protection-breakdown-label">{row.label}</span>
            <span className="protection-breakdown-description">{row.description}</span>
          </div>
          <span className="protection-breakdown-value">
            {formatCurrency(row.getValue(breakdown))}
          </span>
        </li>
      ))}
      <li className="protection-breakdown-item is-deduction">
        <span className="protection-breakdown-icon" aria-hidden="true">
          ❤️
        </span>
        <div className="protection-breakdown-copy">
          <span className="protection-breakdown-label">Existing Life Insurance</span>
          <span className="protection-breakdown-description">
            Current coverage applied as a deduction.
          </span>
        </div>
        <span className="protection-breakdown-value is-deduction">
          -{formatCurrency(existingCoverage)}
        </span>
      </li>
    </ul>
  )
}
