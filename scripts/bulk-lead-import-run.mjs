#!/usr/bin/env node
/**
 * CRM-dev owner-only Bulk Lead Import runner.
 * Default mode is dry-run (no writes). --execute calls import_bulk_lead_consumer
 * with the signed-in owner JWT. Never targets CRM-prod. Never prints secrets.
 *
 *   node --env-file=.env scripts/bulk-lead-import-run.mjs --dry-run --file identities.json
 *   node --env-file=.env scripts/bulk-lead-import-run.mjs --execute --file identities.json
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const REQUIRED_HOST = 'cxgiaevervjttbuiramd.supabase.co'
const FORBIDDEN_HOST = 'phanoknohbidqtgrpwvk.supabase.co'
const BATCH_ID = 'bulk_lead_import_2026_leads_crm_v1'
const RPC = 'import_bulk_lead_consumer'
const MAX_BATCH = 50

function argValue(flag) {
  const index = process.argv.indexOf(flag)
  if (index < 0 || !process.argv[index + 1]) return null
  return process.argv[index + 1]
}

function hasFlag(flag) {
  return process.argv.includes(flag)
}

function hostOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

function toPayload(identity) {
  return {
    import_batch_id: BATCH_ID,
    source_workbook: '2026 leads crm',
    source_sheet: 'Leads',
    canonical_source_row: identity.canonicalSourceRow,
    all_source_rows: identity.allSourceRows,
    first_name: identity.firstName,
    last_name: identity.lastName,
    ...(identity.middleName ? { middle_name: identity.middleName } : {}),
    ...(identity.rawPhone ? { raw_phone: identity.rawPhone } : {}),
    ...(identity.rawEmail ? { raw_email: identity.rawEmail } : {}),
    ...(identity.city ? { city: identity.city } : {}),
    ...(identity.state ? { state: identity.state } : {}),
    ...(identity.sourceTag ? { source_tag: identity.sourceTag } : {}),
    ...(identity.duplicateType ? { duplicate_type: identity.duplicateType } : {}),
    ...(identity.duplicateGroup ? { duplicate_group: identity.duplicateGroup } : {}),
    ruleset_version: identity.rulesetVersion || 'phase_c_consumer_v1',
    ...(identity.rawPayload ? { raw_payload: identity.rawPayload } : {}),
  }
}

async function main() {
  const execute = hasFlag('--execute')
  if (execute && hasFlag('--dry-run')) {
    console.error('Refuse both --dry-run and --execute.')
    process.exit(1)
  }

  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const anonKey = String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim()
  const email = String(process.env.BULK_IMPORT_OWNER_EMAIL || '').trim()
  const password = String(process.env.BULK_IMPORT_OWNER_PASSWORD || '').trim()
  const host = hostOf(url)

  if (!url || !anonKey) {
    console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY.')
    process.exit(1)
  }
  if (host === FORBIDDEN_HOST || /prod|production/i.test(host)) {
    console.error('Refuse CRM-prod or production host.')
    process.exit(1)
  }
  if (host !== REQUIRED_HOST && !/127\.0\.0\.1|localhost/.test(url)) {
    console.error(`Refuse unexpected host ${host}. CRM-dev or local only.`)
    process.exit(1)
  }
  if (!email || !password) {
    console.error('Set BULK_IMPORT_OWNER_EMAIL and BULK_IMPORT_OWNER_PASSWORD for an owner session.')
    process.exit(1)
  }

  const file = argValue('--file')
  if (!file) {
    console.error('Provide --file path to a JSON array of identities.')
    process.exit(1)
  }
  const identities = JSON.parse(readFileSync(resolve(file), 'utf8'))
  if (!Array.isArray(identities)) {
    console.error('Identity file must be a JSON array.')
    process.exit(1)
  }

  const batchSize = Math.min(Math.max(Number(argValue('--batch-size') || 25), 1), MAX_BATCH)
  const slice = identities.slice(0, batchSize)
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) {
    console.error('Owner sign-in failed.')
    process.exit(1)
  }

  if (!execute) {
    console.log(JSON.stringify({
      ok: true,
      mode: 'dry_run',
      importBatchId: BATCH_ID,
      attempted: slice.length,
      note: 'No writes. Execute requires --execute after reviewing this slice.',
      rows: slice.map((identity) => ({
        canonicalSourceRow: identity.canonicalSourceRow,
        allSourceRows: identity.allSourceRows,
        lastName: identity.lastName,
      })),
    }, null, 2))
    process.exit(0)
  }

  const results = []
  let created = 0
  let alreadyExists = 0
  let reviewRequired = 0
  let failed = 0
  let stoppedEarly = false
  let stopReason = null

  for (const identity of slice) {
    const { data, error } = await supabase.rpc(RPC, { p_payload: toPayload(identity) })
    if (error) {
      failed += 1
      const message = error.message || 'rpc_failed'
      results.push({
        canonicalSourceRow: identity.canonicalSourceRow,
        ok: false,
        error: message,
      })
      if (/not_authenticated|not_authorized|unsupported_batch|protected_field/i.test(message)) {
        stoppedEarly = true
        stopReason = message
        break
      }
      continue
    }
    const row = data || {}
    if (row.created === true && row.outcome === 'review_required') reviewRequired += 1
    else if (row.created === true) created += 1
    else alreadyExists += 1
    results.push({
      canonicalSourceRow: identity.canonicalSourceRow,
      ok: row.ok === true,
      created: row.created === true,
      outcome: row.outcome,
      matchStatus: row.match_status,
      householdId: row.household_id,
      leadId: row.lead_id,
    })
  }

  const ok = failed === 0 && !stoppedEarly
  console.log(JSON.stringify({
    ok,
    mode: 'execute',
    importBatchId: BATCH_ID,
    attempted: results.length,
    created,
    alreadyExists,
    reviewRequired,
    failed,
    stoppedEarly,
    stopReason,
    results,
  }, null, 2))
  process.exit(ok ? 0 : 1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'bulk lead import runner failed')
  process.exit(1)
})
