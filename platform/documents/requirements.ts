/**
 * Document requirement helpers — pure metadata composition.
 * Does not create tasks, request uploads, or persist checklist rows.
 */

import {
  getDocumentTypeDefinition,
  listDocumentTypeDefinitions,
} from './documentRegistry'
import type { DocumentTypeDefinition } from './types'

function matchesModule(definition: DocumentTypeDefinition, moduleKey: string): boolean {
  if (definition.moduleKey === moduleKey) return true
  return (definition.alsoUsedByModules ?? []).includes(moduleKey)
}

function matchesCaseType(definition: DocumentTypeDefinition, caseType: string): boolean {
  if (definition.caseType === caseType) return true
  return (definition.alsoUsedByCaseTypes ?? []).includes(caseType)
}

function sortByKey(definitions: readonly DocumentTypeDefinition[]): DocumentTypeDefinition[] {
  return definitions.slice().sort((a, b) => a.key.localeCompare(b.key))
}

/** Document types marked required for a module (primary or also-used). */
export function listRequiredDocumentsForModule(moduleKey: string): DocumentTypeDefinition[] {
  return sortByKey(
    listDocumentTypeDefinitions().filter(
      (definition) => definition.required && matchesModule(definition, moduleKey),
    ),
  )
}

/** Optional (not required) document types associated with a module. */
export function listOptionalDocumentsForModule(moduleKey: string): DocumentTypeDefinition[] {
  return sortByKey(
    listDocumentTypeDefinitions().filter(
      (definition) => !definition.required && matchesModule(definition, moduleKey),
    ),
  )
}

/** Required document types associated with a case type. */
export function listRequiredDocumentsForCaseType(caseType: string): DocumentTypeDefinition[] {
  return sortByKey(
    listDocumentTypeDefinitions().filter(
      (definition) => definition.required && matchesCaseType(definition, caseType),
    ),
  )
}

/** Optional document types associated with a case type. */
export function listOptionalDocumentsForCaseType(caseType: string): DocumentTypeDefinition[] {
  return sortByKey(
    listDocumentTypeDefinitions().filter(
      (definition) => !definition.required && matchesCaseType(definition, caseType),
    ),
  )
}

/** Document types that declare reviewRequired. */
export function listReviewRequiredDocuments(
  filter?: { moduleKey?: string; caseType?: string },
): DocumentTypeDefinition[] {
  return sortByKey(
    listDocumentTypeDefinitions().filter((definition) => {
      if (!definition.review.reviewRequired) return false
      if (filter?.moduleKey && !matchesModule(definition, filter.moduleKey)) return false
      if (filter?.caseType && !matchesCaseType(definition, filter.caseType)) return false
      return true
    }),
  )
}

/** Document types that expire (metadata). */
export function listExpiringDocuments(
  filter?: { moduleKey?: string; caseType?: string },
): DocumentTypeDefinition[] {
  return sortByKey(
    listDocumentTypeDefinitions().filter((definition) => {
      if (!definition.expiration.expires) return false
      if (filter?.moduleKey && !matchesModule(definition, filter.moduleKey)) return false
      if (filter?.caseType && !matchesCaseType(definition, filter.caseType)) return false
      return true
    }),
  )
}

/**
 * Build a deterministic required-document checklist for a case type.
 * Returns type metadata only — no file rows and no persistence.
 */
export function buildRequiredDocumentChecklist(caseType: string): Array<{
  documentTypeKey: string
  title: string
  required: true
  reviewRequired: boolean
  expires: boolean
}> {
  return listRequiredDocumentsForCaseType(caseType).map((definition) => ({
    documentTypeKey: definition.key,
    title: definition.title,
    required: true as const,
    reviewRequired: definition.review.reviewRequired,
    expires: definition.expiration.expires,
  }))
}

export function isDocumentRequiredForCaseType(
  documentTypeKey: string,
  caseType: string,
): boolean {
  const definition = getDocumentTypeDefinition(documentTypeKey)
  if (!definition?.required) return false
  return matchesCaseType(definition, caseType)
}
