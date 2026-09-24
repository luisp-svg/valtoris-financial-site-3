import { timingSafeEqual } from 'node:crypto'
import { syncQuoteDelivery } from '../server/agentcrm/insurance/worker.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkRateLimit } from '../server/ingest/familyReportCard/abuse.js'
import { ingestQuote } from '../server/ingest/insuranceQuote/ingest.js'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method === 'GET') {
    const secret = process.env.CRON_SECRET
    const supplied = typeof req.headers.authorization === 'string' ? req.headers.authorization : ''
    const expected = secret ? `Bearer ${secret}` : ''
    const actualBytes = Buffer.from(supplied), expectedBytes = Buffer.from(expected)
    if (!expected || actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return res.status(401).json({ ok: false })
    const started = Date.now()
    let processed = 0
    while (processed < 5 && Date.now() - started < 40000) {
      const outcome = await syncQuoteDelivery()
      if (['idle', 'disabled', 'queue_unavailable'].includes(outcome)) break
      processed++
    }
    return res.status(200).json({ ok: true, processed })
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' }) }
  const origin = req.headers.origin
  try { if (typeof origin !== 'string' || new URL(origin).host !== req.headers.host) return res.status(403).json({ ok: false, error: 'Invalid request origin' }) }
  catch { return res.status(403).json({ ok: false, error: 'Invalid request origin' }) }
  if (!String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) return res.status(415).json({ ok: false, error: 'JSON required' })
  try {
    if (Buffer.byteLength(JSON.stringify(req.body ?? null), 'utf8') > 65000 || Number(req.headers['content-length'] ?? 0) > 65000) return res.status(413).json({ ok: false, error: 'Request too large' })
  } catch { return res.status(400).json({ ok: false, error: 'Invalid request' }) }
  const ip = String(req.headers['x-vercel-forwarded-for'] ?? req.headers['x-real-ip'] ?? req.socket?.remoteAddress ?? 'unknown').split(',')[0].trim()
  if (!checkRateLimit(`quote:${ip}`).allowed) { res.setHeader('Retry-After', '60'); return res.status(429).json({ ok: false, error: 'Please wait one minute and try again.' }) }
  const result = await ingestQuote(req.body)
  return res.status(result.status).json(result.body)
}
