import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(here, '../../supabase/migrations/046_opportunity_case_conversion.sql'), 'utf8')
const api = readFileSync(join(here, 'convertOpportunityApi.ts'), 'utf8')
const dialog = readFileSync(join(here, 'ConvertOpportunityToCaseDialog.tsx'), 'utf8')
const metrics = readFileSync(join(here, '../production/productionMetrics.ts'), 'utf8')

describe('opportunity conversion compensation and reporting isolation', () => {
  it('does not write 034, 035, chargebacks, or historical receivable flags', () => {
    expect(sql).not.toContain('pp_refresh_application_expected_compensation')
    expect(sql).not.toContain('record_policy_writing_commission_event')
    expect(sql).not.toContain('chargeback')
    expect(sql).not.toContain('set_policy_application_writing_receivable_expected')
    expect(sql).not.toContain('transition_policy_application_stage')
    expect(api).not.toContain('transition_policy_application_stage')
    expect(api).not.toContain('writing_receivable_expected')
    expect(dialog).not.toContain('writing_receivable_expected')
    expect(dialog).toContain('Application Draft')
  })

  it('does not count draft conversion as Applied or placement', () => {
    expect(metrics).toContain("export const NEVER_SUBMITTED_STAGES = ['draft', 'pre_submitted']")
    expect(metrics).toContain('isNeverSubmittedStage')
    expect(metrics).toContain("if (stage === 'in_force')")
    expect(metrics).not.toContain('convert_opportunity_to_policy_application')
  })
})
