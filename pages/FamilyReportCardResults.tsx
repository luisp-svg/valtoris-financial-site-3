import { Link, useLocation, useNavigate } from 'react-router-dom'
import AssessmentBrandHeader from '../components/AssessmentBrandHeader'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import ReportDashboard from '../components/reportDashboard/ReportDashboard'
import SpecializedLocaleSwitcher from '../components/assessment/specialized/SpecializedLocaleSwitcher'
import { familyCopy } from '../components/assessment/family/copy'
import { buildLocalizedFamilyDashboard } from '../components/assessment/family/localizeResults'
import { useReportCardCopy } from '../components/assessment/reportCardLocale'
import { formatSpecializedTemplate } from '../components/assessment/specialized/locale'
import { DEMO_ANSWERS_STORAGE_KEY } from '../components/assessment/constants'
import { DemoAssessmentAnswers, INITIAL_DEMO_ANSWERS } from '../components/assessment/types'
import { ROUTES } from '../constants/routes'

function loadAnswers(state: unknown): DemoAssessmentAnswers {
  if (state && typeof state === 'object' && 'answers' in state) {
    return (state as { answers: DemoAssessmentAnswers }).answers
  }

  try {
    const stored = sessionStorage.getItem(DEMO_ANSWERS_STORAGE_KEY)
    if (stored) return JSON.parse(stored) as DemoAssessmentAnswers
  } catch {
    // Demo fallback when opened directly.
  }

  return INITIAL_DEMO_ANSWERS
}

export default function FamilyReportCardResults() {
  const location = useLocation()
  const navigate = useNavigate()
  const { locale, t, withLocale } = useReportCardCopy(familyCopy)
  const answers = loadAnswers(location.state)
  const submissionWarning =
    location.state &&
    typeof location.state === 'object' &&
    'submissionWarning' in location.state
      ? String((location.state as { submissionWarning?: string }).submissionWarning ?? '')
      : ''
  const firstName = answers.family.firstName.trim()
  const greeting = firstName
    ? formatSpecializedTemplate(t('ui', 'preparedFor'), { name: firstName })
    : t('ui', 'sampleGreeting')

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

        <ReportDashboard data={buildLocalizedFamilyDashboard(firstName, greeting, answers, t)} />

        <section className="rd-cta">
          <h2 className="rd-cta-title">{t('ui', 'resultsScheduleTitle')}</h2>
          <p className="rd-cta-copy">{t('ui', 'resultsScheduleCopy')}</p>
          <ScheduleReportCardLink className="platform-btn platform-btn-secondary">
            {t('ui', 'resultsScheduleTitle')}
          </ScheduleReportCardLink>
          <Link className="results-back-link" to={withLocale(ROUTES.protectionAnalysis)}>
            {t('ui', 'resultsProtectionCta')}
          </Link>
          <button
            type="button"
            className="results-back-link"
            onClick={() => navigate(withLocale(ROUTES.familyAssessment))}
          >
            {t('ui', 'resultsRetake')}
          </button>
        </section>
      </div>
    </div>
  )
}
