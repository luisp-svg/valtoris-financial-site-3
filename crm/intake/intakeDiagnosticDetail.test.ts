import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getModule } from '../../platform/registry'
import { EXPECTED_NUMBERED_MIGRATIONS } from '../security/migration045Contract'
import {
  extractCreditSubmittedAnswers,
  mapPublicFamilyDiagnosticDetail,
} from '../households/assessments/diagnosticFormatters'
import {
  validCreditAnswersFixture,
  validStudentLoanAnswersFixture,
} from '../../server/ingest/familyReportCard/testFixtures'
import { INTAKE_MISSING_ASSESSMENT_COPY } from './intakeAssessmentMatch'
import { canPresentIntakeAssignAdvisorAction } from './intakeAssignmentUi'
import { canPresentIntakeCreateOpportunityAction } from './intakeOpportunityUi'
import { canPresentIntakeArchiveAction } from './intakeArchiveUi'

const root = resolve(process.cwd())
const SHA_047 = '96e82cc9c307df0785bbc6786c4642432972e8df5a0962e492931b1bfe4a03c9'
const SHA_048 = 'b60a9c112b99a8b5442b9c95f3fb79c600823787320d2037843d43f5202bfb1e'
const SHA_049 = 'd42dcfb153970e7c9fa7cf804991f57568e6d21e7866f62fab4014b31145a792'
const SHA_050 = 'ea2f4dc9c4bbff7c93cf83958e4499fe1e20c55769235c12a1efc50b58646d0a'
const SHA_051 = 'db6e49f6ff7e974f0227aee0b6271f001ccbab6933f9c35705d77eb72946dccf'
const SHA_052 = '00ef6c3023e47c192f09a7f4e8e6c1a92791388135577fd362dd704a0a3b2ca7'

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8')
}

function sha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(resolve(root, relativePath))).digest('hex')
}

const panel = read('crm/intake/IntakeDetailPanel.tsx')
const dispatcher = read('crm/intake/IntakeAssessmentDetail.tsx')
const match = read('crm/intake/intakeAssessmentMatch.ts')
const intakeApi = read('crm/intake/intakeApi.ts')
const page = read('pages/crm/CrmIntakePage.tsx')
const familyIngest = read('server/ingest/familyReportCard/ingestFamilyReportCard.ts')
const view = read('crm/households/assessments/PublicFamilyDiagnosticDetailView.tsx')

function studentLoanRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'assess-sl',
    household_id: 'hh-1',
    lead_id: 'lead-sl',
    assessment_type: 'student_loan',
    status: 'completed',
    overall_score: 64,
    overall_grade: 'D',
    completed_at: '2026-08-20T18:00:00.000Z',
    capture_channel: 'public_self_report',
    scoring_version: 1,
    priorities: [
      { title: 'Review repayment plan', why: 'Plan may not match goal', timeline: 'Advisor review' },
    ],
    answers: {
      diagnostic: validStudentLoanAnswersFixture().diagnostic,
      contact: validStudentLoanAnswersFixture().contact,
    },
    derived_metrics: {
      categories: [
        { id: 'status_stability', title: 'Status & stability', score: 12, grade: 'D' },
        { id: 'repayment_strategy', title: 'Repayment strategy', score: 18, grade: 'C' },
      ],
      criticalFlags: [{ id: 'flag_default', label: 'Immediate Review', detail: 'Status needs review' }],
      reviewAreas: [{ id: 'review_flag_default', title: 'Review repayment plan' }],
    },
    deleted_at: null,
    ...overrides,
  }
}

function creditRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'assess-cr',
    household_id: 'hh-1',
    lead_id: 'lead-cr',
    assessment_type: 'credit',
    status: 'completed',
    overall_score: 71,
    overall_grade: 'C',
    completed_at: '2026-08-20T18:00:00.000Z',
    capture_channel: 'public_self_report',
    scoring_version: 1,
    priorities: [{ title: 'Review utilization', why: 'Balances may be high', timeline: 'Advisor review' }],
    answers: {
      diagnostic: validCreditAnswersFixture().diagnostic,
      contact: validCreditAnswersFixture().contact,
    },
    derived_metrics: {
      categories: [{ id: 'utilization', title: 'Utilization', score: 18, grade: 'C' }],
      criticalFlags: [{ id: 'flag_utilization', label: 'Utilization review' }],
    },
    deleted_at: null,
    ...overrides,
  }
}

describe('Intake diagnostic display models', () => {
  it('renders Student Loan score, grade, categories, flags, review areas, and diagnostic answers', () => {
    const detail = mapPublicFamilyDiagnosticDetail(studentLoanRow(), 'hh-1', {
      id: 'lead-sl',
      status: 'unassigned',
    })
    expect(detail?.productLabel).toBe('Student Loan Report Card')
    expect(detail?.overallScore).toBe(64)
    expect(detail?.overallGrade).toBe('D')
    expect(detail?.scoringVersion).toBe(1)
    expect(detail?.categories.map((item) => item.id)).toContain('status_stability')
    expect(detail?.flags.some((flag) => flag.id === 'flag_default')).toBe(true)
    expect(detail?.priorities.length).toBeGreaterThan(0)
    expect(detail?.priorities.length).toBeLessThanOrEqual(3)
    expect(detail?.submittedAnswers.some((item) => item.id === 'primary_goal')).toBe(true)
    expect(detail?.submittedAnswers.some((item) => item.id === 'urgency')).toBe(true)
    expect(JSON.stringify(detail?.submittedAnswers)).not.toMatch(
      /firstName|lastName|jamie\.rivera@example.com|555-201-4488/,
    )
    expect(detail?.submittedSnapshot.firstName).toBeNull()
    expect(detail?.submittedSnapshot.email).toBeNull()
  })

  it('renders Credit score, grade, categories, flags, review areas, and English formatted answers', () => {
    const detail = mapPublicFamilyDiagnosticDetail(creditRow(), 'hh-1', { id: 'lead-cr', status: 'unassigned' })
    expect(detail?.productLabel).toBe('Credit Report Card')
    expect(detail?.overallScore).toBe(71)
    expect(detail?.overallGrade).toBe('C')
    expect(detail?.scoringVersion).toBe(1)
    expect(detail?.categories[0]?.title).toBe('Utilization')
    expect(detail?.flags.some((flag) => flag.id === 'flag_utilization')).toBe(true)
    expect(detail?.priorities.length).toBeGreaterThan(0)
    expect(detail?.priorities.length).toBeLessThanOrEqual(3)

    const answers = extractCreditSubmittedAnswers({
      diagnostic: validCreditAnswersFixture().diagnostic,
    })
    const goal = answers.find((item) => item.id === 'credit_goal')
    expect(goal?.value).toBe('Improve my overall credit health')
    expect(goal?.value).not.toBe('general_health')
    expect(JSON.stringify(answers)).not.toMatch(/Comprar una casa|Mejorar mi salud crediticia/)
    expect(detail?.submittedAnswers.some((item) => item.id === 'credit_goal')).toBe(true)
    expect(detail?.submittedAnswers.some((item) => item.id === 'urgency')).toBe(true)
    expect(JSON.stringify(detail?.submittedAnswers)).not.toMatch(/jamie\.rivera@example.com/)
  })

  it('does not fabricate a score in the missing-assessment copy', () => {
    expect(INTAKE_MISSING_ASSESSMENT_COPY).not.toMatch(/\d/)
    expect(INTAKE_MISSING_ASSESSMENT_COPY).not.toMatch(/score|grade/i)
  })
})

describe('Intake diagnostic dispatcher contracts', () => {
  it('reuses the household public Report Card detail view for assessment-backed Intake', () => {
    expect(dispatcher).toContain('PublicFamilyDiagnosticDetailView')
    expect(dispatcher).toContain('variant="embedded"')
    expect(dispatcher).toContain('INTAKE_MISSING_ASSESSMENT_COPY')
    expect(dispatcher).toContain("kind === 'digital_identity'")
    expect(panel).toContain('IntakeAssessmentDetail')
    expect(panel).not.toContain('View Initial Financial Diagnostic')
    expect(panel).toContain('View {productLabel}')
    expect(view).toContain("variant?: 'page' | 'embedded'")
  })

  it('does not dump hidden payloads, Sheets answers, or service-role metadata', () => {
    expect(dispatcher).not.toContain('raw_payload')
    expect(dispatcher).not.toContain('SERVICE_ROLE')
    expect(dispatcher).not.toContain('service_role')
    expect(dispatcher).not.toContain('JSON.stringify')
    expect(match).not.toContain('SERVICE_ROLE')
    expect(match).not.toContain('createClient')
    expect(intakeApi).not.toContain('SERVICE_ROLE')
    expect(intakeApi).not.toContain('service_role')
    expect(view).not.toContain('raw_payload')
    expect(view).not.toContain('idempotency')
    expect(view).not.toContain('sheetsPayload')
  })

  it('does not create Opportunities or archive from diagnostic display', () => {
    expect(dispatcher).not.toContain('createOpportunity')
    expect(dispatcher).not.toContain('archiveIntakeLead')
    expect(match).not.toContain('createOpportunity')
    expect(match).not.toContain('archiveIntakeLead')
    const diagnosticSection = panel.slice(
      panel.indexOf('crm-intake-diagnostic-heading'),
      panel.indexOf('crm-intake-consent-heading'),
    )
    expect(diagnosticSection).toContain('IntakeAssessmentDetail')
    expect(diagnosticSection).not.toContain('createOpportunity')
    expect(diagnosticSection).not.toContain('archiveIntakeLead')
    expect(diagnosticSection).not.toContain('assignIntakeHousehold')
  })

  it('keeps Intake actions independent of diagnostic rendering', () => {
    expect(panel).toContain('Open household')
    expect(panel).toContain('INTAKE_ASSIGN_ADVISOR_ACTION_LABEL')
    expect(panel).toContain('INTAKE_CREATE_OPPORTUNITY_ACTION_LABEL')
    expect(panel).toContain('INTAKE_ARCHIVE_ACTION_LABEL')
    expect(panel).toContain('className="crm-intake-detail-actions"')
    expect(panel).toContain('<IntakeAssessmentDetail item={item} />')
    expect(panel.indexOf('className="crm-intake-detail-actions"')).toBeLessThan(
      panel.indexOf('<IntakeAssessmentDetail item={item} />'),
    )
    expect(
      canPresentIntakeAssignAdvisorAction({
        isOwner: true,
        householdId: 'hh-1',
      }),
    ).toBe(true)
    expect(
      canPresentIntakeCreateOpportunityAction({
        isOwner: true,
        householdId: 'hh-1',
        householdAssignedAdvisorId: 'adv-1',
        currentAdvisorProfileId: 'adv-1',
      }),
    ).toBe(true)
    expect(
      canPresentIntakeArchiveAction({
        isOwner: true,
        currentAdvisorProfileId: 'adv-1',
        leadAssignedAdvisorId: null,
        householdAssignedAdvisorId: null,
      }),
    ).toBe(true)
  })

  it('keeps pending duplicate from enabling Assign, Create Opportunity, or Archive', () => {
    expect(panel).toContain('INTAKE_WORKFLOW_DUPLICATE_BLOCK_COPY')
    expect(panel).toContain('INTAKE_ARCHIVE_DUPLICATE_BLOCK_COPY')
    expect(panel).toContain('assignBlockedByDuplicate')
    expect(panel).toContain('createBlockedByDuplicate')
    expect(panel).toContain('archiveBlockedByDuplicate')
    expect(page).toContain('assignVisibility.blockedByDuplicate')
    expect(page).toContain('createOpportunityVisibility.blockedByDuplicate')
    expect(page).toContain('archiveVisibility.blockedByDuplicate')
  })

  it('does not auto-create Opportunities from public Report Card ingest', () => {
    expect(familyIngest).toContain('export async function ingestPublicReportCard')
    expect(familyIngest).not.toContain('createOpportunity')
    expect(familyIngest).not.toContain("from('opportunities')")
  })

  it('keeps legacy credit_repair servicing disabled', () => {
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
  })

  it('leaves migrations 047–052 unchanged and is followed by 053', () => {
    const migrationsDir = resolve(root, 'supabase/migrations')
    const files = readdirSync(migrationsDir)
      .filter((name) => /^\d{3}_.+\.sql$/.test(name))
      .sort()
    expect(files).toEqual([...EXPECTED_NUMBERED_MIGRATIONS])
    expect(files.filter((name) => name.startsWith('053_'))).toEqual(['053_bulk_lead_import_writer.sql'])
    expect(files.filter((name) => name.startsWith('054_'))).toEqual([])
    expect(existsSync(resolve(migrationsDir, '053_intake_diagnostic_detail.sql'))).toBe(false)
    expect(sha256('supabase/migrations/047_credit_repair_student_loan_sales_catalog.sql')).toBe(SHA_047)
    expect(sha256('supabase/migrations/048_student_loan_report_card_ingest.sql')).toBe(SHA_048)
    expect(sha256('supabase/migrations/049_specialize_public_report_card_follow_up_copy.sql')).toBe(SHA_049)
    expect(sha256('supabase/migrations/050_credit_report_card_ingest.sql')).toBe(SHA_050)
    expect(sha256('supabase/migrations/051_intake_archive_workflow.sql')).toBe(SHA_051)
    expect(sha256('supabase/migrations/052_fix_intake_archive_activity_order.sql')).toBe(SHA_052)
  })
})
