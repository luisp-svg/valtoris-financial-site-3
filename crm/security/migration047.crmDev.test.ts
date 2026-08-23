/**
 * Live CRM-dev READ for Migration 047 Credit Repair / Student Loan sales catalog.
 * Hard-requires hostname cxgiaevervjttbuiramd.supabase.co. Never targets CRM-prod.
 * Uses the authenticated Opportunity catalog fetchers. No writes.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  fetchOpportunityPipelineOptions,
  fetchOpportunityServiceVerticalOptions,
  fetchOpportunityStageOptions,
} from '../opportunities/opportunitiesApi'
import {
  CREDIT_REPAIR_PIPELINE_ID,
  CREDIT_REPAIR_VERTICAL_ID,
  SERVICE_SALES_STAGE_CODES,
  STUDENT_LOANS_PIPELINE_ID,
  STUDENT_LOANS_VERTICAL_ID,
} from './migration047Contract'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'

function loadDotEnv(): void {
  let raw = ''
  try {
    raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
  } catch {
    return
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = trimmed.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    if (process.env[m[1]]) continue
    let value = m[2]
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[m[1]] = value
  }
}

loadDotEnv()

function crmDevReady(): { url: string; anon: string; ownerPass: string } | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  const ownerPass = process.env.DEV_OWNER_PASSWORD || ''
  if (!url || !anon || !ownerPass) return null
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    return null
  }
  if (host !== REQUIRED_HOST) return null
  if (/prod|production/i.test(host)) return null
  return { url, anon, ownerPass }
}

const env = crmDevReady()

describe.skipIf(!env)('migration 047 CRM-dev sales catalog (cxgiaevervjttbuiramd only)', () => {
  const cfg = env as NonNullable<typeof env>
  let owner: ReturnType<typeof createClient>

  beforeAll(async () => {
    owner = createClient(cfg.url, cfg.anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await owner.auth.signInWithPassword({
      email: 'owner.dev@valtoris.test',
      password: cfg.ownerPass,
    })
    if (error || !data.session) {
      throw new Error(`sign-in failed for owner.dev@valtoris.test: ${error?.message}`)
    }
  })

  it('returns Credit Repair and Student Loans from the Opportunity create catalog', async () => {
    const verticals = await fetchOpportunityServiceVerticalOptions(owner)
    const credit = verticals.find((row) => row.id === CREDIT_REPAIR_VERTICAL_ID)
    const loans = verticals.find((row) => row.id === STUDENT_LOANS_VERTICAL_ID)
    expect(credit).toEqual({
      id: CREDIT_REPAIR_VERTICAL_ID,
      code: 'credit_repair',
      name: 'Credit Repair',
    })
    expect(loans).toEqual({
      id: STUDENT_LOANS_VERTICAL_ID,
      code: 'student_loans',
      name: 'Student Loans',
    })
    expect(verticals.filter((row) => row.code === 'credit_repair')).toHaveLength(1)
    expect(verticals.filter((row) => row.code === 'student_loans')).toHaveLength(1)
  })

  it('returns the matching default service pipelines', async () => {
    const creditPipes = await fetchOpportunityPipelineOptions(owner, {
      serviceVerticalId: CREDIT_REPAIR_VERTICAL_ID,
    })
    const loanPipes = await fetchOpportunityPipelineOptions(owner, {
      serviceVerticalId: STUDENT_LOANS_VERTICAL_ID,
    })
    expect(creditPipes).toEqual([
      {
        id: CREDIT_REPAIR_PIPELINE_ID,
        name: 'Credit Repair Pipeline',
        service_vertical_id: CREDIT_REPAIR_VERTICAL_ID,
        pipeline_type: 'service',
        is_default: true,
        is_active: true,
      },
    ])
    expect(loanPipes).toEqual([
      {
        id: STUDENT_LOANS_PIPELINE_ID,
        name: 'Student Loans Pipeline',
        service_vertical_id: STUDENT_LOANS_VERTICAL_ID,
        pipeline_type: 'service',
        is_default: true,
        is_active: true,
      },
    ])
  })

  it('returns the five sales stages and no Enrolled stage', async () => {
    const [creditStages, loanStages] = await Promise.all([
      fetchOpportunityStageOptions(owner, CREDIT_REPAIR_PIPELINE_ID),
      fetchOpportunityStageOptions(owner, STUDENT_LOANS_PIPELINE_ID),
    ])
    expect(creditStages.map((row) => row.code)).toEqual([...SERVICE_SALES_STAGE_CODES])
    expect(loanStages.map((row) => row.code)).toEqual([...SERVICE_SALES_STAGE_CODES])
    expect(creditStages.some((row) => /enroll/i.test(row.code) || /enroll/i.test(row.name))).toBe(
      false,
    )
    expect(loanStages.some((row) => /enroll/i.test(row.code) || /enroll/i.test(row.name))).toBe(false)

    const creditSold = creditStages.find((row) => row.code === 'sold')
    const creditLost = creditStages.find((row) => row.code === 'closed_lost')
    expect(creditSold).toMatchObject({ is_won: true, is_lost: false, is_terminal: false })
    expect(creditLost).toMatchObject({ is_won: false, is_lost: true, is_terminal: true })

    const loanSold = loanStages.find((row) => row.code === 'sold')
    const loanLost = loanStages.find((row) => row.code === 'closed_lost')
    expect(loanSold).toMatchObject({ is_won: true, is_lost: false, is_terminal: false })
    expect(loanLost).toMatchObject({ is_won: false, is_lost: true, is_terminal: true })
  })
})
