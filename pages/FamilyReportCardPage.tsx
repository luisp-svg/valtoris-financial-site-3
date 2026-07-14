import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import HomeCardIcon from '../components/home/HomeCardIcon'
import SampleResultsPreview from '../components/home/SampleResultsPreview'
import { FAMILY_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

const WHAT_YOU_RECEIVE = [
  {
    icon: 'grade' as const,
    title: 'Overall Financial Score',
    description: 'A clear household score and letter grade that shows where you stand today.',
  },
  {
    icon: 'cashflow' as const,
    title: 'Personalized Category Scores',
    description: 'Category-by-category results so you can see strengths and weak spots side by side.',
  },
  {
    icon: 'protection' as const,
    title: 'Risk Analysis',
    description: 'A focused view of where your family may be financially exposed.',
  },
  {
    icon: 'blueprint' as const,
    title: 'Action Blueprint',
    description: 'Immediate, 30-day, and 90-day priorities tailored to your answers.',
  },
]

const CATEGORIES = [
  {
    icon: 'cashflow' as const,
    title: 'Cash Flow and Budget',
    description: 'See how income, spending, and monthly flexibility support your goals.',
  },
  {
    icon: 'emergency' as const,
    title: 'Emergency Preparedness',
    description: 'Evaluate whether reserves can cover unexpected expenses or income disruption.',
  },
  {
    icon: 'debt' as const,
    title: 'Debt Management',
    description: 'Understand how balances and payments may be limiting progress.',
  },
  {
    icon: 'protection' as const,
    title: 'Protection and Insurance',
    description: 'Identify where coverage may leave your household exposed.',
  },
  {
    icon: 'retirement' as const,
    title: 'Retirement Readiness',
    description: 'Check whether current savings habits align with long-term income needs.',
  },
  {
    icon: 'estate' as const,
    title: 'Estate and Legacy Planning',
    description: 'Review wills, trusts, and documents that protect the people you love.',
  },
  {
    icon: 'credit' as const,
    title: 'Credit Health',
    description: 'Assess credit strength and how it affects borrowing and opportunity.',
  },
  {
    icon: 'independence' as const,
    title: 'Financial Independence',
    description: 'Measure progress toward lasting freedom and family financial resilience.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Answer Questions',
    description: 'Complete a focused set of household finance questions in about two minutes.',
  },
  {
    step: '2',
    title: 'Receive Results',
    description: 'Get your score, grade, and category breakdown immediately after finishing.',
  },
  {
    step: '3',
    title: 'Review Blueprint',
    description: 'See what is working, what may be exposed, and what to prioritize next.',
  },
  {
    step: '4',
    title: 'Schedule Strategy Session',
    description: 'Optionally review your results in a complimentary strategy conversation.',
  },
]

const FAQS = [
  {
    question: 'How long does it take?',
    answer: 'Most families finish in about two minutes. No account creation is required.',
  },
  {
    question: 'Is it free?',
    answer: 'Yes. The Family Financial Report Card™ is complimentary with no obligation.',
  },
  {
    question: 'Do I have to purchase anything?',
    answer: 'No. You receive your results whether or not you choose to take a next step.',
  },
  {
    question: 'Will someone contact me?',
    answer:
      'Only if you choose to continue with a strategy conversation. Completing the report card alone does not create a sales commitment.',
  },
  {
    question: 'Is my information secure?',
    answer:
      'Your answers are used to generate your personalized results and are handled with care for educational planning purposes.',
  },
  {
    question: 'Can I retake it later?',
    answer: 'Yes. You can retake the assessment anytime your situation changes.',
  },
]

export default function FamilyReportCardPage() {
  return (
    <div className="platform-home diagnostic-landing family-report-card-page">
      <section className="platform-hero diagnostic-hero">
        <div className="container diagnostic-hero-inner">
          <p className="platform-eyebrow">Family Financial Report Card™</p>
          <h1 className="platform-headline diagnostic-hero-title">
            See What Your Family Will Receive
          </h1>
          <p className="platform-subhead diagnostic-hero-copy">
            Take the complimentary 2-minute Family Financial Report Card™ and receive a personalized
            score, category breakdown, risk analysis, and action blueprint—so you know where you
            stand and what to address first.
          </p>
          <div className="diagnostic-hero-actions">
            <Link className="platform-btn platform-btn-primary" to={ROUTES.familyAssessment}>
              {FAMILY_CTA}
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
            Four deliverables designed to turn a short assessment into clear financial direction.
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
            An illustrative look at the score, category detail, and action plan you can expect.
          </p>
          <div className="funnel-preview-stage">
            <SampleResultsPreview />
          </div>
        </div>
      </section>

      <section className="platform-section platform-tone-gray" aria-labelledby="categories-heading">
        <div className="container platform-section-inner">
          <h2 id="categories-heading" className="platform-section-title">
            Categories Evaluated
          </h2>
          <p className="platform-section-lead">
            Your Report Card reviews the eight areas that shape a coordinated family financial
            foundation.
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
          <h2 className="product-closing-title">Ready to See Where Your Family Stands?</h2>
          <p className="product-closing-copy">
            Take the first step and receive a clearer picture of your score, risks, and next
            priorities.
          </p>
          <div className="product-closing-actions">
            <Link className="platform-btn platform-btn-secondary" to={ROUTES.familyAssessment}>
              {FAMILY_CTA}
            </Link>
          </div>
          <p className="funnel-final-microcopy">
            Takes approximately two minutes. No cost. No obligation.
          </p>
        </div>
      </section>
    </div>
  )
}
