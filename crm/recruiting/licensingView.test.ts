import { describe, expect, it } from 'vitest'
import { licensingSummary, matchesAttention } from './licensingView'
import type { Recruit, Credential, CarrierReview } from './types'
const record = { id: 'a', stage: 'licensing', next_action_due_on: '2026-11-02' } as Recruit
const license = { id: 'l', recruit_id: 'a', kind: 'license', state: 'TX', authority_scope: 'life', status: 'verified', effective_on: '2026-01-01', expires_on: '2026-12-31', no_expiration: false, evidence_reference: 'reviewed' } as Credential
const eo = { ...license, id: 'e', kind: 'eo', state: null, authority_scope: null, expires_on: '2027-01-02' } as Credential
const carrier = { id: 'c', recruit_id: 'a', carrier_id: 'carrier', state: 'TX', authority_scope: 'life', contract_status: 'verified', contract_effective_on: '2026-01-01', contract_expires_on: '2026-11-01', contract_no_expiration: false, appointment_status: 'pending', appointment_effective_on: null, appointment_expires_on: null, appointment_no_expiration: false, reviewed_at: null } as CarrierReview
const today = '2026-11-02'
describe('multi-agent licensing overview', () => {
  it('never uses another agent’s credentials or appointments', () => {
    const other = { ...license, recruit_id: 'b' }
    const s = licensingSummary(record, [other], [{ ...carrier, recruit_id: 'b' }], today)
    expect(s.licenseMissing).toBe(true)
    expect(s.carrierMissing).toBe(true)
    expect(s.states).toEqual([])
    expect(s.renewals).toEqual([])
    expect(s.pendingAppointments).toBe(0)
  })
  it('includes day 60 and expiration day, separates expired records, and covers carrier expirations', () => {
    const s = licensingSummary(record, [license, eo, { ...license, id: 'today', expires_on: today }], [carrier], today)
    expect(s.renewals.map(e => e.id)).toEqual(['today', 'l'])
    expect(s.expired.map(e => e.id)).toEqual(['c-contract'])
    expect(s.pendingAppointments).toBe(1)
    expect(s.followupDue).toBe(true)
    expect(matchesAttention(record, s, 'renewals')).toBe(true)
    expect(matchesAttention(record, s, 'expired')).toBe(true)
  })
  it('does not treat an agent stage as proof of verified requirements', () => {
    const active = { ...record, stage: 'active_agent' } as Recruit
    const s = licensingSummary(active, [], [], today)
    expect(matchesAttention(active, s, 'requirements')).toBe(true)
    expect(s.licenseMissing && s.eoMissing && s.carrierMissing).toBe(true)
  })
  it('separates missing, future-effective, revoked, and no-expiration evidence', () => {
    const s = licensingSummary(record, [
      { ...license, expires_on: null, no_expiration: true, effective_on: '2027-01-01' },
      { ...eo, status: 'revoked', expires_on: '2026-11-01' },
    ], [], today)
    expect(s.credentialsToReview).toHaveLength(2)
    expect(s.expired).toEqual([])
    expect(s.renewals).toEqual([])
  })
})
