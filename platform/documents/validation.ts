/**
 * Document validation helpers — declarative metadata evaluation only.
 * No uploads, storage I/O, OCR, or authorization.
 */

import { getDocumentTypeDefinition } from './documentRegistry'
import {
  DOCUMENT_VALIDATION_RULE_CATALOG,
  isKnownDocumentValidationRule,
  listDocumentValidationRuleKeys,
} from './validationRules'
import type {
  DocumentTypeKey,
  DocumentValidationContext,
  DocumentValidationResult,
} from './types'

export {
  DOCUMENT_VALIDATION_RULE_CATALOG,
  isKnownDocumentValidationRule,
  listDocumentValidationRuleKeys,
}

/**
 * Evaluate declared validation rules against caller-supplied context.
 * Pure / fail-closed. Does not read files, query storage, scan malware,
 * verify authenticity/identity, or approve documents. A passing result only
 * means caller-asserted flags satisfied the declared metadata rules.
 */
export function validateDocumentMetadata(
  documentTypeKey: DocumentTypeKey,
  context: DocumentValidationContext = {},
): DocumentValidationResult {
  const definition = getDocumentTypeDefinition(documentTypeKey)
  if (!definition) {
    return {
      ok: false,
      documentTypeKey,
      errors: [`Unknown document type "${documentTypeKey}"`],
    }
  }

  const errors: string[] = []

  for (const rule of definition.validationRules) {
    if (!isKnownDocumentValidationRule(rule)) {
      errors.push(`Unknown validation rule "${rule}"`)
      continue
    }
    switch (rule) {
      case 'has_file_reference':
        if (context.hasFileReference !== true) {
          errors.push('has_file_reference not satisfied')
        }
        break
      case 'mime_type_allowed': {
        const mime = context.mimeType
        if (!mime || !definition.supportedMimeTypes.includes(mime)) {
          errors.push('mime_type_allowed not satisfied')
        }
        break
      }
      case 'size_within_limit': {
        const size = context.sizeMB
        if (
          typeof size !== 'number' ||
          Number.isNaN(size) ||
          size < 0 ||
          size > definition.maxSizeMB
        ) {
          errors.push('size_within_limit not satisfied')
        }
        break
      }
      case 'not_expired':
        if (context.expired !== false) {
          errors.push('not_expired not satisfied')
        }
        break
      case 'review_approved':
        if (context.reviewApproved !== true) {
          errors.push('review_approved not satisfied')
        }
        break
      case 'page_count_present':
        if (typeof context.pageCount !== 'number' || context.pageCount < 1) {
          errors.push('page_count_present not satisfied')
        }
        break
      case 'issued_date_present':
        if (context.issuedDatePresent !== true) {
          errors.push('issued_date_present not satisfied')
        }
        break
      default:
        errors.push(`Unhandled validation rule "${rule as string}"`)
    }
  }

  if (errors.length > 0) {
    return { ok: false, documentTypeKey, errors }
  }
  return { ok: true, documentTypeKey }
}

/** Convenience: MIME allow-list check only. */
export function isMimeTypeAllowed(
  documentTypeKey: DocumentTypeKey,
  mimeType: string | null | undefined,
): boolean {
  const definition = getDocumentTypeDefinition(documentTypeKey)
  if (!definition || !mimeType) return false
  return definition.supportedMimeTypes.includes(mimeType)
}

/** Convenience: size check only. */
export function isSizeWithinLimit(
  documentTypeKey: DocumentTypeKey,
  sizeMB: number | null | undefined,
): boolean {
  const definition = getDocumentTypeDefinition(documentTypeKey)
  if (!definition || typeof sizeMB !== 'number' || Number.isNaN(sizeMB) || sizeMB < 0) {
    return false
  }
  return sizeMB <= definition.maxSizeMB
}
