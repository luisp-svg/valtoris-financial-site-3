import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(here, '../../supabase/migrations')
const styles = readFileSync(join(here, '../../src/styles.css'), 'utf8')
const queueCards = readFileSync(join(here, 'ProductionQueueCards.tsx'), 'utf8')
const boardCard = readFileSync(join(here, 'ProductionBoardCard.tsx'), 'utf8')
const queuePage = readFileSync(join(here, '../../pages/crm/CrmProductionPage.tsx'), 'utf8')
const casesTab = readFileSync(join(here, '../households/ClientWorkspace/tabs/CasesTab.tsx'), 'utf8')
const requirementSection = readFileSync(join(here, 'RequirementSection.tsx'), 'utf8')
const caseOperations = readFileSync(join(here, 'CaseOperationsSection.tsx'), 'utf8')
const dashboard = readFileSync(join(here, 'ProductionDashboard.tsx'), 'utf8')
const commissionSummary = readFileSync(join(here, '../commissions/CommissionSummary.tsx'), 'utf8')

describe('CRM mobile responsive cleanup contracts', () => {
  it('does not add a mobile-layout migration; 045 is policy lifecycle only', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
    expect(files.filter((name) => name.startsWith('045_'))).toEqual([
      '045_policy_post_placement_lifecycle.sql',
    ])
    expect(files.filter((name) => name.startsWith('044_'))).toEqual([
      '044_policy_application_requirements.sql',
    ])
    expect(files.filter((name) => name.startsWith('046_'))).toEqual([
      '046_opportunity_case_conversion.sql',
    ])
    expect(files.filter((name) => name.startsWith('047_'))).toEqual([])
    expect(existsSync(join(migrationsDir, '044_case_management.sql'))).toBe(false)
  })

  it('contains overflow at the CRM shell instead of page-level horizontal scroll', () => {
    expect(styles).toContain('.crm-shell {')
    expect(styles).toContain('overflow-x: clip')
    expect(styles).toContain('.crm-main {')
    expect(styles).toContain('.crm-content {')
    expect(styles).toContain('.crm-panel {')
    expect(styles).toContain('min-width: 0')
  })

  it('keeps Production Performance Life/FIA/Total readable on phone via labeled cells', () => {
    expect(dashboard).toContain('data-label="Life"')
    expect(dashboard).toContain('data-label="FIA"')
    expect(dashboard).toContain('data-label="Total"')
    expect(styles).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))")
    expect(styles).toContain(".crm-production-funnel-row [role='rowheader']")
    expect(styles).toContain("content: attr(data-label)")
  })

  it('scrolls Case-view chips on phone and uses 44px touch targets', () => {
    expect(styles).toContain('.crm-case-view-bar')
    expect(styles).toContain('overflow-x: auto')
    expect(styles).toContain('.crm-case-view-btn')
    expect(styles).toContain('min-height: 44px')
    expect(queuePage).toContain('CaseWorkspaceViewBar')
  })

  it('prioritizes client, product, stage, attention, and amount on production cards', () => {
    const clientAt = queueCards.indexOf('crm-opportunities-name')
    const productAt = queueCards.indexOf('crm-production-queue-card-product')
    const stageAt = queueCards.indexOf('crm-production-queue-card-stage')
    const flagsAt = queueCards.lastIndexOf('CaseAttentionFlagList')
    const amountAt = queueCards.indexOf('<dt>Amount</dt>')
    expect(clientAt).toBeGreaterThan(-1)
    expect(productAt).toBeGreaterThan(clientAt)
    expect(stageAt).toBeGreaterThan(productAt)
    expect(flagsAt).toBeGreaterThan(stageAt)
    expect(amountAt).toBeGreaterThan(flagsAt)
    expect(queueCards).toContain('hideCompensation')
    expect(queueCards).toContain('Edit Application')
    expect(queueCards).toContain('crm-production-queue-card-actions')
    expect(queuePage).toContain('hideCompensation={caseView !== \'all_applications\'}')
  })

  it('does not put compensation money on board cards or household Cases', () => {
    expect(boardCard).toContain('productionBoardCardMoney')
    expect(boardCard).not.toContain('CompensationStatusBadge')
    expect(boardCard).not.toContain('expected_compensations')
    expect(casesTab).not.toContain('expected_compensation')
    expect(casesTab).toContain('crm-household-case-product')
    expect(casesTab).toContain('crm-household-case-stage')
    expect(casesTab).toContain('crm-household-case-amount')
    expect(readFileSync(join(here, '../households/ClientWorkspace/tabs/PoliciesTab.tsx'), 'utf8')).toContain(
      'crm-household-policy-card',
    )
  })

  it('keeps requirement writes on RPCs and stacks requirement actions on phone', () => {
    expect(requirementSection).toContain('createPolicyApplicationRequirement')
    expect(requirementSection).toContain('transitionPolicyApplicationRequirementStatus')
    expect(styles).toContain('.crm-requirement-actions')
    expect(styles).toContain('grid-template-columns: 1fr')
  })

  it('does not change commission period options or KPI labels', () => {
    expect(commissionSummary).toContain("options={['this_month', 'ytd', 'lifetime']}")
    expect(commissionSummary).toContain('label="Expected"')
    expect(commissionSummary).toContain('label="Paid"')
    expect(commissionSummary).toContain('label="Net Paid"')
    expect(styles).toContain('.crm-commissions-kpi-grid')
  })

  it('uses mobile-only 44px secondary actions without changing the desktop button rule', () => {
    expect(styles).toMatch(
      /\.crm-secondary-btn \{\s*min-height: 40px;/,
    )
    expect(styles).toMatch(
      /@media \(max-width: 960px\)[\s\S]*?\.crm-secondary-btn \{\s*min-height: 44px;/,
    )
    expect(styles).toMatch(
      /@media \(max-width: 960px\)[\s\S]*?\.crm-user-menu-logout \{\s*min-height: 44px;/,
    )
    expect(styles).toContain('.crm-production-edit-action')
    expect(styles).toContain('.crm-production-queue-card-actions .crm-production-edit-action')
    expect(caseOperations).toContain('Save Case Operations')
    expect(styles).toContain('.crm-case-operations-actions .crm-primary-btn')
    expect(styles).toContain('.crm-case-operations .crm-checkbox-field')
  })

  it('stacks protection cards and lifecycle chips at 393px without page overflow', () => {
    expect(dashboard).toContain('Current Active Life Protection')
    expect(dashboard).toContain('Total Protection Placed')
    expect(dashboard).toContain('crm-production-protection-split')
    expect(styles).toContain('@media (max-width: 393px)')
    expect(styles).toContain('.crm-policy-lifecycle-badge')
    expect(styles).toContain('.crm-production-kpi-grid-summary')
    expect(queueCards).toContain('PolicyLifecycleBadge')
    expect(boardCard).toContain('PolicyLifecycleBadge')
    expect(casesTab).toContain('lifecycleBadge')
    expect(readFileSync(join(here, '../households/ClientWorkspace/tabs/PoliciesTab.tsx'), 'utf8')).toContain(
      'policyLifecycleLabel',
    )
    expect(queuePage).toContain('Policy status')
    expect(styles).toContain('overflow-x: clip')
    expect(styles).toContain('.crm-policy-lifecycle-actions')
    expect(styles).toContain('.crm-policy-lifecycle-dialog')
    expect(readFileSync(join(here, 'PolicyLifecycleSection.tsx'), 'utf8')).toContain(
      'crm-policy-lifecycle-actions',
    )
  })
})
