import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import HomeCardIcon from '../components/home/HomeCardIcon'
import ReportCardHeroPreview from '../components/home/ReportCardHeroPreview'
import SampleReportModal from '../components/home/SampleReportModal'
import { HOME_PRIMARY_CTA } from '../constants/homepage'
import { ROUTES } from '../constants/routes'

const WALK_AWAY_WITH = [
  {
    icon: 'grade' as const,
    title: 'Overall Financial Grade™',
    description: 'Your household score and Legacy Ready™ progress.',
  },
  {
    icon: 'protection' as const,
    title: 'Family Protection Analysis™',
    description: 'Estimated protection gap and coverage insights.',
  },
  {
    icon: 'blueprint' as const,
    title: 'Personalized Financial Blueprint™',
    description: 'Prioritized next steps built for your family.',
  },
  {
    icon: 'session' as const,
    title: '1-on-1 Strategy Session™',
    description: 'Complimentary review with a Valtoris advisor.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Complete Assessment',
    description: 'Quick questions about your family and finances.',
  },
  {
    step: '2',
    title: 'Receive Your Family Financial Report Card™',
    description: 'Your complimentary report with grades and insights.',
  },
  {
    step: '3',
    title: 'Meet With Your Advisor',
    description: 'Walk through your results in a Strategy Session™.',
  },
  {
    step: '4',
    title: 'Implement Your Personalized Financial Blueprint™',
    description: 'Move forward with a clear Financial Blueprint™.',
  },
]

const WHY_VALTORIS = [
  {
    icon: 'picture' as const,
    title: 'One Complete Financial Picture',
    description: 'Income, protection, debt, and legacy in one view.',
  },
  {
    icon: 'priorities' as const,
    title: 'Prioritized Recommendations',
    description: 'Know exactly what to tackle first.',
  },
  {
    icon: 'strategy' as const,
    title: 'Personalized Strategy',
    description: 'A Financial Blueprint™ built for your family.',
  },
]

export default function HomePage() {
  const [isSampleOpen, setIsSampleOpen] = useState(false)

  return (
    <div className="home-page">
      <section className="home-section home-hero">
        <div className="container home-section-inner">
          <p className="home-eyebrow">Valtoris Financial</p>
          <h1 className="home-headline">The Family Financial Report Card™</h1>
          <p className="home-subhead">
            A complimentary, personalized report that shows where your family stands — and what
            to do next.
          </p>
          <div className="home-section-cta">
            <Link className="home-btn home-btn-primary" to={ROUTES.reportCard}>
              {HOME_PRIMARY_CTA}
            </Link>
          </div>
        </div>
      </section>

      <section className="home-section home-preview">
        <div className="container home-section-inner">
          <h2 className="home-section-title home-section-title-wide">
            Explore a Real Family Financial Report Card™
          </h2>
          <p className="home-subhead home-subhead-centered">
            Browse the full report before you start your assessment.
          </p>

          <div className="home-preview-stage-wrap">
            <ReportCardHeroPreview />
          </div>

          <div className="home-section-cta">
            <button
              type="button"
              className="home-btn home-btn-secondary"
              onClick={() => setIsSampleOpen(true)}
            >
              See Sample Report
            </button>
          </div>
        </div>
      </section>

      <section className="home-section home-walkaway">
        <div className="container home-section-inner">
          <h2 className="home-section-title">What You&apos;ll Walk Away With</h2>
          <p className="home-subhead home-subhead-centered">
            Four deliverables. One clear picture.
          </p>

          <div className="home-premium-grid home-premium-grid-four">
            {WALK_AWAY_WITH.map((item) => (
              <article key={item.title} className="home-premium-card">
                <HomeCardIcon variant={item.icon} />
                <h3 className="home-premium-card-title">{item.title}</h3>
                <p className="home-premium-card-copy">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-how">
        <div className="container home-section-inner">
          <h2 className="home-section-title">How It Works</h2>
          <p className="home-subhead home-subhead-centered">
            Four steps from assessment to action.
          </p>

          <div className="home-steps">
            {HOW_IT_WORKS.map((item, index) => (
              <Fragment key={item.title}>
                <article
                  className={`home-step${index === 0 ? ' is-first' : ''}${
                    index === HOW_IT_WORKS.length - 1 ? ' is-last' : ''
                  }`}
                >
                  <span className="home-step-number">{item.step}</span>
                  <h3 className="home-step-title">{item.title}</h3>
                  <p className="home-step-copy">{item.description}</p>
                </article>
                {index < HOW_IT_WORKS.length - 1 ? (
                  <span className="home-step-connector" aria-hidden="true" />
                ) : null}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-why">
        <div className="container home-section-inner">
          <h2 className="home-section-title">Why Families Choose Valtoris</h2>
          <p className="home-subhead home-subhead-centered">
            Clarity over complexity.
          </p>

          <div className="home-premium-grid home-premium-grid-three">
            {WHY_VALTORIS.map((item) => (
              <article key={item.title} className="home-premium-card">
                <HomeCardIcon variant={item.icon} />
                <h3 className="home-premium-card-title">{item.title}</h3>
                <p className="home-premium-card-copy">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-closing">
        <div className="container home-section-inner">
          <h2 className="home-closing-title">Your Family Deserves More Than Guesswork.</h2>
          <p className="home-closing-subhead">
            See where you stand today — and get a personalized roadmap for tomorrow.
          </p>
          <div className="home-section-cta">
            <Link className="home-btn home-btn-light" to={ROUTES.reportCard}>
              {HOME_PRIMARY_CTA}
            </Link>
          </div>
        </div>
      </section>

      <SampleReportModal isOpen={isSampleOpen} onClose={() => setIsSampleOpen(false)} />
    </div>
  )
}
