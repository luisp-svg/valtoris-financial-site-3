import { describe, expect, it } from 'vitest'
import { getCaseTypeDefinition, listCaseTypes } from '../cases/caseTypeRegistry'
import {
  getCrmSidebarNavItems,
  getModule,
  listEnabledModules,
  moduleDeclaresPermission,
} from '../registry'
import {
  advanceWorkflowInstanceDraft,
  buildCreditRepairWorkflowExample,
  buildFundingWorkflowExample,
  buildIfdWorkflowExample,
  buildInsuranceWorkflowExample,
  canReopenWorkflow,
  canTransitionWorkflowStage,
  createWorkflowInstanceDraft,
  evaluateWorkflowGuard,
  evaluateWorkflowGuards,
  getWorkflowCompletionPercent,
  getWorkflowForCaseType,
  isKnownWorkflowKey,
  isWorkflowBlockedStage,
  isWorkflowTerminalStage,
  listAllowedWorkflowTransitions,
  listWorkflowDefinitions,
  listWorkflowGuardKeys,
  listWorkflowKeys,
  listWorkflowStagesOrdered,
  selectAllowedActionsForStage,
  selectOpenWorkflowInstances,
  selectRequiredDocumentsForStage,
  selectSuggestedActivitiesForStage,
  selectSuggestedAiPromptsForStage,
  selectWorkflowInstancesForEnabledModules,
  transitionWorkflowStage,
  validateCreateWorkflowInstanceDraftInput,
  validateWorkflowRegistry,
} from './index'

const CASE_DRAFT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WORKFLOW_DRAFT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('Workflow Engine registry', () => {
  it('registers unique workflows with one workflow per case type', () => {
    const validation = validateWorkflowRegistry()
    expect(validation).toEqual({ ok: true })

    const keys = listWorkflowKeys()
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toEqual([...keys].sort())

    const caseTypes = listWorkflowDefinitions().map((item) => item.caseType)
    expect(new Set(caseTypes).size).toBe(caseTypes.length)
    expect([...caseTypes].sort()).toEqual(listCaseTypes())
  })

  it('requires each workflow to reference a registered module and known case type', () => {
    for (const definition of listWorkflowDefinitions()) {
      expect(getModule(definition.moduleKey)).toBeTruthy()
      expect(definition.stages[0]?.key).toBe(definition.entryStage)
      expect(definition.terminalStages.length).toBeGreaterThan(0)
      expect(new Set(definition.stages.map((stage) => stage.key)).size).toBe(
        definition.stages.length,
      )
      const ordered = listWorkflowStagesOrdered(definition.workflowKey)
      expect(ordered.map((stage) => stage.order)).toEqual(
        [...ordered.map((stage) => stage.order)].sort((a, b) => a - b),
      )
      // Completion % monotonic along stage order; labels/colors remain metadata.
      for (let i = 1; i < ordered.length; i += 1) {
        expect(ordered[i].completionPercent).toBeGreaterThanOrEqual(
          ordered[i - 1].completionPercent,
        )
        expect(ordered[i].completionPercent).toBeLessThanOrEqual(100)
        expect(ordered[i].color).toBeTruthy()
        expect(ordered[i].label.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('keeps stage graphs reachable with no outbound edges from terminal stages', () => {
    for (const definition of listWorkflowDefinitions()) {
      const pairs = definition.transitions.map((item) => `${item.from}->${item.to}`)
      expect(new Set(pairs).size).toBe(pairs.length)

      const terminal = new Set(definition.terminalStages)
      for (const transition of definition.transitions) {
        expect(terminal.has(transition.from)).toBe(false)
      }

      const adjacency = new Map<string, string[]>()
      for (const stage of definition.stages) adjacency.set(stage.key, [])
      for (const transition of definition.transitions) {
        adjacency.get(transition.from)?.push(transition.to)
      }
      const reachable = new Set<string>()
      const queue = [definition.entryStage]
      while (queue.length > 0) {
        const current = queue.shift()
        if (!current || reachable.has(current)) continue
        reachable.add(current)
        for (const next of adjacency.get(current) ?? []) queue.push(next)
      }
      expect([...reachable].sort()).toEqual(
        definition.stages.map((stage) => stage.key).sort(),
      )
    }
  })

  it('does not silently map Case stages onto Workflow stages by string equality', () => {
    // Linkage is caseType only. Shared stage key strings are coincidental, not a sync contract.
    const insuranceCase = getCaseTypeDefinition('insurance_case')
    const insuranceWorkflow = getWorkflowForCaseType('insurance_case')
    expect(insuranceCase).toBeTruthy()
    expect(insuranceWorkflow).toBeTruthy()
    const caseStages = new Set(insuranceCase!.stages)
    const workflowStages = new Set(insuranceWorkflow!.stages.map((stage) => stage.key))
    // Proven divergence: workflow uses application_started; case engine uses intake.
    expect(caseStages.has('intake')).toBe(true)
    expect(workflowStages.has('application_started')).toBe(true)
    expect(workflowStages.has('intake')).toBe(false)
    expect(caseStages.has('application_started')).toBe(false)
  })

  it('allows disabled modules to declare workflows without enabling runtime nav', () => {
    const credit = getModule('credit_repair')
    expect(credit?.featureFlag.enabled).toBe(false)
    expect(getWorkflowForCaseType('credit_repair_case')?.workflowKey).toBe(
      'credit_repair_workflow',
    )
    expect(isKnownWorkflowKey('credit_repair_workflow')).toBe(true)
    expect(credit?.navigation.visible).toBe(false)
  })

  it('registers Workflow Engine as enabled platform module without sidebar or auth grants', () => {
    const module = getModule('workflows')
    expect(module?.status).toBe('active')
    expect(module?.featureFlag.enabled).toBe(true)
    expect(module?.navigation.visible).toBe(false)
    expect(listEnabledModules().some((item) => item.key === 'workflows')).toBe(true)
    // Declared capability ≠ authorization; workflows stay out of CRM sidebar.
    expect(moduleDeclaresPermission('workflows', 'workflow.read')).toBe(true)
    expect(getCrmSidebarNavItems().some((item) => item.label === 'Workflow Engine')).toBe(false)
  })

  it('fails unknown workflow / case combinations safely', () => {
    expect(getWorkflowForCaseType('not_a_case')).toBeUndefined()
    expect(isKnownWorkflowKey('not_a_workflow')).toBe(false)
    expect(
      validateCreateWorkflowInstanceDraftInput({
        caseType: 'not_a_case',
      }),
    ).toEqual({ ok: false, error: 'Unknown workflow for caseType / workflowKey' })
  })
})

describe('Workflow Engine transitions + guards', () => {
  it('allows sequential IFD transitions and rejects illegal jumps', () => {
    expect(canTransitionWorkflowStage('ifd_review_workflow', 'submitted', 'needs_review')).toBe(
      true,
    )
    expect(
      canTransitionWorkflowStage('ifd_review_workflow', 'needs_review', 'presented'),
    ).toBe(false)
    expect(
      transitionWorkflowStage('ifd_review_workflow', 'needs_review', 'presented').ok,
    ).toBe(false)
    expect(
      transitionWorkflowStage('ifd_review_workflow', 'submitted', 'submitted'),
    ).toEqual({ ok: true, from: 'submitted', to: 'submitted' })
  })

  it('evaluates declarative guards without I/O and fails closed', () => {
    expect(listWorkflowGuardKeys()).toContain('documents_complete')
    expect(evaluateWorkflowGuard('has_assigned_advisor', { flags: {} }).ok).toBe(false)
    expect(
      evaluateWorkflowGuard('has_assigned_advisor', {
        flags: { hasAssignedAdvisor: true },
      }).ok,
    ).toBe(true)
    expect(evaluateWorkflowGuard('not_a_guard', {}).ok).toBe(false)

    const blocked = transitionWorkflowStage(
      'ifd_review_workflow',
      'needs_review',
      'assigned',
      { flags: {} },
    )
    expect(blocked.ok).toBe(false)

    const allowed = transitionWorkflowStage(
      'ifd_review_workflow',
      'needs_review',
      'assigned',
      { flags: { hasAssignedAdvisor: true } },
    )
    expect(allowed).toEqual({
      ok: true,
      from: 'needs_review',
      to: 'assigned',
      actionKey: 'assign_advisor',
    })

    expect(evaluateWorkflowGuards([], {}).ok).toBe(true)
  })

  it('marks blocked / terminal stages and supports narrow reopen metadata', () => {
    expect(isWorkflowBlockedStage('insurance_case_workflow', 'needs_documents')).toBe(true)
    expect(isWorkflowTerminalStage('insurance_case_workflow', 'annual_review')).toBe(true)
    expect(getWorkflowCompletionPercent('credit_repair_workflow', 'complete')).toBe(100)

    expect(canReopenWorkflow('ifd_review_workflow', 'completed')).toEqual({
      ok: true,
      toStage: 'needs_review',
    })
    expect(canReopenWorkflow('business_funding_workflow', 'funded').ok).toBe(false)
    expect(canReopenWorkflow('ifd_review_workflow', 'submitted').ok).toBe(false)
  })

  it('exposes stage metadata for documents, tasks, activities, and AI prompts', () => {
    expect(selectRequiredDocumentsForStage('ifd_review_workflow', 'recommendation_prepared')).toEqual(
      ['ifd_report', 'action_plan'],
    )
    expect(
      selectSuggestedActivitiesForStage('ifd_review_workflow', 'submitted'),
    ).toContain('diagnostic.ifd.submitted')
    expect(selectAllowedActionsForStage('ifd_review_workflow', 'needs_review')).toEqual(
      expect.arrayContaining(['assign_advisor']),
    )
    expect(listAllowedWorkflowTransitions('insurance_case_workflow', 'needs_documents')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          to: 'submitted',
          guardKeys: ['documents_complete'],
        }),
      ]),
    )
  })
})

describe('Workflow Engine drafts + selectors', () => {
  it('creates non-persistent drafts with draft id semantics', () => {
    const draft = createWorkflowInstanceDraft({
      id: WORKFLOW_DRAFT_ID,
      caseType: 'diagnostic_review_case',
      caseDraftId: CASE_DRAFT_ID,
      currentStage: 'needs_review',
      metadata: {
        source: 'test',
        nested: { nope: true },
        answers: { x: 1 },
      } as never,
    })
    expect(draft.isDraft).toBe(true)
    expect(draft.id).toBe(WORKFLOW_DRAFT_ID)
    expect(draft.workflowKey).toBe('ifd_review_workflow')
    expect(draft.moduleKey).toBe('initial_financial_diagnostic')
    expect(draft.caseDraftId).toBe(CASE_DRAFT_ID)
    expect(draft.metadata.source).toBe('test')
    expect(draft.metadata.nested).toBeUndefined()
    expect(draft.metadata.answers).toBeUndefined()
    expect(draft.closedAt).toBeNull()
  })

  it('advances drafts immutably and applies terminal closure timestamps', () => {
    const start = createWorkflowInstanceDraft({
      id: WORKFLOW_DRAFT_ID,
      caseType: 'credit_repair_case',
      openedAt: '2026-08-03T12:00:00.000Z',
    })
    const snapshot = start.history.length
    const next = advanceWorkflowInstanceDraft(start, 'documents_received', {
      at: '2026-08-03T13:00:00.000Z',
    })
    expect(start.currentStage).toBe('enrollment')
    expect(start.history).toHaveLength(snapshot)
    expect(next.currentStage).toBe('documents_received')
    expect(next.history).toHaveLength(2)

    const terminal = createWorkflowInstanceDraft({
      caseType: 'credit_repair_case',
      currentStage: 'complete',
      openedAt: '2026-08-03T14:00:00.000Z',
    })
    expect(terminal.closedAt).toBe('2026-08-03T14:00:00.000Z')
  })

  it('rejects malformed draft ids and invalid stage / type pairs', () => {
    expect(
      validateCreateWorkflowInstanceDraftInput({
        caseType: 'insurance_case',
        caseDraftId: 'bad',
      }).ok,
    ).toBe(false)
    expect(
      validateCreateWorkflowInstanceDraftInput({
        caseType: 'insurance_case',
        currentStage: 'enrollment',
      }).ok,
    ).toBe(false)
    expect(() =>
      createWorkflowInstanceDraft({
        caseType: 'insurance_case',
        workflowKey: 'credit_repair_workflow',
      }),
    ).toThrow(/caseType does not match workflow definition/)
  })

  it('filters enabled-module instances without mutating source arrays', () => {
    const credit = buildCreditRepairWorkflowExample({ id: WORKFLOW_DRAFT_ID })
    const onboarding = createWorkflowInstanceDraft({
      id: CASE_DRAFT_ID,
      caseType: 'household_onboarding_case',
    })
    const source = [credit, onboarding]
    const snapshot = source.map((item) => item.id)
    const enabledOnly = selectWorkflowInstancesForEnabledModules(source)
    expect(source.map((item) => item.id)).toEqual(snapshot)
    expect(enabledOnly.map((item) => item.caseType)).toEqual(['household_onboarding_case'])
    expect(selectOpenWorkflowInstances(source).map((item) => item.caseType).sort()).toEqual([
      'credit_repair_case',
      'household_onboarding_case',
    ])
  })
})

describe('Workflow Engine examples', () => {
  it('builds IFD / insurance / credit / funding examples as non-persistent shapes only', () => {
    const ifd = buildIfdWorkflowExample({
      id: WORKFLOW_DRAFT_ID,
      caseDraftId: CASE_DRAFT_ID,
    })
    expect(ifd.isDraft).toBe(true)
    expect(ifd.workflowKey).toBe('ifd_review_workflow')
    expect(ifd.currentStage).toBe('needs_review')
    // Soft case draft link only — examples do not create Cases/Tasks/Activities.
    expect(ifd.caseDraftId).toBe(CASE_DRAFT_ID)

    expect(buildInsuranceWorkflowExample().currentStage).toBe('application_started')
    expect(buildCreditRepairWorkflowExample().currentStage).toBe('enrollment')
    expect(buildFundingWorkflowExample().currentStage).toBe('qualification')

    // Disabled modules remain disabled; AI prompt ids do not invoke AI.
    expect(getModule('credit_repair')?.featureFlag.enabled).toBe(false)
    expect(getModule('business_funding')?.featureFlag.enabled).toBe(false)
    expect(
      selectSuggestedAiPromptsForStage('ifd_review_workflow', 'recommendation_prepared'),
    ).toEqual(['case.summarize'])
  })
})
