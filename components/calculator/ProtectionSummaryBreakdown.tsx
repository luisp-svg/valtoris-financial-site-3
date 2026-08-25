import { formatCurrency, ProtectionBreakdown } from './calculations'

export type ProtectionBreakdownLabels = {
  incomeLabel?: string
  incomeDescription?: string
  housingLabel?: string
  housingDescription?: string
  debtLabel?: string
  debtDescription?: string
  educationLabel?: string
  educationDescription?: string
  finalExpensesLabel?: string
  finalExpensesDescription?: string
  existingCoverageLabel?: string
  existingCoverageDescription?: string
}

type ProtectionSummaryBreakdownProps = {
  breakdown: ProtectionBreakdown
  existingCoverage: number
  /** Optional localized labels. Defaults keep the existing English copy. */
  labels?: ProtectionBreakdownLabels
}

export default function ProtectionSummaryBreakdown({
  breakdown,
  existingCoverage,
  labels = {},
}: ProtectionSummaryBreakdownProps) {
  const rows = [
    {
      icon: '🛡',
      label: labels.incomeLabel ?? 'Income Protection',
      description: labels.incomeDescription ?? 'Replacement income for your loved ones.',
      value: breakdown.income,
    },
    {
      icon: '🏠',
      label: labels.housingLabel ?? 'Mortgage / Rent Protection (5 Years)',
      description: labels.housingDescription ?? 'Five years of housing payments.',
      value: breakdown.housing,
    },
    {
      icon: '💳',
      label: labels.debtLabel ?? 'Outstanding Debt',
      description: labels.debtDescription ?? 'Consumer debt and liabilities.',
      value: breakdown.debt,
    },
    {
      icon: '🎓',
      label: labels.educationLabel ?? "Children's Education",
      description: labels.educationDescription ?? 'Future education funding.',
      value: breakdown.education,
    },
    {
      icon: '⚰',
      label: labels.finalExpensesLabel ?? 'Final Expenses',
      description: labels.finalExpensesDescription ?? 'End-of-life expenses.',
      value: breakdown.finalExpenses,
    },
  ]

  return (
    <ul className="protection-breakdown-list">
      {rows.map((row) => (
        <li key={row.label} className="protection-breakdown-item">
          <span className="protection-breakdown-icon" aria-hidden="true">
            {row.icon}
          </span>
          <div className="protection-breakdown-copy">
            <span className="protection-breakdown-label">{row.label}</span>
            <span className="protection-breakdown-description">{row.description}</span>
          </div>
          <span className="protection-breakdown-value">{formatCurrency(row.value)}</span>
        </li>
      ))}
      <li className="protection-breakdown-item is-deduction">
        <span className="protection-breakdown-icon" aria-hidden="true">
          ❤️
        </span>
        <div className="protection-breakdown-copy">
          <span className="protection-breakdown-label">
            {labels.existingCoverageLabel ?? 'Existing Life Insurance'}
          </span>
          <span className="protection-breakdown-description">
            {labels.existingCoverageDescription ?? 'Current coverage applied as a deduction.'}
          </span>
        </div>
        <span className="protection-breakdown-value is-deduction">
          -{formatCurrency(existingCoverage)}
        </span>
      </li>
    </ul>
  )
}
