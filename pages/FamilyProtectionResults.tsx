import { useLocation, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import { ROUTES } from '../constants/routes'
import {
  calculateSelectedNeed,
  formatCurrency,
  parseAmount,
} from '../components/calculator/calculations'
import ProtectionSummaryBreakdown from '../components/calculator/ProtectionSummaryBreakdown'
import { CALCULATOR_STORAGE_KEY } from '../components/calculator/constants'
import { CalculatorAnswers, INITIAL_CALCULATOR_ANSWERS } from '../components/calculator/types'

function loadAnswers(state: unknown): CalculatorAnswers {
  if (state && typeof state === 'object' && 'answers' in state) {
    return (state as { answers: CalculatorAnswers }).answers
  }

  try {
    const stored = sessionStorage.getItem(CALCULATOR_STORAGE_KEY)
    if (stored) return JSON.parse(stored) as CalculatorAnswers
  } catch {
    // Demo fallback when opened directly.
  }

  return INITIAL_CALCULATOR_ANSWERS
}

export default function FamilyProtectionResults() {
  const location = useLocation()
  const navigate = useNavigate()
  const answers = loadAnswers(location.state)
  const submissionWarning =
    location.state &&
    typeof location.state === 'object' &&
    'submissionWarning' in location.state
      ? String((location.state as { submissionWarning?: string }).submissionWarning ?? '')
      : ''
  const familyName = answers.family.firstName.trim()
  const greeting = familyName ? `Prepared for ${familyName}` : 'Sample Protection Analysis'

  const breakdown = calculateSelectedNeed(answers)
  const existingCoverage = parseAmount(answers.coverage.currentLifeInsurance)

  return (
    <div className="protection-results-shell">
      <div className="protection-results-container">
        <header className="protection-results-header">
          <BrandLogo className="protection-results-logo" />
          <p className="protection-results-prepared">{greeting}</p>
        </header>

        {submissionWarning ? (
          <p className="submission-notice" role="status">
            {submissionWarning}
          </p>
        ) : null}

        <section className="protection-results-hero">
          <p className="protection-results-kicker">Valtoris Financial</p>
          <h1 className="protection-results-title">Your Estimated Family Protection Need™</h1>
        </section>

        <section className="protection-summary-card">
          <span className="protection-summary-label">Recommended Life Insurance Coverage</span>
          <span className="protection-summary-amount">{formatCurrency(breakdown.total)}</span>
          <span className="protection-summary-note">(Automatically calculated)</span>
          <ProtectionSummaryBreakdown
            breakdown={breakdown}
            existingCoverage={existingCoverage}
          />
        </section>

        <section className="protection-results-cta">
          <h2>Ready to Protect Your Family?</h2>
          <p>
            This estimate is only one part of your family's financial picture. Schedule your
            complimentary Family Financial Report Card™ review to receive personalized
            recommendations for protection, retirement, debt strategy, estate planning, tax
            efficiency, and long-term financial planning.
          </p>
          <ScheduleReportCardLink className="protection-results-cta-button" />
          <button
            type="button"
            className="protection-results-back"
            onClick={() => navigate(ROUTES.protectionGap)}
          >
            Recalculate Protection Need
          </button>
        </section>

        <p className="protection-results-disclaimer">
          This calculator provides an educational estimate and should not be considered financial,
          legal, or insurance advice. Final recommendations should be made after completing your
          Family Financial Report Card™.
        </p>
      </div>
    </div>
  )
}
