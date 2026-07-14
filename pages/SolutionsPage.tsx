import { Link } from 'react-router-dom'
import HomeCardIcon from '../components/home/HomeCardIcon'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import { RETIREMENT_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

type SolutionAreaItem = {
  title: string
  description?: string
}

type SolutionSection = {
  id: string
  icon: 'protection' | 'priorities' | 'strategy' | 'retirement' | 'picture'
  title: string
  lead: string
  body: string
  areas: SolutionAreaItem[]
  ctaLabel: string
  ctaTo: string
  crossLink?: {
    text: string
    linkLabel: string
    to: string
  }
}

const SOLUTION_AREAS: SolutionSection[] = [
  {
    id: 'protect-family',
    icon: 'protection' as const,
    title: 'Protect Your Family',
    lead: 'Build a stronger financial foundation for the people who depend on you.',
    body: 'Protection is about more than buying an insurance policy. It\u2019s about understanding what could put your family\u2019s future at risk and making sure the right safeguards are in place.',
    areas: [
      {
        title: 'Life Insurance Strategies',
        description:
          'Evaluate income replacement, debt protection, mortgage protection, final expenses, living benefits, and long-term family needs.',
      },
      {
        title: 'Family Protection Planning',
        description:
          'Identify potential gaps between the protection your family has today and what they may actually need if the unexpected happens.',
      },
      {
        title: 'Health Insurance Solutions',
        description:
          'Explore available health coverage options based on your family, budget, and circumstances.',
      },
      {
        title: 'Property & Casualty Insurance',
        description: 'Review protection for your home, vehicles, and other personal risks.',
      },
      {
        title: 'Estate & Legacy Planning Coordination',
        description:
          'Help identify potential estate planning needs and connect families with appropriate legal resources for wills, trusts, and related documents.',
      },
    ],
    ctaLabel: 'Start My Family Protection Analysis™',
    ctaTo: ROUTES.protectionAnalysis,
  },
  {
    id: 'strengthen-finances',
    icon: 'priorities' as const,
    title: 'Strengthen Your Finances',
    lead: 'Create more breathing room today so you can build a stronger tomorrow.',
    body: 'It\u2019s difficult to build wealth when cash flow is tight, debt is growing, credit is holding you back, or student loans feel impossible to navigate. We help you understand what is happening now and build a clearer strategy forward.',
    areas: [
      {
        title: 'Cash Flow & Financial Organization',
        description:
          'Understand where your money is going and identify opportunities to improve monthly financial stability.',
      },
      {
        title: 'Debt Strategy',
        description:
          'Review balances, interest costs, monthly payments, and potential payoff priorities.',
      },
      {
        title: 'Credit Improvement',
        description:
          'Identify credit challenges and create a structured path toward a stronger credit profile.',
      },
      {
        title: 'Student Loan Strategies',
        description:
          'Review repayment options, consolidation considerations, forgiveness opportunities, and available federal program pathways.',
      },
      {
        title: 'Financial Action Planning',
        description:
          'Turn financial goals into clear priorities for the next 30 days, 90 days, and 12 months.',
      },
    ],
    ctaLabel: 'Get My Free Family Financial Report Card™',
    ctaTo: ROUTES.reportCard,
  },
  {
    id: 'build-future',
    icon: 'strategy' as const,
    title: 'Build Your Future',
    lead: 'Turn today\u2019s financial decisions into long-term progress.',
    body: 'Retirement planning is not just about choosing an account or investment. It starts with understanding where you are, where you want to go, and what gaps may stand between the two.',
    areas: [
      {
        title: 'Retirement Strategies',
        description:
          'Review your current retirement direction, goals, timeline, and potential income needs.',
      },
      {
        title: 'Retirement Income Planning',
        description:
          'Explore strategies designed to help create more predictable income in retirement.',
      },
      {
        title: 'Annuity Strategies',
        description:
          'Evaluate whether an annuity may fit within a broader retirement or income strategy.',
      },
      {
        title: 'Legacy & Wealth Transfer Considerations',
        description:
          'Consider how assets, insurance, and estate planning may work together to support the people and causes that matter to you.',
      },
      {
        title: 'Tax Strategy Coordination',
        description:
          'Help identify areas where proactive tax planning may be valuable and coordinate with appropriate tax professionals when needed.',
      },
    ],
    ctaLabel: 'Start My Family Financial Report Card™',
    ctaTo: ROUTES.reportCard,
    crossLink: {
      text: 'Prefer a retirement-focused diagnostic?',
      linkLabel: 'Take the Retirement Report Card™',
      to: ROUTES.retirementReportCard,
    },
  },
  {
    id: 'prepare-retirement',
    icon: 'retirement' as const,
    title: 'Prepare for Retirement With Greater Clarity',
    lead: 'See how savings, income sources, and risk may work together before you need them to.',
    body: 'Retirement planning involves more than accumulating assets. It also requires coordinating income needs, Social Security, pensions, withdrawals, taxes, healthcare, investment risk, and legacy goals. The areas below are educational evaluation topics—not guaranteed recommendations.',
    areas: [
      { title: 'Retirement Readiness' },
      { title: 'Projected Income Needs' },
      { title: 'Retirement Income Gap' },
      { title: 'Social Security Timing' },
      { title: 'Pension Options' },
      { title: '401(k), 403(b), IRA, and TSP Decisions' },
      { title: 'Investment Risk and Diversification' },
      { title: 'Tax Diversification' },
      { title: 'Healthcare and Long-Term-Care Readiness' },
      { title: 'Estate and Beneficiary Coordination' },
    ],
    ctaLabel: RETIREMENT_CTA,
    ctaTo: ROUTES.retirementReportCard,
  },
  {
    id: 'protect-business',
    icon: 'picture' as const,
    title: 'Protect & Grow Your Business',
    lead: 'Your business deserves a financial strategy as intentional as the business itself.',
    body: 'Many business owners spend years building revenue while leaving critical risks, financial systems, and long-term planning unaddressed. Valtoris helps business owners look beyond daily operations and evaluate the financial health of the business as a whole.',
    areas: [
      {
        title: 'Business Risk & Insurance Review',
        description:
          'Identify areas where the business, owners, employees, or operations may be financially exposed.',
      },
      {
        title: 'Key Person Protection',
        description:
          'Evaluate the financial impact the loss of a critical owner or employee could have on the business.',
      },
      {
        title: 'Executive & Employee Benefit Strategies',
        description: 'Explore ways to protect, reward, and retain key people.',
      },
      {
        title: 'Business Continuity & Succession Considerations',
        description:
          'Identify potential gaps in ownership transition, succession, and continuity planning.',
      },
      {
        title: 'Business Credit & Financial Readiness',
        description:
          'Evaluate areas that may affect the company\u2019s ability to access capital and grow.',
      },
      {
        title: 'Payment Processing Solutions',
        description:
          'Explore opportunities to improve how the business accepts and manages customer payments.',
      },
      {
        title: 'Tax Strategy Coordination',
        description:
          'Help identify potential planning opportunities and coordinate with qualified tax professionals when appropriate.',
      },
    ],
    ctaLabel: 'Get My Free Business Financial Report Card™',
    ctaTo: ROUTES.businessReportCard,
  },
]

const STARTING_POINTS = [
  {
    label: 'For Families',
    description: 'Take the Family Financial Report Card™',
    to: ROUTES.reportCard,
  },
  {
    label: 'For Business Owners',
    description: 'Take the Business Financial Report Card™',
    to: ROUTES.businessReportCard,
  },
  {
    label: 'For Retirement Planning',
    description: 'Take the Retirement Report Card™',
    to: ROUTES.retirementReportCard,
  },
  {
    label: 'For Family Protection',
    description: 'Start the Family Protection Analysis™',
    to: ROUTES.protectionAnalysis,
  },
]

const SOLUTIONS_DISCLAIMER =
  'Valtoris Financial provides financial education, insurance services, and strategic coordination. Certain services, including legal, tax, estate planning, and other specialized professional services, may be provided by independent third-party professionals. Valtoris Financial does not provide legal or tax advice. Insurance products and availability vary by state, carrier, eligibility, and individual circumstances.'

export default function SolutionsPage() {
  return (
    <div className="product-landing solutions-page">
      <section className="product-hero solutions-hero">
        <div className="container solutions-hero-inner">
          <p className="kicker">Valtoris Financial Solutions</p>
          <h1 className="product-headline solutions-hero-title">
            Solutions Built Around Your Whole Financial Life
          </h1>
          <div className="solutions-hero-copy">
            <p>Most financial decisions don&apos;t exist in isolation.</p>
            <p>
              Your insurance affects your family&apos;s security. Your debt affects your ability to
              build wealth. Your taxes affect your retirement. Your business affects your personal
              financial future.
            </p>
            <p>
              Valtoris Financial helps families and business owners understand how the pieces work
              together, identify the areas that need attention, and take the next right step.
            </p>
          </div>
          <div className="solutions-hero-actions platform-btn-row platform-btn-row--center">
            <Link className="platform-btn platform-btn-primary" to={ROUTES.reportCard}>
              Start Family Report Card
            </Link>
            <Link className="platform-btn platform-btn-secondary" to={ROUTES.businessReportCard}>
              Business Owner? Start Here
            </Link>
          </div>
        </div>
      </section>

      {SOLUTION_AREAS.map((section, index) => (
        <section
          key={section.id}
          id={section.id}
          className={`product-section${index % 2 === 1 ? ' product-section-alt' : ''}`}
        >
          <div className="container product-section-inner product-section-inner-split solutions-section-split">
            <div className="solutions-section-copy">
              <HomeCardIcon variant={section.icon} />
              <h2 className="product-section-title product-section-title-left">{section.title}</h2>
              <p className="product-section-lead product-section-lead-left solutions-section-lead">
                {section.lead}
              </p>
              <p className="solutions-section-body">{section.body}</p>
              <Link className="platform-btn platform-btn-primary" to={section.ctaTo}>
                {section.ctaLabel}
              </Link>
              {section.crossLink ? (
                <p className="solutions-crosslink">
                  {section.crossLink.text}{' '}
                  <Link to={section.crossLink.to}>{section.crossLink.linkLabel}</Link>
                </p>
              ) : null}
            </div>
            <div className="solutions-areas">
              <h3 className="solutions-areas-title">Areas We Can Help You Evaluate:</h3>
              <ul className="solutions-areas-list">
                {section.areas.map((area) => (
                  <li key={area.title} className="solutions-area-item">
                    {area.description ? (
                      <>
                        <strong className="solutions-area-title">{area.title}:</strong>{' '}
                        <span className="solutions-area-description">{area.description}</span>
                      </>
                    ) : (
                      <strong className="solutions-area-title">{area.title}</strong>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ))}

      <section className="product-section product-section-alt solutions-approach">
        <div className="container product-section-inner">
          <h2 className="product-section-title solutions-approach-title">
            You Don&apos;t Need More Random Financial Products
          </h2>
          <p className="product-section-lead">
            You need to know what matters most.
          </p>
          <p className="solutions-approach-copy">
            The Valtoris approach starts with understanding your current position, identifying the
            most important gaps and opportunities, and building a clear path forward.
          </p>
          <p className="solutions-approach-tagline">Diagnose. Prioritize. Strategize.</p>
        </div>
      </section>

      <section id="starting-points" className="product-section solutions-starting-points">
        <div className="container product-section-inner">
          <h2 className="product-section-title">Choose Your Starting Point</h2>
          <div className="solutions-starting-grid">
            {STARTING_POINTS.map((point) => (
              <Link key={point.label} className="solutions-starting-card" to={point.to}>
                <span className="solutions-starting-label">{point.label}</span>
                <span className="solutions-starting-description">{point.description}</span>
                <span className="solutions-starting-action">Get Started →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="product-closing solutions-closing">
        <div className="container product-closing-inner">
          <h2 className="product-closing-title solutions-closing-title">
            One Strategy. The Right Solutions. A Clearer Path Forward.
          </h2>
          <p className="product-closing-copy">
            You don&apos;t have to figure out every financial decision alone.
          </p>
          <div className="product-closing-actions">
            <ScheduleReportCardLink className="platform-btn platform-btn-secondary">
              Schedule My Complimentary Strategy Session™
            </ScheduleReportCardLink>
          </div>
        </div>
      </section>

      <section className="solutions-disclaimer" aria-label="Legal disclaimer">
        <div className="container solutions-disclaimer-inner">
          <p className="notice">{SOLUTIONS_DISCLAIMER}</p>
        </div>
      </section>
    </div>
  )
}
