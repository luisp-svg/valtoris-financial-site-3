import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { caseHasOverdueRequirement, caseNeedsAttention } from './caseWorkspace'
import { isOpenRequirementOverdue } from './requirementView'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(here, '../../supabase/migrations')
const view = readFileSync(join(here, 'requirementView.ts'), 'utf8')
const api = readFileSync(join(here, 'requirementApi.ts'), 'utf8')
const section = readFileSync(join(here, 'RequirementSection.tsx'), 'utf8')
const caseWorkspace = readFileSync(join(here, 'caseWorkspace.ts'), 'utf8')
const queuePage = readFileSync(join(here, '../../pages/crm/CrmProductionPage.tsx'), 'utf8')
const queueTable = readFileSync(join(here, 'ProductionQueueTable.tsx'), 'utf8')
const queueCards = readFileSync(join(here, 'ProductionQueueCards.tsx'), 'utf8')
const board = readFileSync(join(here, 'ProductionBoard.tsx'), 'utf8')
const boardCard = readFileSync(join(here, 'ProductionBoardCard.tsx'), 'utf8')
const dashboard = readFileSync(join(here, 'ProductionDashboard.tsx'), 'utf8')
const casesTab = readFileSync(join(here, '../households/ClientWorkspace/tabs/CasesTab.tsx'), 'utf8')
const openCasesWidget = readFileSync(
  join(here, '../households/ClientWorkspace/widgets/OpenCasesWidget.tsx'),
  'utf8',
)
const productionApi = readFileSync(join(here, 'productionApi.ts'), 'utf8')
const householdsApi = readFileSync(join(here, '../households/householdsApi.ts'), 'utf8')

const SUMMARY_SURFACES = [queuePage, queueTable, queueCards, board, boardCard, casesTab]

describe('Case Management Phase 2C overdue-requirement contracts', () => {
  it('does not add a requirements migration past 044; 045 is policy lifecycle only', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
    expect(files.filter((name) => name.startsWith('045_'))).toEqual([
      '045_policy_post_placement_lifecycle.sql',
    ])
    expect(files.filter((name) => name.startsWith('044_'))).toEqual([
      '044_policy_application_requirements.sql',
    ])
    expect(files.filter((name) => name.startsWith('046_'))).toEqual([])
    expect(existsSync(join(migrationsDir, '044_case_management.sql'))).toBe(false)
  })

  it('keeps one overdue helper and a batched RLS read over already-loaded application IDs', () => {
    expect(view).toContain('export function isOpenRequirementOverdue')
    expect(view).toContain('export function overdueRequirementCountsByApplicationId')
    expect(api).toContain('fetchRequirementUrgencyByApplicationIds')
    expect(api).toContain("select(URGENCY_SELECT)")
    expect(api).toContain("URGENCY_SELECT = 'application_id, status, due_date'")
    expect(api).not.toMatch(/URGENCY_SELECT[\s\S]{0,80}custom_label/)
    expect(productionApi).not.toContain('policy_application_requirements')
    expect(queuePage).toContain('fetchOverdueRequirementCountsByApplicationIds(supabase, applicationIds)')
    expect(queuePage).toContain('PRODUCTION_LIST_DEFAULT_LIMIT')
    expect(casesTab).toContain('fetchOverdueRequirementCountsByApplicationIds')
  })

  it('extends Needs Attention without weakening Phase 1 signals or Open Cases count', () => {
    expect(caseWorkspace).toContain('overdueRequirementCount')
    expect(caseWorkspace).toContain('flags.overdueFollowUp ||')
    expect(caseWorkspace).toContain('flags.staleInStage ||')
    expect(caseWorkspace).toContain('flags.issuedDeliveryIncomplete')
    expect(caseWorkspace).toContain('formatOverdueRequirementLabel')
    expect(householdsApi).toContain('countOpenPolicyCases(productionApplications)')
    expect(openCasesWidget).toContain('workspace.openCasesCount')
    expect(openCasesWidget).not.toContain('overdue_requirement')
    expect(dashboard).not.toContain('overdue_requirement_count')
    const now = new Date('2026-08-20T15:00:00.000Z')
    expect(
      caseNeedsAttention(
        {
          production_stage: 'submitted',
          delivery_status: 'pre_issue',
          next_follow_up_date: '2026-08-19',
          stage_history: [],
          updated_at: '2026-08-18T00:00:00.000Z',
          submission_date: '2026-06-01',
          deleted_at: null,
          overdue_requirement_count: 0,
        },
        now,
      ),
    ).toBe(true)
    expect(
      caseHasOverdueRequirement({
        production_stage: 'withdrawn',
        submission_date: '2026-06-01',
        deleted_at: null,
        overdue_requirement_count: 4,
      }),
    ).toBe(false)
  })

  it('keeps summary surfaces to urgency state only — no labels, APS, history, or PHI', () => {
    for (const source of SUMMARY_SURFACES) {
      expect(source).not.toContain('custom_label')
      expect(source).not.toContain('fetchApplicationRequirementHistory')
      expect(source).not.toContain('requirement_code')
      expect(source).not.toMatch(/diagnos|medication|lab.result|physician/i)
      expect(source).not.toContain('changed_by_user_id')
      expect(source).not.toContain('SERVICE_ROLE')
      expect(source).not.toMatch(/\.insert\s*\(/)
      expect(source).not.toMatch(/from\('policy_application_requirements'\)[\s\S]{0,120}\.(insert|update|delete)\s*\(/)
    }
    expect(queueTable).toContain('CaseAttentionFlagList')
    expect(queueCards).toContain('CaseAttentionFlagList')
    expect(boardCard).toContain('CaseAttentionFlagList')
    expect(casesTab).toContain('CaseAttentionFlagList')
    expect(section).toContain('isOpenRequirementOverdue')
    expect(isOpenRequirementOverdue({ status: 'open', due_date: '2026-08-19' }, '2026-08-20')).toBe(
      true,
    )
  })

  it('does not add requirement DML, a Vercel endpoint, or service-role browser access', () => {
    expect(api).not.toMatch(/\.insert\s*\(/)
    expect(api).not.toMatch(/\.update\s*\(/)
    expect(api).not.toMatch(/\.delete\s*\(/)
    expect(api).not.toContain('SERVICE_ROLE')
    expect(queuePage).not.toContain('SERVICE_ROLE')
    expect(casesTab).not.toContain('SERVICE_ROLE')
    expect(section).not.toContain('SERVICE_ROLE')
    expect(queuePage).not.toContain('/api/')
    expect(casesTab).not.toContain('/api/')
  })
})
