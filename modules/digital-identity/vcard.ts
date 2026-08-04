/**
 * Pure vCard 3.0 builders for published advisor card fields.
 * No API routes. No CRM side effects.
 */

import type { VCardBuildInput, VCardBuildResult } from './types'

const CRLF = '\r\n'

/**
 * Escape text values per vCard 3.0 (backslash, semicolon, comma, newlines).
 */
export function escapeVCardText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

/**
 * Sanitize a download filename; always ends with .vcf
 */
export function sanitizeVCardFilename(displayName: string): string {
  const base = displayName
    .normalize('NFKD')
    .replace(/[^\w\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
  const safe = base.length > 0 ? base : 'contact'
  return `Valtoris-${safe}.vcf`
}

function splitDisplayName(input: VCardBuildInput): { family: string; given: string } {
  const given = (input.firstName ?? '').trim()
  const family = (input.lastName ?? '').trim()
  if (given || family) {
    return { family, given }
  }

  const parts = input.displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { family: '', given: '' }
  if (parts.length === 1) return { family: '', given: parts[0] }
  return {
    given: parts[0],
    family: parts.slice(1).join(' '),
  }
}

/**
 * Build a vCard 3.0 document from allowlisted published fields only.
 * Omits address by default. Does not create leads, households, or activities.
 */
export function buildVCard(input: VCardBuildInput): VCardBuildResult {
  const displayName = input.displayName.trim()
  const { family, given } = splitDisplayName(input)
  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCardText(displayName)}`,
    `N:${escapeVCardText(family)};${escapeVCardText(given)};;;`,
  ]

  const org = input.organization?.trim()
  if (org) lines.push(`ORG:${escapeVCardText(org)}`)

  const title = input.title?.trim()
  if (title) lines.push(`TITLE:${escapeVCardText(title)}`)

  const phone = input.phone?.trim()
  if (phone) lines.push(`TEL;TYPE=CELL,VOICE:${escapeVCardText(phone)}`)

  const email = input.email?.trim()
  if (email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${escapeVCardText(email)}`)

  const url = input.url?.trim()
  if (url) lines.push(`URL:${escapeVCardText(url)}`)

  const note = input.note?.trim()
  if (note) lines.push(`NOTE:${escapeVCardText(note)}`)

  const photoUrl = input.photoUrl?.trim()
  if (photoUrl && /^https:\/\//i.test(photoUrl)) {
    // URI photo reference only — never embed private binary blobs here.
    lines.push(`PHOTO;VALUE=URI:${escapeVCardText(photoUrl)}`)
  }

  lines.push('END:VCARD')

  return {
    body: `${lines.join(CRLF)}${CRLF}`,
    filename: sanitizeVCardFilename(displayName || 'contact'),
    createsCrmRecord: false,
  }
}
