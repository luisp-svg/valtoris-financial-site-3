export type NlgCatalogClassification = 'KEEP' | 'DEACTIVATE' | 'REVIEW'

/**
 * Classification of National Life Group production catalog names.
 * Uses exact names from the live catalog. Does not write catalog rows.
 */
export function classifyNlgProductName(name: string): NlgCatalogClassification {
  const n = name.trim()
  if (n === 'LSW ART & Term 10') return 'KEEP'
  if (n === 'LSW ART & Term 15') return 'KEEP'
  if (n === 'LSW Term 20') return 'KEEP'
  if (n === 'LSW Term 30') return 'KEEP'
  if (n === 'Flexlife II') return 'KEEP'
  if (n === 'IUL Flex II') return 'KEEP'
  if (n === 'Term 15' || n === 'Term 20' || n === 'Term 25' || n === 'Term 30') return 'DEACTIVATE'
  if (n === 'IUL Flex' || n === 'IUL Flex Life') return 'DEACTIVATE'
  if (n === 'IUL - Permanent') return 'DEACTIVATE'
  return 'REVIEW'
}
