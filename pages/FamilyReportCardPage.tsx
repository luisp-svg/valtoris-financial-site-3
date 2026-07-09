import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HomeCardIcon from '../components/home/HomeCardIcon'
import ReportCardHeroPreview from '../components/home/ReportCardHeroPreview'
import SampleReportModal from '../components/home/SampleReportModal'
import { FAMILY_CTA, SAMPLE_REPORT_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

const WHAT_YOU_RECEIVE = [
  {
    icon: 'grade' as const,
    title: 'Overall Financial Grade™',
    description: 'Your household score and Legacy Ready™ progress in one clear view.',
  },
  {
    icon: 'protection' as const,
    title: 'Family Protection Analysis™',
    description: 'Estimated protection gap and coverage insights built into your report.',
  },
  {
    icon: 'blueprint' as const,
    title: 'Personalized Financial Blueprint™',
    description: 'Prioritized next steps tailored to your family\'s situation.',
  },
  {
    icon: 'priorities' as const,
    title: 'Personalized Action Plan',
    description: 'A focused roadmap built around your highest-priority financial opportunities.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Complete the Assessment',
    description: 'Answer focused questions about your family, finances, and goals.',
  },
  {
    step: '2',
    title: 'Receive Your Report Card',
    description: 'Get your complimentary Family Financial Report Card™ with grades and insights.',
  },
  {
    step: '3',
    title: 'Meet With Your Advisor',
    description: 'Review your results in a complimentary Strategy Session™.',
  },
  {
    step: '4',
    title: 'Implement Your Blueprint',
    description: 'Move forward with a clear, prioritized Financial Blueprint™.',
  },
]

const WHAT_WE_REVIEW = [
  {
    title: 'Cash Flow & Budget',
    description: 'Housing burden, monthly cash flow patterns, and spending flexibility.',
  },
  {
    title: 'Emergency Fund',
    description: 'Reserve adequacy for income disruptions and unexpected expenses.',
  },
  {
    title: 'Debt Management',
    description: 'Total debt relative to income and payoff strategy readiness.',
  },
  {
    title: 'Insurance & Protection',
    description: 'Life insurance, disability coverage, and estimated Protection Gap™.',
  },
  {
    title: 'Retirement Readiness',
    description: 'Savings contributions and long-term income replacement planning.',
  },
  {
    title: 'Estate & Legacy',
    description: 'Documents, beneficiary designations, and guardianship planning.',
  },
]

export default function FamilyReportCardPage() {
  const navigate = useNavigate()
  const [isSampleOpen, setIsSampleOpen] = useState(false)

  return (
    <div className="product-landing family-report-card-page">
      <section className="product-hero">
        <div className="container product-hero-grid">
          <div className="panel product-hero-panel">
            <div className="kicker">Family Financial Report Card™</div>
            <h1 className="product-headline">
              Your family&apos;s complete financial health report.
            </h1>
            <p className="product-lead">
              See where your household is strong, where you&apos;re exposed, and what to fix
              first — with grades, protection insights, and a personalized roadmap.
            </p>
            <ul className="product-points">
              <li>Overall Financial Grade™ with letter score</li>
              <li>Six category breakdowns with personalized guidance</li>
              <li>Top 3 Priorities and 90-day Family Action Plan™</li>
            </ul>
            <button
              type="button"
              className="product-btn-secondary"
              onClick={() => setIsSampleOpen(true)}
            >
              {SAMPLE_REPORT_CTA}
            </button>
          </div>
          <div className="panel product-cta-panel">
            <h2 className="product-cta-title">Family Financial Assessment™</h2>
            <p className="product-cta-copy">
              A professional diagnostic for families — answer focused questions and receive
              your complimentary Family Financial Report Card™.
            </p>
            <button
              type="button"
              className="assessment-btn assessment-btn-primary product-cta-button"
              onClick={() => navigate(ROUTES.familyAssessment)}
            >
              {FAMILY_CTA}
            </button>
          </div>
        </div>
      </section>

      <section className="product-section product-preview-section">
        <div className="container product-section-inner">
          <h2 className="product-section-title">Explore a Sample Report Card</h2>
          <p className="product-section-lead">
            Browse a real Family Financial Report Card™ before you begin your assessment.
          </p>
          <div className="product-preview-stage">
            <ReportCardHeroPreview />
          </div>
          <div className="product-section-actions">
            <button
              type="button"
              className="product-btn-secondary"
              onClick={() => setIsSampleOpen(true)}
            >
              {SAMPLE_REPORT_CTA}
            </button>
          </div>
        </div>
      </section>

      <section className="product-section">
        <div className="container product-section-inner">
          <h2 className="product-section-title">What You&apos;ll Receive</h2>
          <p className="product-section-lead">
            Four deliverables. One complete picture of your family&apos;s financial health.
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

      <section className="product-section">
        <div className="container product-section-inner">
          <h2 className="product-section-title">What We Review</h2>
          <p className="product-section-lead">
            Six financial dimensions scored, graded, and explained in your report.
          </p>
          <div className="product-card-grid product-card-grid-three">
            {WHAT_WE_REVIEW.map((item) => (
              <article key={item.title} className="product-card product-card-review">
                <h3 className="product-card-title">{item.title}</h3>
                <p className="product-card-copy">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="product-closing">
        <div className="container product-closing-inner">
          <h2 className="product-closing-title">Your Family Deserves More Than Guesswork.</h2>
          <p className="product-closing-copy">
            See where you stand today — and get a personalized roadmap for tomorrow.
            Complimentary. No obligation.
          </p>
          <div className="product-closing-actions">
            <button
              type="button"
              className="product-btn-light"
              onClick={() => navigate(ROUTES.familyAssessment)}
            >
              {FAMILY_CTA}
            </button>
            <button
              type="button"
              className="product-btn-ghost"
              onClick={() => setIsSampleOpen(true)}
            >
              {SAMPLE_REPORT_CTA}
            </button>
          </div>
        </div>
      </section>

      <SampleReportModal isOpen={isSampleOpen} onClose={() => setIsSampleOpen(false)} />
    </div>
  )
}
