import { Link, useLocation, useNavigate } from 'react-router-dom'
import AssessmentBrandHeader from '../components/AssessmentBrandHeader'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import AnimatedCurrency from '../components/calculator/AnimatedCurrency'
import { useReportCardCopy } from '../components/assessment/reportCardLocale'
import { formatSpecializedTemplate } from '../components/assessment/specialized/locale'
import SpecializedLocaleSwitcher from '../components/assessment/specialized/SpecializedLocaleSwitcher'
import {
  calculateSelectedNeed,
  parseAmount,
} from '../components/calculator/calculations'
import ProtectionSummaryBreakdown from '../components/calculator/ProtectionSummaryBreakdown'
import { CALCULATOR_STORAGE_KEY } from '../components/calculator/constants'
import { protectionCopy } from '../components/calculator/protectionCopy'
import { CalculatorAnswers, INITIAL_CALCULATOR_ANSWERS } from '../components/calculator/types'
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
  const { locale, t, withLocale } = useReportCardCopy(protectionCopy)
  const answers = loadAnswers(location.state)
  const submissionWarning =
    location.state &&
    typeof location.state === 'object' &&
    'submissionWarning' in location.state
      ? String((location.state as { submissionWarning?: string }).submissionWarning ?? '')
      : ''
  const firstName = answers.family.firstName.trim()
  const headline = firstName
    ? formatSpecializedTemplate(t('results', 'headlineNamed'), { name: firstName })
    : t('results', 'headline')

  const breakdown = calculateSelectedNeed(answers)
  const existingCoverage = parseAmount(answers.coverage.currentLifeInsurance)

  return (
    <div className="protection-results-shell">
      <div className="protection-results-container">
        <header className="protection-results-header protection-report-fade">
          <AssessmentBrandHeader />
          <SpecializedLocaleSwitcher
            locale={locale}
            groupLabel={t('ui', 'languageGroupLabel')}
            englishLabel={t('ui', 'languageEnglish')}
            spanishLabel={t('ui', 'languageSpanish')}
          />
        </header>

        {submissionWarning ? (
          <p className="submission-notice protection-report-fade" role="status">
            {submissionWarning}
          </p>
        ) : null}

        <section className="protection-report-intro protection-report-fade">
          <h1 className="protection-analysis-headline">{headline}</h1>
          <p className="protection-report-subheading">{t('results', 'subheading')}</p>
        </section>

        <section
          className="protection-hero-card protection-report-fade protection-report-fade-delay-1"
          aria-labelledby="recommended-coverage-title"
        >
          <h2 id="recommended-coverage-title" className="protection-hero-title">
            {t('results', 'recommendedTitle')}
          </h2>
          <AnimatedCurrency
            value={breakdown.total}
            className="protection-hero-amount"
          />
          <p className="protection-hero-subtitle">{t('results', 'recommendedSubtitle')}</p>
        </section>

        <section
          className="protection-breakdown-section protection-report-fade protection-report-fade-delay-2"
          aria-labelledby="protection-breakdown-title"
        >
          <h2 id="protection-breakdown-title" className="protection-breakdown-title">
            {t('results', 'breakdownTitle')}
          </h2>
          <ProtectionSummaryBreakdown
            breakdown={breakdown}
            existingCoverage={existingCoverage}
            labels={{
              incomeLabel: t('results', 'row.income.label'),
              incomeDescription: t('results', 'row.income.description'),
              housingLabel: t('results', 'row.housing.label'),
              housingDescription: t('results', 'row.housing.description'),
              debtLabel: t('results', 'row.debt.label'),
              debtDescription: t('results', 'row.debt.description'),
              educationLabel: t('results', 'row.education.label'),
              educationDescription: t('results', 'row.education.description'),
              finalExpensesLabel: t('results', 'row.finalExpenses.label'),
              finalExpensesDescription: t('results', 'row.finalExpenses.description'),
              existingCoverageLabel: t('results', 'row.existingCoverage.label'),
              existingCoverageDescription: t('results', 'row.existingCoverage.description'),
            }}
          />
        </section>

        <section
          className="protection-gap-card protection-report-fade protection-report-fade-delay-3"
          aria-labelledby="protection-gap-title"
        >
          <h2 id="protection-gap-title" className="protection-gap-headline">
            {t('results', 'gapTitle')}
          </h2>
          <AnimatedCurrency
            value={breakdown.netNeed}
            className="protection-gap-amount"
          />
          <p className="protection-gap-copy">{t('results', 'gapCopy')}</p>
        </section>

        <section
          className="protection-means-card protection-report-fade protection-report-fade-delay-4"
          aria-labelledby="what-this-means-title"
        >
          <h2 id="what-this-means-title" className="protection-means-title">
            {t('results', 'meansTitle')}
          </h2>
          <p className="protection-means-copy">{t('results', 'meansCopy')}</p>
        </section>

        <section className="protection-results-cta protection-report-fade protection-report-fade-delay-5">
          <h2>{t('results', 'scheduleTitle')}</h2>
          <p>{t('results', 'scheduleCopy')}</p>
          <div className="protection-results-actions">
            <ScheduleReportCardLink className="platform-btn platform-btn-primary">
              {t('results', 'scheduleCta')}
            </ScheduleReportCardLink>
            <Link className="platform-btn platform-btn-outline" to={withLocale(ROUTES.reportCard)}>
              {t('results', 'learnMoreCta')}
            </Link>
            <button
              type="button"
              className="platform-btn platform-btn-outline"
              onClick={() => navigate(withLocale(ROUTES.protectionGap))}
            >
              {t('results', 'restartCta')}
            </button>
          </div>
        </section>

        <footer className="protection-report-footer protection-report-fade protection-report-fade-delay-6">
          <p>{t('results', 'footer1')}</p>
          <p>{t('results', 'footer2')}</p>
        </footer>
      </div>
    </div>
  )
}
