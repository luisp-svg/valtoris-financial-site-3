import { useLocation, useNavigate } from 'react-router-dom'
import AssessmentBrandHeader from '../components/AssessmentBrandHeader'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import ReportDashboard from '../components/reportDashboard/ReportDashboard'
import {
  DEMO_RETIREMENT_ANSWERS,
  RETIREMENT_SAMPLE_GREETING,
  getRetirementReportDashboardData,
} from '../components/reportCard/retirementReportCardData'
import { RETIREMENT_ANSWERS_STORAGE_KEY } from '../components/assessment/retirement/constants'
import { RetirementAssessmentAnswers } from '../components/assessment/retirement/types'
import { scoreRetirementAssessment } from '../components/assessment/scoring/scoreRetirementAssessment'
import { formatCurrency } from '../components/calculator/calculations'
import { RETAKE_ASSESSMENT_CTA, SCHEDULE_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

const PLANNING_PATHWAYS = [
  'Retirement-income planning',
  'Social Security review',
  'Pension analysis',
  '401(k), 403(b), IRA, or TSP rollover review',
  'Lifetime-income and annuity analysis',
  'Roth and tax-diversification planning',
  'Medicare and long-term-care planning',
  'Life-insurance review',
  'Estate and beneficiary review',
]

function loadAnswers(state: unknown): RetirementAssessmentAnswers {
  if (state && typeof state === 'object' && 'answers' in state) {
    return (state as { answers: RetirementAssessmentAnswers }).answers
  }

  try {
    const stored = sessionStorage.getItem(RETIREMENT_ANSWERS_STORAGE_KEY)
    if (stored) return JSON.parse(stored) as RetirementAssessmentAnswers
  } catch {
    // Demo fallback when opened directly.
  }

  return DEMO_RETIREMENT_ANSWERS
}

export default function RetirementReportCardResults() {
  const location = useLocation()
  const navigate = useNavigate()
  const answers = loadAnswers(location.state)
  const submissionWarning =
    location.state &&
    typeof location.state === 'object' &&
    'submissionWarning' in location.state
      ? String((location.state as { submissionWarning?: string }).submissionWarning ?? '')
      : ''
  const firstName = answers.household.firstName.trim()
  const greeting = firstName ? `Prepared for ${firstName}` : RETIREMENT_SAMPLE_GREETING
  const scored = scoreRetirementAssessment(answers)
  const { metrics } = scored
  const monthlyGap = Math.round(metrics.annualIncomeGap / 12)
  const fundedRatio = Math.round(metrics.incomeReplacementRatio * 100)
  const savingsRate =
    metrics.currentAnnualGrossIncome > 0
      ? Math.round(((metrics.monthlyContribution * 12) / metrics.currentAnnualGrossIncome) * 100)
      : 0

  return (
    <div className="results-shell report-dashboard-shell">
      <div className="results-container report-dashboard-container">
        <header className="results-header report-dashboard-header">
          <AssessmentBrandHeader />
        </header>

        {submissionWarning ? (
          <p className="submission-notice" role="status">
            {submissionWarning}
          </p>
        ) : null}

        <ReportDashboard data={getRetirementReportDashboardData(firstName, greeting, answers)} />

        <section className="rd-section" aria-labelledby="retirement-metrics-title">
          <div className="rd-section-head">
            <h2 id="retirement-metrics-title" className="rd-section-title">
              Your Retirement Snapshot
            </h2>
            <p className="rd-section-lead">
              Your Retirement Snapshot highlights monthly need, total projected income, and any
              estimated gap first. Supporting metrics below include assets, income sources, and
              category context. Guaranteed income is weighted more heavily than other or temporary
              sources.
            </p>
          </div>
          <dl className="retirement-snapshot-highlights" aria-label="Primary retirement summary">
            <div className="retirement-snapshot-highlight">
              <dt>Estimated Monthly Retirement Need</dt>
              <dd>{formatCurrency(metrics.targetMonthlyRetirementSpending)}</dd>
            </div>
            <div className="retirement-snapshot-highlight">
              <dt>Estimated Total Monthly Income</dt>
              <dd>{formatCurrency(metrics.totalProjectedMonthlyIncome)}</dd>
            </div>
            <div className="retirement-snapshot-highlight">
              <dt>Estimated Monthly Income Gap</dt>
              <dd>{formatCurrency(monthlyGap)}</dd>
            </div>
          </dl>
          <dl className="retirement-metrics-grid">
            <div>
              <dt>Current Retirement Assets</dt>
              <dd>{formatCurrency(metrics.currentSavings)}</dd>
            </div>
            <div>
              <dt>Projected Assets at Retirement</dt>
              <dd>{formatCurrency(metrics.projectedNestEgg)}</dd>
            </div>
            <div>
              <dt>Guaranteed Monthly Income</dt>
              <dd>{formatCurrency(metrics.totalGuaranteedMonthlyIncome)}</dd>
            </div>
            <div>
              <dt>Other Expected Monthly Income</dt>
              <dd>
                {formatCurrency(metrics.totalOtherExpectedMonthlyIncome)}
                {metrics.partTimeIncomeIncluded
                  ? ` (includes temporary part-time: ${formatCurrency(metrics.partTimeIncomeMonthly)} for ~${metrics.expectedPartTimeWorkYears} yr)`
                  : ''}
              </dd>
            </div>
            <div>
              <dt>Estimated Portfolio Monthly Income</dt>
              <dd>{formatCurrency(metrics.portfolioMonthlyIncome)}</dd>
            </div>
            <div>
              <dt>Funded Ratio</dt>
              <dd>{fundedRatio}%</dd>
            </div>
            <div>
              <dt>Current Savings Rate</dt>
              <dd>{savingsRate}%</dd>
            </div>
            <div>
              <dt>{metrics.isAlreadyRetired ? 'Retirement Status' : 'Years Until Retirement'}</dt>
              <dd>
                {metrics.isAlreadyRetired ? 'Already Retired' : String(metrics.yearsUntilRetirement)}
              </dd>
            </div>
            <div>
              <dt>Strongest / Priority Categories</dt>
              <dd>
                {scored.strongestCategory.title} / {scored.priorityCategory.title}
              </dd>
            </div>
          </dl>
          <p className="funnel-microcopy assessment-note">
            These results are educational estimates and do not guarantee retirement outcomes.
            Assumptions include inflation, growth, withdrawal rate, and longevity age{' '}
            {metrics.assumptions.longevityAge}.
          </p>
        </section>

        <section className="rd-section" aria-labelledby="pathways-title">
          <div className="rd-section-head">
            <h2 id="pathways-title" className="rd-section-title">
              Potential Planning Pathways
            </h2>
            <p className="rd-section-lead">
              Educational topics you may explore with a strategist. This list is not a product
              recommendation.
            </p>
          </div>
          <ul className="retirement-assumption-list">
            {PLANNING_PATHWAYS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="rd-cta">
          <h2 className="rd-cta-title">{SCHEDULE_CTA}</h2>
          <p className="rd-cta-copy">
            Review your Retirement Report Card™ with a Valtoris strategist and receive a customized
            action plan for strengthening retirement income readiness.
          </p>
          <ScheduleReportCardLink className="platform-btn platform-btn-secondary">
            {SCHEDULE_CTA}
          </ScheduleReportCardLink>
          <button
            type="button"
            className="results-back-link"
            onClick={() => navigate(ROUTES.retirementAssessment)}
          >
            {RETAKE_ASSESSMENT_CTA}
          </button>
        </section>
      </div>
    </div>
  )
}
