import QuestionCard from '../assessment/QuestionCard'

type FormulaNoteProps = {
  label: string
  formula: string
}

export function FormulaNote({ label, formula }: FormulaNoteProps) {
  return (
    <div className="formula-note">
      <span className="formula-note-label">{label}</span>
      <span className="formula-note-formula">{formula}</span>
    </div>
  )
}

type TotalDisplayProps = {
  label: string
  value: string
}

export function TotalDisplay({ label, value }: TotalDisplayProps) {
  return (
    <div className="calc-total-display">
      <span className="calc-total-label">{label}</span>
      <span className="calc-total-value">{value}</span>
    </div>
  )
}

export { QuestionCard as CalculatorQuestionCard }
