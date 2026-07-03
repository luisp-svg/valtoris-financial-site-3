import { useLocation, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import ReportCardDocument from '../components/reportCard/ReportCardDocument'
import { SAMPLE_GREETING } from '../components/reportCard/reportCardData'
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
  const answers = loadAnswers(location.state)
  const familyName = answers.family.firstName.trim()
  const greeting = familyName ? `Prepared for ${familyName}` : SAMPLE_GREETING

  return (
    <div className="results-shell">
      <div className="results-container">
        <header className="results-header">
          <BrandLogo className="results-logo" />
          <p className="results-prepared-for">{greeting}</p>
        </header>

        <ReportCardDocument
          greeting={greeting}
          showHeader={false}
          showFooter={false}
          variant="flow"
          pages={['overview', 'insights', 'protection', 'priorities']}
        />

        <section className="results-cta">
          <h2 className="results-cta-headline">
            Ready to Improve Your Family Financial Report Card™?
          </h2>
          <p className="results-cta-support">
            Meet with a Valtoris Financial Strategist to review your report and build your
            personalized Family Financial Blueprint™.
          </p>
          <ScheduleReportCardLink className="results-cta-button" />
          <button type="button" className="results-back-link" onClick={() => navigate(ROUTES.reportCard)}>
            Retake Assessment
          </button>
        </section>
      </div>
    </div>
  )
}
