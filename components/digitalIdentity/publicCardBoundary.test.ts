import { describe, expect, it } from 'vitest'
import * as digitalIdentityModule from '../../modules/digital-identity'
import {
  ROUTES,
  publicCardKeyPath,
  publicCardSlugPath,
} from '../../constants/routes'
import * as fetchMod from './fetchPublicCard'
import * as viewModel from './publicCardViewModel'

describe('public card browser/server boundary', () => {
  it('does not expose admin lookup or service-role helpers to the UI layer', () => {
    expect(digitalIdentityModule).not.toHaveProperty('lookupPublishedCard')
    expect(digitalIdentityModule).not.toHaveProperty('createSupabaseAdminClient')
    expect(fetchMod).not.toHaveProperty('lookupPublishedCard')
    expect(fetchMod).not.toHaveProperty('createSupabaseAdminClient')
    expect(viewModel).not.toHaveProperty('lookupPublishedCard')
    expect(viewModel.publicCardPageSideEffects().importsAdminClient).toBe(false)
  })

  it('declares no analytics or CRM side effects from fetch or page helpers', () => {
    expect(fetchMod.publicCardFetchSideEffects()).toEqual({
      writesAnalytics: false,
      createsLead: false,
      createsHousehold: false,
      createsTask: false,
      createsActivity: false,
      createsCase: false,
    })
    expect(viewModel.publicCardPageSideEffects()).toMatchObject({
      writesAnalytics: false,
      writesDigitalCardEvents: false,
      createsLead: false,
      createsHousehold: false,
      createsActivity: false,
      downloadsVCard: true,
      downloadsQr: false,
      opensConnectForm: true,
      sharesCard: true,
    })
  })

  it('keeps durable key and slug public routes distinct and ordered safely', () => {
    expect(ROUTES.publicCardByKey).toBe('/c/k/:key')
    expect(ROUTES.publicCardBySlug).toBe('/c/:slug')
    expect(publicCardKeyPath('pk_live_abcdefghijklmnop')).toBe(
      '/c/k/pk_live_abcdefghijklmnop',
    )
    expect(publicCardSlugPath('jane-advisor')).toBe('/c/jane-advisor')
    expect(digitalIdentityModule.buildPublicCardPath('pk_live_abcdefghijklmnop')).toBe(
      '/c/k/pk_live_abcdefghijklmnop',
    )
    expect(digitalIdentityModule.buildPublicCardSlugPath('jane-advisor')).toBe(
      '/c/jane-advisor',
    )
  })

  it('does not import service-role helpers in public card or CRM card modules', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const files = [
      'components/digitalIdentity/PublicAdvisorCardView.tsx',
      'components/digitalIdentity/sharePublicCard.ts',
      'pages/PublicAdvisorCardPage.tsx',
      'crm/digital-identity/cardsApi.ts',
      'crm/digital-identity/AdvisorDigitalCardPanel.tsx',
      'modules/digital-identity/publicDesignation.ts',
      'pages/crm/CrmCampaignsPage.tsx',
    ]
    for (const file of files) {
      const src = readFileSync(join(process.cwd(), file), 'utf8')
      expect(src).not.toMatch(/createSupabaseAdminClient|SUPABASE_SERVICE_ROLE|service_role/)
    }
    const view = readFileSync(
      join(process.cwd(), 'components/digitalIdentity/PublicAdvisorCardView.tsx'),
      'utf8',
    )
    expect(view).not.toMatch(/luis-perez\.png|\/images\/advisors\//)
  })

  it('locks branded public-card classes and the four-tile How I Can Help presentation', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const view = readFileSync(
      join(process.cwd(), 'components/digitalIdentity/PublicAdvisorCardView.tsx'),
      'utf8',
    )
    const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8')
    const constants = readFileSync(
      join(process.cwd(), 'modules/digital-identity/constants.ts'),
      'utf8',
    )
    const page = readFileSync(join(process.cwd(), 'pages/PublicAdvisorCardPage.tsx'), 'utf8')
    const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8')

    expect(app).toMatch(/path=\{ROUTES\.publicCardByKey\} element=\{<PublicAdvisorCardPage/)
    expect(page).toMatch(/from '\.\.\/components\/digitalIdentity\/PublicAdvisorCardView'/)
    expect(view).toMatch(/public-card-hero-brand/)
    expect(view).toMatch(/public-card-btn--call/)
    expect(view).toMatch(/public-card-btn--text/)
    expect(view).toMatch(/public-card-btn--light/)
    expect(view).toMatch(/public-card-btn--connect/)
    expect(view).toMatch(/public-card-btn--share/)
    expect(view).toMatch(/selectPublicCardHelpTiles/)
    expect(view).toMatch(/public-card-btn--book/)
    expect(view).toMatch(/Connect With Me/)
    expect(view).toMatch(/VALTORIS_PUBLIC_TAGLINE/)
    expect(constants).toMatch(/Strategy Today\. Security Tomorrow/)
    expect(css).toMatch(/\.public-card-tagline\s*\{/)
    expect(view).not.toMatch(/Download QR/)
    expect(view).not.toMatch(/Tools & Diagnostics/)
    expect(view).not.toMatch(/Build Business Wealth|Improve Credit|Build Business Credit/)

    expect(css).toMatch(/\.public-card-hero-brand\s*\{/)
    expect(css).toMatch(/\.public-card-btn--call\s*\{/)
    expect(css).toMatch(/\.public-card-btn--text\s*\{/)
    expect(css).toMatch(/\.public-card-btn--connect\s*\{/)
    expect(css).toMatch(/\.public-card-btn--share\s*\{/)
    expect(css).toMatch(/\.public-card-btn--share:focus-visible/)
    expect(css).toMatch(/\.public-card-headshot\s*\{[\s\S]*?border:\s*4px solid var\(--gold\)/)
    expect(css).toMatch(/\.public-card-hero\s*\{[\s\S]*?overflow:\s*visible/)
    expect(css).not.toMatch(/\.public-card-hero\s*\{[^}]*overflow:\s*hidden/)
    expect(css).not.toMatch(/\.public-card-hero-brand\s*\{[^}]*position:\s*relative/)
    expect(css).toMatch(/\.public-card-headshot-wrap\s*\{/)
    expect(css).toMatch(/margin-top:\s*calc\(var\(--public-card-headshot\) \* -0\.4\)/)
    expect(css).toMatch(
      /padding-bottom:\s*calc\(var\(--public-card-headshot\) \* 0\.4 \+ 32px\)/,
    )
    expect(css).toMatch(/\.public-card-hero-brand\s*\{[\s\S]*?justify-content:\s*flex-start/)
    expect(css).not.toMatch(/@media \(min-width: 720px\)[\s\S]*?\.public-card-hero-brand\s*\{[^}]*padding:/)
    expect(css).not.toMatch(/@media \(max-width: 430px\)[\s\S]*?\.public-card-hero-brand\s*\{[^}]*padding:/)
    expect(view).toMatch(/public-card-headshot-wrap/)
  })

  it('keeps the Let’s Connect modal from overflowing on narrow viewports', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8')
    const modal = readFileSync(
      join(process.cwd(), 'components/digitalIdentity/LetsConnectModal.tsx'),
      'utf8',
    )

    expect(modal).toMatch(/<fieldset className="public-card-connect-fieldset"/)
    expect(modal).toMatch(/<legend>\{copy\.reasonLabel\}<\/legend>/)
    expect(modal).toMatch(/<legend>Consent<\/legend>/)
    expect(modal).toMatch(/type="radio"/)
    expect(modal).toMatch(/type="checkbox"/)
    expect(modal).toMatch(/className="public-card-connect-reason"/)
    expect(modal).toMatch(/className="public-card-connect-check"/)

    expect(css).toMatch(/\.public-card-connect-sheet\s*\{[\s\S]*?overflow-x:\s*hidden/)
    expect(css).toMatch(/\.public-card-connect-sheet\s*\{[\s\S]*?overflow-y:\s*auto/)
    expect(css).toMatch(/\.public-card-connect-sheet\s*\{[\s\S]*?width:\s*min\(100%, 560px\)/)
    expect(css).toMatch(/\.public-card-connect-form\s*\{[\s\S]*?padding:\s*0/)
    expect(css).toMatch(/\.public-card-connect-fieldset\s*\{[\s\S]*?min-width:\s*0/)
    expect(css).toMatch(/\.public-card-connect-fieldset\s*\{[\s\S]*?min-inline-size:\s*0/)
    expect(css).toMatch(
      /\.public-card-connect-reason input\[type='radio'\][\s\S]*?width:\s*auto/,
    )
    expect(css).toMatch(
      /\.public-card-connect-check input\[type='checkbox'\][\s\S]*?width:\s*auto/,
    )
    expect(css).toMatch(/\.public-card-connect-reason span[\s\S]*?overflow-wrap:\s*break-word/)
    expect(css).toMatch(
      /\.public-card-connect-field-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/,
    )
    expect(css).not.toMatch(/\.public-card-connect-honeypot\s*\{[^}]*left:\s*-10000px/)
  })
})
