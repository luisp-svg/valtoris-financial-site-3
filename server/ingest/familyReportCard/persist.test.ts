import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { persistFamilyReportCardIngest } from './persist'

function rpcRow(matchStatus: string, memberId: string) {
  return {
    created: true,
    lead_id: 'lead-1',
    household_id: 'hh-1',
    member_id: memberId,
    assessment_id: 'assess-1',
    match_status: matchStatus,
    sheets_sync_status: 'pending',
    duplicate_review_id: matchStatus === 'possible_match' ? 'review-1' : null,
  }
}

function adminFor(row: Record<string, unknown>) {
  const from = vi.fn(() => {
    throw new Error('member lookup is not allowed')
  })
  const rpc = vi.fn(async (fn: string) => {
    if (fn !== 'ingest_public_report_card') throw new Error(`Unexpected RPC: ${fn}`)
    return { data: row, error: null }
  })
  return { rpc, from } as unknown as SupabaseClient
}

describe('persistFamilyReportCardIngest member id', () => {
  it('retains the RPC member id for a new prospect and does not look up another member', async () => {
    const admin = adminFor(rpcRow('new_prospect', 'member-new-1'))
    const result = await persistFamilyReportCardIngest(admin, { match_status: 'new_prospect' })

    expect(result).toEqual({
      ok: true,
      created: true,
      leadId: 'lead-1',
      householdId: 'hh-1',
      memberId: 'member-new-1',
      assessmentId: 'assess-1',
      matchStatus: 'new_prospect',
      sheetsSyncStatus: 'pending',
      duplicateReviewId: null,
    })
    expect(admin.rpc).toHaveBeenCalledTimes(1)
    expect(admin.rpc).toHaveBeenCalledWith('ingest_public_report_card', {
      p_payload: { match_status: 'new_prospect' },
    })
    expect((admin as unknown as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled()
  })

  it('retains the member id returned for an exact trusted match', async () => {
    const admin = adminFor(rpcRow('exact_trusted_match', 'member-primary-returned'))
    const result = await persistFamilyReportCardIngest(admin, { match_status: 'exact_trusted_match' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.memberId).toBe('member-primary-returned')
      expect(result.leadId).toBe('lead-1')
      expect(result.householdId).toBe('hh-1')
      expect(result.assessmentId).toBe('assess-1')
      expect(result.matchStatus).toBe('exact_trusted_match')
    }
    expect((admin as unknown as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled()
  })

  it('retains the member id returned for a possible match without changing that status', async () => {
    const admin = adminFor(rpcRow('possible_match', 'member-possible-1'))
    const result = await persistFamilyReportCardIngest(admin, { match_status: 'possible_match' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.memberId).toBe('member-possible-1')
      expect(result.matchStatus).toBe('possible_match')
      expect(result.duplicateReviewId).toBe('review-1')
      expect(result.leadId).toBe('lead-1')
      expect(result.householdId).toBe('hh-1')
      expect(result.assessmentId).toBe('assess-1')
    }
  })

  it('keeps a null member id when the RPC omits one, including idempotent replay', async () => {
    const admin = adminFor({
      created: false,
      lead_id: 'lead-1',
      household_id: 'hh-1',
      assessment_id: 'assess-1',
      match_status: 'exact_trusted_match',
      sheets_sync_status: 'succeeded',
      duplicate_review_id: null,
    })
    const result = await persistFamilyReportCardIngest(admin, {})

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.created).toBe(false)
      expect(result.memberId).toBeNull()
      expect(result.leadId).toBe('lead-1')
      expect(result.householdId).toBe('hh-1')
      expect(result.assessmentId).toBe('assess-1')
    }
    expect((admin as unknown as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled()
  })

  it('does not query household members or call AgentCRM', () => {
    const source = readFileSync(resolve(process.cwd(), 'server/ingest/familyReportCard/persist.ts'), 'utf8')
    expect(source).not.toMatch(/from\(['"]household_members/)
    expect(source).not.toContain('is_primary_contact')
    expect(source).not.toContain('agentcrm')
    expect(source).not.toContain('server/agentcrm')
  })
})
