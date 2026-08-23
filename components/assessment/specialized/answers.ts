import type {
  SpecializedAnswerMap,
  SpecializedCondition,
  SpecializedField,
  SpecializedQuestion,
} from './types'

export function questionFields(question: SpecializedQuestion): readonly SpecializedField[] {
  return question.fields
}

export function isFieldRequired(field: SpecializedField): boolean {
  return field.required !== false
}

export function conditionMatches(
  condition: SpecializedCondition | undefined,
  values: SpecializedAnswerMap,
): boolean {
  if (!condition) return true
  const raw = values[condition.field]
  const current = typeof raw === 'string' ? raw : ''
  if ('equals' in condition) return current === condition.equals
  if ('notEquals' in condition) return current !== condition.notEquals
  if ('in' in condition) return condition.in.includes(current)
  return !condition.notIn.includes(current)
}

export function isFieldVisible(field: SpecializedField, values: SpecializedAnswerMap): boolean {
  return conditionMatches(field.when, values)
}

export function visibleFields(
  question: SpecializedQuestion,
  values: SpecializedAnswerMap,
): SpecializedField[] {
  return question.fields.filter((field) => isFieldVisible(field, values))
}

export function getStringValue(values: SpecializedAnswerMap, fieldId: string): string {
  const raw = values[fieldId]
  return typeof raw === 'string' ? raw : ''
}

export function getMultiValue(values: SpecializedAnswerMap, fieldId: string): string[] {
  const raw = values[fieldId]
  return Array.isArray(raw) ? raw : []
}

export function isFieldComplete(field: SpecializedField, values: SpecializedAnswerMap): boolean {
  if (!isFieldVisible(field, values)) return true
  if (!isFieldRequired(field)) {
    if (field.input === 'short_text') {
      const text = getStringValue(values, field.id)
      return text.length <= field.maxLength
    }
    return true
  }
  if (field.input === 'multi') {
    return getMultiValue(values, field.id).length > 0
  }
  if (field.input === 'short_text') {
    const text = getStringValue(values, field.id).trim()
    return text.length > 0 && text.length <= field.maxLength
  }
  return getStringValue(values, field.id).trim() !== ''
}

/** A grouped question is complete only when every visible field is complete. */
export function isQuestionComplete(
  question: SpecializedQuestion,
  values: SpecializedAnswerMap,
): boolean {
  return visibleFields(question, values).every((field) => isFieldComplete(field, values))
}

export function applyExclusiveMultiValue(
  field: SpecializedField,
  previous: string[],
  next: string[],
): string[] {
  if (field.input !== 'multi' || !field.exclusiveValues?.length) return next
  const exclusive = new Set(field.exclusiveValues)
  const added = next.find((value) => !previous.includes(value))
  if (added && exclusive.has(added)) return [added]
  if (next.some((value) => exclusive.has(value)) && next.some((value) => !exclusive.has(value))) {
    return next.filter((value) => !exclusive.has(value))
  }
  return next
}

export function applyFieldChange(
  question: SpecializedQuestion,
  field: SpecializedField,
  values: SpecializedAnswerMap,
  nextValue: string | string[],
): SpecializedAnswerMap {
  const previous = getMultiValue(values, field.id)
  const resolved =
    field.input === 'multi' && Array.isArray(nextValue)
      ? applyExclusiveMultiValue(field, previous, nextValue)
      : nextValue
  const updated: SpecializedAnswerMap = { ...values, [field.id]: resolved }
  return pruneHiddenQuestionAnswers(question, updated)
}

export function pruneHiddenQuestionAnswers(
  question: SpecializedQuestion,
  values: SpecializedAnswerMap,
): SpecializedAnswerMap {
  const next: SpecializedAnswerMap = { ...values }
  for (const field of question.fields) {
    if (isFieldVisible(field, next)) continue
    next[field.id] = field.input === 'multi' ? [] : ''
  }
  return next
}

export function assertSpecializedQuestion(question: SpecializedQuestion): void {
  if (question.fields.length === 0) {
    throw new Error(`Specialized question ${question.id} must declare at least one field.`)
  }
  if (question.kind === 'group') {
    if (question.fields.length < 2) {
      throw new Error(`Grouped question ${question.id} must declare two or more fields.`)
    }
    return
  }
  if (question.fields.length !== 1) {
    throw new Error(`Question ${question.id} of kind ${question.kind} must declare exactly one field.`)
  }
  if (question.fields[0].input !== question.kind) {
    throw new Error(
      `Question ${question.id} kind ${question.kind} does not match field input ${question.fields[0].input}.`,
    )
  }
}

export function planSpecializedQuestionRender(
  question: SpecializedQuestion,
  values: SpecializedAnswerMap,
): Array<{ id: string; input: SpecializedField['input']; followUp: boolean; required: boolean }> {
  return visibleFields(question, values).map((field) => ({
    id: field.id,
    input: field.input,
    followUp: Boolean(field.when),
    required: isFieldRequired(field),
  }))
}
