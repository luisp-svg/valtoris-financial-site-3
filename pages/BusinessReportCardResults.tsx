import { useLocation, useNavigate } from 'react-router-dom'
import AssessmentBrandHeader from '../components/AssessmentBrandHeader'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import ReportDashboard from '../components/reportDashboard/ReportDashboard'
import SpecializedLocaleSwitcher from '../components/assessment/specialized/SpecializedLocaleSwitcher'
import { businessCopy } from '../components/assessment/business/copy'
import { buildLocalizedBusinessDashboard } from '../components/assessment/business/localizeResults'
import { useReportCardCopy } from '../components/assessment/reportCardLocale'
import { formatSpecializedTemplate } from '../components/assessment/specialized/locale'
import { DEMO_BUSINESS_ANSWERS } from '../components/reportCard/businessReportCardData'
import { BUSINESS_ANSWERS_STORAGE_KEY } from '../components/business/constants'
import { BusinessAssessmentAnswers } from '../components/assessment/business/types'
import { ROUTES } from '../constants/routes'

function loadAnswers(state: unknown): BusinessAssessmentAnswers | undefined {
  if (state && typeof state === 'object' && 'answers' in state) {
    return (state as { answers: BusinessAssessmentAnswers }).answers
  }

  try {
    const stored = sessionStorage.getItem(BUSINESS_ANSWERS_STORAGE_KEY)
    if (stored) return JSON.parse(stored) as BusinessAssessmentAnswers
  } catch {
    // Demo fallback when opened directly.
  }

  return undefined
}

export default function BusinessReportCardResults() {
  const location = useLocation()
  const navigate = useNavigate()
  const { locale, t, withLocale } = useReportCardCopy(businessCopy)
  const answers = loadAnswers(location.state)
  const submissionWarning =
    location.state &&
    typeof location.state === 'object' &&
    'submissionWarning' in location.state
      ? String((location.state as { submissionWarning?: string }).submissionWarning ?? '')
      : ''
  const businessName = answers?.business.name.trim() ?? ''
  const greeting = businessName
    ? formatSpecializedTemplate(t('ui', 'preparedFor'), { name: businessName })
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

        {submissionWarning ? (
          <p className="submission-notice" role="status">
            {submissionWarning}
          </p>
        ) : null}

        <ReportDashboard
          data={buildLocalizedBusinessDashboard(
            businessName,
            greeting,
            answers ?? DEMO_BUSINESS_ANSWERS,
            t,
          )}
        />

        <section className="rd-cta">
          <h2 className="rd-cta-title">{t('ui', 'resultsScheduleTitle')}</h2>
          <p className="rd-cta-copy">{t('ui', 'resultsScheduleCopy')}</p>
          <ScheduleReportCardLink className="platform-btn platform-btn-secondary">
            {t('ui', 'resultsScheduleTitle')}
          </ScheduleReportCardLink>
          <button
            type="button"
            className="results-back-link"
            onClick={() => navigate(withLocale(ROUTES.businessAssessment))}
          >
            {t('ui', 'resultsRetake')}
          </button>
        </section>
      </div>
    </div>
  )
}
