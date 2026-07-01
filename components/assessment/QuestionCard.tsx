import { ReactNode } from 'react'

type QuestionCardProps = {
  title: string
  description?: string
  children: ReactNode
}

export default function QuestionCard({ title, description, children }: QuestionCardProps) {
  return (
    <section className="question-card">
      <h1 className="question-card-title">{title}</h1>
      {description && <p className="question-card-description">{description}</p>}
      <div className="question-card-body">{children}</div>
    </section>
  )
}
