import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { next } from '@vercel/edge'
import { isPublicCrmAuthPath } from './crmPublicAuthPaths'
import { getServerSupabaseAnonKey, getServerSupabaseUrl } from './env'

/**
 * Edge middleware helper: refresh/validate CRM session cookies via getUser().
 * Redirects unauthenticated users away from protected /crm routes.
 * Public auth routes (/crm/login, /crm/auth/recovery) stay reachable so the
 * browser can consume invite/recovery hash or PKCE query state.
 */
export async function updateCrmSession(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const pathname = url.pathname
  const isPublicAuth = isPublicCrmAuthPath(pathname)
  const isCrm = pathname === '/crm' || pathname.startsWith('/crm/')

  if (!isCrm) {
    return next()
  }

  const supabaseUrl = getServerSupabaseUrl()
  const anonKey = getServerSupabaseAnonKey()

  // If env is missing at the edge, let the SPA show a clear config error.
  if (!supabaseUrl || !anonKey) {
    return next()
  }

  let response = next()

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('cookie') ?? '')
      },
      setAll(cookiesToSet, cacheHeaders) {
        const headers = new Headers(response.headers)
        if (cacheHeaders) {
          for (const [key, value] of Object.entries(cacheHeaders)) {
            headers.set(key, value)
          }
        }

        response = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        })

        for (const { name, value, options } of cookiesToSet) {
          response.headers.append('Set-Cookie', serializeCookieHeader(name, value, options))
        }
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublicAuth) {
    const loginUrl = new URL('/crm/login', url.origin)
    loginUrl.searchParams.set('redirect', pathname)
    return Response.redirect(loginUrl.toString(), 302)
  }

  // Only bounce authenticated users away from the login form — never from recovery.
  if (user && pathname === '/crm/login') {
    return Response.redirect(new URL('/crm', url.origin).toString(), 302)
  }

  return response
}
