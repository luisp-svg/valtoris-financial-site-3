/**
 * Central public designation for Digital Identity cards.
 * Applied at assemble/read time so existing published cards pick up copy
 * without rotating public_key or rewriting digital_cards.
 */

import {
  LEGACY_GENERIC_PUBLIC_DESIGNATIONS,
  VALTORIS_PUBLIC_COMPANY,
  VALTORIS_PUBLIC_DESIGNATION,
} from './constants.js'

const MAX_TITLE = 120
const MAX_COMPANY = 120

function readTrimmed(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

function isLegacyGenericDesignation(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return LEGACY_GENERIC_PUBLIC_DESIGNATIONS.some(
    (legacy) => legacy.toLowerCase() === normalized,
  )
}

/**
 * Public title for the advisor card.
 * Empty or the retired generic "Financial Advisor" → Financial Strategist.
 * Custom titles (e.g. "Managing Partner") are preserved.
 */
export function resolvePublicDesignation(value: unknown): string {
  const trimmed = readTrimmed(value, MAX_TITLE)
  if (!trimmed || isLegacyGenericDesignation(trimmed)) {
    return VALTORIS_PUBLIC_DESIGNATION
  }
  return trimmed
}

/** Public company line; defaults to Valtoris Financial when unset. */
export function resolvePublicCompany(value: unknown): string {
  return readTrimmed(value, MAX_COMPANY) ?? VALTORIS_PUBLIC_COMPANY
}
