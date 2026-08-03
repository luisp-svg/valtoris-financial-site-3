/**
 * Document selectors and requirement draft builders.
 * Pure / in-memory only — no storage, uploads, or database I/O.
 */

import { getModule, listEnabledModules } from '../registry'
import { getDocumentCategory, listDocumentCategories } from './categories'
import {
  getDocumentTypeDefinition,
  listDocumentTypeDefinitions,
  requireDocumentTypeDefinition,
} from './documentRegistry'
import type {
  CreateDocumentRequirementDraftInput,
  DocumentCategoryKeyCanonical,
  DocumentRequirementDraft,
  DocumentTypeDefinition,
  DocumentTypeKey,
} from './types'

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function createDraftDocumentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`
}

function normalizeMetadata(
  input: CreateDocumentRequirementDraftInput['metadata'] | undefined,
): DocumentRequirementDraft['metadata'] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const metadata: DocumentRequirementDraft['metadata'] = {}
  for (const key of ['source', 'idempotencyKey', 'notes'] as const) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) {
      metadata[key] = value.trim()
    }
  }
  return metadata
}

function sortDefinitions(
  definitions: readonly DocumentTypeDefinition[],
): DocumentTypeDefinition[] {
  return definitions.slice().sort((a, b) => a.key.localeCompare(b.key))
}

export function selectDocumentsByCategory(
  category: DocumentCategoryKeyCanonical | string,
): DocumentTypeDefinition[] {
  if (!getDocumentCategory(category)) return []
  return sortDefinitions(
    listDocumentTypeDefinitions().filter((definition) => definition.category === category),
  )
}

export function selectDocumentsByModule(moduleKey: string): DocumentTypeDefinition[] {
  return sortDefinitions(
    listDocumentTypeDefinitions().filter(
      (definition) =>
        definition.moduleKey === moduleKey ||
        (definition.alsoUsedByModules ?? []).includes(moduleKey),
    ),
  )
}

export function selectDocumentsByCaseType(caseType: string): DocumentTypeDefinition[] {
  return sortDefinitions(
    listDocumentTypeDefinitions().filter(
      (definition) =>
        definition.caseType === caseType ||
        (definition.alsoUsedByCaseTypes ?? []).includes(caseType),
    ),
  )
}

export function selectDocumentByKey(
  key: DocumentTypeKey,
): DocumentTypeDefinition | undefined {
  return getDocumentTypeDefinition(key)
}

export function selectVersionableDocuments(): DocumentTypeDefinition[] {
  return sortDefinitions(
    listDocumentTypeDefinitions().filter((definition) => definition.version.versionable),
  )
}

/**
 * Document types whose primary module is currently feature-enabled.
 * Disabled product modules are excluded unless callers use unfiltered selectors.
 */
export function selectDocumentsForEnabledModules(): DocumentTypeDefinition[] {
  const enabled = new Set(listEnabledModules().map((module) => module.key))
  return sortDefinitions(
    listDocumentTypeDefinitions().filter((definition) => enabled.has(definition.moduleKey)),
  )
}

export function selectDocumentCategorySummary(): Array<{
  category: DocumentCategoryKeyCanonical
  label: string
  documentCount: number
}> {
  return listDocumentCategories().map((category) => ({
    category: category.key,
    label: category.label,
    documentCount: selectDocumentsByCategory(category.key).length,
  }))
}

export function validateCreateDocumentRequirementDraftInput(
  input: CreateDocumentRequirementDraftInput,
): { ok: true } | { ok: false; error: string } {
  const definition = getDocumentTypeDefinition(input.documentTypeKey)
  if (!definition) {
    return { ok: false, error: 'Unknown documentTypeKey' }
  }
  const moduleKey = input.moduleKey ?? definition.moduleKey
  if (!getModule(moduleKey)) {
    return { ok: false, error: 'moduleKey is not registered' }
  }
  if (input.caseDraftId != null && input.caseDraftId !== '' && !isUuid(input.caseDraftId)) {
    return { ok: false, error: 'caseDraftId must be a valid UUID when provided' }
  }
  if (input.id != null && input.id !== '' && !isUuid(input.id)) {
    return { ok: false, error: 'id must be a valid UUID when provided' }
  }
  return { ok: true }
}

/**
 * Build an in-memory document requirement draft.
 * Does not upload, store, or persist a document.
 */
export function createDocumentRequirementDraft(
  input: CreateDocumentRequirementDraftInput,
): DocumentRequirementDraft {
  const validation = validateCreateDocumentRequirementDraftInput(input)
  if (!validation.ok) {
    throw new Error(`Document Engine: ${validation.error}`)
  }

  const definition = requireDocumentTypeDefinition(input.documentTypeKey)
  const openedAt = input.openedAt ?? new Date().toISOString()

  return {
    id: input.id ?? createDraftDocumentId(),
    documentTypeKey: definition.key,
    moduleKey: input.moduleKey ?? definition.moduleKey,
    caseType: input.caseType ?? definition.caseType ?? null,
    caseDraftId: input.caseDraftId ?? null,
    required: definition.required,
    status: input.status ?? 'requested',
    metadata: normalizeMetadata(input.metadata),
    openedAt,
    isDraft: true,
  }
}
