import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../constants/routes'

const here = dirname(fileURLToPath(import.meta.url))
const header = readFileSync(join(here, 'SiteHeader.tsx'), 'utf8')
const footer = readFileSync(join(here, 'SiteFooter.tsx'), 'utf8')
const app = readFileSync(join(here, '../src/App.tsx'), 'utf8')
const middleware = readFileSync(join(here, '../lib/supabase/middleware.ts'), 'utf8')
const routes = readFileSync(join(here, '../constants/routes.ts'), 'utf8')
const home = readFileSync(join(here, '../pages/HomePage.tsx'), 'utf8')

describe('Phase B.5 public Advisor Login contracts', () => {
  it('adds Advisor Login in desktop and wrapping mobile nav to /crm/login', () => {
    expect(ROUTES.crmLogin).toBe('/crm/login')
    expect(header).toContain('Advisor Login')
    expect(header).toContain('ROUTES.crmLogin')
    expect(header).toContain('nav-advisor-login')
    expect(header).toContain('aria-label="Primary"')
    expect(footer).toContain('Advisor Login')
    expect(footer).toContain('ROUTES.crmLogin')
  })

  it('does not create an alternate auth route or put CRM data in public navigation', () => {
    expect(header).not.toContain('fetchHouseholdNotes')
    expect(header).not.toContain('display_name')
    expect(footer).not.toContain('fetchHouseholdNotes')
    expect(app).toContain('path="login" element={<CrmLoginPage />}')
    expect(app).not.toContain('path="advisor-login"')
    expect(routes).toContain("crmLogin: '/crm/login'")
    expect(routes).toContain("crmAuthRecovery: '/crm/auth/recovery'")
    expect(middleware).toContain("pathname === '/crm/login'")
    expect(middleware).toContain("new URL('/crm', url.origin)")
  })

  it('keeps consumer CTAs on the public home page', () => {
    expect(home).toContain('platform-btn-primary')
    expect(home).toContain('Family Financial Report Card™')
    expect(header).toContain('Family Report Card™')
    expect(header).toContain('Solutions')
  })
})
