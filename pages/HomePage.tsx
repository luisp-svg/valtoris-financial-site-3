import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import DiagnosticProductCard from '../components/home/DiagnosticProductCard'
import HomeCardIcon from '../components/home/HomeCardIcon'
import PlatformHeroVisual from '../components/home/PlatformHeroVisual'
import {
  HOME_BUSINESS_CARD_PRIMARY,
  HOME_EXPLORE_CTA,
  HOME_FAMILY_CARD_PRIMARY,
  HOME_HOW_IT_WORKS_CTA,
  HOME_LEARN_MORE_CTA,
  HOME_PROTECTION_CARD_PRIMARY,
} from '../constants/homepage'
import { ROUTES } from '../constants/routes'

const DIAGNOSTIC_PRODUCTS = [
  {
    variant: 'family' as const,
    icon: 'grade' as const,
    title: 'Family Financial Report Card™',
    valueProp:
      'Understand your household\'s financial health across protection, cash flow, debt, retirement, and legacy.',
    timeEstimate: '~5 min',
    primaryLabel: HOME_FAMILY_CARD_PRIMARY,
    primaryTo: ROUTES.familyAssessment,
    secondaryLabel: HOME_LEARN_MORE_CTA,
    secondaryTo: ROUTES.reportCard,
  },
  {
    variant: 'business' as const,
    icon: 'picture' as const,
    title: 'Business Financial Report Card™',
    valueProp:
      'Identify gaps in cash flow, structure, tax strategy, protection, risk, funding, and exit readiness.',
    timeEstimate: '~6 min',
    primaryLabel: HOME_BUSINESS_CARD_PRIMARY,
    primaryTo: ROUTES.businessAssessment,
    secondaryLabel: HOME_LEARN_MORE_CTA,
    secondaryTo: ROUTES.businessReportCard,
  },
  {
    variant: 'protection' as const,
    icon: 'protection' as const,
    title: 'Family Protection Analysis™',
    valueProp:
      'Estimate how much life insurance protection your family may need and where your coverage gap may be.',
    timeEstimate: '<2 min',
    primaryLabel: HOME_PROTECTION_CARD_PRIMARY,
    primaryTo: ROUTES.protectionGap,
    secondaryLabel: HOME_LEARN_MORE_CTA,
    secondaryTo: ROUTES.protectionAnalysis,
  },
]

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Choose Your Diagnostic',
    description: 'Select the path that matches your family, business, or protection needs.',
  },
  {
    step: '2',
    title: 'Answer Focused Questions',
    description: 'Complete a short, structured assessment — no account required.',
  },
  {
    step: '3',
    title: 'Receive Your Personalized Report',
    description: 'Get grades, gaps, and prioritized insights built from your answers.',
  },
  {
    step: '4',
    title: 'Build Your Strategy',
    description: 'Move forward with a clear action plan tailored to what matters most.',
  },
]

const SOLUTION_PREVIEW_AREAS = [
  {
    icon: 'protection' as const,
    title: 'Protect Your Family',
    description: 'Build a stronger financial foundation for the people who depend on you.',
  },
  {
    icon: 'priorities' as const,
    title: 'Strengthen Your Finances',
    description: 'Create more breathing room today so you can build a stronger tomorrow.',
  },
  {
    icon: 'strategy' as const,
    title: 'Build Your Future',
    description: 'Turn today\u2019s financial decisions into long-term progress.',
  },
  {
    icon: 'picture' as const,
    title: 'Protect & Grow Your Business',
    description: 'A financial strategy as intentional as the business itself.',
  },
]

const WHO_WE_HELP = [
  {
    title: 'Families',
    description:
      'Clarity across protection, cash flow, debt, and legacy — with a full Family Financial Report Card™ or a faster Family Protection Analysis™.',
    actionLabel: 'Explore Family Solutions',
    actionTo: ROUTES.reportCard,
    icon: 'grade' as const,
  },
  {
    title: 'Business Owners',
    description:
      'Assess financial health, risk, structure, cash flow, protection, and exit readiness — with prioritized steps to grow enterprise value.',
    actionLabel: 'Explore Business Solutions',
    actionTo: ROUTES.businessReportCard,
    icon: 'picture' as const,
  },
]

const WHY_VALTORIS = [
  {
    icon: 'picture' as const,
    title: 'Clarity Over Complexity',
    description: 'Structured diagnostics that turn financial uncertainty into a clear, readable picture.',
  },
  {
    icon: 'priorities' as const,
    title: 'Prioritized Recommendations',
    description: 'Know what deserves attention first — not a generic list of everything at once.',
  },
  {
    icon: 'grade' as const,
    title: 'Educational First',
    description: 'Complimentary reports designed to inform and empower — not pressure you into a sale.',
  },
  {
    icon: 'strategy' as const,
    title: 'Strategy After Diagnosis',
    description: 'Every diagnostic leads to actionable next steps — not just data without direction.',
  },
]

const FINAL_CTA_PATHS = [
  {
    label: 'Family Report Card',
    description: 'Comprehensive household financial health',
    action: 'Explore Family Report Card',
    to: ROUTES.reportCard,
  },
  {
    label: 'Business Report Card',
    description: 'Business financial health & enterprise value',
    action: 'Explore Business Report Card',
    to: ROUTES.businessReportCard,
  },
  {
    label: 'Protection Analysis',
    description: 'Coverage needs & protection gap estimate',
    action: 'Explore Protection Analysis',
    to: ROUTES.protectionAnalysis,
  },
]

export default function HomePage() {
  return (
    <div className="platform-home">
      <section className="platform-hero">
        <div className="container platform-hero-grid">
          <div className="platform-hero-copy">
            <p className="platform-eyebrow">VALTORIS FINANCIAL</p>
            <h1 className="platform-headline">See the gaps. Know what to fix next.</h1>
            <p className="platform-subhead">
              Personalized financial diagnostics for your family, your business, and the future
              you&apos;re building.
            </p>
            <div className="platform-hero-actions">
              <a className="platform-btn platform-btn-primary" href="#diagnostics">
                {HOME_EXPLORE_CTA}
              </a>
              <a className="platform-btn platform-btn-secondary" href="#how-it-works">
                {HOME_HOW_IT_WORKS_CTA}
              </a>
            </div>
          </div>
          <PlatformHeroVisual />
        </div>
      </section>

      <section id="diagnostics" className="platform-section platform-diagnostics">
        <div className="container platform-section-inner">
          <h2 className="platform-section-title">Your Financial Diagnostics</h2>
          <p className="platform-section-lead">
            Three focused diagnostics — each built to reveal gaps and prioritize what to fix next.
          </p>
          <div className="diagnostic-product-grid">
            {DIAGNOSTIC_PRODUCTS.map((product) => (
              <DiagnosticProductCard key={product.title} {...product} />
            ))}
          </div>
        </div>
      </section>

      <section className="platform-section platform-solutions-preview">
        <div className="container platform-section-inner">
          <h2 className="platform-section-title">Solutions for Your Whole Financial Life</h2>
          <p className="platform-section-lead">
            Four strategic areas — protection, finances, future planning, and business — coordinated
            around what matters most.
          </p>
          <div className="solutions-preview-grid">
            {SOLUTION_PREVIEW_AREAS.map((area) => (
              <article key={area.title} className="solutions-preview-card">
                <HomeCardIcon variant={area.icon} />
                <h3 className="solutions-preview-title">{area.title}</h3>
                <p className="solutions-preview-copy">{area.description}</p>
              </article>
            ))}
          </div>
          <Link className="platform-btn platform-btn-secondary solutions-preview-cta" to={ROUTES.solutions}>
            Explore All Solutions
          </Link>
        </div>
      </section>

      <section id="how-it-works" className="platform-section platform-section-alt">
        <div className="container platform-section-inner">
          <h2 className="platform-section-title">How Valtoris Works</h2>
          <p className="platform-section-lead">
            From diagnostic to direction in four focused steps.
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

      <section className="platform-section">
        <div className="container platform-section-inner">
          <h2 className="platform-section-title">Who We Help</h2>
          <p className="platform-section-lead">
            Purpose-built diagnostics for the people who carry the most financial responsibility.
          </p>
          <div className="platform-audience-grid">
            {WHO_WE_HELP.map((item) => (
              <article key={item.title} className="platform-audience-card">
                <HomeCardIcon variant={item.icon} />
                <h3 className="platform-audience-title">{item.title}</h3>
                <p className="platform-audience-copy">{item.description}</p>
                <Link className="platform-audience-action" to={item.actionTo}>
                  {item.actionLabel} →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="platform-section platform-why">
        <div className="container platform-section-inner">
          <h2 className="platform-section-title">Why Valtoris</h2>
          <p className="platform-section-lead">
            A diagnostic platform built for clarity — not complexity.
          </p>
          <div className="platform-why-grid">
            {WHY_VALTORIS.map((item) => (
              <article key={item.title} className="platform-why-item">
                <HomeCardIcon variant={item.icon} />
                <h3 className="platform-why-title">{item.title}</h3>
                <p className="platform-why-copy">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="product-closing platform-closing">
        <div className="container product-closing-inner">
          <h2 className="product-closing-title">Start with clarity.</h2>
          <p className="product-closing-copy">
            Choose the diagnostic that fits where you are today.
          </p>
          <div className="platform-final-cta-grid">
            {FINAL_CTA_PATHS.map((path) => (
              <Link key={path.label} className="platform-final-cta-card" to={path.to}>
                <span className="platform-final-cta-label">{path.label}</span>
                <span className="platform-final-cta-description">{path.description}</span>
                <span className="platform-final-cta-action">{path.action} →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
