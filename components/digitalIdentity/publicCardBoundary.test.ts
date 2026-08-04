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
      downloadsQr: true,
      opensConnectForm: false,
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
})
