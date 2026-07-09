import { GOOGLE_SHEETS_CALCULATOR_WEBHOOK_URL } from '../constants/urls'

export type LeadType = 'Protection Gap' | 'Family Report Card' | 'Business Report Card'

export type LeadPayloadValue = string | number | boolean | null | undefined

export type LeadSubmissionPayload = Record<string, LeadPayloadValue>

export async function submitLeadToGoogleSheets(
  leadType: LeadType,
  payload: LeadSubmissionPayload,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const webhookUrl = GOOGLE_SHEETS_CALCULATOR_WEBHOOK_URL
  const body: LeadSubmissionPayload = {
    leadType,
    timestamp: new Date().toISOString(),
    ...payload,
  }

  const webhookPresent = Boolean(webhookUrl.trim())

  if (!webhookPresent) {
    const error = new Error('Webhook URL not configured')
    console.error('Google Sheets submission failed:', error)
    return { ok: false, error }
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    })

    const responseText = await response.text()

    if (!response.ok) {
      const error = new Error(`Webhook responded with ${response.status}: ${responseText}`)
      console.error('Google Sheets submission failed:', error)
      return { ok: false, error }
    }

    return { ok: true }
  } catch (error) {
    console.error('Google Sheets submission failed:', error)
    return { ok: false, error }
  }
}

export function getSourcePage(): string {
  if (typeof window === 'undefined') return ''
  return window.location.pathname
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  if (!trimmed) return { firstName: '', lastName: '' }

  const spaceIndex = trimmed.indexOf(' ')
  if (spaceIndex === -1) return { firstName: trimmed, lastName: '' }

  return {
    firstName: trimmed.slice(0, spaceIndex),
    lastName: trimmed.slice(spaceIndex + 1).trim(),
  }
}
