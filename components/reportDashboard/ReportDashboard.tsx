import { useState } from 'react'
import PriorityRecommendationCard from '../results/PriorityRecommendationCard'
import {
  ACTION_PLAN,
  CATEGORY_SCORES,
  CategoryScore,
  REPORT_GRADE,
  REPORT_LEVEL,
  REPORT_PROGRESS,
  REPORT_PROTECTION_GAP,
  REPORT_TOP_PRIORITIES,
  getHeroNarrative,
} from '../reportCard/reportCardData'
import AnimatedScoreRing from './AnimatedScoreRing'
import { CategoryIcon, GradePill, ScoreBar } from './CategoryScoreVisuals'

type ReportDashboardProps = {
  firstName?: string
  greeting: string
}

function CategoryAccordionItem({
  category,
  isOpen,
  onToggle,
}: {
  category: CategoryScore
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <article className={`rd-accordion-item${isOpen ? ' is-open' : ''}`}>
      <button
        type="button"
        className="rd-accordion-trigger"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <CategoryIcon categoryId={category.id} />
        <span className="rd-accordion-copy">
          <span className="rd-accordion-title">{category.title}</span>
          <span className="rd-accordion-summary">{category.summary}</span>
        </span>
        <GradePill grade={category.grade} />
        <span className="rd-accordion-chevron" aria-hidden="true">
          {isOpen ? '−' : '+'}
        </span>
      </button>
      <div className="rd-accordion-panel">
        <div className="rd-accordion-panel-inner">
          <div className="rd-accordion-metrics">
            <span className="rd-accordion-metric">
              Score <strong>{category.score}</strong>/100
            </span>
            <span className={`rd-status-chip rd-status-${category.status}`}>
              {category.status === 'strength'
                ? 'Strength'
                : category.status === 'opportunity'
                  ? 'Opportunity'
                  : 'In progress'}
            </span>
          </div>
          <ScoreBar score={category.score} grade={category.grade} />
          <p className="rd-accordion-explanation">{category.explanation}</p>
          <p className="rd-accordion-guidance">{category.guidance}</p>
          <h4 className="rd-accordion-subhead">Recommended improvements</h4>
          <ul className="rd-accordion-list">
            {category.recommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  )
}

export default function ReportDashboard({ firstName = '', greeting }: ReportDashboardProps) {
  const [openCategories, setOpenCategories] = useState<string[]>(['protection'])

  function toggleCategory(id: string) {
    setOpenCategories((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  return (
    <div className="report-dashboard">
      <section className="rd-hero" aria-labelledby="rd-hero-title">
        <p className="rd-kicker">Valtoris Financial</p>
        <h1 id="rd-hero-title" className="rd-hero-title">
          Your Family Financial Report Card™
        </h1>
        <p className="rd-prepared">{greeting}</p>
        <p className="rd-hero-narrative">{getHeroNarrative(firstName)}</p>

        <div className="rd-hero-grid">
          <div className="rd-hero-score">
            <p className="rd-hero-score-label">Overall Financial Score™</p>
            <AnimatedScoreRing score={REPORT_PROGRESS} grade={REPORT_GRADE} />
            <p className="rd-hero-level">{REPORT_LEVEL}</p>
          </div>

          <div className="rd-hero-meta">
            <div className="rd-legacy-card">
              <div className="rd-legacy-header">
                <span>Progress Toward Legacy Ready™</span>
                <strong>{REPORT_PROGRESS}%</strong>
              </div>
              <div className="rd-legacy-track">
                <div className="rd-legacy-fill" style={{ width: `${REPORT_PROGRESS}%` }} />
              </div>
            </div>

            <div className="rd-gap-strip">
              <span className="rd-gap-strip-label">Protection Gap™</span>
              <span className="rd-gap-strip-value">{REPORT_PROTECTION_GAP}</span>
              <p className="rd-gap-strip-copy">
                Estimated additional protection your family may need beyond current coverage.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rd-section" aria-labelledby="rd-glance-title">
        <div className="rd-section-head">
          <h2 id="rd-glance-title" className="rd-section-title">
            At a Glance
          </h2>
          <p className="rd-section-lead">Your financial foundation across six categories.</p>
        </div>

        <div className="rd-glance-grid">
          {CATEGORY_SCORES.map((category) => (
            <article key={category.id} className="rd-glance-card">
              <div className="rd-glance-card-top">
                <CategoryIcon categoryId={category.id} />
                <GradePill grade={category.grade} />
              </div>
              <h3 className="rd-glance-card-title">{category.title}</h3>
              <div className="rd-glance-card-score">
                <strong>{category.score}</strong>
                <span>/100</span>
              </div>
              <ScoreBar score={category.score} grade={category.grade} />
              <p className="rd-glance-card-summary">{category.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rd-section rd-section-priorities" aria-labelledby="rd-priorities-title">
        <div className="rd-section-head">
          <h2 id="rd-priorities-title" className="rd-section-title">
            Top 3 Priorities™
          </h2>
          <p className="rd-section-lead">Highest-impact recommendations for your family.</p>
        </div>

        <div className="rd-priorities-list">
          {REPORT_TOP_PRIORITIES.map((priority, index) => (
            <div
              key={priority.title}
              className={`rd-priority-wrap${index === 0 ? ' is-featured' : ''}`}
            >
              <span className="rd-priority-rank">{index + 1}</span>
              <PriorityRecommendationCard
                {...priority}
                rank={index + 1}
                featured={index === 0}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rd-section" aria-labelledby="rd-plan-title">
        <div className="rd-section-head">
          <h2 id="rd-plan-title" className="rd-section-title">
            Personalized Action Plan™
          </h2>
          <p className="rd-section-lead">Immediate, 30-day, and 90-day next steps.</p>
        </div>

        <div className="rd-plan-grid">
          <article className="rd-plan-column">
            <h3 className="rd-plan-label">Immediate</h3>
            <ul className="rd-plan-list">
              {ACTION_PLAN.immediate.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="rd-plan-column">
            <h3 className="rd-plan-label">30 Days</h3>
            <ul className="rd-plan-list">
              {ACTION_PLAN.thirtyDay.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="rd-plan-column">
            <h3 className="rd-plan-label">90 Days</h3>
            <ul className="rd-plan-list">
              {ACTION_PLAN.ninetyDay.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="rd-section" aria-labelledby="rd-categories-title">
        <div className="rd-section-head">
          <h2 id="rd-categories-title" className="rd-section-title">
            Category Recommendations
          </h2>
          <p className="rd-section-lead">
            Expand each category for personalized guidance and improvements.
          </p>
        </div>

        <div className="rd-accordion">
          {CATEGORY_SCORES.map((category) => (
            <CategoryAccordionItem
              key={category.id}
              category={category}
              isOpen={openCategories.includes(category.id)}
              onToggle={() => toggleCategory(category.id)}
            />
          ))}
        </div>
      </section>

      <section className="rd-section rd-blueprint" aria-labelledby="rd-blueprint-title">
        <div className="rd-section-head">
          <h2 id="rd-blueprint-title" className="rd-section-title">
            Your Personalized Financial Blueprint™
          </h2>
        </div>
        <p className="rd-blueprint-copy">
          This report identifies your current strengths, potential risks, and highest-impact
          opportunities. During your complimentary Family Financial Strategy Session™, we&apos;ll
          review every recommendation and create a customized action plan for your family.
        </p>
      </section>

      <footer className="rd-footer">
        <p>Powered by Valtoris Financial™</p>
        <p>Helping Families Become Legacy Ready™</p>
      </footer>
    </div>
  )
}
