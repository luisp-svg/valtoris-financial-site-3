import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DASHBOARD_PIPELINE_STAGES } from './productionMetrics'
import { casePipelineStagesMatchDashboard } from './caseWorkspace'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(here, '../../supabase/migrations')
const casesTab = readFileSync(join(here, '../households/ClientWorkspace/tabs/CasesTab.tsx'), 'utf8')
const openCasesWidget = readFileSync(
  join(here, '../households/ClientWorkspace/widgets/OpenCasesWidget.tsx'),
  'utf8',
)
const householdsApi = readFileSync(join(here, '../households/householdsApi.ts'), 'utf8')
const queuePage = readFileSync(join(here, '../../pages/crm/CrmProductionPage.tsx'), 'utf8')
const caseWorkspace = readFileSync(join(here, 'caseWorkspace.ts'), 'utf8')
const productionApi = readFileSync(join(here, 'productionApi.ts'), 'utf8')

describe('Case Management Phase 1 contracts', () => {
  it('does not create public.cases or Migration 044', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
    expect(files.filter((name) => name.startsWith('044_'))).toEqual([])
    expect(existsSync(join(migrationsDir, '044_case_management.sql'))).toBe(false)
    expect(caseWorkspace).toContain('No public.cases table')
    expect(casesTab).not.toMatch(/from\('cases'\)/)
    expect(householdsApi).not.toMatch(/from\('cases'\)/)
  })

  it('derives household openCasesCount from policy_applications with the shared helper', () => {
    expect(householdsApi).toContain('countOpenPolicyCases(productionApplications)')
    expect(householdsApi).toContain('fetchHouseholdProductionApplications')
    expect(casesTab).toContain('fetchHouseholdProductionApplications')
    expect(casesTab).toContain('partitionHouseholdCases')
    expect(casesTab).toContain('crmProductionPath(row.id)')
    expect(casesTab).toContain('Open case workspace')
    expect(casesTab).not.toContain('expected_compensation')
    expect(openCasesWidget).toContain('workspace.openCasesCount')
  })

  it('filters Case views on the loaded list without a second fetch or dashboard funnel reuse', () => {
    expect(queuePage).toContain('applyCaseWorkspaceView(filteredItems, caseView, now)')
    expect(queuePage).toContain('buildProductionDashboard(filteredItems, { period: productionPeriod, today })')
    expect(queuePage).not.toMatch(/buildProductionDashboard\([^)]*caseItems/)
    expect(queuePage).not.toContain('fetchProductionApplications(supabase, { limit: ')
    expect(productionApi).toContain('PRODUCTION_LIST_DEFAULT_LIMIT = 200')
    expect(caseWorkspace).toContain('default cap 200')
  })

  it('keeps Case pipeline stages aligned with Current Case Pipeline and issued visible', () => {
    expect(casePipelineStagesMatchDashboard()).toEqual([...DASHBOARD_PIPELINE_STAGES])
    expect(DASHBOARD_PIPELINE_STAGES).toContain('issued')
    expect(queuePage).toContain('Case views')
    expect(queuePage).toContain('CASE_WORKSPACE_VIEWS')
    expect(queuePage).toContain('CaseWorkspaceViewBar')
    expect(caseWorkspace).toContain("'needs_attention'")
    expect(caseWorkspace).toContain("if (view === 'needs_attention') return 'Needs attention'")
    expect(queuePage).not.toContain('SERVICE_ROLE')
    expect(casesTab).not.toContain('SERVICE_ROLE')
    expect(householdsApi).not.toContain('SERVICE_ROLE')
  })
})
