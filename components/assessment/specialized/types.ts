/**
 * Typed contract for specialized public assessments.
 * Explicit question kinds — not a generic form builder.
 * Canonical option values are language-neutral; labels resolve from locale copy.
 */

export const SPECIALIZED_LOCALES = ['en', 'es'] as const
export type SpecializedLocale = (typeof SPECIALIZED_LOCALES)[number]

export const SPECIALIZED_QUESTION_KINDS = ['single', 'multi', 'short_text', 'group'] as const
export type SpecializedQuestionKind = (typeof SPECIALIZED_QUESTION_KINDS)[number]

export const SPECIALIZED_FIELD_INPUTS = ['single', 'multi', 'short_text'] as const
export type SpecializedFieldInput = (typeof SPECIALIZED_FIELD_INPUTS)[number]

export type SpecializedCopyKey = string

export type SpecializedOption = {
  readonly value: string
  readonly labelKey: SpecializedCopyKey
}

export type SpecializedCondition =
  | { readonly field: string; readonly equals: string }
  | { readonly field: string; readonly in: readonly string[] }
  | { readonly field: string; readonly notEquals: string }
  | { readonly field: string; readonly notIn: readonly string[] }

type SpecializedFieldBase = {
  readonly id: string
  readonly required?: boolean
  readonly labelKey: SpecializedCopyKey
  readonly helperKey?: SpecializedCopyKey
  readonly when?: SpecializedCondition
}

export type SpecializedSingleField = SpecializedFieldBase & {
  readonly input: 'single'
  readonly options: readonly SpecializedOption[]
  readonly placeholderKey?: SpecializedCopyKey
}

export type SpecializedMultiField = SpecializedFieldBase & {
  readonly input: 'multi'
  readonly options: readonly SpecializedOption[]
  /** Selecting any of these values replaces the rest (e.g. none, not_sure). */
  readonly exclusiveValues?: readonly string[]
}

export type SpecializedShortTextField = SpecializedFieldBase & {
  readonly input: 'short_text'
  readonly maxLength: number
  readonly placeholderKey?: SpecializedCopyKey
}

export type SpecializedField =
  | SpecializedSingleField
  | SpecializedMultiField
  | SpecializedShortTextField

export type SpecializedQuestion = {
  readonly id: string
  readonly kind: SpecializedQuestionKind
  /** Groups still count as one diagnostic question. */
  readonly diagnostic: true
  readonly labelKey: SpecializedCopyKey
  readonly helperKey?: SpecializedCopyKey
  readonly fields: readonly SpecializedField[]
}

export type SpecializedAnswerValue = string | string[]
export type SpecializedAnswerMap = Record<string, SpecializedAnswerValue>

export type SpecializedCopyCatalog = {
  readonly questions: Record<string, string>
  readonly helpers: Record<string, string>
  readonly fields: Record<string, string>
  readonly answers: Record<string, string>
  readonly placeholders: Record<string, string>
  readonly validation: Record<string, string>
  readonly ui: Record<string, string>
  readonly results: Record<string, string>
}

export type SpecializedCopySection = keyof SpecializedCopyCatalog

export type SpecializedProductCopy = Record<SpecializedLocale, SpecializedCopyCatalog | null>
