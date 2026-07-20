import { updateCrmSession } from './lib/supabase/middleware'

export const config = {
  matcher: ['/crm', '/crm/:path*'],
}

/**
 * Vercel Edge Middleware — server-side Supabase session gate for CRM routes.
 * Uses getUser() (Auth server validation), not getSession() alone.
 */
export default async function middleware(request: Request) {
  return updateCrmSession(request)
}
