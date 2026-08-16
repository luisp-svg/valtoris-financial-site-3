import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const productionApi = readFileSync(join(here, 'productionApi.ts'), 'utf8')
const applicationApi = readFileSync(join(here, 'applicationApi.ts'), 'utf8')
const compensationApi = readFileSync(join(here, 'compensationApi.ts'), 'utf8')
const detailPage = readFileSync(join(here, '../../pages/crm/CrmProductionDetailPage.tsx'), 'utf8')
const panel = readFileSync(join(here, 'StageTransitionPanel.tsx'), 'utf8')
const dialog = readFileSync(join(here, 'StageTransitionConfirmDialog.tsx'), 'utf8')
const view = readFileSync(join(here, 'stageTransitionView.ts'), 'utf8')
const styles = readFileSync(join(here, '../../src/styles.css'), 'utf8')

describe('UI-1b stage control contracts', () => {
  it('calls transition_policy_application_stage and never updates stage on the table', () => {
    expect(applicationApi).toContain("transition: 'transition_policy_application_stage'")
    expect(applicationApi).toContain('p_to_stage: input.toStage')
    expect(detailPage).toContain('transitionPolicyApplicationStage')
    expect(detailPage).toContain('setReloadKey')
    expect(productionApi).not.toMatch(/\.rpc\s*\(/)
    expect(productionApi).not.toMatch(/\.update\s*\(/)
    expect(panel).not.toMatch(/\.update\s*\(/)
    expect(detailPage).not.toContain("from('policy_applications')")
  })

  it('keeps compensation read-only and present after the transition flow', () => {
    expect(detailPage).toContain('<ExpectedCompensationPanel')
    expect(detailPage).toContain('<ActualCommissionPanel')
    expect(detailPage.indexOf('<StageTransitionPanel')).toBeGreaterThan(-1)
    expect(detailPage.indexOf('<ExpectedCompensationPanel')).toBeGreaterThan(
      detailPage.indexOf('<StageTransitionPanel'),
    )
    expect(compensationApi).not.toMatch(/\.insert\s*\(/)
    expect(compensationApi).not.toMatch(/\.update\s*\(/)
    expect(compensationApi).not.toMatch(/\.delete\s*\(/)
    expect(panel).not.toContain('policy_application_expected_compensations')
    expect(panel).not.toContain('policy_writing_commission_events')
    expect(panel).not.toContain('product_compensation_schedules')
  })

  it('disables actions while pending and confirms consequential stages', () => {
    expect(panel).toContain('disabled={submitting}')
    expect(panel).toContain('if (submitting) return')
    expect(dialog).toContain('disabled={blocked}')
    expect(dialog).toContain('Updating stage…')
    expect(dialog).toContain('role="dialog"')
    expect(view).toContain("confirmTitle(to)")
    expect(view).toContain("'Issue this policy?'")
    expect(view).toContain("'Mark this application withdrawn?'")
    expect(view).toContain("'Mark this application declined?'")
  })

  it('keeps mobile full-width stage actions and current stage readable', () => {
    expect(panel).toContain('StageBadge')
    expect(panel).toContain('Current stage')
    expect(styles).toContain('.crm-production-stage-actions')
    expect(styles).toContain('.crm-production-stage-actions .crm-secondary-btn')
    expect(styles).toContain('width: 100%')
  })

  it('does not add pending/eligible/released compensation workflow statuses', () => {
    expect(view).not.toMatch(/\bPending\b/)
    expect(view).not.toMatch(/\bEligible\b/)
    expect(view).not.toMatch(/\bReleased\b/)
    expect(panel).not.toContain('Cannot submit because no compensation rate')
  })
})
