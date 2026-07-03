import { getGradeTone } from '../reportCard/reportCardData'

export function CategoryIcon({ categoryId }: { categoryId: string }) {
  return <span className={`rd-category-icon rd-category-icon-${categoryId}`} aria-hidden="true" />
}

export function GradePill({ grade }: { grade: string }) {
  const tone = getGradeTone(grade)
  return <span className={`rd-grade-pill rd-grade-pill-${tone}`}>{grade}</span>
}

export function ScoreBar({ score, grade }: { score: number; grade: string }) {
  const tone = getGradeTone(grade)
  return (
    <div className="rd-score-bar">
      <div className={`rd-score-bar-fill rd-score-bar-${tone}`} style={{ width: `${score}%` }} />
    </div>
  )
}
