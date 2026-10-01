import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { reportCardValidationScope } from './reportCardValidationScope'
import { syncReportCardDelivery } from './reportCardDelivery'
import { REPORT_CARD_FOLLOW_UP_TARGET } from './reportCardFollowUpConfig'

const first = '11111111-1111-4111-8111-111111111111'
const second = '22222222-2222-4222-8222-222222222222'
const outside = '33333333-3333-4333-8333-333333333333'
const now = Date.parse('2026-10-01T12:00:00Z')
const scoped = {
  AGENTCRM_REPORT_CARD_VALIDATION_LEAD_IDS: `${first},${second}`,
  AGENTCRM_REPORT_CARD_VALIDATION_UNTIL: '2026-10-01T13:00:00Z',
}
const enabled = {
  SUPABASE_URL: 'https://phanoknohbidqtgrpwvk.supabase.co',
  AGENTCRM_REPORT_CARD_SYNC_ENABLED: 'true', AGENTCRM_CONTACT_LINKING_ENABLED: 'true',
  AGENTCRM_PRIVATE_INTEGRATION_TOKEN: 'synthetic-token', AGENTCRM_LOCATION_ID: REPORT_CARD_FOLLOW_UP_TARGET.locationId,
  AGENTCRM_REPORT_CARD_TRIGGERS_VERIFIED: 'true', AGENTCRM_REPORT_CARD_DIRECT_FOLLOW_UP_VERIFIED: 'true',
}
afterEach(() => vi.useRealTimers())
describe('temporary Report Card validation scope', () => {
  it('preserves ordinary operation only when both settings are absent', () => {
    expect(reportCardValidationScope({}, now)).toBeNull()
    expect(reportCardValidationScope({ ...scoped, AGENTCRM_REPORT_CARD_VALIDATION_LEAD_IDS: undefined }, now)).toEqual([])
    expect(reportCardValidationScope({ ...scoped, AGENTCRM_REPORT_CARD_VALIDATION_UNTIL: undefined }, now)).toEqual([])
  })
  it('accepts a bounded exact list with UTC expiry', () => {
    expect(reportCardValidationScope(scoped, now)).toEqual([first, second])
  })
  it.each(['', '*', first + ',', first + ',' + first, 'not-a-uuid', Array(11).fill(first).join(',')])('fails closed for invalid list %s', ids => {
    expect(reportCardValidationScope({ ...scoped, AGENTCRM_REPORT_CARD_VALIDATION_LEAD_IDS: ids }, now)).toEqual([])
  })
  it.each(['', 'tomorrow', '2026-10-01', '2026-10-01T11:59:59Z', '2026-10-01T12:00:00Z', '2026-10-02T12:00:01Z'])('fails closed for invalid/expired/unbounded expiry %s', expiry => {
    expect(reportCardValidationScope({ ...scoped, AGENTCRM_REPORT_CARD_VALIDATION_UNTIL: expiry }, now)).toEqual([])
  })
  it('rejects browser-prefixed validation settings even without server settings', () => {
    expect(reportCardValidationScope({ VITE_AGENTCRM_REPORT_CARD_VALIDATION_LEAD_IDS: first }, now)).toEqual([])
  })
  it('never claims non-test submissions during validation', async () => {
    vi.useFakeTimers(); vi.setSystemTime(now)
    const rpc = vi.fn()
    const result = await syncReportCardDelivery(outside, { env: { ...enabled, ...scoped }, admin: { rpc } as unknown as SupabaseClient })
    expect(result).toBe('disabled'); expect(rpc).not.toHaveBeenCalled()
  })
  it('limits scheduled processing to the exact test IDs, without an unfiltered fallback', async () => {
    vi.useFakeTimers(); vi.setSystemTime(now)
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    expect(await syncReportCardDelivery(undefined, { env: { ...enabled, ...scoped }, admin: { rpc } as unknown as SupabaseClient })).toBe('idle')
    expect(rpc.mock.calls).toEqual([first, second].map(id => ['claim_report_card_delivery', { p_location: enabled.AGENTCRM_LOCATION_ID, p_lead_id: id }]))
  })
  it('does not activate sync just by configuring a validation list', async () => {
    vi.useFakeTimers(); vi.setSystemTime(now)
    const rpc = vi.fn()
    expect(await syncReportCardDelivery(first, { env: scoped, admin: { rpc } as unknown as SupabaseClient })).toBe('disabled')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('does not claim after the validation window expires', async () => {
    vi.useFakeTimers(); vi.setSystemTime(now + 3600000)
    const rpc = vi.fn()
    expect(await syncReportCardDelivery(undefined, { env: { ...enabled, ...scoped }, admin: { rpc } as unknown as SupabaseClient })).toBe('disabled')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('stops between claims when the validation window expires', async () => {
    vi.useFakeTimers(); vi.setSystemTime(now)
    const rpc = vi.fn(async () => { vi.setSystemTime(now + 3600000); return { data: null, error: null } })
    expect(await syncReportCardDelivery(undefined, { env: { ...enabled, ...scoped }, deadline: now + 7200000, admin: { rpc } as unknown as SupabaseClient })).toBe('disabled')
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('rejects a mismatched claim before reading a household or contacting AgentCRM', async () => {
    vi.useFakeTimers(); vi.setSystemTime(now)
    const rpc = vi.fn().mockResolvedValue({ data: { lead_id: outside }, error: null })
    const from = vi.fn()
    expect(await syncReportCardDelivery(first, { env: { ...enabled, ...scoped }, admin: { rpc, from } as unknown as SupabaseClient })).toBe('held')
    expect(from).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('preserves an unfiltered claim when validation settings are absent', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    expect(await syncReportCardDelivery(undefined, { env: enabled, admin: { rpc } as unknown as SupabaseClient })).toBe('idle')
    expect(rpc).toHaveBeenCalledWith('claim_report_card_delivery', { p_location: enabled.AGENTCRM_LOCATION_ID, p_lead_id: null })
  })
})
