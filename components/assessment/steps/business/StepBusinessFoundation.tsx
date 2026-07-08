import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import SelectInput from '../../SelectInput'
import {
  FINANCE_SEPARATION_OPTIONS,
  LEGAL_ENTITY_STRUCTURE_OPTIONS,
  OPERATING_DOCS_OPTIONS,
} from '../../business/constants'
import { FoundationAnswers } from '../../business/types'

type StepBusinessFoundationProps = {
  answers: FoundationAnswers
  onChange: (field: keyof FoundationAnswers, value: string) => void
}

export default function StepBusinessFoundation({ answers, onChange }: StepBusinessFoundationProps) {
  return (
    <QuestionCard
      title="Business Foundation"
      description="How your business is structured and how clearly finances are separated."
    >
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <SelectInput
          label="How is your business legally structured?"
          name="entityStructure"
          value={answers.entityStructure}
          onChange={(value) => onChange('entityStructure', value)}
          options={LEGAL_ENTITY_STRUCTURE_OPTIONS}
          placeholder="Select legal structure"
          required
        />
        <OptionGroup
          label="Are your operating agreement and ownership documents current?"
          name="operatingDocs"
          options={OPERATING_DOCS_OPTIONS}
          value={answers.operatingDocs}
          onChange={(value) => onChange('operatingDocs', value)}
          required
        />
        <OptionGroup
          label="How separated are your personal and business finances?"
          name="financeSeparation"
          options={FINANCE_SEPARATION_OPTIONS}
          value={answers.financeSeparation}
          onChange={(value) => onChange('financeSeparation', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
