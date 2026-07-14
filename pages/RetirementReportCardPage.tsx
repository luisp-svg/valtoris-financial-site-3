import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import HomeCardIcon from '../components/home/HomeCardIcon'
import RetirementSampleResultsPreview from '../components/home/RetirementSampleResultsPreview'
import { RETIREMENT_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

const WHAT_YOU_RECEIVE = [
  {
    icon: 'grade' as const,
    title: 'Retirement Readiness Score',
    description:
      'An overall score and letter grade that summarizes how prepared your plan appears today.',
  },
  {
    icon: 'cashflow' as const,
    title: 'Income-Gap Analysis',
    description:
      'A clear view of projected retirement spending need versus expected income sources.',
  },
  {
    icon: 'retirement' as const,
    title: 'Category-by-Category Review',
    description:
      'Eight retirement categories scored so you can see strengths and gaps side by side.',
  },
  {
    icon: 'blueprint' as const,
    title: 'Personalized Action Blueprint',
    description:
      'Immediate, 30-day, and 90-day priorities tailored to your answers and timeline.',
  },
]

const CATEGORIES = [
  {
    icon: 'picture' as const,
    title: 'Retirement Vision & Timeline',
    description: 'Clarify lifestyle goals, plan clarity, and your intended retirement date.',
  },
  {
    icon: 'retirement' as const,
    title: 'Savings & Contribution Progress',
    description: 'Evaluate balances, contribution habits, and employer-match utilization.',
  },
  {
    icon: 'cashflow' as const,
    title: 'Retirement Income Sources',
    description: 'Review Social Security, pension, annuity, and other expected income streams.',
  },
  {
    icon: 'strategy' as const,
    title: 'Income Adequacy & Sustainability',
    description: 'Compare projected income to spending need under standard planning assumptions.',
  },
  {
    icon: 'credit' as const,
    title: 'Investment Risk & Diversification',
    description: 'Assess risk posture, diversification, and allocation review habits.',
  },
  {
    icon: 'independence' as const,
    title: 'Tax Diversification & Efficiency',
    description: 'Look at account types, Roth usage, and tax-planning readiness.',
  },
  {
    icon: 'emergency' as const,
    title: 'Healthcare & Long-Term-Care Readiness',
    description: 'Check Medicare readiness, HSA balances, and long-term-care planning.',
  },
  {
    icon: 'estate' as const,
    title: 'Estate, Beneficiaries & Legacy',
    description: 'Review wills, trusts, powers of attorney, beneficiaries, and legacy intent.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Answer Questions',
    description: 'Share focused details about your timeline, savings, income, and protection.',
  },
  {
    step: '2',
    title: 'Receive Results',
    description: 'Get your retirement score, grade, and category breakdown immediately.',
  },
  {
    step: '3',
    title: 'Review Blueprint',
    description: 'See what appears on track, where gaps may exist, and what to prioritize next.',
  },
  {
    step: '4',
    title: 'Schedule Strategy Session',
    description: 'Optionally review your results in a complimentary strategy conversation.',
  },
]

const FAQS = [
  {
    question: 'How long does the Retirement Report Card take?',
    answer: 'Most people finish in about 4–6 minutes. No account creation is required.',
  },
  {
    question: 'Is it free?',
    answer: 'Yes. The Valtoris Retirement Report Card™ is complimentary with no obligation.',
  },
  {
    question: 'Are the projections guaranteed?',
    answer:
      'No. Results are educational estimates based on your answers and standard planning assumptions. They do not guarantee retirement outcomes.',
  },
  {
    question: 'Do I need exact account balances?',
    answer:
      'Approximate figures are fine. More accurate inputs produce more useful estimates, but you can refine details later.',
  },
  {
    question: 'Do I have to purchase anything?',
    answer: 'No. You receive your results whether or not you choose to take a next step.',
  },
  {
    question: 'Will someone contact me?',
    answer:
      'Only if you provide contact preferences and consent. Completing the report card alone does not create a sales commitment.',
  },
  {
    question: 'Can I retake it later?',
    answer: 'Yes. You can retake the assessment anytime your situation changes.',
  },
]

export default function RetirementReportCardPage() {
  return (
    <div className="platform-home diagnostic-landing retirement-report-card-page">
      <section className="platform-hero diagnostic-hero">
        <div className="container diagnostic-hero-inner">
          <p className="platform-eyebrow">VALTORIS RETIREMENT REPORT CARD™</p>
          <h1 className="platform-headline diagnostic-hero-title">
            Are You on Track to Retire With Confidence?
          </h1>
          <p className="platform-subhead diagnostic-hero-copy">
            Take the Valtoris Retirement Report Card™ to evaluate your retirement income, savings
            progress, Social Security, pension decisions, investment risk, tax diversification,
            healthcare readiness, and legacy planning.
          </p>
          <p className="platform-subhead diagnostic-hero-copy">
            See what appears to be on track, where important gaps may exist, and what to address
            next.
          </p>
          <div className="diagnostic-hero-actions">
            <Link className="platform-btn platform-btn-primary" to={ROUTES.retirementAssessment}>
              {RETIREMENT_CTA}
            </Link>
          </div>
          <p className="funnel-microcopy">
            Takes approximately 4–6 minutes. No cost. No obligation. Results are estimates, not
            guarantees.
          </p>
        </div>
      </section>

      <section className="platform-section platform-tone-blue" aria-labelledby="receive-heading">
        <div className="container platform-section-inner">
          <h2 id="receive-heading" className="platform-section-title">
            What You&apos;ll Receive
          </h2>
          <p className="platform-section-lead">
            Four deliverables designed to turn a short assessment into clearer retirement direction.
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
            <RetirementSampleResultsPreview />
          </div>
        </div>
      </section>

      <section className="platform-section platform-tone-gray" aria-labelledby="categories-heading">
        <div className="container platform-section-inner">
          <h2 id="categories-heading" className="platform-section-title">
            Eight Retirement Categories
          </h2>
          <p className="platform-section-lead">
            Your Report Card reviews the eight areas that shape a coordinated retirement foundation.
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
          <p className="platform-section-lead">Straightforward answers before you begin.</p>
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
          <h2 className="product-closing-title">Ready to See Where Your Retirement Stands?</h2>
          <p className="product-closing-copy">
            Take the first step and receive a clearer picture of your score, income gap, and next
            priorities.
          </p>
          <div className="product-closing-actions">
            <Link className="platform-btn platform-btn-secondary" to={ROUTES.retirementAssessment}>
              {RETIREMENT_CTA}
            </Link>
          </div>
          <p className="funnel-final-microcopy">
            Takes approximately 4–6 minutes. No cost. No obligation. Results are estimates, not
            guarantees.
          </p>
        </div>
      </section>
    </div>
  )
}
