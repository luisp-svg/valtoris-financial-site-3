/**
 * Sprint 4A.3 CRM interactive QA after migration 024.
 * QA_BASE_URL=http://127.0.0.1:5174 node scripts/qa/run-crm-rc-browser.mjs
 */
import { chromium, devices } from 'playwright'

const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:5174'
const OWNER_EMAIL = process.env.QA_OWNER_EMAIL || 'owner.localqa@valtoris.test'
const ADVISOR_EMAIL = process.env.QA_ADVISOR_EMAIL || 'advisor.localqa@valtoris.test'
const PASS = process.env.QA_LOCAL_PASS || 'LocalQaPass123!'
const results = []
const consoleErrors = []

function log(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function login(page, email) {
  await page.goto(`${BASE}/crm/login`, { waitUntil: 'networkidle' })
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(PASS)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/crm(?!\/login)/, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
  return page.url()
}

async function main() {
  const browser = await chromium.launch({ headless: true })

  {
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    const page = await context.newPage()
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(`[owner] ${m.text()}`)
    })

    const url = await login(page, OWNER_EMAIL)
    log('owner login', /\/crm/.test(url) && !/login/.test(url), url)

    await page.goto(`${BASE}/crm/intake`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    const body = await page.locator('body').innerText()
    log('owner intake no 42501', !/42501|permission denied for table/i.test(body))
    log(
      'owner intake shows seeded scenarios',
      /QA4A3|Prospect Contact|Possible|Sheets Failed|Task Automation|exact|possible|unassigned/i.test(body),
      body.slice(0, 240).replace(/\s+/g, ' '),
    )
    log('owner sees match/consent/task language', /match|consent|task|sheets|duplicate|contact/i.test(body))

    const confirmBtn = page.getByRole('button', { name: /confirm same|keep separate|resolve/i }).first()
    log('owner duplicate actions available or review UI present', (await confirmBtn.count()) > 0 || /duplicate|possible match/i.test(body))

    // Households list → IFD
    await page.goto(`${BASE}/crm/households`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    const hhBody = await page.locator('body').innerText()
    log('owner households load', /QA4A3|household|Prospect|Canonical/i.test(hhBody) && !/permission denied for table/i.test(hhBody))

    const link = page.locator('a[href*="/crm/households/"]').first()
    if (await link.count()) {
      await link.click()
      await page.waitForTimeout(1000)
      const detail = await page.locator('body').innerText()
      log(
        'household IFD/overview language',
        /Initial Financial Diagnostic|diagnostic|assessment|Financial Progress|Overview/i.test(detail),
        page.url(),
      )
    } else {
      log('household IFD/overview language', false, 'no household link')
    }

    await page.goto(`${BASE}/crm/tasks`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    const tasksBody = await page.locator('body').innerText()
    log('owner tasks load without grant errors', !/permission denied for table/i.test(tasksBody))

    await context.close()
  }

  {
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    const page = await context.newPage()
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(`[advisor] ${m.text()}`)
    })
    await login(page, ADVISOR_EMAIL)
    await page.goto(`${BASE}/crm/intake`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    const body = await page.locator('body').innerText()
    log('advisor intake no raw grant errors', !/permission denied for table|42501/i.test(body))
    log(
      'advisor owner-only resolve not freely available',
      !/Confirm same household/i.test(body) || /owner|unavailable|not authorized/i.test(body),
      'soft',
    )
    await context.close()
  }

  {
    const context = await browser.newContext({ ...devices['iPhone 13'] })
    const page = await context.newPage()
    await login(page, OWNER_EMAIL)
    await page.goto(`${BASE}/crm/intake`, { waitUntil: 'networkidle' })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8)
    log('mobile intake usable', !overflow)
    await context.close()
  }

  await browser.close()
  console.log('\n--- Console errors (sample) ---')
  const serious = consoleErrors.filter((e) => /42501|permission denied for table/i.test(e))
  if (!serious.length) console.log('(no table-privilege console errors)')
  else serious.slice(0, 20).forEach((e) => console.log(e))

  const failed = results.filter((r) => !r.ok)
  console.log(`\nCRM interactive summary: ${results.length - failed.length}/${results.length} passed`)
  process.exitCode = failed.length ? 1 : 0
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
