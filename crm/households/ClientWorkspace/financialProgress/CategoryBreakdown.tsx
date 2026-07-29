import Panel from '../../../components/ui/Panel'
import SectionHeader from '../../../components/ui/SectionHeader'
import type { CategoryProgress } from '../../../financial-progress'
import {
  formatCategoryScoreDisplay,
  formatCategoryStatus,
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
          const scoreDisplay = formatCategoryScoreDisplay(category)
          const gradeSuffix =
            scoreDisplay.available && category.grade ? ` (${category.grade})` : ''

          return (
            <li key={category.categoryId} className="crm-financial-progress-category-row">
              <div className="crm-financial-progress-category-main">
                <p className="crm-task-title">{getCategoryDisplayName(category)}</p>
                <p className="crm-task-meta">
                  Maximum Points: {category.maxPoints}
                  {' · '}
                  Status: {formatCategoryStatus(category.status)}
                  {scoreDisplay.incompleteNote
                    ? ` · ${scoreDisplay.incompleteNote}`
                    : null}
                </p>
              </div>
              <div className="crm-financial-progress-category-score">
                {scoreDisplay.available ? (
                  <span>
                    {scoreDisplay.label}
                    {gradeSuffix}
                  </span>
                ) : (
                  <span className="crm-muted">{scoreDisplay.label}</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
