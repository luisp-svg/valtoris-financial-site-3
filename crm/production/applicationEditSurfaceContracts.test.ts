import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { crmProductionEditPath } from '../../constants/routes'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(here, '../../supabase/migrations')
const editView = readFileSync(join(here, 'applicationEditView.ts'), 'utf8')
const applicationApi = readFileSync(join(here, 'applicationApi.ts'), 'utf8')
const productionApi = readFileSync(join(here, 'productionApi.ts'), 'utf8')
const detailPage = readFileSync(join(here, '../../pages/crm/CrmProductionDetailPage.tsx'), 'utf8')
const editPage = readFileSync(join(here, '../../pages/crm/CrmProductionEditPage.tsx'), 'utf8')
const queuePage = readFileSync(join(here, '../../pages/crm/CrmProductionPage.tsx'), 'utf8')
const table = readFileSync(join(here, 'ProductionQueueTable.tsx'), 'utf8')
const cards = readFileSync(join(here, 'ProductionQueueCards.tsx'), 'utf8')
const boardCard = readFileSync(join(here, 'ProductionBoardCard.tsx'), 'utf8')
const form = readFileSync(join(here, 'ApplicationEditForm.tsx'), 'utf8')
const styles = readFileSync(join(here, '../../src/styles.css'), 'utf8')

describe('Phase 1 expose existing Application edit workflow', () => {
  it('does not add an application-edit migration; 045 is policy lifecycle only', () => {
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
    expect(existsSync(join(migrationsDir, '045_application_edit.sql'))).toBe(false)
  })

  it('reuses one eligibility helper and does not expand generic-edit stages', () => {
    expect(editView).toContain('export function canShowProductionEditAction')
    expect(editView).toContain("'draft'")
    expect(editView).toContain("'pre_submitted'")
    expect(editView).toContain("'submitted'")
    expect(editView).toContain("'in_underwriting'")
    expect(table).toContain('canShowProductionEditAction')
    expect(cards).toContain('canShowProductionEditAction')
    expect(boardCard).toContain('canShowProductionEditAction')
    expect(detailPage).toContain('canShowProductionEditAction')
    expect(editPage).toContain('canShowProductionEditAction')
    expect(table).not.toContain("stage === 'issued'")
    expect(cards).not.toContain("stage === 'issued'")
    expect(boardCard).not.toContain("stage === 'in_force'")
    expect(table).not.toContain("stage === 'approved'")
    expect(cards).not.toContain("stage === 'postponed'")
  })

  it('labels Case, list, cards, and board Edit Application and uses the existing edit route', () => {
    expect(crmProductionEditPath('abc')).toBe('/crm/production/abc/edit')
    expect(detailPage).toContain('Edit Application')
    expect(detailPage).not.toContain('Edit / Complete')
    expect(detailPage).toContain('crmProductionEditPath(application.id)')
    expect(table).toContain('Edit Application')
    expect(table).toContain('crmProductionEditPath(item.id)')
    expect(table).toContain('crmProductionPath(item.id)')
    expect(table).toContain('scope="col">Actions</th>')
    expect(cards).toContain('Edit Application')
    expect(cards).toContain('crmProductionEditPath(item.id)')
    expect(cards).toContain('crmProductionPath(item.id)')
    expect(boardCard).toContain('Edit Application')
    expect(boardCard).toContain('crmProductionEditPath(item.id)')
    expect(boardCard).toContain('crmProductionPath(item.id)')
    expect(queuePage).toContain('role={role}')
  })

  it('keeps table Case navigation on the household name and does not inline-edit', () => {
    expect(table).toContain('className="crm-opportunities-name-link"')
    expect(table).not.toContain('saveProductionApplicationEdit')
    expect(table).not.toContain("rpc(")
    expect(table).not.toMatch(/\.update\s*\(/)
    expect(cards).not.toContain('saveProductionApplicationEdit')
    expect(boardCard).not.toContain('saveProductionApplicationEdit')
    expect(boardCard).not.toMatch(/\.update\s*\(/)
  })

  it('keeps board Edit outside drag and does not treat it as the drag handle', () => {
    expect(boardCard.indexOf('crm-production-board-card-link')).toBeLessThan(
      boardCard.indexOf('crm-production-board-card-actions'),
    )
    expect(boardCard.indexOf('crm-production-board-drag-handle')).toBeLessThan(
      boardCard.indexOf('crmProductionEditPath(item.id)'),
    )
    expect(boardCard).toContain("className=\"crm-production-edit-action\"")
    expect(boardCard).toContain('onClick={(event) => event.stopPropagation()}')
    const editBlock = boardCard.slice(boardCard.indexOf('crmProductionEditPath(item.id)'))
    expect(editBlock).not.toContain('{...listeners}')
    expect(editBlock).not.toContain('crm-production-board-drag-handle')
  })

  it('places queue-card Edit after client/product/stage/flags/amount and outside the Case link', () => {
    const clientAt = cards.indexOf('crm-opportunities-name')
    const productAt = cards.indexOf('crm-production-queue-card-product')
    const stageAt = cards.indexOf('crm-production-queue-card-stage')
    const flagsAt = cards.lastIndexOf('CaseAttentionFlagList')
    const amountAt = cards.indexOf('<dt>Amount</dt>')
    const caseLinkStart = cards.indexOf('className="crm-opportunities-card-link"')
    const caseLinkClose = cards.indexOf('</Link>', caseLinkStart)
    const actionsAt = cards.indexOf('crm-production-queue-card-actions')
    expect(clientAt).toBeGreaterThan(-1)
    expect(productAt).toBeGreaterThan(clientAt)
    expect(stageAt).toBeGreaterThan(productAt)
    expect(flagsAt).toBeGreaterThan(stageAt)
    expect(amountAt).toBeGreaterThan(flagsAt)
    expect(actionsAt).toBeGreaterThan(amountAt)
    expect(caseLinkClose).toBeGreaterThan(amountAt)
    expect(actionsAt).toBeGreaterThan(caseLinkClose)
    expect(cards).toContain('crm-production-queue-card-actions')
  })

  it('does not add issued/in-force editors, beneficiaries, or writing-receivable on Edit', () => {
    expect(form).not.toContain('writing_receivable_expected')
    expect(form).not.toContain('set_policy_application_beneficiaries')
    expect(form).not.toContain('delivery_status')
    expect(form).not.toContain('terminated_on')
    expect(form).not.toContain('termination_reason')
    expect(form).not.toContain('record_policy_post_placement_outcome')
    expect(editPage).not.toContain('writing_receivable_expected')
    expect(editPage).toContain('Issued and in-force historical corrections are not handled on this screen.')
    expect(form).toContain('This screen edits application details.')
  })

  it('keeps identifier writes on set/correct RPCs and allocations on the existing setter', () => {
    expect(applicationApi).toContain("setNumber: 'set_policy_application_number'")
    expect(applicationApi).toContain("correctNumber: 'correct_policy_application_number'")
    expect(editPage).toContain('saveProductionApplicationEdit')
    expect(applicationApi).toContain("rpc(APPLICATION_RPC.setNumber")
    expect(applicationApi).toContain("rpc(APPLICATION_RPC.correctNumber")
    expect(applicationApi).not.toMatch(/from\('policy_applications'\)[\s\S]*\.update\s*\(/)
    expect(productionApi).not.toMatch(/\.rpc\s*\(/)
    expect(applicationApi).not.toContain('SERVICE_ROLE')
    expect(applicationApi).not.toContain("from('policies')")
  })

  it('keeps 44px mobile Edit targets and wraps board/card actions', () => {
    expect(styles).toContain('.crm-production-edit-action')
    expect(styles).toContain('min-height: 44px')
    expect(styles).toContain('.crm-production-queue-card-actions')
    expect(styles).toContain('.crm-production-board-card-actions')
    expect(styles).toContain('flex-wrap: wrap')
    expect(styles).toContain('.crm-production-queue-card-actions .crm-production-edit-action')
  })
})
