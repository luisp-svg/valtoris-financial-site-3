import ChoiceGroup from '../ChoiceGroup'
import QuestionCard from '../QuestionCard'
import SelectInput from '../SelectInput'
import TextInput from '../TextInput'
import {
  getMultiValue,
  getStringValue,
  isFieldComplete,
  isFieldRequired,
  visibleFields,
} from './answers'
import type {
  SpecializedAnswerMap,
  SpecializedCopySection,
  SpecializedField,
  SpecializedQuestion,
} from './types'

export type SpecializedCopyFn = (section: SpecializedCopySection, key: string) => string

export type SpecializedQuestionRendererProps = {
  question: SpecializedQuestion
  values: SpecializedAnswerMap
  t: SpecializedCopyFn
  showErrors?: boolean
  onChange: (field: SpecializedField, value: string | string[]) => void
}

function fieldErrorMessage(
  field: SpecializedField,
  values: SpecializedAnswerMap,
  t: SpecializedCopyFn,
): string {
  if (field.input === 'short_text' && getStringValue(values, field.id).length > field.maxLength) {
    return t('validation', 'servicer_length')
  }
  return t('validation', 'required')
}

function SpecializedFieldControl({
  field,
  values,
  t,
  showErrors,
  onChange,
}: {
  field: SpecializedField
  values: SpecializedAnswerMap
  t: SpecializedCopyFn
  showErrors: boolean
  onChange: (field: SpecializedField, value: string | string[]) => void
}) {
  const label = t('fields', field.labelKey)
  const invalid = showErrors && isFieldRequired(field) && !isFieldComplete(field, values)
  const helper = field.helperKey ? t('helpers', field.helperKey) : null

  let control = null
  if (field.input === 'single') {
    control = (
      <SelectInput
        label={label}
        name={field.id}
        value={getStringValue(values, field.id)}
        onChange={(value) => onChange(field, value)}
        options={field.options.map((option) => ({
          value: option.value,
          label: t('answers', option.labelKey),
        }))}
        placeholder={t('placeholders', field.placeholderKey ?? 'select')}
        required={isFieldRequired(field)}
      />
    )
  } else if (field.input === 'multi') {
    control = (
      <ChoiceGroup
        label={label}
        name={field.id}
        options={field.options.map((option) => ({
          value: option.value,
          label: t('answers', option.labelKey),
        }))}
        selected={getMultiValue(values, field.id)}
        onChange={(selected) => onChange(field, selected)}
        required={isFieldRequired(field)}
      />
    )
  } else {
    const current = getStringValue(values, field.id)
    control = (
      <TextInput
        label={label}
        name={field.id}
        value={current}
        onChange={(value) => onChange(field, value.slice(0, field.maxLength))}
        placeholder={field.placeholderKey ? t('placeholders', field.placeholderKey) : undefined}
        required={isFieldRequired(field)}
        maxLength={field.maxLength}
      />
    )
  }

  return (
    <div className={field.when ? 'assessment-subsection' : undefined}>
      {control}
      {helper ? <p className="assessment-note">{helper}</p> : null}
      {invalid ? (
        <p className="assessment-validation-message" role="alert">
          {fieldErrorMessage(field, values, t)}
        </p>
      ) : null}
    </div>
  )
}

export default function SpecializedQuestionRenderer({
  question,
  values,
  t,
  showErrors = false,
  onChange,
}: SpecializedQuestionRendererProps) {
  const fields = visibleFields(question, values)
  const title = t('questions', question.labelKey)
  const description = question.helperKey ? t('helpers', question.helperKey) : undefined

  return (
    <QuestionCard title={title} description={description}>
      <div className="assessment-form">
        {fields.map((field) => (
          <SpecializedFieldControl
            key={field.id}
            field={field}
            values={values}
            t={t}
            showErrors={showErrors}
            onChange={onChange}
          />
        ))}
      </div>
    </QuestionCard>
  )
}
