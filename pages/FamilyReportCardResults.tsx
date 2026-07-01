import { useLocation, useNavigate } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import PriorityRecommendationCard from '../components/results/PriorityRecommendationCard'
import { DEMO_ANSWERS_STORAGE_KEY } from '../components/assessment/constants'
import { DemoAssessmentAnswers, INITIAL_DEMO_ANSWERS } from '../components/assessment/types'

const STRENGTHS = ['Income & Cash Flow', 'Debt Strategy', 'Protection Planning']

const OPPORTUNITIES = [
  'Estate & Legacy Planning',
  'Emergency Preparedness',
  'Retirement Readiness',
]

const TOP_PRIORITIES = [
  {
    level: 'Critical' as const,
    title: 'Close Your Family Protection Gap',
    why: 'Your current coverage may leave a significant income and lifestyle gap if something unexpected happens to you or your spouse.',
    timeline: 'Recommended within 30–60 days',
  },
  {
    level: 'Important' as const,
    title: 'Complete Estate & Legacy Planning',
    why: 'Updating your will, trust, and beneficiary designations ensures your family is protected and your wishes are carried out.',
    timeline: 'Recommended within 60–90 days',
  },
  {
    level: 'Long-Term' as const,
    title: 'Accelerate Retirement Readiness',
    why: 'A structured savings and investment plan helps your family build confidence toward long-term financial independence.',
    timeline: 'Recommended over the next 6–12 months',
  },
]

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
  const greeting = familyName ? `Prepared for ${familyName}` : 'Sample Family Report Card'

  return (
    <div className="results-shell">
      <div className="results-container">
        <header className="results-header">
          <BrandLogo className="results-logo" />
          <p className="results-prepared-for">{greeting}</p>
        </header>

        <section className="results-hero">
          <p className="results-kicker">Valtoris Financial</p>
          <h1 className="results-title">Your Family Financial Report Card™</h1>

          <div className="results-grade-card">
            <div className="results-grade-block">
              <span className="results-grade-label">Overall Grade</span>
              <span className="results-grade-value">B+</span>
            </div>
            <div className="results-grade-divider" aria-hidden="true" />
            <div className="results-grade-block">
              <span className="results-grade-label">Current Level</span>
              <span className="results-level-value">Strong Foundation</span>
            </div>
          </div>

          <div className="results-progress-section">
            <div className="results-progress-header">
              <span>Progress Toward Legacy Ready™</span>
              <strong>82%</strong>
            </div>
            <div className="results-progress-track">
              <div className="results-progress-fill" style={{ width: '82%' }} />
            </div>
          </div>
        </section>

        <div className="results-grid">
          <section className="results-panel results-panel-strengths">
            <h2>Greatest Strengths</h2>
            <ul>
              {STRENGTHS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="results-panel results-panel-opportunities">
            <h2>Biggest Opportunities</h2>
            <ul>
              {OPPORTUNITIES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>

        <section className="results-gap-card">
          <span className="results-gap-label">Family Protection Gap</span>
          <span className="results-gap-value">$750,000</span>
          <p className="results-gap-note">
            Closing this gap helps protect your family's income, lifestyle, and long-term legacy goals.
          </p>
        </section>

        <section className="results-priorities">
          <h2 className="results-section-title">Your Top 3 Priorities</h2>
          <div className="results-priorities-list">
            {TOP_PRIORITIES.map((priority) => (
              <PriorityRecommendationCard key={priority.title} {...priority} />
            ))}
          </div>
        </section>

        <section className="results-cta">
          <h2 className="results-cta-headline">
            Ready to Improve Your Family Financial Report Card™?
          </h2>
          <p className="results-cta-support">
            Meet with a Valtoris Financial Strategist to review your report and build your
            personalized Family Financial Blueprint™.
          </p>
          <ScheduleReportCardLink className="results-cta-button" />
          <button type="button" className="results-back-link" onClick={() => navigate('/assessment')}>
            Retake Assessment
          </button>
        </section>
      </div>
    </div>
  )
}
