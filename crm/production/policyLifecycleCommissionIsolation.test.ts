import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const lifecycle = readFileSync(join(here, 'policyLifecycle.ts'), 'utf8')
const dashboard = readFileSync(join(here, 'ProductionDashboard.tsx'), 'utf8')
const detail = readFileSync(join(here, '../../pages/crm/CrmProductionDetailPage.tsx'), 'utf8')
const section = readFileSync(join(here, 'PolicyLifecycleSection.tsx'), 'utf8')
const dialog = readFileSync(join(here, 'RecordPostPlacementOutcomeDialog.tsx'), 'utf8')
const lifecycleApi = readFileSync(join(here, 'policyLifecycleApi.ts'), 'utf8')
const commissionWrite = readFileSync(join(here, '../commissions/commissionWriteApi.ts'), 'utf8')
const metrics = readFileSync(join(here, 'productionMetrics.ts'), 'utf8')

describe('policy lifecycle commission isolation', () => {
  it('does not infer Chargeback from policy lifecycle copy or helpers', () => {
    expect(lifecycle).toContain('does not indicate whether a commission chargeback occurred')
    expect(lifecycle).not.toContain("'Chargeback'")
    expect(lifecycle).not.toContain('"Chargeback"')
    expect(dashboard).toContain('label="Placed"')
    expect(dashboard).not.toContain('label="Chargeback"')
    expect(section).toContain('POLICY_LIFECYCLE_CHARGEBACK_NOTE')
    expect(dialog).toContain('POLICY_LIFECYCLE_CHARGEBACK_NOTE')
    expect(detail).not.toContain('record_policy_post_placement_outcome')
    expect(detail).not.toContain('record_policy_writing_commission_event')
  })

  it('keeps placement formulas on application stage, not policies.status', () => {
    expect(metrics).toContain("if (stage === 'in_force')")
    expect(metrics).toContain('counts.placed += 1')
    expect(metrics).not.toContain('linked_policies')
    expect(metrics).not.toContain('surrendered')
    expect(metrics).not.toContain('canceled')
  })

  it('does not write commission events from production lifecycle UI', () => {
    expect(commissionWrite).not.toContain('policyLifecycle')
    expect(commissionWrite).not.toContain('record_policy_post_placement_outcome')
    expect(detail).not.toContain('record_policy_writing_commission_event')
    expect(lifecycleApi).not.toContain('record_policy_writing_commission_event')
    expect(section).not.toContain('record_policy_writing_commission_event')
  })
})
