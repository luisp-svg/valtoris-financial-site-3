import OptionGroup from '../../../calculator/OptionGroup'
import QuestionCard from '../../QuestionCard'
import SelectInput from '../../SelectInput'
import { localizedOptions, type ReportCardCopyFn } from '../../reportCardLocale'
import {
  FINANCE_SEPARATION_OPTIONS,
  LEGAL_ENTITY_STRUCTURE_OPTIONS,
  OPERATING_DOCS_OPTIONS,
} from '../../business/constants'
import { FoundationAnswers } from '../../business/types'

type StepBusinessFoundationProps = {
  answers: FoundationAnswers
  onChange: (field: keyof FoundationAnswers, value: string) => void
  t: ReportCardCopyFn
}

export default function StepBusinessFoundation({
  answers,
  onChange,
  t,
}: StepBusinessFoundationProps) {
  return (
    <QuestionCard title={t('ui', 'step3Title')} description={t('helpers', 'step3')}>
      <form className="assessment-form" onSubmit={(event) => event.preventDefault()}>
        <SelectInput
          label={t('fields', 'entityStructure')}
          name="entityStructure"
          value={answers.entityStructure}
          onChange={(value) => onChange('entityStructure', value)}
          options={localizedOptions(LEGAL_ENTITY_STRUCTURE_OPTIONS, t, 'entityStructure')}
          placeholder={t('placeholders', 'entityStructure')}
          required
        />
        <OptionGroup
          label={t('fields', 'operatingDocs')}
          name="operatingDocs"
          options={localizedOptions(OPERATING_DOCS_OPTIONS, t, 'operatingDocs')}
          value={answers.operatingDocs}
          onChange={(value) => onChange('operatingDocs', value)}
          required
        />
        <OptionGroup
          label={t('fields', 'financeSeparation')}
          name="financeSeparation"
          options={localizedOptions(FINANCE_SEPARATION_OPTIONS, t, 'financeSeparation')}
          value={answers.financeSeparation}
          onChange={(value) => onChange('financeSeparation', value)}
          required
        />
      </form>
    </QuestionCard>
  )
}
