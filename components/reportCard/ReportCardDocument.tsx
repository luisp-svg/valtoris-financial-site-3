import PriorityRecommendationCard from '../results/PriorityRecommendationCard'
import {
  REPORT_GRADE,
  REPORT_LEVEL,
  REPORT_OPPORTUNITIES,
  REPORT_PAGES,
  REPORT_PROTECTION_GAP,
  REPORT_PROGRESS,
  REPORT_STRENGTHS,
  REPORT_TOP_PRIORITIES,
  ReportPageId,
} from './reportCardData'

type ReportCardDocumentProps = {
  greeting?: string
  pageId?: ReportPageId
  showHeader?: boolean
  showFooter?: boolean
  variant?: 'flow' | 'document'
  pages?: ReportPageId[]
  className?: string
}

function ReportCardHeader({ greeting }: { greeting: string }) {
  return (
    <header className="report-card-doc-header">
      <p className="report-card-doc-prepared">{greeting}</p>
    </header>
  )
}

function ReportCardOverviewPage() {
  return (
    <section
      className="report-card-page report-card-page-overview results-hero"
      aria-label="Report overview"
    >
      <p className="results-kicker">Valtoris Financial</p>
      <h2 className="results-title">Your Family Financial Report Card™</h2>

      <div className="results-grade-card">
        <div className="results-grade-block">
          <span className="results-grade-label">Overall Grade</span>
          <span className="results-grade-value">{REPORT_GRADE}</span>
        </div>
        <div className="results-grade-divider" aria-hidden="true" />
        <div className="results-grade-block">
          <span className="results-grade-label">Current Level</span>
          <span className="results-level-value">{REPORT_LEVEL}</span>
        </div>
      </div>

      <div className="results-progress-section">
        <div className="results-progress-header">
          <span>Progress Toward Legacy Ready™</span>
          <strong>{REPORT_PROGRESS}%</strong>
        </div>
        <div className="results-progress-track">
          <div className="results-progress-fill" style={{ width: `${REPORT_PROGRESS}%` }} />
        </div>
      </div>
    </section>
  )
}

function ReportCardInsightsPage() {
  return (
    <section className="report-card-page report-card-page-insights" aria-label="Strengths and opportunities">
      <h2 className="results-section-title">Strengths &amp; Opportunities</h2>
      <div className="results-grid">
        <section className="results-panel results-panel-strengths">
          <h2>Greatest Strengths</h2>
          <ul>
            {REPORT_STRENGTHS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="results-panel results-panel-opportunities">
          <h2>Biggest Opportunities</h2>
          <ul>
            {REPORT_OPPORTUNITIES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  )
}

function ReportCardProtectionPage() {
  return (
    <section className="report-card-page report-card-page-protection" aria-label="Protection analysis">
      <h2 className="results-section-title">Protection Analysis</h2>
      <section className="results-gap-card">
        <span className="results-gap-label">Family Protection Gap</span>
        <span className="results-gap-value">{REPORT_PROTECTION_GAP}</span>
        <p className="results-gap-note">
          Closing this gap helps protect your family&apos;s income, lifestyle, and long-term legacy goals.
        </p>
      </section>
    </section>
  )
}

function ReportCardPrioritiesPage() {
  return (
    <section className="report-card-page report-card-page-priorities" aria-label="Personalized action plan">
      <h2 className="results-section-title">Your Top 3 Priorities</h2>
      <div className="results-priorities-list">
        {REPORT_TOP_PRIORITIES.map((priority) => (
          <PriorityRecommendationCard key={priority.title} {...priority} />
        ))}
      </div>
    </section>
  )
}

function ReportCardNextStepsPage() {
  return (
    <section className="report-card-page report-card-page-next-steps" aria-label="Next steps">
      <div className="results-cta">
        <h2 className="results-cta-headline">
          Ready to Improve Your Family Financial Report Card™?
        </h2>
        <p className="results-cta-support">
          Meet with a Valtoris Financial Strategist to review your report and build your personalized
          Family Financial Blueprint™.
        </p>
        <span className="report-card-doc-cta-placeholder">Schedule My Complimentary Session</span>
      </div>
    </section>
  )
}

function ReportCardPageContent({ pageId }: { pageId: ReportPageId }) {
  switch (pageId) {
    case 'overview':
      return <ReportCardOverviewPage />
    case 'insights':
      return <ReportCardInsightsPage />
    case 'protection':
      return <ReportCardProtectionPage />
    case 'priorities':
      return <ReportCardPrioritiesPage />
    case 'next-steps':
      return <ReportCardNextStepsPage />
    default:
      return null
  }
}

export function ReportCardSinglePage({
  pageId,
  greeting = 'Sample Family Report Card',
  showHeader = true,
  className = '',
}: ReportCardDocumentProps & { pageId: ReportPageId }) {
  return (
    <div className={`report-card-document ${className}`.trim()}>
      {showHeader ? <ReportCardHeader greeting={greeting} /> : null}
      <ReportCardPageContent pageId={pageId} />
    </div>
  )
}

export default function ReportCardDocument({
  greeting = 'Sample Family Report Card',
  showHeader = true,
  showFooter = true,
  variant = 'document',
  pages,
  className = '',
}: ReportCardDocumentProps) {
  const visiblePages = REPORT_PAGES.filter((page) =>
    pages ? pages.includes(page.id) : true,
  )

  return (
    <div className={`report-card-document report-card-document-${variant} ${className}`.trim()}>
      {showHeader ? <ReportCardHeader greeting={greeting} /> : null}

      {visiblePages.map((page, index) => {
        const content = <ReportCardPageContent pageId={page.id} />

        if (variant === 'flow') {
          return (
            <div key={page.id} className="report-card-flow-section" data-page={page.id}>
              {content}
            </div>
          )
        }

        return (
          <div key={page.id} className="report-card-doc-sheet" data-page={page.id}>
            <p className="report-card-doc-sheet-label">
              Page {index + 1} · {page.label}
            </p>
            {content}
          </div>
        )
      })}

      {showFooter ? (
        <footer className="report-card-doc-footer">
          <p>Powered by Valtoris Financial™</p>
          <p>Helping Families Become Legacy Ready™</p>
        </footer>
      ) : null}
    </div>
  )
}
