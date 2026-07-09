import { formatCurrency } from '../calculator/calculations'

const SAMPLE_BREAKDOWN = [
  { label: 'Income Protection', value: 600_000 },
  { label: 'Mortgage / Rent Protection', value: 180_000 },
  { label: 'Outstanding Debt', value: 85_000 },
  { label: "Children's Education", value: 200_000 },
  { label: 'Final Expenses', value: 25_000 },
] as const

const SAMPLE_RECOMMENDED = 1_090_000
const SAMPLE_EXISTING = 250_000
const SAMPLE_GAP = SAMPLE_RECOMMENDED - SAMPLE_EXISTING

export default function ProtectionSamplePreview() {
  return (
    <div className="protection-sample-preview" aria-label="Example protection analysis output">
      <p className="protection-sample-label">Example Output</p>

      <div className="protection-sample-hero">
        <span className="protection-sample-hero-kicker">Recommended Coverage</span>
        <p className="protection-sample-hero-amount">{formatCurrency(SAMPLE_RECOMMENDED)}</p>
        <p className="protection-sample-hero-copy">
          Estimated amount needed to help protect your family&apos;s financial future.
        </p>
      </div>

      <ul className="protection-sample-breakdown">
        {SAMPLE_BREAKDOWN.map((row) => (
          <li key={row.label} className="protection-sample-breakdown-item">
            <span className="protection-sample-breakdown-label">{row.label}</span>
            <span className="protection-sample-breakdown-value">{formatCurrency(row.value)}</span>
          </li>
        ))}
        <li className="protection-sample-breakdown-item is-deduction">
          <span className="protection-sample-breakdown-label">Existing Life Insurance</span>
          <span className="protection-sample-breakdown-value">
            -{formatCurrency(SAMPLE_EXISTING)}
          </span>
        </li>
      </ul>

      <div className="protection-sample-gap">
        <span className="protection-sample-gap-kicker">Estimated Protection Gap™</span>
        <p className="protection-sample-gap-amount">{formatCurrency(SAMPLE_GAP)}</p>
        <p className="protection-sample-gap-copy">
          Additional protection your family may still need after existing coverage.
        </p>
      </div>
    </div>
  )
}
