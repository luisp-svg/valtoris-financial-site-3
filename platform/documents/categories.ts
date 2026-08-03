/**
 * Document category taxonomy — metadata only.
 */

import type { DocumentCategoryDefinition, DocumentCategoryKeyCanonical } from './types'

export const DOCUMENT_CATEGORIES: readonly DocumentCategoryDefinition[] = [
  {
    key: 'identity',
    label: 'Identity',
    description:
      'Identity document types commonly used in verification workflows (taxonomy only — not verified identity).',
    order: 10,
  },
  {
    key: 'financial',
    label: 'Financial',
    description: 'Personal financial statements and income evidence.',
    order: 20,
  },
  {
    key: 'insurance',
    label: 'Insurance',
    description: 'Insurance applications, illustrations, and policy docs.',
    order: 30,
  },
  {
    key: 'legal',
    label: 'Legal',
    description: 'Legal instruments such as wills, trusts, and agreements.',
    order: 40,
  },
  {
    key: 'tax',
    label: 'Tax',
    description: 'Tax returns and tax-planning artifacts.',
    order: 50,
  },
  {
    key: 'business',
    label: 'Business',
    description: 'Business formation and operating documents.',
    order: 60,
  },
  {
    key: 'medical',
    label: 'Medical',
    description:
      'Sensitive medical / underwriting category reserved for future types (taxonomy only — no seed PII).',
    order: 70,
  },
  {
    key: 'property',
    label: 'Property',
    description: 'Property ownership and related evidence.',
    order: 80,
  },
  {
    key: 'credit',
    label: 'Credit',
    description: 'Credit reports, authorizations, and dispute artifacts.',
    order: 90,
  },
  {
    key: 'compliance',
    label: 'Compliance',
    description:
      'Documents commonly associated with compliance workflows (taxonomy only — not a compliance determination).',
    order: 100,
  },
  {
    key: 'advisor_generated',
    label: 'Advisor Generated',
    description: 'Documents produced by advisors or the platform.',
    order: 110,
  },
  {
    key: 'client_generated',
    label: 'Client Generated',
    description: 'Documents provided by the client / household.',
    order: 120,
  },
] as const

const BY_KEY = new Map(DOCUMENT_CATEGORIES.map((item) => [item.key, item]))

export function listDocumentCategories(): DocumentCategoryDefinition[] {
  return DOCUMENT_CATEGORIES.slice().sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return a.key.localeCompare(b.key)
  })
}

export function listDocumentCategoryKeys(): DocumentCategoryKeyCanonical[] {
  return listDocumentCategories().map((item) => item.key)
}

export function getDocumentCategory(
  key: string,
): DocumentCategoryDefinition | undefined {
  return BY_KEY.get(key as DocumentCategoryKeyCanonical)
}

export function isKnownDocumentCategory(key: string): boolean {
  return BY_KEY.has(key as DocumentCategoryKeyCanonical)
}
