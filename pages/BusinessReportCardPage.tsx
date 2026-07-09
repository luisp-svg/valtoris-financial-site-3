import { Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import HomeCardIcon from '../components/home/HomeCardIcon'
import BusinessReportHeroPreview from '../components/product/BusinessReportHeroPreview'
import { BUSINESS_CTA, BUSINESS_SAMPLE_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

const WHAT_YOU_RECEIVE = [
  {
    icon: 'grade' as const,
    title: 'Business Financial Score™',
    description:
      'Overall score and letter grade across the core areas of business financial health.',
  },
  {
    icon: 'picture' as const,
    title: 'Eight Category Breakdowns',
    description: 'See where the business is strong, exposed, or missing key systems.',
  },
  {
    icon: 'priorities' as const,
    title: 'Top 3 Business Priorities',
    description: 'Identify what deserves attention first based on the owner\'s answers.',
  },
  {
    icon: 'blueprint' as const,
    title: '90-Day Business Action Plan',
    description: 'Turn assessment results into focused next steps for the next quarter.',
  },
]

const WHAT_WE_REVIEW = [
  {
    title: 'Business Structure',
    description:
      'Legal entity, operating documents, and separation of personal and business finances.',
  },
  {
    title: 'Cash Flow',
    description:
      'Operating cash flow, reserves, revenue predictability, and owner compensation patterns.',
  },
  {
    title: 'Tax Strategy',
    description:
      'Proactive tax planning, benefit strategies, and alignment with business growth goals.',
  },
  {
    title: 'Business Protection',
    description:
      'Key person coverage, buy-sell planning, and continuity strategies for leadership risk.',
  },
  {
    title: 'Risk Management',
    description:
      'Core commercial insurance, specialized coverage, and operational liability exposure.',
  },
  {
    title: 'Retirement & Wealth',
    description:
      'Owner retirement savings outside the business relative to revenue and personal income.',
  },
  {
    title: 'Credit & Funding',
    description: 'Business credit profile, lending relationships, and access to growth capital.',
  },
  {
    title: 'Exit Planning',
    description: 'Succession planning, valuation baseline, and long-term transition readiness.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Complete the Assessment',
    description: 'Answer focused questions about your business, operations, and owner goals.',
  },
  {
    step: '2',
    title: 'Receive Your Business Report Card',
    description:
      'Get your complimentary Business Financial Report Card™ with scores, grades, and insights.',
  },
  {
    step: '3',
    title: 'Review Your Priorities',
    description: 'See your Top 3 Business Priorities™ and where the business needs attention first.',
  },
  {
    step: '4',
    title: 'Implement Your 90-Day Plan',
    description: 'Follow your Business Action Plan™ with immediate, 30-day, and 90-day next steps.',
  },
]

export default function BusinessReportCardPage() {
  const navigate = useNavigate()

  function handleStartAssessment() {
    navigate(ROUTES.businessAssessment)
  }

  function handleViewSampleReport() {
    navigate(ROUTES.businessReportCardResults)
  }

  return (
    <div className="product-landing business-report-card-page">
      <section className="product-hero business-report-card-hero">
        <div className="container two-col">
          <div className="panel">
            <div className="kicker">Business Financial Report Card™</div>
            <h1 className="business-report-card-headline">
              Your business finally has a financial health report.
            </h1>
            <p className="business-report-card-lead">
              Discover where your business is strong, where it&apos;s exposed, and what to fix first
              to protect revenue, reduce risk, and increase enterprise value.
            </p>
            <ul className="business-report-card-points">
              <li>Business Financial Score with letter grade</li>
              <li>Eight category breakdowns with personalized guidance</li>
              <li>Top 3 Business Priorities and 90-day action plan</li>
            </ul>
            <button
              type="button"
              className="business-report-card-sample"
              onClick={handleViewSampleReport}
            >
              {BUSINESS_SAMPLE_CTA}
            </button>
          </div>
          <div className="panel business-report-card-cta-panel">
            <h3 className="business-report-card-cta-title">Business Financial Assessment™</h3>
            <p className="business-report-card-cta-copy">
              A professional diagnostic for business owners — answer focused questions and receive your
              personalized Business Financial Report Card™.
            </p>
            <button
              type="button"
              className="assessment-btn assessment-btn-primary business-report-card-cta-button"
              onClick={handleStartAssessment}
            >
              {BUSINESS_CTA}
            </button>
          </div>
        </div>
      </section>

      <section className="product-section product-preview-section">
        <div className="container product-section-inner">
          <h2 className="product-section-title">See What Your Business Report Looks Like</h2>
          <p className="product-section-lead">
            Preview the financial score, category breakdowns, priorities, and action plan you&apos;ll
            receive after completing the assessment.
          </p>
          <div className="product-preview-stage">
            <BusinessReportHeroPreview />
          </div>
          <div className="product-section-actions">
            <button
              type="button"
              className="product-btn-secondary"
              onClick={handleViewSampleReport}
            >
              {BUSINESS_SAMPLE_CTA}
            </button>
          </div>
        </div>
      </section>

      <section className="product-section">
        <div className="container product-section-inner">
          <h2 className="product-section-title">What You&apos;ll Receive</h2>
          <p className="product-section-lead">
            Four deliverables. One complete picture of your business financial health.
          </p>
          <div className="product-card-grid product-card-grid-four">
            {WHAT_YOU_RECEIVE.map((item) => (
              <article key={item.title} className="product-card">
                <HomeCardIcon variant={item.icon} />
                <h3 className="product-card-title">{item.title}</h3>
                <p className="product-card-copy">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="product-section product-section-alt">
        <div className="container product-section-inner">
          <h2 className="product-section-title">What We Review</h2>
          <p className="product-section-lead">
            Eight business dimensions scored, graded, and explained in your report.
          </p>
          <div className="product-card-grid product-card-grid-four">
            {WHAT_WE_REVIEW.map((item) => (
              <article key={item.title} className="product-card product-card-review">
                <h3 className="product-card-title">{item.title}</h3>
                <p className="product-card-copy">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="product-section">
        <div className="container product-section-inner">
          <h2 className="product-section-title">How It Works</h2>
          <p className="product-section-lead">
            Four steps from assessment to action.
          </p>
          <div className="product-steps">
            {HOW_IT_WORKS.map((item, index) => (
              <Fragment key={item.title}>
                <article
                  className={`product-step${index === 0 ? ' is-first' : ''}${
                    index === HOW_IT_WORKS.length - 1 ? ' is-last' : ''
                  }`}
                >
                  <span className="product-step-number">{item.step}</span>
                  <h3 className="product-step-title">{item.title}</h3>
                  <p className="product-step-copy">{item.description}</p>
                </article>
                {index < HOW_IT_WORKS.length - 1 ? (
                  <span className="product-step-connector" aria-hidden="true" />
                ) : null}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      <section className="product-closing">
        <div className="container product-closing-inner">
          <h2 className="product-closing-title">Your Business Deserves More Than Guesswork.</h2>
          <p className="product-closing-copy">
            See where your business stands, what may be holding it back, and what to prioritize next.
          </p>
          <div className="product-closing-actions">
            <button
              type="button"
              className="product-btn-light"
              onClick={handleStartAssessment}
            >
              {BUSINESS_CTA}
            </button>
            <button
              type="button"
              className="product-btn-ghost"
              onClick={handleViewSampleReport}
            >
              {BUSINESS_SAMPLE_CTA}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
