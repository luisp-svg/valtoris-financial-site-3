import { Fragment } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ProtectionSamplePreview from '../components/product/ProtectionSamplePreview'
import {
  FAMILY_REPORT_CARD_LEARN_CTA,
  PROTECTION_CTA,
} from '../constants/homepage'
import { ROUTES } from '../constants/routes'

const WHAT_IT_CALCULATES = [
  {
    title: 'Recommended Coverage',
    description: 'Total estimated life insurance needed to protect your household.',
  },
  {
    title: 'Income Protection',
    description: 'Replacement income to help your family maintain their standard of living.',
  },
  {
    title: 'Mortgage / Rent Protection',
    description: 'Five years of housing payments to preserve stability at home.',
  },
  {
    title: 'Debt Payoff',
    description: 'Outstanding consumer debt and liabilities your family would inherit.',
  },
  {
    title: 'Child Education',
    description: 'Future education funding for each child in your household.',
  },
  {
    title: 'Final Expenses',
    description: 'End-of-life costs so your family isn\'t burdened unexpectedly.',
  },
  {
    title: 'Existing Coverage',
    description: 'Current life insurance applied as a deduction from total need.',
  },
  {
    title: 'Protection Gap™',
    description: 'The difference between what you need and what you already have.',
  },
]

const WHO_THIS_IS_FOR = [
  {
    title: 'Families seeking coverage clarity',
    description:
      'You want a fast, focused estimate of how much life insurance your household may need — without a full financial review.',
  },
  {
    title: 'Parents evaluating current coverage',
    description:
      'You have a policy but aren\'t sure it\'s enough to protect income, housing, debt, and education goals.',
  },
  {
    title: 'Households starting with protection',
    description:
      'You\'re not ready for a full report card yet, but you want to understand your Protection Gap™ first.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Share Your Details',
    description: 'Enter family, income, housing, debt, education, and coverage information.',
  },
  {
    step: '2',
    title: 'Review Your Analysis',
    description: 'See recommended coverage, a needs breakdown, and your estimated Protection Gap™.',
  },
  {
    step: '3',
    title: 'Discuss With an Advisor',
    description: 'Schedule a complimentary Strategy Session™ to review your results and next steps.',
  },
]

export default function ProtectionAnalysisPage() {
  const navigate = useNavigate()

  return (
    <div className="product-landing protection-analysis-page">
      <section className="product-hero">
        <div className="container product-hero-grid">
          <div className="panel product-hero-panel">
            <div className="kicker">Family Protection Analysis™</div>
            <h1 className="product-headline">
              Find out how much protection your family may need.
            </h1>
            <p className="product-lead">
              A focused diagnostic that estimates your coverage needs and Protection Gap™ —
              in less than two minutes.
            </p>
            <ul className="product-points">
              <li>Recommended Life Insurance Coverage™</li>
              <li>Detailed needs breakdown by category</li>
              <li>Estimated Protection Gap™ after existing coverage</li>
            </ul>
            <Link className="product-btn-secondary" to={ROUTES.reportCard}>
              {FAMILY_REPORT_CARD_LEARN_CTA}
            </Link>
          </div>
          <div className="panel product-cta-panel">
            <h2 className="product-cta-title">Protection Calculator™</h2>
            <p className="product-cta-copy">
              Answer seven quick questions and receive your personalized Family Protection
              Analysis™ — complimentary and educational.
            </p>
            <button
              type="button"
              className="assessment-btn assessment-btn-primary product-cta-button"
              onClick={() => navigate(ROUTES.protectionGap)}
            >
              {PROTECTION_CTA}
            </button>
          </div>
        </div>
      </section>

      <section className="product-section product-preview-section">
        <div className="container product-section-inner product-section-inner-split">
          <div className="product-preview-copy">
            <h2 className="product-section-title product-section-title-left">
              See What Your Analysis Looks Like
            </h2>
            <p className="product-section-lead product-section-lead-left">
              Every Family Protection Analysis™ delivers a clear coverage recommendation,
              itemized needs breakdown, and estimated Protection Gap™.
            </p>
          </div>
          <ProtectionSamplePreview />
        </div>
      </section>

      <section className="product-section">
        <div className="container product-section-inner">
          <h2 className="product-section-title">What It Calculates</h2>
          <p className="product-section-lead">
            Eight dimensions of protection need — scored, summed, and compared to your existing coverage.
          </p>
          <div className="product-card-grid product-card-grid-four">
            {WHAT_IT_CALCULATES.map((item) => (
              <article key={item.title} className="product-card product-card-review">
                <h3 className="product-card-title">{item.title}</h3>
                <p className="product-card-copy">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="product-section product-section-alt">
        <div className="container product-section-inner">
          <h2 className="product-section-title">Who This Is For</h2>
          <p className="product-section-lead">
            Families who need coverage clarity — whether as a standalone diagnostic or a first step
            toward the full Family Financial Report Card™.
          </p>
          <div className="product-card-grid product-card-grid-three">
            {WHO_THIS_IS_FOR.map((item) => (
              <article key={item.title} className="product-card">
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
            Three steps from calculator to clarity.
          </p>
          <div className="product-steps product-steps-three">
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
          <h2 className="product-closing-title">Know Your Gap Before It Becomes a Risk.</h2>
          <p className="product-closing-copy">
            Start with a focused protection estimate — complimentary and completed in under two minutes.
          </p>
          <div className="product-closing-actions">
            <button
              type="button"
              className="product-btn-light"
              onClick={() => navigate(ROUTES.protectionGap)}
            >
              {PROTECTION_CTA}
            </button>
            <Link className="product-btn-ghost" to={ROUTES.reportCard}>
              {FAMILY_REPORT_CARD_LEARN_CTA}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
