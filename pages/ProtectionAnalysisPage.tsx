import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import HomeCardIcon from '../components/home/HomeCardIcon'
import ProtectionSampleResultsPreview from '../components/home/ProtectionSampleResultsPreview'
import { PROTECTION_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

const WHAT_YOU_RECEIVE = [
  {
    icon: 'grade' as const,
    title: 'Recommended Coverage',
    description: 'An estimated life insurance amount designed to help protect your household.',
  },
  {
    icon: 'protection' as const,
    title: 'Protection Gap',
    description: 'The difference between what your family may need and what you already have.',
  },
  {
    icon: 'priorities' as const,
    title: 'Needs Analysis',
    description: 'A clear breakdown across income, housing, debt, education, and final expenses.',
  },
  {
    icon: 'blueprint' as const,
    title: 'Action Recommendations',
    description: 'Focused next steps so you know where protection planning should begin.',
  },
]

const CATEGORIES = [
  {
    icon: 'cashflow' as const,
    title: 'Income Protection',
    description: 'Replacement income to help your family maintain their standard of living.',
  },
  {
    icon: 'emergency' as const,
    title: 'Mortgage / Rent Protection',
    description: 'Housing payment support to preserve stability at home.',
  },
  {
    icon: 'debt' as const,
    title: 'Debt Payoff',
    description: 'Outstanding consumer debt and liabilities your family would inherit.',
  },
  {
    icon: 'estate' as const,
    title: 'Child Education',
    description: 'Future education funding considerations for each child in your household.',
  },
  {
    icon: 'session' as const,
    title: 'Final Expenses',
    description: 'End-of-life costs so your family is not burdened unexpectedly.',
  },
  {
    icon: 'credit' as const,
    title: 'Existing Coverage',
    description: 'Current life insurance applied as a deduction from total need.',
  },
  {
    icon: 'protection' as const,
    title: 'Protection Gap™',
    description: 'The remaining difference between estimated need and current coverage.',
  },
  {
    icon: 'strategy' as const,
    title: 'Coverage Recommendation',
    description: 'A clear total estimate of protection that may be appropriate for your family.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Answer Questions',
    description: 'Share focused details about income, housing, debt, education, and coverage.',
  },
  {
    step: '2',
    title: 'Receive Results',
    description: 'Get recommended coverage, a needs breakdown, and your estimated Protection Gap™.',
  },
  {
    step: '3',
    title: 'Review Blueprint',
    description: 'See which protection priorities deserve attention first.',
  },
  {
    step: '4',
    title: 'Schedule Strategy Session',
    description: 'Optionally review your analysis in a complimentary strategy conversation.',
  },
]

const FAQS = [
  {
    question: 'How long does it take?',
    answer: 'Most households finish in under two minutes.',
  },
  {
    question: 'Is it free?',
    answer: 'Yes. The Family Protection Analysis™ is complimentary and educational.',
  },
  {
    question: 'Do I have to purchase anything?',
    answer: 'No. You can review your results with no purchase required.',
  },
  {
    question: 'Will someone contact me?',
    answer:
      'Only if you choose to schedule a follow-up conversation. Completing the analysis alone does not create a sales commitment.',
  },
  {
    question: 'Is my information secure?',
    answer:
      'Your answers are used to generate your protection estimate and are handled with care for educational planning purposes.',
  },
  {
    question: 'Can I retake it later?',
    answer: 'Yes. Retake the analysis anytime your income, coverage, or family situation changes.',
  },
]

export default function ProtectionAnalysisPage() {
  return (
    <div className="platform-home diagnostic-landing protection-analysis-page">
      <section className="platform-hero diagnostic-hero">
        <div className="container diagnostic-hero-inner">
          <p className="platform-eyebrow">Family Protection Analysis™</p>
          <h1 className="platform-headline diagnostic-hero-title">
            See What Your Protection Analysis Delivers
          </h1>
          <p className="platform-subhead diagnostic-hero-copy">
            Complete a focused protection diagnostic and receive recommended coverage, a needs
            breakdown, your estimated Protection Gap™, and clear next-step recommendations—in less
            than two minutes.
          </p>
          <div className="diagnostic-hero-actions">
            <Link className="platform-btn platform-btn-primary" to={ROUTES.protectionGap}>
              {PROTECTION_CTA}
            </Link>
          </div>
          <p className="funnel-microcopy">No cost. No obligation. Immediate personalized results.</p>
        </div>
      </section>

      <section className="platform-section platform-tone-blue" aria-labelledby="receive-heading">
        <div className="container platform-section-inner">
          <h2 id="receive-heading" className="platform-section-title">
            What You&apos;ll Receive
          </h2>
          <p className="platform-section-lead">
            Four deliverables that turn a short calculator into clearer protection direction.
          </p>
          <div className="diagnostic-receive-grid">
            {WHAT_YOU_RECEIVE.map((item) => (
              <article key={item.title} className="diagnostic-receive-card platform-card">
                <HomeCardIcon variant={item.icon} />
                <h3 className="diagnostic-receive-title">{item.title}</h3>
                <p className="diagnostic-receive-copy">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="platform-section platform-tone-white" aria-labelledby="sample-heading">
        <div className="container platform-section-inner funnel-preview-section">
          <h2 id="sample-heading" className="platform-section-title">
            Sample Report Preview
          </h2>
          <p className="platform-section-lead">
            An illustrative look at coverage need, current coverage, Protection Gap™, and priority
            recommendations.
          </p>
          <div className="funnel-preview-stage">
            <ProtectionSampleResultsPreview />
          </div>
        </div>
      </section>

      <section className="platform-section platform-tone-gray" aria-labelledby="categories-heading">
        <div className="container platform-section-inner">
          <h2 id="categories-heading" className="platform-section-title">
            Categories Evaluated
          </h2>
          <p className="platform-section-lead">
            Your Protection Analysis reviews the planning inputs that shape estimated coverage need.
          </p>
          <div className="funnel-category-grid">
            {CATEGORIES.map((category) => (
              <article key={category.title} className="funnel-category-card platform-card">
                <HomeCardIcon variant={category.icon} />
                <h3 className="funnel-category-title">{category.title}</h3>
                <p className="funnel-category-copy">{category.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="platform-section platform-tone-blue" aria-labelledby="how-heading">
        <div className="container platform-section-inner">
          <h2 id="how-heading" className="platform-section-title">
            How It Works
          </h2>
          <p className="platform-section-lead">
            From your first answers to a clearer next step in four focused stages.
          </p>
          <div className="diagnostic-timeline">
            {HOW_IT_WORKS.map((item, index) => (
              <Fragment key={item.title}>
                <article className="diagnostic-timeline-step platform-card">
                  <span className="diagnostic-timeline-number">{item.step}</span>
                  <h3 className="diagnostic-timeline-title">{item.title}</h3>
                  <p className="diagnostic-timeline-copy">{item.description}</p>
                </article>
                {index < HOW_IT_WORKS.length - 1 ? (
                  <span className="diagnostic-timeline-arrow" aria-hidden="true">
                    ↓
                  </span>
                ) : null}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      <section className="platform-section platform-tone-white" aria-labelledby="faq-heading">
        <div className="container platform-section-inner">
          <h2 id="faq-heading" className="platform-section-title">
            Frequently Asked Questions
          </h2>
          <p className="platform-section-lead">
            Straightforward answers before you begin.
          </p>
          <div className="diagnostic-faq-list">
            {FAQS.map((faq) => (
              <article key={faq.question} className="diagnostic-faq-item platform-card">
                <h3 className="diagnostic-faq-question">{faq.question}</h3>
                <p className="diagnostic-faq-answer">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="product-closing platform-closing">
        <div className="container product-closing-inner">
          <h2 className="product-closing-title">Know Your Gap Before It Becomes a Risk</h2>
          <p className="product-closing-copy">
            Start with a focused protection estimate and leave with clearer next-step direction.
          </p>
          <div className="product-closing-actions">
            <Link className="platform-btn platform-btn-secondary" to={ROUTES.protectionGap}>
              {PROTECTION_CTA}
            </Link>
          </div>
          <p className="funnel-final-microcopy">
            Takes under two minutes. No cost. No obligation.
          </p>
        </div>
      </section>
    </div>
  )
}
