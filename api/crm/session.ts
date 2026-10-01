import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSupabaseServerClient } from '../../lib/supabase/server.js'
import { checkAgentCrmConnection } from '../../server/agentcrm/connectionCheck.js'
import { checkRateLimit } from '../../server/ingest/familyReportCard/abuse.js'

/**
 * GET /api/crm/session
 * Server-side session check for CRM (cookie + Supabase Auth getUser).
 * Optional check=agentcrm performs owner-only, read-only provider diagnostics.
 * Never returns or uses the service-role key.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const check = req.query?.check
  if (check !== undefined && check !== 'agentcrm') {
    return res.status(400).json({ ok: false, error: 'Unknown check' })
  }

  try {
    const supabase = createSupabaseServerClient(req, res)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return res.status(401).json({ ok: false, authenticated: false })
    }

    if (check === 'agentcrm') {
      const { data: profile, error: profileError } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if (profileError || profile?.role !== 'owner') {
        return res.status(403).json({ ok: false, error: 'Owner access required' })
      }
      if (!checkRateLimit(`agentcrm-connection:${user.id}`).allowed) {
        res.setHeader('Retry-After', '60')
        return res.status(429).json({ ok: false, error: 'Please wait one minute and try again.' })
      }
      return res.status(200).json(await checkAgentCrmConnection())
    }

    return res.status(200).json({
      ok: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email ?? null,
      },
    })
  } catch {
    return res.status(500).json({ ok: false, error: 'Session check failed' })
  }
}
