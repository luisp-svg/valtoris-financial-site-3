/** CRM routes that must remain reachable without an established session cookie. */
export const CRM_PUBLIC_AUTH_PATHS = ['/crm/login', '/crm/auth/recovery'] as const

export function isPublicCrmAuthPath(pathname: string): boolean {
  return (CRM_PUBLIC_AUTH_PATHS as readonly string[]).includes(pathname)
}
