import { useLocation, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import AnimatedCurrency from '../components/calculator/AnimatedCurrency'
import {
  calculateSelectedNeed,
  parseAmount,
} from '../components/calculator/calculations'
import ProtectionSummaryBreakdown from '../components/calculator/ProtectionSummaryBreakdown'
import { CALCULATOR_STORAGE_KEY } from '../components/calculator/constants'
import { CalculatorAnswers, INITIAL_CALCULATOR_ANSWERS } from '../components/calculator/types'
import { SCHEDULE_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

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
  const firstName = answers.family.firstName.trim()
  const headline = firstName
    ? `${firstName}, here's your Family Protection Analysis™`
    : 'Your Family Protection Analysis™'

  const breakdown = calculateSelectedNeed(answers)
  const existingCoverage = parseAmount(answers.coverage.currentLifeInsurance)

  return (
    <div className="protection-results-shell">
      <div className="protection-results-container">
        <header className="protection-results-header protection-report-fade">
          <BrandLogo className="protection-results-logo" />
        </header>

        {submissionWarning ? (
          <p className="submission-notice protection-report-fade" role="status">
            {submissionWarning}
          </p>
        ) : null}

        <section className="protection-report-intro protection-report-fade">
          <h1 className="protection-analysis-headline">{headline}</h1>
          <p className="protection-report-subheading">
            Based on the information you provided, we&apos;ve estimated the amount of life
            insurance your family may need to help protect their financial future.
          </p>
        </section>

        <section
          className="protection-hero-card protection-report-fade protection-report-fade-delay-1"
          aria-labelledby="recommended-coverage-title"
        >
          <h2 id="recommended-coverage-title" className="protection-hero-title">
            Recommended Life Insurance Coverage™
          </h2>
          <AnimatedCurrency
            value={breakdown.total}
            className="protection-hero-amount"
          />
          <p className="protection-hero-subtitle">
            Estimated amount needed to help protect your family&apos;s financial future.
          </p>
        </section>

        <section
          className="protection-breakdown-section protection-report-fade protection-report-fade-delay-2"
          aria-labelledby="protection-breakdown-title"
        >
          <h2 id="protection-breakdown-title" className="protection-breakdown-title">
            Protection Breakdown
          </h2>
          <ProtectionSummaryBreakdown
            breakdown={breakdown}
            existingCoverage={existingCoverage}
          />
        </section>

        <section
          className="protection-gap-card protection-report-fade protection-report-fade-delay-3"
          aria-labelledby="protection-gap-title"
        >
          <h2 id="protection-gap-title" className="protection-gap-headline">
            Estimated Protection Gap™
          </h2>
          <AnimatedCurrency
            value={breakdown.netNeed}
            className="protection-gap-amount"
          />
          <p className="protection-gap-copy">
            This represents the estimated additional protection your family may still need after
            considering your current life insurance.
          </p>
        </section>

        <section
          className="protection-means-card protection-report-fade protection-report-fade-delay-4"
          aria-labelledby="what-this-means-title"
        >
          <h2 id="what-this-means-title" className="protection-means-title">
            What This Means
          </h2>
          <p className="protection-means-copy">
            This calculator provides an educational estimate based on the information you entered.
            It is not an insurance quote or financial recommendation. Your Family Financial Report
            Card™ will provide a personalized analysis and recommendations.
          </p>
        </section>

        <section className="protection-results-cta protection-report-fade protection-report-fade-delay-5">
          <h2>{SCHEDULE_CTA}</h2>
          <p>
            Review your Family Protection Analysis™ with a Valtoris Financial Advisor and receive
            personalized recommendations.
          </p>
          <div className="protection-results-actions">
            <ScheduleReportCardLink className="protection-results-cta-button">
              {SCHEDULE_CTA}
            </ScheduleReportCardLink>
            <button
              type="button"
              className="protection-results-secondary-btn"
              onClick={() => navigate(ROUTES.protectionGap)}
            >
              Recalculate
            </button>
          </div>
        </section>

        <footer className="protection-report-footer protection-report-fade protection-report-fade-delay-6">
          <p>Powered by Valtoris Financial™</p>
          <p>Helping Families Become Legacy Ready™</p>
        </footer>
      </div>
    </div>
  )
}
