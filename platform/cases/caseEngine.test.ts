import { describe, expect, it } from 'vitest'
import {
  CASE_STATUS_TRANSITIONS,
  applyCaseClosure,
  applyCaseReopen,
  buildCaseMetadata,
  buildIfdCaseExample,
  buildOnboardingCaseExample,
  canSetCaseStage,
  canTransitionCaseStatus,
  createCaseDraft,
  getCaseTypeDefinition,
  isKnownCaseType,
  isOpenCaseStatus,
  isTerminalCaseStatus,
  linkActivityToCase,
  listCaseTypeDefinitions,
  listCaseTypes,
  listCaseTypesForModule,
  selectCasesByHousehold,
  selectCasesByModule,
  selectCasesByPriority,
  selectCasesByStatus,
  selectCasesForEnabledModules,
  selectClosedCases,
  selectOpenCases,
  sortCasesDeterministically,
  toActivityCaseLinkMetadata,
  transitionCaseStatus,
  validateCreateCaseDraftInput,
} from './index'
import {
  getModule,
  listCaseTypes as listRegistryCaseTypes,
  listEnabledModules,
  moduleDeclaresPermission,
} from '../registry'
import type { CaseStatus } from './types'

const HOUSEHOLD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const LEAD_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ASSESSMENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const CASE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const ACTIVITY_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

const ALL_STATUSES: CaseStatus[] = [
  'draft',
  'intake',
  'active',
  'waiting',
  'blocked',
  'completed',
  'cancelled',
  'archived',
]

describe('Case Engine registry', () => {
  it('registers unique case types with deterministic ordering', () => {
    const types = listCaseTypes()
    expect(new Set(types).size).toBe(types.length)
    expect(types).toEqual([...types].sort())
    expect(types).toContain('diagnostic_review_case')
    expect(types).toContain('household_onboarding_case')
    expect(types).toContain('insurance_case')
  })

  it('requires each case type to reference a registered module', () => {
    for (const definition of listCaseTypeDefinitions()) {
      expect(getModule(definition.moduleKey)).toBeTruthy()
      expect(definition.allowedStatuses).toContain(definition.initialStatus)
      expect(definition.stages[0]).toBeDefined()
      expect(definition.stages).toContain(definition.initialStage)
      expect(new Set(definition.stages).size).toBe(definition.stages.length)
    }
  })

  it('allows disabled modules to declare future case types without enabling runtime nav', () => {
    const credit = getModule('credit_repair')
    expect(credit?.featureFlag.enabled).toBe(false)
    expect(credit?.caseTypes.some((item) => item.caseType === 'credit_repair_case')).toBe(true)
    expect(isKnownCaseType('credit_repair_case')).toBe(true)
    expect(getCrmSidebarAbsence('credit_repair')).toBe(true)
  })

  it('registers Case Engine as enabled platform module without sidebar nav or auth grants', () => {
    const module = getModule('cases')
    expect(module?.status).toBe('active')
    expect(module?.featureFlag.enabled).toBe(true)
    expect(module?.navigation.visible).toBe(false)
    expect(listEnabledModules().some((item) => item.key === 'cases')).toBe(true)
    expect(listRegistryCaseTypes()).toEqual(expect.arrayContaining(listCaseTypes()))
    // Declared capability ≠ authorization.
    expect(moduleDeclaresPermission('cases', 'case.write')).toBe(true)
  })

  it('fails unknown case types safely', () => {
    expect(getCaseTypeDefinition('not_a_case')).toBeUndefined()
    expect(isKnownCaseType('not_a_case')).toBe(false)
    expect(listCaseTypesForModule('insurance').map((item) => item.caseType)).toEqual([
      'insurance_case',
    ])
  })
})

function getCrmSidebarAbsence(moduleKey: string): boolean {
  const module = getModule(moduleKey)
  return module?.navigation.visible === false
}

describe('Case Engine lifecycle', () => {
  it('covers every declared transition and rejects invalid paths', () => {
    for (const transition of CASE_STATUS_TRANSITIONS) {
      expect(canTransitionCaseStatus(transition.from, transition.to)).toBe(true)
      expect(transitionCaseStatus(transition.from, transition.to)).toEqual({
        ok: true,
        status: transition.to,
      })
    }

    // Spot-check illegal transitions across the matrix.
    const illegal: Array<[CaseStatus, CaseStatus]> = [
      ['draft', 'waiting'],
      ['draft', 'completed'],
      ['intake', 'completed'],
      ['intake', 'archived'],
      ['active', 'draft'],
      ['active', 'intake'],
      ['waiting', 'completed'],
      ['blocked', 'completed'],
      ['completed', 'intake'],
      ['completed', 'cancelled'],
      ['cancelled', 'completed'],
      ['archived', 'active'],
      ['archived', 'intake'],
      ['archived', 'draft'],
    ]
    for (const [from, to] of illegal) {
      expect(canTransitionCaseStatus(from, to)).toBe(false)
      expect(transitionCaseStatus(from, to).ok).toBe(false)
    }

    // Identity transitions are allowed.
    for (const status of ALL_STATUSES) {
      expect(canTransitionCaseStatus(status, status)).toBe(true)
    }
  })

  it('keeps status and stage separate; validates stages per case type', () => {
    expect(canSetCaseStage('diagnostic_review_case', 'needs_review')).toEqual({ ok: true })
    expect(canSetCaseStage('diagnostic_review_case', 'quoting').ok).toBe(false)
    expect(isOpenCaseStatus('active')).toBe(true)
    expect(isTerminalCaseStatus('completed')).toBe(true)
    expect(isTerminalCaseStatus('cancelled')).toBe(true)
    expect(isOpenCaseStatus('completed')).toBe(false)
  })

  it('applies closure timestamps correctly and keeps completed ≠ cancelled', () => {
    expect(
      applyCaseClosure({ status: 'active', closedAt: '2026-01-01T00:00:00.000Z' }),
    ).toEqual({ status: 'active', closedAt: null })
    expect(
      applyCaseClosure({ status: 'completed', nowIso: '2026-08-03T12:00:00.000Z' }),
    ).toEqual({ status: 'completed', closedAt: '2026-08-03T12:00:00.000Z' })
    expect(
      applyCaseClosure({
        status: 'cancelled',
        closedAt: '2026-07-01T00:00:00.000Z',
        nowIso: '2026-08-03T12:00:00.000Z',
      }),
    ).toEqual({ status: 'cancelled', closedAt: '2026-07-01T00:00:00.000Z' })

    expect(applyCaseReopen({ status: 'completed' })).toEqual({
      ok: true,
      status: 'active',
      closedAt: null,
    })
    expect(applyCaseReopen({ status: 'cancelled' })).toEqual({
      ok: true,
      status: 'intake',
      closedAt: null,
    })
    expect(applyCaseReopen({ status: 'archived' }).ok).toBe(false)
    expect(applyCaseReopen({ status: 'active' }).ok).toBe(false)
  })
})

describe('Case Engine drafts + metadata', () => {
  it('creates a non-persistent draft with registry-derived module and draft id semantics', () => {
    const draft = createCaseDraft({
      id: CASE_ID,
      caseType: 'insurance_case',
      householdId: HOUSEHOLD_ID,
      title: '  Life insurance review  ',
      summary: '  brief  ',
    })
    expect(draft.isDraft).toBe(true)
    expect(draft.id).toBe(CASE_ID)
    expect(draft.moduleKey).toBe('insurance')
    expect(draft.title).toBe('Life insurance review')
    expect(draft.summary).toBe('brief')
    expect(draft.links).toEqual({
      householdId: HOUSEHOLD_ID,
      businessId: null,
      leadId: null,
      assessmentId: null,
      opportunityId: null,
    })
    expect(draft.workflowRunId).toBeNull()
    expect(draft.aiSummaryRef).toBeNull()
  })

  it('stores references only and rejects malformed UUIDs / unknown types', () => {
    expect(
      validateCreateCaseDraftInput({
        caseType: 'nope',
        householdId: HOUSEHOLD_ID,
      }),
    ).toEqual({ ok: false, error: 'Unknown caseType' })
    expect(
      validateCreateCaseDraftInput({
        caseType: 'insurance_case',
        householdId: 'bad',
      }).ok,
    ).toBe(false)
    expect(
      validateCreateCaseDraftInput({
        caseType: 'insurance_case',
        householdId: HOUSEHOLD_ID,
        leadId: 'not-uuid',
      }).ok,
    ).toBe(false)
  })

  it('allow-lists metadata and strips unsafe bags', () => {
    const metadata = buildCaseMetadata({
      assessmentType: 'family',
      answers: { income: 'nope' },
      consent: { contactPermission: true },
      nested: { x: 1 },
      ssn: '000-00-0000',
      idempotencyKey: 'diagnostic_review_case:x',
      portalVisible: true,
    } as never)
    expect(metadata.assessmentType).toBe('family')
    expect(metadata.idempotencyKey).toBe('diagnostic_review_case:x')
    expect(metadata.portalVisible).toBe(true)
    expect(metadata.answers).toBeUndefined()
    expect(metadata.consent).toBeUndefined()
    expect(metadata.nested).toBeUndefined()
    expect(metadata.ssn).toBeUndefined()
  })
})

describe('Case Engine selectors', () => {
  it('is pure, deterministic, and distinguishes open vs closed', () => {
    const source = [
      createCaseDraft({
        caseType: 'insurance_case',
        householdId: HOUSEHOLD_ID,
        id: CASE_ID,
        dueDate: '2026-09-01',
        openedAt: '2026-08-01T00:00:00.000Z',
      }),
      createCaseDraft({
        caseType: 'funding_case',
        householdId: HOUSEHOLD_ID,
        status: 'completed',
        stage: 'closed',
        id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        dueDate: null,
        openedAt: '2026-08-02T00:00:00.000Z',
      }),
      createCaseDraft({
        caseType: 'insurance_case',
        householdId: HOUSEHOLD_ID,
        id: '11111111-1111-4111-8111-111111111111',
        dueDate: '2026-08-15',
        priority: 'urgent',
        openedAt: '2026-08-03T00:00:00.000Z',
      }),
    ]
    const snapshot = source.map((item) => item.id)
    const sorted = sortCasesDeterministically(source)
    expect(source.map((item) => item.id)).toEqual(snapshot)
    expect(sorted.map((item) => item.id)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      CASE_ID,
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
    ])
    expect(selectOpenCases(source).map((item) => item.id)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      CASE_ID,
    ])
    expect(selectClosedCases(source).map((item) => item.id)).toEqual([
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
    ])
    expect(selectCasesByStatus(source, 'completed')).toHaveLength(1)
    expect(selectCasesByPriority(source, 'urgent')).toHaveLength(1)
    expect(selectCasesByHousehold(source, HOUSEHOLD_ID)).toHaveLength(3)
    expect(selectCasesByModule(source, 'insurance')).toHaveLength(2)
  })

  it('excludes disabled-module cases from enabled-module helper unless unfiltered', () => {
    const credit = createCaseDraft({
      caseType: 'credit_repair_case',
      householdId: HOUSEHOLD_ID,
      id: '22222222-2222-4222-8222-222222222222',
    })
    const onboarding = createCaseDraft({
      caseType: 'household_onboarding_case',
      householdId: HOUSEHOLD_ID,
      id: '33333333-3333-4333-8333-333333333333',
    })
    const enabledOnly = selectCasesForEnabledModules([credit, onboarding])
    expect(enabledOnly.map((item) => item.caseType)).toEqual(['household_onboarding_case'])
    expect(selectCasesByModule([credit, onboarding], 'credit_repair')).toHaveLength(1)
  })

  it('links activity ids in memory and builds soft caseId metadata only', () => {
    const draft = createCaseDraft({
      caseType: 'diagnostic_review_case',
      householdId: HOUSEHOLD_ID,
      id: CASE_ID,
    })
    const linked = linkActivityToCase(draft, ACTIVITY_ID)
    expect(draft.links.activityIds).toBeUndefined()
    expect(linked.links.activityIds).toEqual([ACTIVITY_ID])
    expect(toActivityCaseLinkMetadata(linked)).toEqual({
      caseId: CASE_ID,
      module: 'initial_financial_diagnostic',
      entityType: 'case',
      entityId: CASE_ID,
    })
  })
})

describe('Case Engine metadata examples (IFD + Onboarding)', () => {
  it('builds IFD/onboarding examples as non-persistent reference shapes only', () => {
    const ifd = buildIfdCaseExample({
      householdId: HOUSEHOLD_ID,
      leadId: LEAD_ID,
      assessmentId: ASSESSMENT_ID,
      id: CASE_ID,
    })
    expect(ifd.isDraft).toBe(true)
    expect(ifd.caseType).toBe('diagnostic_review_case')
    expect(ifd.links.leadId).toBe(LEAD_ID)
    expect(ifd.links.assessmentId).toBe(ASSESSMENT_ID)
    expect(ifd.metadata.captureChannel).toBe('public_self_report')
    expect(ifd.metadata.workflowHint).toBe('review_initial_diagnostic')
    // No copied assessment payload.
    expect(Object.keys(ifd.links).sort()).toEqual(
      ['assessmentId', 'businessId', 'householdId', 'leadId', 'opportunityId'].sort(),
    )

    const onboarding = buildOnboardingCaseExample({
      householdId: HOUSEHOLD_ID,
      assessmentId: ASSESSMENT_ID,
      id: CASE_ID,
      status: 'draft',
    })
    expect(onboarding.isDraft).toBe(true)
    expect(onboarding.caseType).toBe('household_onboarding_case')
    expect(onboarding.metadata.assessmentType).toBe('household_onboarding')
  })
})
