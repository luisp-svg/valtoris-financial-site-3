/**
 * Document validation rule catalog — no registry imports (cycle-safe).
 */

import type { DocumentValidationRuleKey } from './types'

export const DOCUMENT_VALIDATION_RULE_CATALOG: ReadonlyArray<{
  key: DocumentValidationRuleKey
  description: string
}> = [
  { key: 'has_file_reference', description: 'Caller asserts a file reference exists.' },
  { key: 'mime_type_allowed', description: 'MIME type is in the document type allow-list.' },
  { key: 'size_within_limit', description: 'Size is within maxSizeMB.' },
  { key: 'not_expired', description: 'Caller asserts the document is not expired.' },
  { key: 'review_approved', description: 'Caller asserts review was approved.' },
  { key: 'page_count_present', description: 'Caller asserts a page count is present.' },
  { key: 'issued_date_present', description: 'Caller asserts an issued date is present.' },
] as const

const RULE_KEYS = new Set(DOCUMENT_VALIDATION_RULE_CATALOG.map((item) => item.key))

export function isKnownDocumentValidationRule(rule: string): boolean {
  return RULE_KEYS.has(rule as DocumentValidationRuleKey)
}

export function listDocumentValidationRuleKeys(): DocumentValidationRuleKey[] {
  return DOCUMENT_VALIDATION_RULE_CATALOG.map((item) => item.key).sort()
}
