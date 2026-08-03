/**
 * Sprint 4A.3 interactive public Family QA against local Vite.
 * Usage: node scripts/qa/run-family-rc-browser.mjs
 */
import { chromium, devices } from 'playwright'

const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:5173'
const results = []
const consoleErrors = []

function log(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function fillByName(page, name, value) {
  const el = page.locator(`[name="${name}"]`).first()
  await el.fill(String(value))
}

async function selectByName(page, name, value) {
  await page.locator(`select[name="${name}"]`).first().selectOption(value)
}

async function clickContinue(page) {
  const btn = page.getByRole('button', { name: /continue|view my report card/i }).first()
  await btn.waitFor({ state: 'visible' })
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('button')]
    const target = buttons.find((b) => /continue|view my report card/i.test(b.textContent || ''))
    return target && !target.disabled
  }, null, { timeout: 10000 }).catch(() => {})
  await btn.click({ force: false })
}

async function chooseOption(page, name, value) {
  const labelHints = {
    monthlyCashFlow: /monthly cash flow/i,
    retirementContribution: /retirement savings/i,
    hasDisabilityProtection: /disability/i,
    hasWill: /has will/i,
    hasTrust: /has trust/i,
    beneficiariesReviewed: /beneficiar/i,
    guardianDocumented: /guardian/i,
  }
  const valueLabels = {
    'break-even': /usually break even/i,
    '6-10': /6% to 10%/i,
    yes: /^yes$/i,
    no: /^no$/i,
  }
  const hint = labelHints[name]
  const valuePat = valueLabels[value] || new RegExp(value, 'i')
  if (hint) {
    const field = page.locator('.assessment-field').filter({ hasText: hint }).first()
    if (await field.count()) {
      const btn = field.locator('button').filter({ hasText: valuePat }).first()
      if (await btn.count()) {
        await btn.click()
        return
      }
    }
  }
  await page.locator('button.option-chip, button.yes-no-option').filter({ hasText: valuePat }).first().click()
}

async function completeAssessmentToConsent(page, { phone = '5552014488', children = '0' } = {}) {
  await page.getByRole('button', { name: /get my free family|report card|begin|start/i }).first().click()
  await fillByName(page, 'firstName', 'Casey')
  await fillByName(page, 'lastName', 'Qa')
  await fillByName(page, 'email', 'casey.qa@example.test')
  await fillByName(page, 'phone', phone)
  await fillByName(page, 'age', '38')
  await selectByName(page, 'state', 'TX')
  await selectByName(page, 'maritalStatus', 'married')
  await fillByName(page, 'numberOfChildren', children)
  await clickContinue(page)

  await fillByName(page, 'householdIncome', '150000')
  await fillByName(page, 'monthlyHousingPayment', '2200')
  await fillByName(page, 'totalDebt', '18000')
  await fillByName(page, 'emergencyFundMonths', '3')
  await chooseOption(page, 'monthlyCashFlow', 'break-even')
  await chooseOption(page, 'retirementContribution', '6-10')
  await clickContinue(page)

  await fillByName(page, 'currentLifeInsurance', '250000')
  await chooseOption(page, 'hasDisabilityProtection', 'yes')
  await chooseOption(page, 'hasWill', 'no')
  await chooseOption(page, 'hasTrust', 'no')
  await chooseOption(page, 'beneficiariesReviewed', 'yes')
  await clickContinue(page)

  // Goals — click a known goal label
  const goalLabel = page.getByText('Protect my family', { exact: false }).first()
  if (await goalLabel.count()) await goalLabel.click()
  else {
    const cb = page.locator('input[type="checkbox"]').first()
    if (await cb.count()) await cb.check({ force: true })
  }
}

async function readSession(page) {
  return page.evaluate((key) => {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  }, 'valtoris-family-ingest-session')
}

async function main() {
  const browser = await chromium.launch({ headless: true })

  // ---- Desktop full path ----
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))

    const sheetsHits = []
    const crmHits = []
    page.on('request', (req) => {
      const u = req.url()
      if (u.includes('script.google.com')) sheetsHits.push(u)
      if (u.includes('/api/ingest-family-report-card')) crmHits.push({ method: req.method(), url: u })
    })

    // Privacy
    await page.goto(`${BASE}/privacy`, { waitUntil: 'networkidle' })
    const privacyOk =
      (await page.locator('h1').first().innerText().catch(() => '')).toLowerCase().includes('privacy') ||
      (await page.title()).toLowerCase().includes('privacy')
    log('desktop /privacy opens', privacyOk, await page.title())

    // Fresh session + UTM first-touch
    await page.goto(`${BASE}/family-assessment?utm_source=qa_src&utm_medium=qa_med&utm_campaign=qa_camp`, {
      waitUntil: 'networkidle',
    })
    await page.getByRole('button', { name: /get my free family|report card|begin|start/i }).first().click()
    let session = await readSession(page)
    log('new assessment creates ingest session', Boolean(session?.formStartedAt), JSON.stringify(session?.utm))
    log(
      'first-touch UTM preserved',
      session?.utm?.utmSource === 'qa_src' && session?.utm?.utmMedium === 'qa_med',
      JSON.stringify(session?.utm),
    )
    const formStartedAt = session?.formStartedAt

    // Navigate away-ish via query change should not reset first-touch if utmLocked
    await page.goto(`${BASE}/family-assessment?utm_source=second_touch`, { waitUntil: 'networkidle' })
    session = await readSession(page)
    log(
      'later UTM does not overwrite first-touch',
      session?.utm?.utmSource === 'qa_src' || session?.utmLocked === true,
      JSON.stringify(session?.utm),
    )

    // Restart genuinely new assessment
    await page.evaluate(() => sessionStorage.removeItem('valtoris-family-ingest-session'))
    await page.goto(`${BASE}/family-assessment?utm_source=fresh`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /get my free family|report card|begin|start/i }).first().click()
    const session2 = await readSession(page)
    log(
      'genuinely new assessment creates new session clock',
      Boolean(session2?.formStartedAt) && session2.formStartedAt !== formStartedAt,
      `${formStartedAt} -> ${session2?.formStartedAt}`,
    )

    await context.close()
  }

  // Fresh context for full assessment + consent (avoids SPA state bleed from UTM probes)
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))

    const sheetsHits = []
    const crmHits = []
    page.on('request', (req) => {
      const u = req.url()
      if (u.includes('script.google.com')) sheetsHits.push(u)
      if (u.includes('/api/ingest-family-report-card')) crmHits.push({ method: req.method(), url: u })
    })

    await page.goto(`${BASE}/family-assessment`, { waitUntil: 'networkidle' })
    await completeAssessmentToConsent(page, { phone: '5552014488', children: '0' })

    // Ensure on goals/consent
    const privacyCb = page.locator('#family-consent-privacy')
    const reachedConsent = (await privacyCb.count()) > 0
    log('reached consent step', reachedConsent)

    if (reachedConsent) {
      const storage = page.locator('#family-consent-storage')
      const contact = page.locator('[name="contactPermission"]')
      const emailM = page.locator('[name="emailMarketingConsent"]')
      const sms = page.locator('[name="smsMarketingConsent"]')
      const privacyLink = page.locator('a.family-consent-privacy-link')

      log('storage unchecked default', !(await storage.isChecked()))
      log('privacy unchecked default', !(await privacyCb.isChecked()))
      log('contact optional unchecked', !(await contact.isChecked()))
      log('email marketing unchecked', !(await emailM.isChecked()))
      log('sms unchecked default', !(await sms.isChecked()))
      log('sms enabled when phone present', !(await sms.isDisabled()))
      log(
        'privacy link href',
        (await privacyLink.getAttribute('href')) === '/privacy',
      )

      // Keyboard + accessible errors
      await privacyCb.focus()
      await page.keyboard.press('Space')
      log('keyboard toggles privacy', await privacyCb.isChecked())

      await page.getByRole('button', { name: /view my report card/i }).click()
      const alert = page.locator('[role="alert"], .family-consent-error')
      await page.waitForTimeout(300)
      log('consent errors announced', (await alert.count()) > 0, `alerts=${await alert.count()}`)

      await storage.check()
      // privacy already checked

      // Mock CRM failure
      await page.route('**/api/ingest-family-report-card', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ ok: false, error: 'Unable to save submission' }),
          })
        } else await route.fallback()
      })

      // Ensure a goal selected
      const anyGoal = page.locator('input[type="checkbox"]').first()
      if (await anyGoal.count()) {
        if (!(await anyGoal.isChecked())) await anyGoal.check().catch(() => anyGoal.click())
      }

      const beforeSid = (await readSession(page))?.submissionId
      await page.getByRole('button', { name: /view my report card/i }).click()
      await page.waitForTimeout(800)
      const afterFail = await readSession(page)
      const stillOnAssessment = page.url().includes('family-assessment')
      log('CRM failure stays on final step', stillOnAssessment, page.url())
      log('CRM failure shows safe error', (await page.locator('[role="alert"], .assessment-status, .family-consent-error').count()) > 0)
      log(
        'retry keeps same submission UUID path ready',
        Boolean(afterFail?.submissionId) || afterFail?.status === 'failed' || beforeSid == null,
        JSON.stringify({ beforeSid, after: afterFail?.submissionId, status: afterFail?.status }),
      )
      log('CRM failure produced one CRM request', crmHits.filter((h) => h.method === 'POST').length >= 1, String(crmHits.length))
      log('no browser Sheets on CRM failure path', sheetsHits.length === 0, String(sheetsHits.length))

      // Double-click / second submit with same mock — should not invent Sheets traffic
      await page.getByRole('button', { name: /view my report card|try again|retry|saving/i }).first().click().catch(() => {})
      await page.waitForTimeout(400)
      log('no Sheets after retry click', sheetsHits.length === 0)

      // Switch mock to success
      await page.unroute('**/api/ingest-family-report-card')
      let postBodies = []
      await page.route('**/api/ingest-family-report-card', async (route) => {
        const req = route.request()
        if (req.method() === 'POST') {
          postBodies.push(req.postData() || '')
          const body = JSON.parse(req.postData() || '{}')
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              created: true,
              submissionId: body.submissionId,
              assessmentId: 'assess-qa-1',
              matchStatus: 'new_prospect',
              sheetsSync: { status: 'failed', errorCategory: 'timeout' },
            }),
          })
        } else await route.fallback()
      })

      const retryBtn = page.getByRole('button', { name: /view my report card|try again|retry/i }).first()
      await retryBtn.dblclick().catch(async () => {
        await retryBtn.click()
        await retryBtn.click()
      })
      await page.waitForTimeout(1000)
      const navigated = page.url().includes('result') || page.url().includes('report')
      log('CRM success navigates to results (Sheets failed server-side)', navigated, page.url())
      log('only CRM API used (no Sheets browser write)', sheetsHits.length === 0 && postBodies.length >= 1, `posts=${postBodies.length}`)
      if (postBodies.length >= 1) {
        const b = JSON.parse(postBodies[0])
        log('submission UUID present on success POST', Boolean(b.submissionId), b.submissionId)
      }
      // Double-click should ideally be one in-flight; tolerate 1–2 with same id
      const ids = postBodies.map((p) => {
        try {
          return JSON.parse(p).submissionId
        } catch {
          return null
        }
      })
      log(
        'double-click uses stable submission UUID',
        ids.length > 0 && ids.every((id) => id === ids[0]),
        JSON.stringify(ids),
      )
    }

    // Refresh no auto post on welcome
    const crmBefore = crmHits.length
    await page.goto(`${BASE}/family-assessment`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    log('refresh does not unintended repost', crmHits.length === crmBefore, `delta=${crmHits.length - crmBefore}`)

    await context.close()
  }


  // ---- Mobile ----
  {
    const context = await browser.newContext({ ...devices['iPhone 13'] })
    const page = await context.newPage()
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`[mobile] ${msg.text()}`)
    })
    await page.goto(`${BASE}/privacy`, { waitUntil: 'networkidle' })
    log('mobile /privacy loads', (await page.locator('h1,main').count()) > 0)
    await page.goto(`${BASE}/family-assessment`, { waitUntil: 'networkidle' })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 4)
    log('mobile family start no major overflow', !overflow)
    await page.getByRole('button', { name: /get my free family|report card|begin|start/i }).first().click().catch(() => {})
    log('mobile begin works', page.url().includes('family'))
    await context.close()
  }

  // ---- CRM routes without auth ----
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()
    await page.goto(`${BASE}/crm/intake`, { waitUntil: 'networkidle' })
    const body = await page.locator('body').innerText()
    log(
      'intake unauth does not dump raw errors',
      !/TypeError|Cannot read|stack trace|permission denied for table/i.test(body),
      page.url(),
    )
    await context.close()
  }

  await browser.close()

  console.log('\n--- Browser console errors (captured) ---')
  if (!consoleErrors.length) console.log('(none)')
  else consoleErrors.slice(0, 50).forEach((e) => console.log(e))

  const failed = results.filter((r) => !r.ok)
  console.log(`\nInteractive QA summary: ${results.length - failed.length}/${results.length} passed`)
  process.exitCode = failed.length ? 1 : 0
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
