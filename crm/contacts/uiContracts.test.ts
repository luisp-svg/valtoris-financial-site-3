import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROUTES, crmContactNewPath, crmContactPath } from '../../constants/routes'
import { getCrmSidebarNavItems } from '../../platform/registry'

const ROOT = join(import.meta.dirname, '../..')

function countApiHandlers(root: string): number {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(ts|js)$/.test(name) && !name.endsWith('.d.ts') && !name.includes('.test.')) {
        out.push(full)
      }
    }
  }
  walk(join(root, 'api'))
  return out.filter((p) => !p.split('/').some((seg) => seg.startsWith('_'))).length
}

describe('Contacts routes and navigation', () => {
  it('registers authenticated CRM contact routes and nav', () => {
    expect(ROUTES.crmContacts).toBe('/crm/contacts')
    expect(crmContactNewPath()).toBe('/crm/contacts/new')
    expect(crmContactPath('lead-1')).toBe('/crm/contacts/lead-1')
    const nav = getCrmSidebarNavItems()
    const contacts = nav.find((item) => item.path === '/crm/contacts')
    expect(contacts?.label).toBe('Contacts')
    const intakeIdx = nav.findIndex((item) => item.path === '/crm/intake')
    const contactsIdx = nav.findIndex((item) => item.path === '/crm/contacts')
    const campaignsIdx = nav.findIndex((item) => item.path === '/crm/campaigns')
    expect(contactsIdx).toBeGreaterThan(intakeIdx)
    expect(contactsIdx).toBeLessThan(campaignsIdx)
  })

  it('wires App routes under CrmProtectedGate and keeps function count at 10', () => {
    const app = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8')
    expect(app).toMatch(/path="contacts"/)
    expect(app).toMatch(/path="contacts\/new"/)
    expect(app).toMatch(/path="contacts\/:leadId"/)
    expect(app.indexOf('CrmProtectedGate')).toBeLessThan(app.indexOf('contacts'))
    expect(countApiHandlers(ROOT)).toBe(10)
  })
})

describe('duplicate modal / accessibility / mobile contracts', () => {
  it('restricted collision copy has no PII or Open existing', () => {
    const modal = readFileSync(join(ROOT, 'crm/contacts/DuplicateCollisionModal.tsx'), 'utf8')
    expect(modal).toMatch(
      /A possible existing contact was found\.\s*Contact an owner or create a separate record if\s*appropriate\./,
    )
    expect(modal).toContain('Open existing')
    expect(modal).toContain('visibility === \'accessible\'')
    expect(modal).toContain('aria-modal')
    expect(modal).toContain('role="dialog"')
  })

  it('Quick Add focuses first name and exposes field labels', () => {
    const form = readFileSync(join(ROOT, 'crm/contacts/QuickAddContactForm.tsx'), 'utf8')
    expect(form).toContain('firstNameRef.current?.focus()')
    expect(form).toContain('<span>First name</span>')
    expect(form).toContain('Save &amp; Add Another')
    expect(form).not.toContain('localStorage')
    expect(form).not.toContain('sessionStorage')
    expect(form).not.toContain('consentedAt')
    expect(form).not.toContain('console.log')
  })

  it('CSS includes mobile-responsive contacts layout helpers', () => {
    const css = readFileSync(join(ROOT, 'src/styles.css'), 'utf8')
    expect(css).toContain('.crm-contacts-filters')
    expect(css).toContain('.crm-contacts-table-wrap')
    expect(css).toContain('@media (max-width: 767px)')
  })
})

describe('security surface for Contacts SPA', () => {
  it('does not import service-role/admin clients in contacts UI modules', () => {
    const files = [
      'contactsApi.ts',
      'QuickAddContactForm.tsx',
      'ContactEditForm.tsx',
      'DuplicateCollisionModal.tsx',
      'payload.ts',
    ]
    for (const file of files) {
      const src = readFileSync(join(ROOT, 'crm/contacts', file), 'utf8')
      expect(src).not.toMatch(/service_role|createSupabaseAdmin|SUPABASE_SERVICE_ROLE/i)
      expect(src).not.toMatch(/from\('activities'\)\.insert|\.from\("activities"\)\.insert/)
    }
  })

  it('does not add Activity/assessment/Case/workflow messaging in Contacts pages', () => {
    for (const file of [
      'pages/crm/CrmContactsPage.tsx',
      'pages/crm/CrmContactNewPage.tsx',
      'pages/crm/CrmContactDetailPage.tsx',
    ]) {
      const src = readFileSync(join(ROOT, file), 'utf8')
      expect(src).not.toMatch(/createActivity|sendMessage|ocr|openai/i)
      expect(src).not.toMatch(/from\('activities'\)\.insert/)
    }
  })
})
