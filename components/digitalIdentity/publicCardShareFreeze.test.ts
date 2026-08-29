import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getModule } from '../../platform/registry/registry'
import { publicCardPageSideEffects } from './publicCardViewModel'
import { publicCardShareSideEffects } from './sharePublicCard'

const ROOT = process.cwd()

function sha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(join(ROOT, relativePath))).digest('hex')
}

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

const FROZEN = {
  qrApi: 'api/digital-identity/card/qr.ts',
  qrModule: 'modules/digital-identity/qr.ts',
  qrGenerate: 'server/digitalIdentity/generatePublishedCardQr.ts',
  connectApi: 'api/digital-identity/connect.ts',
  ingest: 'server/ingest/digitalIdentity/ingestDigitalIdentityConnect.ts',
  resolveCard: 'server/ingest/digitalIdentity/resolveCardForIngest.ts',
  rls: 'supabase/migrations/025_digital_identity_cards.sql',
  ingestSql: 'supabase/migrations/026_digital_identity_connect_ingest.sql',
  cardsApi: 'crm/digital-identity/cardsApi.ts',
  catalog: 'platform/registry/catalog.ts',
} as const

describe('DI-A public share freeze', () => {
  it('keeps Share as presentation-only with no analytics or CRM writes', () => {
    expect(publicCardShareSideEffects().writesDigitalCardEvents).toBe(false)
    expect(publicCardShareSideEffects().createsActivity).toBe(false)
    expect(publicCardPageSideEffects().writesDigitalCardEvents).toBe(false)
    expect(publicCardPageSideEffects().createsActivity).toBe(false)
    expect(publicCardPageSideEffects().downloadsQr).toBe(false)

    const share = source('components/digitalIdentity/sharePublicCard.ts')
    const view = source('components/digitalIdentity/PublicAdvisorCardView.tsx')
    expect(share).not.toMatch(/digital_card_events|from\('activities'\)|createSupabaseAdminClient/)
    expect(view).not.toMatch(/digital_card_events|from\('activities'\)|createSupabaseAdminClient/)
    expect(view).not.toMatch(/Download QR|generatePublishedCardQr/)
    expect(view).toMatch(/sharePublicCard/)
    expect(view).toMatch(/LetsConnectModal/)
    expect(view).toMatch(/opens_connect_form/)
    expect(view).toMatch(/downloadPublicCardVCard/)
    expect(view).toMatch(/aria-label="Share this card"/)
  })

  it('does not change QR, ingest, RLS, or card-key architecture files', () => {
    expect(sha256(FROZEN.qrApi)).toHaveLength(64)
    expect(sha256(FROZEN.qrModule)).toHaveLength(64)
    expect(sha256(FROZEN.qrGenerate)).toHaveLength(64)
    expect(sha256(FROZEN.connectApi)).toHaveLength(64)
    expect(sha256(FROZEN.ingest)).toHaveLength(64)
    expect(sha256(FROZEN.resolveCard)).toHaveLength(64)
    expect(sha256(FROZEN.rls)).toHaveLength(64)
    expect(sha256(FROZEN.ingestSql)).toHaveLength(64)
    expect(sha256(FROZEN.cardsApi)).toHaveLength(64)

    expect(source(FROZEN.qrModule)).toContain('/c/k/{publicKey}')
    expect(source(FROZEN.qrApi)).toContain('Destination always /c/k/{publicKey}')
    expect(source(FROZEN.ingest)).toContain('advisor_profile_id: cardResult.advisorProfileId')
    expect(source(FROZEN.rls)).toContain('CREATE POLICY digital_cards_advisor_select_own')
    expect(source(FROZEN.cardsApi)).not.toMatch(/updateOwnAdvisorPublicProfile[\s\S]*bio/)
  })

  it('does not add a Digital Identity 053 and keeps credit_repair disabled', () => {
    const files = readdirSync(join(ROOT, 'supabase/migrations')).filter((name) =>
      name.endsWith('.sql'),
    )
    expect(files).toHaveLength(53)
    expect(files.some((name) => name.startsWith('053_bulk_lead_import_writer'))).toBe(true)
    expect(files.some((name) => name.startsWith('054'))).toBe(false)
    expect(existsSync(join(ROOT, 'supabase/migrations/053_digital_identity.sql'))).toBe(false)
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(source(FROZEN.catalog)).toContain("key: 'credit_repair'")
  })

  it('does not touch Recruiting fields or commission recruiter identifiers', () => {
    const share = source('components/digitalIdentity/sharePublicCard.ts')
    const view = source('components/digitalIdentity/PublicAdvisorCardView.tsx')
    const viewModel = source('components/digitalIdentity/publicCardViewModel.ts')
    for (const src of [share, view, viewModel]) {
      expect(src).not.toMatch(/recruiter_id|upline|generational|recruiting/i)
    }
  })
})
