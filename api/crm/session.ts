import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSupabaseServerClient } from '../../lib/supabase/server'

/**
 * GET /api/crm/session
 * Server-side session check for CRM (cookie + Supabase Auth getUser).
 * Never returns or uses the service-role key.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
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
