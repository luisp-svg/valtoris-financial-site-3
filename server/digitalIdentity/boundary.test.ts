import { describe, expect, it } from 'vitest'
import * as digitalIdentityModule from '../../modules/digital-identity'
import * as serverDigitalIdentity from './index'

describe('Digital Identity browser/server boundary', () => {
  it('keeps admin/service-role lookup off the modules package', () => {
    expect(digitalIdentityModule).not.toHaveProperty('lookupPublishedCard')
    expect(digitalIdentityModule).not.toHaveProperty('lookupPublishedCardByPublicKey')
    expect(digitalIdentityModule).not.toHaveProperty('createSupabaseAdminClient')
  })

  it('exposes lookup only from the server package', () => {
    expect(typeof serverDigitalIdentity.lookupPublishedCard).toBe('function')
    expect(typeof serverDigitalIdentity.lookupPublishedCardByPublicKey).toBe('function')
    expect(typeof serverDigitalIdentity.lookupPublishedCardBySlug).toBe('function')
    expect(serverDigitalIdentity.publicCardLookupSideEffects().writesAnalytics).toBe(false)
  })
})
