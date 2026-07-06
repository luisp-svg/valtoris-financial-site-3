import type { VercelRequest, VercelResponse } from '@vercel/node'

/** @deprecated Lead capture uses client-side submitLeadToGoogleSheets() instead. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL
  const payload = {
    submittedAt: new Date().toISOString(),
    ...req.body
  }

  if (!webhookUrl) {
    return res.status(503).json({ ok: false, error: 'Webhook not configured', stored: false })
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    return res.status(502).json({ ok: false, error: 'Webhook request failed' })
  }

  return res.status(200).json({ ok: true })
}
