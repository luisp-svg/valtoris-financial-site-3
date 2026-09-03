import { Link, useLocation } from 'react-router-dom'
import AssessmentBrandHeader from '../components/AssessmentBrandHeader'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import SpecializedLocaleSwitcher, {
  useSpecializedDocumentLang,
} from '../components/assessment/specialized/SpecializedLocaleSwitcher'
import {
  formatSpecializedTemplate,
  readSpecializedLocale,
  resolveSpecializedCopy,
  withSpecializedLocale,
} from '../components/assessment/specialized/locale'
import type { SpecializedCopySection } from '../components/assessment/specialized/types'
import { HOME_BUYER_ANSWERS_STORAGE_KEY } from '../components/assessment/homeBuyer/constants'
import { homeBuyerCopy } from '../components/assessment/homeBuyer/copy'
import {
  getHomeBuyerResultsModel,
  type HomeBuyerResultsSession,
} from '../components/assessment/homeBuyer/resultsModel'
import type { HomeBuyerFlagSeverity } from '../components/assessment/homeBuyer/scoreHomeBuyerAssessment'
import type { HomeBuyerDiagnosticAnswers } from '../components/assessment/homeBuyer/types'
import { ROUTES } from '../constants/routes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function readResultsSession(value: unknown): HomeBuyerResultsSession | null {
  if (!isRecord(value) || !isRecord(value.diagnostic)) return null
  return {
    diagnostic: value.diagnostic as HomeBuyerDiagnosticAnswers,
    firstName: typeof value.firstName === 'string' ? value.firstName : '',
  }
}

function loadResultsSession(state: unknown): HomeBuyerResultsSession | null {
  if (isRecord(state) && isRecord(state.answers)) {
    return readResultsSession(state.answers)
  }
  try {
    const stored = sessionStorage.getItem(HOME_BUYER_ANSWERS_STORAGE_KEY)
    if (!stored) return null
    return readResultsSession(JSON.parse(stored))
  } catch {
    // Direct visits have no answers; the shell stays unavailable.
  }
  return null
}

function flagCardClass(severity: HomeBuyerFlagSeverity): string {
  if (severity === 'immediate_review') return 'priority-card priority-card-critical'
  if (severity === 'high_priority') return 'priority-card priority-card-important'
  return 'priority-card priority-card-longterm'
}

function flagBadgeClass(severity: HomeBuyerFlagSeverity): string {
  if (severity === 'immediate_review') return 'priority-badge priority-badge-critical'
  if (severity === 'high_priority') return 'priority-badge priority-badge-important'
  return 'priority-badge priority-badge-longterm'
}

export default function HomeBuyerReportCardResults() {
  const location = useLocation()
  const locale = readSpecializedLocale(location.search)
  useSpecializedDocumentLang(locale)
  const session = loadResultsSession(location.state)
  const results = getHomeBuyerResultsModel(session)
  const firstName = session?.firstName.trim() ?? ''

  function t(section: SpecializedCopySection, key: string): string {
    return resolveSpecializedCopy(homeBuyerCopy, locale, section, key)
  }

  if (!results.available || results.overallScore === null || !results.grade) {
    return (
      <div className="results-shell">
        <div className="results-container">
          <header className="results-header">
            <AssessmentBrandHeader />
            <SpecializedLocaleSwitcher
              locale={locale}
              groupLabel={t('ui', 'languageGroupLabel')}
              englishLabel={t('ui', 'languageEnglish')}
              spanishLabel={t('ui', 'languageSpanish')}
            />
          </header>
          <section className="question-card" aria-labelledby="home-buyer-results-title">
            <h1 className="question-card-title" id="home-buyer-results-title">
              {t('ui', 'productTitle')}
            </h1>
            <p className="question-card-description" data-testid="home-buyer-results-unavailable">
              {t('results', 'unavailable')}
            </p>
            <p className="assessment-note">{t('ui', 'resultsLead')}</p>
            <div className="welcome-actions">
              <Link
                className="platform-btn platform-btn-primary"
                to={withSpecializedLocale(ROUTES.homeBuyerAssessment, locale, location.search)}
              >
                {t('ui', 'retake')}
              </Link>
              <Link
                className="platform-btn platform-btn-outline"
                to={withSpecializedLocale(ROUTES.homeBuyerReportCard, locale, location.search)}
              >
                {t('ui', 'backToLanding')}
              </Link>
            </div>
          </section>
        </div>
      </div>
    )
  }

  const statusText = results.statusLabelKey ? t('results', results.statusLabelKey) : ''

  return (
    <div className="results-shell">
      <div className="results-container">
        <header className="results-header">
          <AssessmentBrandHeader />
          <SpecializedLocaleSwitcher
            locale={locale}
            groupLabel={t('ui', 'languageGroupLabel')}
            englishLabel={t('ui', 'languageEnglish')}
            spanishLabel={t('ui', 'languageSpanish')}
          />
          <h1 className="visually-hidden">{t('ui', 'productTitle')}</h1>
          {firstName ? (
            <p className="results-prepared-for">
              {t('ui', 'preparedFor')} {firstName}
            </p>
          ) : null}
        </header>

        {results.hardRiskFlags.length > 0 ? (
          <section className="results-priorities" aria-labelledby="home-buyer-flags-title">
            <h2 className="results-section-title" id="home-buyer-flags-title">
              {t('results', 'flags')}
            </h2>
            <div className="results-priorities-list">
              {results.hardRiskFlags.map((flag) => (
                <article key={flag.id} className={flagCardClass(flag.severity)} data-flag-id={flag.id}>
                  <span className={flagBadgeClass(flag.severity)}>{t('results', flag.labelKey)}</span>
                  <h3 className="priority-title">{t('results', `insight.${flag.id}.title`)}</h3>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="results-hero" aria-labelledby="home-buyer-score-title">
          <p className="results-kicker">{t('ui', 'productTitle')}</p>
          <h2 className="results-title" id="home-buyer-score-title">
            {t('results', 'score')}
          </h2>
          <div className="results-grade-card">
            <div className="results-grade-block">
              <span className="results-grade-label">{t('results', 'score')}</span>
              <span
                className="results-grade-value"
                data-testid="home-buyer-overall-score"
                aria-label={`${t('results', 'score')} ${formatSpecializedTemplate(t('ui', 'scoreOutOf'), { score: results.overallScore })}`}
              >
                {results.overallScore}
              </span>
            </div>
            <div className="results-grade-divider" aria-hidden="true" />
            <div className="results-grade-block">
              <span className="results-grade-label">{t('results', 'grade')}</span>
              <span className="results-level-value" data-testid="home-buyer-grade">
                {results.grade} — {statusText}
              </span>
            </div>
          </div>
          <div className="results-progress-section">
            <div className="results-progress-header">
              <span>{t('results', 'status')}</span>
              <strong data-testid="home-buyer-status">{statusText}</strong>
            </div>
            <div className="results-progress-track">
              <div className="results-progress-fill" style={{ width: `${results.overallScore}%` }} />
            </div>
          </div>
        </section>

        <section className="results-panel" aria-labelledby="home-buyer-categories-title">
          <h2 id="home-buyer-categories-title">{t('results', 'categories')}</h2>
          <ul>
            {results.categoryScores.map((category) => (
              <li key={category.id} data-category-id={category.id}>
                {t('results', category.labelKey)}: {category.score}/{category.max}
              </li>
            ))}
          </ul>
        </section>

        {results.strengths.length > 0 ? (
          <section className="results-panel" aria-labelledby="home-buyer-strengths-title">
            <h2 className="results-section-title" id="home-buyer-strengths-title">
              {t('results', 'strengths')}
            </h2>
            <div className="results-priorities-list">
              {results.strengths.map((item) => (
                <article key={item.id} className={flagCardClass(item.severity)} data-strength-id={item.id}>
                  <h3 className="priority-title">{t('results', item.titleKey)}</h3>
                  <p className="priority-detail-text">{t('results', item.explanationKey)}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {results.barriers.length > 0 ? (
          <section className="results-priorities" aria-labelledby="home-buyer-barriers-title">
            <h2 className="results-section-title" id="home-buyer-barriers-title">
              {t('results', 'barriers')}
            </h2>
            <div className="results-priorities-list">
              {results.barriers.map((item) => (
                <article key={item.id} className={flagCardClass(item.severity)} data-barrier-id={item.id}>
                  <span className={flagBadgeClass(item.severity)}>{t('results', item.titleKey)}</span>
                  <p className="priority-detail-text">{t('results', item.explanationKey)}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {results.prioritizedNextActions.length > 0 ? (
          <section className="results-priorities" aria-labelledby="home-buyer-actions-title">
            <h2 className="results-section-title" id="home-buyer-actions-title">
              {t('results', 'nextActions')}
            </h2>
            <div className="results-priorities-list">
              {results.prioritizedNextActions.map((item) => (
                <article key={item.id} className={flagCardClass(item.severity)} data-action-id={item.id}>
                  <span className={flagBadgeClass(item.severity)}>{t('results', item.titleKey)}</span>
                  <p className="priority-detail-text">{t('results', item.explanationKey)}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <p className="family-results-disclaimer">{t('results', 'disclaimer')}</p>

        <section className="results-cta">
          <h2 className="results-cta-headline">{t('results', 'reviewWithValtoris')}</h2>
          <p className="results-cta-support">{t('ui', 'nextStepSupport')}</p>
          <ScheduleReportCardLink className="platform-btn platform-btn-secondary">
            {t('results', 'reviewWithValtoris')}
          </ScheduleReportCardLink>
          <Link
            className="results-back-link"
            to={withSpecializedLocale(ROUTES.homeBuyerAssessment, locale, location.search)}
          >
            {t('ui', 'retakeCta')}
          </Link>
        </section>
      </div>
    </div>
  )
}
