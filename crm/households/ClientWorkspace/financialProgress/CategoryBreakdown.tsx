import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import type { CategoryProgress } from '../../../financial-progress'
import {
  formatCategoryStatus,
  formatProgressScoreValue,
  getCategoryDisplayName,
} from './formatProgressDisplay'

type CategoryBreakdownProps = {
  categories: CategoryProgress[]
}

export default function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  return (
    <Panel labelledBy="crm-fp-categories-heading">
      <SectionHeader
        title="Category Breakdown"
        titleId="crm-fp-categories-heading"
        meta={<span className="crm-count-pill">{categories.length}</span>}
      />

      <ul className="crm-financial-progress-category-list">
        {categories.map((category) => {
          const notCalculated = category.status === 'placeholder' || category.score == null

          return (
            <li key={category.categoryId} className="crm-financial-progress-category-row">
              <div className="crm-financial-progress-category-main">
                <p className="crm-task-title">{getCategoryDisplayName(category)}</p>
                <p className="crm-task-meta">
                  Maximum Points: {category.maxPoints}
                  {' · '}
                  Status: {formatCategoryStatus(category.status)}
                </p>
              </div>
              <div className="crm-financial-progress-category-score">
                {notCalculated ? (
                  <span className="crm-muted">Not Yet Calculated</span>
                ) : (
                  <span>
                    {formatProgressScoreValue(category.score)}
                    {category.grade ? ` (${category.grade})` : ''}
                    <span className="crm-muted"> / {category.maxPoints}</span>
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
