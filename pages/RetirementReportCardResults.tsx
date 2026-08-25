import { useLocation, useNavigate } from 'react-router-dom'
import AssessmentBrandHeader from '../components/AssessmentBrandHeader'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import ReportDashboard from '../components/reportDashboard/ReportDashboard'
import SpecializedLocaleSwitcher from '../components/assessment/specialized/SpecializedLocaleSwitcher'
import { retirementCopy } from '../components/assessment/retirement/copy'
import { buildLocalizedRetirementDashboard } from '../components/assessment/retirement/localizeResults'
import { useReportCardCopy } from '../components/assessment/reportCardLocale'
import { formatSpecializedTemplate } from '../components/assessment/specialized/locale'
import { DEMO_RETIREMENT_ANSWERS } from '../components/reportCard/retirementReportCardData'
import { RETIREMENT_ANSWERS_STORAGE_KEY } from '../components/assessment/retirement/constants'
import { RetirementAssessmentAnswers } from '../components/assessment/retirement/types'
import { scoreRetirementAssessment } from '../components/assessment/scoring/scoreRetirementAssessment'
import { formatCurrency } from '../components/calculator/calculations'
import { ROUTES } from '../constants/routes'

const PLANNING_PATHWAY_KEYS = [
  'pathways.1',
  'pathways.2',
  'pathways.3',
  'pathways.4',
  'pathways.5',
  'pathways.6',
  'pathways.7',
  'pathways.8',
  'pathways.9',
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
  const { locale, t, withLocale } = useReportCardCopy(retirementCopy)
  const answers = loadAnswers(location.state)
  const submissionWarning =
    location.state &&
    typeof location.state === 'object' &&
    'submissionWarning' in location.state
      ? String((location.state as { submissionWarning?: string }).submissionWarning ?? '')
      : ''
  const firstName = answers.household.firstName.trim()
  const greeting = firstName
    ? formatSpecializedTemplate(t('ui', 'preparedFor'), { name: firstName })
    : t('ui', 'sampleGreeting')
  const scored = scoreRetirementAssessment(answers)
  const { metrics } = scored
  const monthlyGap = Math.round(metrics.annualIncomeGap / 12)
  const fundedRatio = Math.round(metrics.incomeReplacementRatio * 100)
  const savingsRate =
    metrics.currentAnnualGrossIncome > 0
      ? Math.round(((metrics.monthlyContribution * 12) / metrics.currentAnnualGrossIncome) * 100)
      : 0
  const dashboard = buildLocalizedRetirementDashboard(firstName, greeting, answers, t)
  const partTimeNote = metrics.partTimeIncomeIncluded
    ? formatSpecializedTemplate(t('results', 'snapshot.partTimeNote'), {
        amount: formatCurrency(metrics.partTimeIncomeMonthly),
        years: metrics.expectedPartTimeWorkYears,
      })
    : ''

  return (
    <div className="results-shell report-dashboard-shell">
      <div className="results-container report-dashboard-container">
        <header className="results-header report-dashboard-header">
          <AssessmentBrandHeader />
          <SpecializedLocaleSwitcher
            locale={locale}
            groupLabel={t('ui', 'languageGroupLabel')}
            englishLabel={t('ui', 'languageEnglish')}
            spanishLabel={t('ui', 'languageSpanish')}
          />
        </header>

        <p className="family-results-diagnostic-label">{t('ui', 'resultsDiagnosticLabel')}</p>
        <p className="family-results-disclaimer">{t('ui', 'resultsDisclaimer')}</p>

        {submissionWarning ? (
          <p className="submission-notice" role="status">
            {submissionWarning}
          </p>
        ) : null}

        <ReportDashboard data={dashboard} />

        <section className="rd-section" aria-labelledby="retirement-metrics-title">
          <div className="rd-section-head">
            <h2 id="retirement-metrics-title" className="rd-section-title">
              {t('results', 'snapshot.title')}
            </h2>
            <p className="rd-section-lead">{t('results', 'snapshot.lead')}</p>
          </div>
          <dl
            className="retirement-snapshot-highlights"
            aria-label={t('results', 'snapshot.highlightsLabel')}
          >
            <div className="retirement-snapshot-highlight">
              <dt>{t('results', 'snapshot.needLabel')}</dt>
              <dd>{formatCurrency(metrics.targetMonthlyRetirementSpending)}</dd>
            </div>
            <div className="retirement-snapshot-highlight">
              <dt>{t('results', 'snapshot.incomeLabel')}</dt>
              <dd>{formatCurrency(metrics.totalProjectedMonthlyIncome)}</dd>
            </div>
            <div className="retirement-snapshot-highlight">
              <dt>{t('results', 'snapshot.gapLabel')}</dt>
              <dd>{formatCurrency(monthlyGap)}</dd>
            </div>
          </dl>
          <dl className="retirement-metrics-grid">
            <div>
              <dt>{t('results', 'snapshot.assetsLabel')}</dt>
              <dd>{formatCurrency(metrics.currentSavings)}</dd>
            </div>
            <div>
              <dt>{t('results', 'snapshot.projectedAssetsLabel')}</dt>
              <dd>{formatCurrency(metrics.projectedNestEgg)}</dd>
            </div>
            <div>
              <dt>{t('results', 'snapshot.guaranteedLabel')}</dt>
              <dd>{formatCurrency(metrics.totalGuaranteedMonthlyIncome)}</dd>
            </div>
            <div>
              <dt>{t('results', 'snapshot.otherIncomeLabel')}</dt>
              <dd>
                {formatCurrency(metrics.totalOtherExpectedMonthlyIncome)}
                {partTimeNote}
              </dd>
            </div>
            <div>
              <dt>{t('results', 'snapshot.portfolioLabel')}</dt>
              <dd>{formatCurrency(metrics.portfolioMonthlyIncome)}</dd>
            </div>
            <div>
              <dt>{t('results', 'snapshot.fundedRatioLabel')}</dt>
              <dd>{fundedRatio}%</dd>
            </div>
            <div>
              <dt>{t('results', 'snapshot.savingsRateLabel')}</dt>
              <dd>{savingsRate}%</dd>
            </div>
            <div>
              <dt>
                {metrics.isAlreadyRetired
                  ? t('results', 'snapshot.statusLabel')
                  : t('results', 'snapshot.yearsLabel')}
              </dt>
              <dd>
                {metrics.isAlreadyRetired
                  ? t('results', 'snapshot.alreadyRetired')
                  : String(metrics.yearsUntilRetirement)}
              </dd>
            </div>
            <div>
              <dt>{t('results', 'snapshot.categoriesLabel')}</dt>
              <dd>
                {dashboard.categories.find(
                  (category) => category.id === scored.strongestCategory.id,
                )?.title ?? scored.strongestCategory.title}{' '}
                /{' '}
                {dashboard.categories.find(
                  (category) => category.id === scored.priorityCategory.id,
                )?.title ?? scored.priorityCategory.title}
              </dd>
            </div>
          </dl>
          <p className="funnel-microcopy assessment-note">
            {formatSpecializedTemplate(t('results', 'snapshot.note'), {
              longevityAge: metrics.assumptions.longevityAge,
            })}
          </p>
        </section>

        <section className="rd-section" aria-labelledby="pathways-title">
          <div className="rd-section-head">
            <h2 id="pathways-title" className="rd-section-title">
              {t('results', 'pathways.title')}
            </h2>
            <p className="rd-section-lead">{t('results', 'pathways.lead')}</p>
          </div>
          <ul className="retirement-assumption-list">
            {PLANNING_PATHWAY_KEYS.map((key) => (
              <li key={key}>{t('results', key)}</li>
            ))}
          </ul>
        </section>

        <section className="rd-cta">
          <h2 className="rd-cta-title">{t('ui', 'resultsScheduleTitle')}</h2>
          <p className="rd-cta-copy">{t('ui', 'resultsScheduleCopy')}</p>
          <ScheduleReportCardLink className="platform-btn platform-btn-secondary">
            {t('ui', 'resultsScheduleTitle')}
          </ScheduleReportCardLink>
          <button
            type="button"
            className="results-back-link"
            onClick={() => navigate(withLocale(ROUTES.retirementAssessment))}
          >
            {t('ui', 'resultsRetake')}
          </button>
        </section>
      </div>
    </div>
  )
}
