import { useState } from 'react'
import PriorityRecommendationCard from '../results/PriorityRecommendationCard'
import { CategoryScore } from '../reportCard/types'
import { ReportDashboardData } from './types'
import AnimatedScoreRing from './AnimatedScoreRing'
import { CategoryIcon, GradePill, ScoreBar } from './CategoryScoreVisuals'

type ReportDashboardProps = {
  data: ReportDashboardData
}

function CategoryAccordionItem({
  category,
  isOpen,
  onToggle,
  statusLabels,
  statusMetricLabel,
  recommendationsSubhead,
}: {
  category: CategoryScore
  isOpen: boolean
  onToggle: () => void
  statusLabels: ReportDashboardData['statusLabels']
  statusMetricLabel?: string
  recommendationsSubhead: string
}) {
  const statusLabel =
    category.status === 'strength'
      ? statusLabels.strength
      : category.status === 'opportunity'
        ? statusLabels.opportunity
        : category.status === 'strong'
          ? statusLabels.strong ?? 'Strong'
          : category.status === 'stable'
            ? statusLabels.stable ?? 'Stable'
            : category.status === 'needs-attention'
              ? statusLabels['needs-attention'] ?? 'Needs Attention'
              : category.status === 'priority-risk'
                ? statusLabels['priority-risk'] ?? 'Priority Risk'
                : statusLabels.neutral

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
              Current Score <strong>{category.score}</strong>/100
            </span>
            <span className="rd-accordion-metric">
              Letter Grade <strong>{category.grade}</strong>
            </span>
            {statusMetricLabel ? (
              <span className="rd-accordion-metric">
                {statusMetricLabel} <strong>{statusLabel}</strong>
              </span>
            ) : (
              <span className={`rd-status-chip rd-status-${category.status}`}>{statusLabel}</span>
            )}
          </div>
          <ScoreBar score={category.score} grade={category.grade} />
          <p className="rd-accordion-explanation">{category.explanation}</p>
          <p className="rd-accordion-guidance">{category.guidance}</p>
          <h4 className="rd-accordion-subhead">{recommendationsSubhead}</h4>
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

export default function ReportDashboard({ data }: ReportDashboardProps) {
  const [openCategories, setOpenCategories] = useState<string[]>([data.defaultOpenCategory])

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
          {data.title}
        </h1>
        <p className="rd-prepared">{data.preparedFor}</p>
        <p className="rd-hero-narrative">{data.narrative}</p>

        <div className="rd-hero-grid">
          <div className="rd-hero-score">
            <p className="rd-hero-score-label">{data.scoreLabel}</p>
            <AnimatedScoreRing score={data.score} grade={data.grade} />
            <p className="rd-hero-level">{data.level}</p>
          </div>

          <div className="rd-hero-meta">
            {data.heroMeta.map((card) =>
              card.type === 'progress' ? (
                <div key={card.label} className="rd-legacy-card">
                  <div className="rd-legacy-header">
                    <span>{card.label}</span>
                    <strong>{card.value}%</strong>
                  </div>
                  <div className="rd-legacy-track">
                    <div className="rd-legacy-fill" style={{ width: `${card.value}%` }} />
                  </div>
                  {card.copy ? <p className="rd-legacy-copy">{card.copy}</p> : null}
                </div>
              ) : (
                <div key={card.label} className="rd-gap-strip">
                  <span className="rd-gap-strip-label">{card.label}</span>
                  <span className="rd-gap-strip-value">{card.value}</span>
                  {card.copy ? <p className="rd-gap-strip-copy">{card.copy}</p> : null}
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="rd-section" aria-labelledby="rd-glance-title">
        <div className="rd-section-head">
          <h2 id="rd-glance-title" className="rd-section-title">
            At a Glance
          </h2>
          <p className="rd-section-lead">{data.glanceLead}</p>
        </div>

        <div
          className={`rd-glance-grid${
            data.categories.length > 6 ? ' rd-glance-grid-wide' : ''
          }`}
        >
          {data.categories.map((category) => (
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

      {data.strengths?.length && data.opportunities?.length ? (
        <section className="rd-section" aria-labelledby="rd-insights-title">
          <div className="rd-section-head">
            <h2 id="rd-insights-title" className="rd-section-title">
              Strengths &amp; Opportunities
            </h2>
            <p className="rd-section-lead">
              Where your family is strongest today and where the highest-impact improvements live.
            </p>
          </div>

          <div className="rd-insights-grid">
            <article className="rd-insight-panel rd-insight-panel-strengths">
              <h3 className="rd-insight-panel-title">Greatest Strengths</h3>
              <ul className="rd-insight-list">
                {data.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="rd-insight-panel rd-insight-panel-opportunities">
              <h3 className="rd-insight-panel-title">Biggest Opportunities</h3>
              <ul className="rd-insight-list">
                {data.opportunities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>
      ) : null}

      {data.protectionAnalysis ? (
        <section className="rd-section" aria-labelledby="rd-protection-title">
          <div className="rd-section-head">
            <h2 id="rd-protection-title" className="rd-section-title">
              Protection Analysis
            </h2>
            <p className="rd-section-lead">
              How well your current coverage protects your family&apos;s income and lifestyle.
            </p>
          </div>

          <article className="rd-protection-card">
            <span className="rd-protection-label">{data.protectionAnalysis.label}</span>
            <span className="rd-protection-value">{data.protectionAnalysis.value}</span>
            <p className="rd-protection-note">{data.protectionAnalysis.note}</p>
          </article>
        </section>
      ) : null}

      <section className="rd-section rd-section-priorities" aria-labelledby="rd-priorities-title">
        <div className="rd-section-head">
          <h2 id="rd-priorities-title" className="rd-section-title">
            {data.prioritiesTitle}
          </h2>
          <p className="rd-section-lead">{data.prioritiesLead}</p>
        </div>

        <div className="rd-priorities-list">
          {data.priorities.map((priority, index) => (
            <div
              key={priority.title}
              className={`rd-priority-wrap${index === 0 ? ' is-featured' : ''}`}
            >
              <span className="rd-priority-rank">{index + 1}</span>
              <PriorityRecommendationCard
                {...priority}
                rank={index + 1}
                featured={index === 0}
                impactLabel={data.impactLabel}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rd-section" aria-labelledby="rd-plan-title">
        <div className="rd-section-head">
          <h2 id="rd-plan-title" className="rd-section-title">
            {data.actionPlanTitle}
          </h2>
          <p className="rd-section-lead">{data.actionPlanLead}</p>
        </div>

        <div className="rd-plan-grid">
          {(
            [
              { key: 'immediate', label: 'Immediate', items: data.actionPlan.immediate },
              { key: 'thirtyDay', label: '30 Days', items: data.actionPlan.thirtyDay },
              { key: 'ninetyDay', label: '90 Days', items: data.actionPlan.ninetyDay },
            ] as const
          ).map((column, index) => (
            <article key={column.key} className="rd-plan-column">
              <h3 className="rd-plan-label">
                {data.actionPlanColumnIcons ? (
                  <span
                    className={`rd-plan-icon rd-plan-icon-${data.actionPlanColumnIcons[index]}`}
                    aria-hidden="true"
                  />
                ) : null}
                {column.label}
              </h3>
              <ul className="rd-plan-list">
                {column.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="rd-section" aria-labelledby="rd-categories-title">
        <div className="rd-section-head">
          <h2 id="rd-categories-title" className="rd-section-title">
            {data.categoriesTitle}
          </h2>
          <p className="rd-section-lead">{data.categoriesLead}</p>
        </div>

        <div className="rd-accordion">
          {data.categories.map((category) => (
            <CategoryAccordionItem
              key={category.id}
              category={category}
              isOpen={openCategories.includes(category.id)}
              onToggle={() => toggleCategory(category.id)}
              statusLabels={data.statusLabels}
              statusMetricLabel={data.statusMetricLabel}
              recommendationsSubhead={data.recommendationsSubhead}
            />
          ))}
        </div>
      </section>

      <section className="rd-section rd-blueprint" aria-labelledby="rd-blueprint-title">
        <div className="rd-section-head">
          <h2 id="rd-blueprint-title" className="rd-section-title">
            {data.blueprintTitle}
          </h2>
        </div>
        <p className="rd-blueprint-copy">{data.blueprintCopy}</p>
        {data.blueprintBullets?.length ? (
          <ul className="rd-blueprint-list">
            {data.blueprintBullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <footer className="rd-footer">
        <p>{data.footerLines[0]}</p>
        <p>{data.footerLines[1]}</p>
      </footer>
    </div>
  )
}
