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
      createsLead: false,
      createsHousehold: false,
      downloadsVCard: true,
      downloadsQr: false,
      opensConnectForm: true,
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
    expect(css).toMatch(/\.public-card-headshot\s*\{[\s\S]*?border:\s*4px solid var\(--gold\)/)
    expect(css).toMatch(/\.public-card-hero\s*\{[\s\S]*?overflow:\s*visible/)
    expect(css).not.toMatch(/\.public-card-hero\s*\{[^}]*overflow:\s*hidden/)
    expect(css).not.toMatch(/\.public-card-hero-brand\s*\{[^}]*position:\s*relative/)
    expect(css).toMatch(/\.public-card-headshot-wrap\s*\{/)
    expect(css).toMatch(/margin-top:\s*calc\(var\(--public-card-headshot\) \* -0\.4\)/)
    expect(view).toMatch(/public-card-headshot-wrap/)
  })
})
