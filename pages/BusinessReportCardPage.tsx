import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import BusinessSampleResultsPreview from '../components/home/BusinessSampleResultsPreview'
import HomeCardIcon from '../components/home/HomeCardIcon'
import { BUSINESS_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

const WHAT_YOU_RECEIVE = [
  {
    icon: 'grade' as const,
    title: 'Business Score',
    description: 'An overall business financial score and letter grade across core operating areas.',
  },
  {
    icon: 'protection' as const,
    title: 'Business Risk Review',
    description: 'A clear view of continuity, coverage, and exposure that may threaten the company.',
  },
  {
    icon: 'blueprint' as const,
    title: 'Owner Strategy Blueprint',
    description: 'Guidance that connects company strength with the owner\'s long-term financial position.',
  },
  {
    icon: 'priorities' as const,
    title: '90-Day Business Priorities',
    description: 'Focused near-term actions so leadership knows what to address first.',
  },
]

const CATEGORIES = [
  {
    icon: 'picture' as const,
    title: 'Business Structure',
    description: 'Legal entity, operating documents, and separation of personal and business finances.',
  },
  {
    icon: 'cashflow' as const,
    title: 'Cash Flow',
    description: 'Operating cash flow, reserves, revenue predictability, and owner compensation.',
  },
  {
    icon: 'strategy' as const,
    title: 'Tax Strategy',
    description: 'Proactive tax planning, benefit strategies, and alignment with growth goals.',
  },
  {
    icon: 'protection' as const,
    title: 'Business Protection',
    description: 'Key person coverage, buy-sell planning, and leadership continuity strategies.',
  },
  {
    icon: 'emergency' as const,
    title: 'Risk Management',
    description: 'Commercial insurance, specialized coverage, and operational liability exposure.',
  },
  {
    icon: 'retirement' as const,
    title: 'Retirement & Wealth',
    description: 'Owner retirement savings outside the business relative to income and revenue.',
  },
  {
    icon: 'credit' as const,
    title: 'Credit & Funding',
    description: 'Business credit profile, lending relationships, and access to growth capital.',
  },
  {
    icon: 'independence' as const,
    title: 'Exit Planning',
    description: 'Succession planning, valuation baseline, and long-term transition readiness.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Answer Questions',
    description: 'Share focused details about your business operations, protection, and owner goals.',
  },
  {
    step: '2',
    title: 'Receive Results',
    description: 'Get your business score, grade, and category breakdown immediately.',
  },
  {
    step: '3',
    title: 'Review Blueprint',
    description: 'See where the business is strong, exposed, and what deserves attention first.',
  },
  {
    step: '4',
    title: 'Schedule Strategy Session',
    description: 'Optionally review your results with a complimentary strategy conversation.',
  },
]

const FAQS = [
  {
    question: 'How long does it take?',
    answer: 'Most business owners complete the assessment in a few focused minutes.',
  },
  {
    question: 'Is it free?',
    answer: 'Yes. The Business Financial Report Card™ is complimentary with no obligation.',
  },
  {
    question: 'Do I have to purchase anything?',
    answer: 'No. Your results are provided whether or not you choose additional services.',
  },
  {
    question: 'Will someone contact me?',
    answer:
      'Only if you request a follow-up conversation. Completing the report card alone does not create a sales commitment.',
  },
  {
    question: 'Is my information secure?',
    answer:
      'Your answers are used to generate personalized business results and are handled with care for educational planning purposes.',
  },
  {
    question: 'Can I retake it later?',
    answer: 'Yes. Retake the assessment as your business, team, or goals evolve.',
  },
]

export default function BusinessReportCardPage() {
  return (
    <div className="platform-home diagnostic-landing business-report-card-page">
      <section className="platform-hero diagnostic-hero">
        <div className="container diagnostic-hero-inner">
          <p className="platform-eyebrow">Business Financial Report Card™</p>
          <h1 className="platform-headline diagnostic-hero-title">
            See What Your Business Will Receive
          </h1>
          <p className="platform-subhead diagnostic-hero-copy">
            Take the complimentary Business Financial Report Card™ and receive a business score,
            risk review, owner strategy blueprint, and 90-day priorities—so you can protect revenue,
            reduce exposure, and strengthen enterprise value.
          </p>
          <div className="diagnostic-hero-actions">
            <Link className="platform-btn platform-btn-primary" to={ROUTES.businessAssessment}>
              {BUSINESS_CTA}
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
            Four deliverables that turn a short diagnostic into clear business direction.
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
            An illustrative look at the score, category detail, and action plan business owners can
            expect.
          </p>
          <div className="funnel-preview-stage">
            <BusinessSampleResultsPreview />
          </div>
        </div>
      </section>

      <section className="platform-section platform-tone-gray" aria-labelledby="categories-heading">
        <div className="container platform-section-inner">
          <h2 id="categories-heading" className="platform-section-title">
            Categories Evaluated
          </h2>
          <p className="platform-section-lead">
            Your Business Report Card reviews the eight dimensions that shape company financial
            health.
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
          <h2 className="product-closing-title">Ready to See Where Your Business Stands?</h2>
          <p className="product-closing-copy">
            Take the first step and receive a clearer picture of business strength, risk, and
            near-term priorities.
          </p>
          <div className="product-closing-actions">
            <Link className="platform-btn platform-btn-secondary" to={ROUTES.businessAssessment}>
              {BUSINESS_CTA}
            </Link>
          </div>
          <p className="funnel-final-microcopy">
            Takes a few focused minutes. No cost. No obligation.
          </p>
        </div>
      </section>
    </div>
  )
}
