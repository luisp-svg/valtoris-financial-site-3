import { Link, useLocation } from 'react-router-dom'
import AssessmentBrandHeader from '../components/AssessmentBrandHeader'
import SpecializedLocaleSwitcher, {
  useSpecializedDocumentLang,
} from '../components/assessment/specialized/SpecializedLocaleSwitcher'
import {
  readSpecializedLocale,
  resolveSpecializedCopy,
  withSpecializedLocale,
} from '../components/assessment/specialized/locale'
import type { SpecializedCopySection } from '../components/assessment/specialized/types'
import { CREDIT_ANSWERS_STORAGE_KEY } from '../components/assessment/credit/constants'
import { creditCopy } from '../components/assessment/credit/copy'
import {
  getCreditResultsModel,
  type CreditResultsSession,
} from '../components/assessment/credit/resultsModel'
import type { CreditDiagnosticAnswers } from '../components/assessment/credit/types'
import { ROUTES } from '../constants/routes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function readResultsSession(value: unknown): CreditResultsSession | null {
  if (!isRecord(value) || !isRecord(value.diagnostic)) return null
  return {
    diagnostic: value.diagnostic as CreditDiagnosticAnswers,
    firstName: typeof value.firstName === 'string' ? value.firstName : '',
  }
}

function loadResultsSession(state: unknown): CreditResultsSession | null {
  if (isRecord(state) && isRecord(state.answers)) {
    return readResultsSession(state.answers)
  }
  try {
    const stored = sessionStorage.getItem(CREDIT_ANSWERS_STORAGE_KEY)
    if (!stored) return null
    return readResultsSession(JSON.parse(stored))
  } catch {
    // Direct visits have no answers; the shell stays unavailable.
  }
  return null
}

export default function CreditReportCardResults() {
  const location = useLocation()
  const locale = readSpecializedLocale(location.search)
  useSpecializedDocumentLang(locale)
  const session = loadResultsSession(location.state)
  const results = getCreditResultsModel(session)

  function t(section: SpecializedCopySection, key: string): string {
    return resolveSpecializedCopy(creditCopy, locale, section, key)
  }

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
        <section className="question-card" aria-labelledby="credit-results-title">
          <h1 className="question-card-title" id="credit-results-title">
            {t('ui', 'productTitle')}
          </h1>
          <p className="question-card-description" data-testid="credit-results-unavailable">
            {t('results', 'unavailable')}
          </p>
          <p className="assessment-note">{t('ui', 'resultsLead')}</p>
          {results.available ? (
            <p data-testid="credit-results-unexpected-score">Unexpected scored result</p>
          ) : null}
          <div className="welcome-actions">
            <Link
              className="platform-btn platform-btn-primary"
              to={withSpecializedLocale(ROUTES.creditAssessment, locale, location.search)}
            >
              {t('ui', 'retake')}
            </Link>
            <Link
              className="platform-btn platform-btn-outline"
              to={withSpecializedLocale(ROUTES.creditReportCard, locale, location.search)}
            >
              {t('ui', 'backToLanding')}
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
