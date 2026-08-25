import { ReactNode } from 'react'

type QuestionCardProps = {
  title: string
  description?: string
  children: ReactNode
  titleAs?: 'h1' | 'h2'
}

export default function QuestionCard({
  title,
  description,
  children,
  titleAs: TitleTag = 'h1',
}: QuestionCardProps) {
  return (
    <section className="question-card">
      <TitleTag className="question-card-title">{title}</TitleTag>
      {description && <p className="question-card-description">{description}</p>}
      <div className="question-card-body">{children}</div>
    </section>
  )
}
