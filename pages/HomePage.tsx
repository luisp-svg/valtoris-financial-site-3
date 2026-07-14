import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import HomeCardIcon from '../components/home/HomeCardIcon'
import SampleResultsPreview from '../components/home/SampleResultsPreview'
import {
  HOME_BUSINESS_PATHWAY_CTA,
  HOME_FAMILY_PATHWAY_CTA,
  HOME_PAIN_CTA,
  HOME_POSITIONING_TAGLINE,
  HOME_PRIMARY_CTA,
  HOME_SECONDARY_CTA,
} from '../constants/homepage'
import { ROUTES } from '../constants/routes'

const FAMILY_FUNNEL = ROUTES.reportCard
const BUSINESS_FUNNEL = ROUTES.businessReportCard

const PAIN_POINTS = [
  'You make decent money but still wonder where it goes.',
  'You have insurance but are unsure whether your family is properly protected.',
  'You are saving for retirement but do not know whether you are truly on track.',
  'Debt keeps taking money away from your goals.',
  'You know you need a will or trust but keep putting it off.',
  'You have financial products but no coordinated financial strategy.',
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
    title: 'Complete the Report Card',
    description:
      'Answer focused questions about your household finances in about two minutes. No account is required.',
  },
  {
    step: '2',
    title: 'Receive Your Results',
    description:
      'Get an immediate personalized score, grade, and category breakdown based on your answers.',
  },
  {
    step: '3',
    title: 'Review Your Blueprint',
    description:
      'See what is working, what may be exposed, and which priorities deserve attention first.',
  },
  {
    step: '4',
    title: 'Decide Your Next Step',
    description:
      'Use your results to take focused action—or continue with a complimentary strategy conversation.',
  },
]

const SOLUTIONS: Array<{ label: string; to?: string; meaning?: string }> = [
  { label: 'Life insurance and living-benefit strategies' },
  { label: 'Property and casualty insurance' },
  { label: 'Health insurance solutions' },
  {
    label: 'Retirement Readiness & Income Planning',
    to: ROUTES.retirementReportCard,
    meaning:
      'Evaluate savings progress, projected retirement income, Social Security, pensions, investment risk, tax diversification, healthcare readiness, and potential income gaps.',
  },
  { label: 'Credit improvement' },
  { label: 'Student-loan strategies' },
  { label: 'Wills and trusts' },
  { label: 'Tax-planning coordination' },
  { label: 'Business-owner solutions' },
]

export default function HomePage() {
  return (
    <div className="platform-home funnel-home">
      <section className="platform-hero funnel-hero">
        <div className="container platform-hero-grid">
          <div className="platform-hero-copy">
            <p className="platform-eyebrow">VALTORIS FAMILY FINANCIAL REPORT CARD™</p>
            <p className="funnel-positioning">{HOME_POSITIONING_TAGLINE}</p>
            <h1 className="platform-headline">How Financially Prepared Is Your Family?</h1>
            <p className="platform-subhead">
              Take the complimentary 2-minute Valtoris Family Financial Report Card™ and receive a
              personalized score, category breakdown, risk analysis, and next-step action plan.
            </p>
            <p className="funnel-hero-extra">
              Stop guessing about your finances. See what is working, what may be exposed, and what
              to address first.
            </p>
            <div className="platform-hero-actions platform-btn-row">
              <Link className="platform-btn platform-btn-primary" to={FAMILY_FUNNEL}>
                {HOME_PRIMARY_CTA}
              </Link>
              <Link className="platform-btn platform-btn-secondary" to={BUSINESS_FUNNEL}>
                {HOME_SECONDARY_CTA}
              </Link>
            </div>
            <p className="funnel-microcopy">No cost. No obligation. Immediate personalized results.</p>
          </div>
          <SampleResultsPreview compact />
        </div>
      </section>

      <section
        className="platform-section platform-tone-blue funnel-pathways"
        aria-labelledby="pathways-heading"
      >
        <div className="container platform-section-inner">
          <h2 id="pathways-heading" className="platform-section-title">
            Choose Your Path
          </h2>
          <p className="platform-section-lead">
            Start with the diagnostic that matches where you need clarity most.
          </p>
          <div className="funnel-pathway-grid">
            <article className="funnel-pathway-card funnel-pathway-card--family platform-card">
              <HomeCardIcon variant="grade" />
              <h3 className="funnel-pathway-title">For Families</h3>
              <p className="funnel-pathway-copy">
                Understand your household&apos;s cash flow, savings, debt, protection, retirement
                readiness, credit health, estate planning, and progress toward financial
                independence.
              </p>
              <Link className="platform-btn platform-btn-primary" to={FAMILY_FUNNEL}>
                {HOME_FAMILY_PATHWAY_CTA}
              </Link>
            </article>
            <article className="funnel-pathway-card funnel-pathway-card--business platform-card">
              <HomeCardIcon variant="picture" />
              <h3 className="funnel-pathway-title">For Business Owners</h3>
              <p className="funnel-pathway-copy">
                Evaluate the financial strength, protection, continuity, benefits, succession
                readiness, and owner independence of your business.
              </p>
              <Link className="platform-btn platform-btn-secondary" to={BUSINESS_FUNNEL}>
                {HOME_BUSINESS_PATHWAY_CTA}
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="platform-section platform-tone-white" aria-labelledby="pain-heading">
        <div className="container platform-section-inner">
          <h2 id="pain-heading" className="platform-section-title">
            Does This Sound Familiar?
          </h2>
          <ul className="funnel-pain-list">
            {PAIN_POINTS.map((point) => (
              <li key={point} className="funnel-pain-item platform-card">
                <HomeCardIcon variant="check" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="funnel-pain-close">
            Stop guessing. Get a clear view of your complete financial foundation.
          </p>
          <Link className="platform-btn platform-btn-primary" to={FAMILY_FUNNEL}>
            {HOME_PAIN_CTA}
          </Link>
        </div>
      </section>

      <section className="platform-section platform-tone-gray" aria-labelledby="categories-heading">
        <div className="container platform-section-inner">
          <h2 id="categories-heading" className="platform-section-title">
            Eight Areas That Shape Your Score
          </h2>
          <p className="platform-section-lead">
            Your Report Card reviews the core categories that support a coordinated family financial
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

      <section className="platform-section platform-tone-white" aria-labelledby="preview-heading">
        <div className="container platform-section-inner funnel-preview-section">
          <h2 id="preview-heading" className="platform-section-title">
            See What Your Results Can Look Like
          </h2>
          <p className="platform-section-lead">
            A clear score, category breakdown, priority callout, and near-term action plan—so you
            know where to focus next.
          </p>
          <div className="funnel-preview-stage">
            <SampleResultsPreview />
          </div>
          <Link className="platform-btn platform-btn-primary" to={FAMILY_FUNNEL}>
            {HOME_PRIMARY_CTA}
          </Link>
        </div>
      </section>

      <section
        id="how-it-works"
        className="platform-section platform-tone-blue"
        aria-labelledby="how-heading"
      >
        <div className="container platform-section-inner">
          <h2 id="how-heading" className="platform-section-title">
            How It Works
          </h2>
          <p className="platform-section-lead">
            From your first answers to a clearer next step in four focused stages.
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

      <section
        className="platform-section platform-tone-white platform-why"
        aria-labelledby="positioning-heading"
      >
        <div className="container platform-section-inner funnel-positioning-section">
          <h2 id="positioning-heading" className="platform-section-title">
            Your Financial Life Should Work as One Coordinated Strategy
          </h2>
          <p className="platform-section-lead">
            Financial planning is often fragmented. One professional discusses insurance. Another
            discusses taxes, credit, retirement, debt, or estate planning. Valtoris Financial helps
            families see how these critical areas connect.
          </p>
          <p className="funnel-positioning-emphasis">
            Recommendations should begin with your situation—not with a product.
          </p>
        </div>
      </section>

      <section className="platform-section platform-tone-white" aria-labelledby="solutions-heading">
        <div className="container platform-section-inner">
          <h2 id="solutions-heading" className="platform-section-title">
            Solutions That May Support Your Blueprint
          </h2>
          <p className="platform-section-lead">
            Depending on your results, these are potential areas that may support a client&apos;s
            blueprint—not guaranteed recommendations.
          </p>
          <ul className="funnel-solutions-grid">
            {SOLUTIONS.map((solution) => (
              <li key={solution.label} className="funnel-solution-item platform-card">
                {solution.to ? (
                  <Link
                    className="funnel-solution-link"
                    to={solution.to}
                    aria-label={
                      solution.meaning
                        ? `${solution.label}. ${solution.meaning}`
                        : solution.label
                    }
                  >
                    {solution.label}
                  </Link>
                ) : (
                  solution.label
                )}
              </li>
            ))}
          </ul>
          <Link className="platform-btn platform-btn-outline" to={ROUTES.solutions}>
            Explore All Solutions
          </Link>
        </div>
      </section>

      <section className="platform-section platform-tone-gray" aria-labelledby="business-heading">
        <div className="container platform-section-inner funnel-business-section">
          <HomeCardIcon variant="picture" />
          <h2 id="business-heading" className="platform-section-title">
            Built for Business Owners Too
          </h2>
          <p className="platform-section-lead">
            If you own a business, your personal and company finances are connected. The Business
            Financial Report Card™ evaluates strength, protection, continuity, benefits, succession
            readiness, and owner independence—so you can see what needs attention next.
          </p>
          <Link className="platform-btn platform-btn-primary" to={BUSINESS_FUNNEL}>
            {HOME_SECONDARY_CTA}
          </Link>
        </div>
      </section>

      <section className="product-closing platform-closing">
        <div className="container product-closing-inner">
          <h2 className="product-closing-title">Stop Guessing About Your Financial Future</h2>
          <p className="product-closing-copy">
            Take the first step today and receive a clearer picture of where you stand, what may be
            missing, and what to work on next.
          </p>
          <div className="product-closing-actions">
            <Link className="platform-btn platform-btn-secondary" to={FAMILY_FUNNEL}>
              {HOME_PRIMARY_CTA}
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
