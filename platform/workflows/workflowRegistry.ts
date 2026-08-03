/**
 * Workflow Registry — one workflow definition per Case Type.
 * Compiled catalog only; no database table and no execution runtime.
 */

import { getCaseTypeDefinition, listCaseTypes } from '../cases/caseTypeRegistry'
import { getModule } from '../registry'
import { isKnownWorkflowGuard } from './guards'
import type {
  WorkflowDefinition,
  WorkflowKey,
  WorkflowStageColor,
  WorkflowStageDefinition,
  WorkflowStageKind,
  WorkflowTransitionDefinition,
} from './types'

type StageSeed = {
  key: string
  label: string
  kind?: WorkflowStageKind
  completionPercent: number
  estimatedDurationDays?: number | null
  color?: WorkflowStageColor
  requiredDocuments?: readonly string[]
  requiredTasks?: readonly string[]
  suggestedActivities?: readonly string[]
  suggestedAiPrompts?: readonly string[]
  allowedActions?: readonly string[]
  description?: string
}

type TransitionSeed = {
  from: string
  to: string
  actionKey?: string
  label?: string
  guardKeys?: readonly string[]
}

function buildStages(seeds: readonly StageSeed[]): WorkflowStageDefinition[] {
  return seeds.map((seed, index) => ({
    key: seed.key,
    label: seed.label,
    description: seed.description,
    kind: seed.kind ?? (index === 0 ? 'entry' : 'active'),
    order: index,
    completionPercent: seed.completionPercent,
    estimatedDurationDays: seed.estimatedDurationDays ?? null,
    color: seed.color ?? 'neutral',
    requiredDocuments: seed.requiredDocuments ?? [],
    requiredTasks: seed.requiredTasks ?? [],
    suggestedActivities: seed.suggestedActivities ?? [],
    suggestedAiPrompts: seed.suggestedAiPrompts ?? [],
    allowedActions: seed.allowedActions ?? [],
  }))
}

function mergeTransitions(
  stageKeys: readonly string[],
  overrides: readonly TransitionSeed[] = [],
  terminalStages: readonly string[] = [],
): WorkflowTransitionDefinition[] {
  const terminal = new Set(terminalStages)
  const byPair = new Map<string, WorkflowTransitionDefinition>()
  for (let i = 0; i < stageKeys.length - 1; i += 1) {
    const from = stageKeys[i]
    const to = stageKeys[i + 1]
    // Terminal stages have no forward edges; reopen is a separate policy.
    if (terminal.has(from)) continue
    byPair.set(`${from}->${to}`, {
      from,
      to,
      actionKey: `advance_to_${to}`,
      label: `Advance to ${to}`,
    })
  }
  for (const override of overrides) {
    if (terminal.has(override.from)) continue
    byPair.set(`${override.from}->${override.to}`, {
      from: override.from,
      to: override.to,
      actionKey: override.actionKey,
      label: override.label,
      guardKeys: override.guardKeys,
    })
  }
  return [...byPair.values()]
}

function defineWorkflow(input: {
  workflowKey: WorkflowKey
  caseType: string
  moduleKey: string
  displayName: string
  description: string
  stages: readonly StageSeed[]
  transitions?: readonly TransitionSeed[]
  blockedStages?: readonly string[]
  terminalStages?: readonly string[]
  reopen?: WorkflowDefinition['reopen']
  estimatedDurationDays?: number | null
}): WorkflowDefinition {
  const stages = buildStages(input.stages)
  const stageKeys = stages.map((stage) => stage.key)
  const terminalStages =
    input.terminalStages ??
    stages.filter((stage) => stage.kind === 'terminal').map((stage) => stage.key)
  const blockedStages =
    input.blockedStages ??
    stages.filter((stage) => stage.kind === 'blocked').map((stage) => stage.key)
  const lastActive =
    [...stages].reverse().find((stage) => stage.kind === 'active' || stage.kind === 'entry')
      ?.key ?? stageKeys[0]

  return {
    workflowKey: input.workflowKey,
    caseType: input.caseType,
    moduleKey: input.moduleKey,
    displayName: input.displayName,
    description: input.description,
    entryStage: stageKeys[0],
    terminalStages,
    blockedStages,
    reopen: input.reopen ?? {
      enabled: true,
      fromStages: terminalStages.filter((key) => key !== 'cancelled'),
      toStage: lastActive,
    },
    stages,
    transitions: mergeTransitions(stageKeys, input.transitions, terminalStages),
    estimatedDurationDays: input.estimatedDurationDays ?? null,
  }
}

/**
 * Foundation workflows — one per Case Type.
 * Stage graphs are declarative metadata for future execution.
 */
export const WORKFLOW_DEFINITIONS: readonly WorkflowDefinition[] = [
  defineWorkflow({
    workflowKey: 'ifd_review_workflow',
    caseType: 'diagnostic_review_case',
    moduleKey: 'initial_financial_diagnostic',
    displayName: 'IFD Review Workflow',
    description:
      'Stage machine for Initial Financial Diagnostic review engagements (foundation only).',
    estimatedDurationDays: 14,
    stages: [
      {
        key: 'submitted',
        label: 'Submitted',
        kind: 'entry',
        completionPercent: 10,
        color: 'blue',
        suggestedActivities: ['diagnostic.ifd.submitted'],
        allowedActions: ['start_review'],
      },
      {
        key: 'needs_review',
        label: 'Needs Review',
        completionPercent: 25,
        color: 'amber',
        requiredTasks: ['review_initial_diagnostic'],
        suggestedActivities: ['case.review.started'],
        allowedActions: ['assign_advisor'],
      },
      {
        key: 'assigned',
        label: 'Assigned',
        completionPercent: 40,
        color: 'blue',
        requiredTasks: ['assign_reviewer'],
        allowedActions: ['schedule_appointment'],
      },
      {
        key: 'appointment_scheduled',
        label: 'Appointment Scheduled',
        completionPercent: 55,
        color: 'blue',
        suggestedActivities: ['appointment.scheduled'],
        allowedActions: ['prepare_recommendation'],
      },
      {
        key: 'recommendation_prepared',
        label: 'Recommendation Prepared',
        completionPercent: 75,
        color: 'amber',
        requiredDocuments: ['ifd_report', 'action_plan'],
        suggestedAiPrompts: ['case.summarize'],
        allowedActions: ['present_recommendation'],
      },
      {
        key: 'presented',
        label: 'Presented',
        completionPercent: 90,
        color: 'green',
        allowedActions: ['complete_case'],
      },
      {
        key: 'completed',
        label: 'Completed',
        kind: 'terminal',
        completionPercent: 100,
        color: 'green',
      },
    ],
    transitions: [
      {
        from: 'needs_review',
        to: 'assigned',
        actionKey: 'assign_advisor',
        guardKeys: ['has_assigned_advisor'],
      },
      {
        from: 'assigned',
        to: 'appointment_scheduled',
        actionKey: 'schedule_appointment',
        guardKeys: ['appointment_scheduled'],
      },
      {
        from: 'recommendation_prepared',
        to: 'presented',
        actionKey: 'present_recommendation',
        guardKeys: ['recommendation_ready'],
      },
    ],
    reopen: {
      enabled: true,
      fromStages: ['completed'],
      toStage: 'needs_review',
    },
  }),

  defineWorkflow({
    workflowKey: 'household_onboarding_workflow',
    caseType: 'household_onboarding_case',
    moduleKey: 'households',
    displayName: 'Household Onboarding Workflow',
    description: 'Advisor-led onboarding stage machine (metadata example; not auto-converted).',
    estimatedDurationDays: 7,
    stages: [
      {
        key: 'in_progress',
        label: 'In Progress',
        kind: 'entry',
        completionPercent: 20,
        color: 'blue',
        requiredTasks: ['complete_onboarding_assessment'],
      },
      {
        key: 'ready_for_review',
        label: 'Ready for Review',
        completionPercent: 60,
        color: 'amber',
        suggestedActivities: ['onboarding.ready_for_review'],
      },
      {
        key: 'completed',
        label: 'Completed',
        completionPercent: 90,
        color: 'green',
      },
      {
        key: 'closed',
        label: 'Closed',
        kind: 'terminal',
        completionPercent: 100,
        color: 'slate',
      },
    ],
    reopen: {
      enabled: true,
      fromStages: ['closed'],
      toStage: 'in_progress',
    },
  }),

  defineWorkflow({
    workflowKey: 'insurance_case_workflow',
    caseType: 'insurance_case',
    moduleKey: 'insurance',
    displayName: 'Insurance Case Workflow',
    description: 'Personal insurance service delivery stage machine.',
    estimatedDurationDays: 45,
    stages: [
      {
        key: 'application_started',
        label: 'Application Started',
        kind: 'entry',
        completionPercent: 10,
        color: 'blue',
        allowedActions: ['request_documents'],
      },
      {
        key: 'needs_documents',
        label: 'Needs Documents',
        kind: 'blocked',
        completionPercent: 25,
        color: 'amber',
        requiredDocuments: ['id_verification', 'application_packet'],
        requiredTasks: ['collect_insurance_documents'],
      },
      {
        key: 'submitted',
        label: 'Submitted',
        completionPercent: 45,
        color: 'blue',
        suggestedActivities: ['insurance.application.submitted'],
      },
      {
        key: 'underwriting',
        label: 'Underwriting',
        completionPercent: 65,
        color: 'amber',
        suggestedAiPrompts: ['case.summarize'],
      },
      {
        key: 'issued',
        label: 'Issued',
        completionPercent: 80,
        color: 'green',
        requiredDocuments: ['policy_document'],
      },
      {
        key: 'delivered',
        label: 'Delivered',
        completionPercent: 90,
        color: 'green',
      },
      {
        key: 'annual_review',
        label: 'Annual Review',
        kind: 'terminal',
        completionPercent: 100,
        color: 'slate',
        requiredTasks: ['schedule_annual_review'],
      },
    ],
    transitions: [
      {
        from: 'needs_documents',
        to: 'submitted',
        actionKey: 'submit_application',
        guardKeys: ['documents_complete'],
      },
    ],
    reopen: {
      enabled: true,
      fromStages: ['annual_review'],
      toStage: 'delivered',
    },
  }),

  defineWorkflow({
    workflowKey: 'credit_repair_workflow',
    caseType: 'credit_repair_case',
    moduleKey: 'credit_repair',
    displayName: 'Credit Repair Workflow',
    description: 'Credit repair engagement stage machine.',
    estimatedDurationDays: 90,
    stages: [
      {
        key: 'enrollment',
        label: 'Enrollment',
        kind: 'entry',
        completionPercent: 10,
        color: 'blue',
        requiredDocuments: ['credit_authorization'],
      },
      {
        key: 'documents_received',
        label: 'Documents Received',
        completionPercent: 25,
        color: 'blue',
        requiredDocuments: ['identity_docs', 'credit_authorization'],
      },
      {
        key: 'credit_reports_imported',
        label: 'Credit Reports Imported',
        completionPercent: 40,
        color: 'amber',
        suggestedAiPrompts: ['case.summarize'],
      },
      {
        key: 'disputes_sent',
        label: 'Disputes Sent',
        completionPercent: 60,
        color: 'amber',
        requiredTasks: ['send_disputes'],
        suggestedActivities: ['credit.disputes.sent'],
      },
      {
        key: 'responses_received',
        label: 'Responses Received',
        completionPercent: 75,
        color: 'blue',
      },
      {
        key: 'updated',
        label: 'Updated',
        completionPercent: 90,
        color: 'green',
      },
      {
        key: 'complete',
        label: 'Complete',
        kind: 'terminal',
        completionPercent: 100,
        color: 'green',
      },
    ],
    reopen: {
      enabled: true,
      fromStages: ['complete'],
      toStage: 'updated',
    },
  }),

  defineWorkflow({
    workflowKey: 'business_funding_workflow',
    caseType: 'funding_case',
    moduleKey: 'business_funding',
    displayName: 'Business Funding Workflow',
    description: 'Business funding application stage machine.',
    estimatedDurationDays: 60,
    stages: [
      {
        key: 'qualification',
        label: 'Qualification',
        kind: 'entry',
        completionPercent: 10,
        color: 'blue',
        requiredTasks: ['qualify_funding'],
      },
      {
        key: 'application',
        label: 'Application',
        completionPercent: 30,
        color: 'blue',
        requiredDocuments: ['funding_application', 'financials'],
      },
      {
        key: 'submitted',
        label: 'Submitted',
        completionPercent: 50,
        color: 'amber',
        suggestedActivities: ['funding.application.submitted'],
      },
      {
        key: 'underwriting',
        label: 'Underwriting',
        completionPercent: 70,
        color: 'amber',
        suggestedAiPrompts: ['case.summarize'],
      },
      {
        key: 'approved',
        label: 'Approved',
        completionPercent: 85,
        color: 'green',
      },
      {
        key: 'funded',
        label: 'Funded',
        kind: 'terminal',
        completionPercent: 100,
        color: 'green',
      },
    ],
    transitions: [
      {
        from: 'underwriting',
        to: 'approved',
        actionKey: 'approve_funding',
        guardKeys: ['manual_approval'],
      },
    ],
    reopen: {
      enabled: false,
      fromStages: [],
      toStage: 'qualification',
    },
  }),

  defineWorkflow({
    workflowKey: 'estate_planning_workflow',
    caseType: 'estate_case',
    moduleKey: 'estate_planning',
    displayName: 'Estate Planning Workflow',
    description: 'Estate planning engagement stage machine.',
    estimatedDurationDays: 45,
    stages: [
      { key: 'intake', label: 'Intake', kind: 'entry', completionPercent: 10, color: 'blue' },
      {
        key: 'planning',
        label: 'Planning',
        completionPercent: 35,
        color: 'blue',
        suggestedAiPrompts: ['case.summarize'],
      },
      {
        key: 'documents',
        label: 'Documents',
        completionPercent: 60,
        color: 'amber',
        requiredDocuments: ['estate_draft'],
      },
      { key: 'review', label: 'Review', completionPercent: 85, color: 'amber' },
      {
        key: 'closed',
        label: 'Closed',
        kind: 'terminal',
        completionPercent: 100,
        color: 'slate',
      },
    ],
  }),

  defineWorkflow({
    workflowKey: 'tax_strategy_workflow',
    caseType: 'tax_strategy_case',
    moduleKey: 'tax_planning',
    displayName: 'Tax Strategy Workflow',
    description: 'Tax planning / strategy stage machine.',
    estimatedDurationDays: 30,
    stages: [
      { key: 'intake', label: 'Intake', kind: 'entry', completionPercent: 10, color: 'blue' },
      { key: 'analysis', label: 'Analysis', completionPercent: 35, color: 'blue' },
      {
        key: 'strategy',
        label: 'Strategy',
        completionPercent: 60,
        color: 'amber',
        suggestedAiPrompts: ['case.summarize'],
      },
      {
        key: 'implementation',
        label: 'Implementation',
        completionPercent: 85,
        color: 'green',
      },
      {
        key: 'closed',
        label: 'Closed',
        kind: 'terminal',
        completionPercent: 100,
        color: 'slate',
      },
    ],
  }),

  defineWorkflow({
    workflowKey: 'commercial_insurance_workflow',
    caseType: 'commercial_insurance_case',
    moduleKey: 'commercial_insurance',
    displayName: 'Commercial Insurance Workflow',
    description: 'Commercial insurance stage machine.',
    estimatedDurationDays: 45,
    stages: [
      {
        key: 'intake',
        label: 'Intake',
        kind: 'entry',
        completionPercent: 10,
        color: 'blue',
      },
      { key: 'discovery', label: 'Discovery', completionPercent: 30, color: 'blue' },
      { key: 'quoting', label: 'Quoting', completionPercent: 50, color: 'amber' },
      { key: 'bound', label: 'Bound', completionPercent: 75, color: 'green' },
      { key: 'servicing', label: 'Servicing', completionPercent: 90, color: 'green' },
      {
        key: 'closed',
        label: 'Closed',
        kind: 'terminal',
        completionPercent: 100,
        color: 'slate',
      },
    ],
  }),

  defineWorkflow({
    workflowKey: 'employee_benefits_workflow',
    caseType: 'employee_benefits_case',
    moduleKey: 'employee_benefits',
    displayName: 'Employee Benefits Workflow',
    description: 'Employee benefits stage machine.',
    estimatedDurationDays: 40,
    stages: [
      {
        key: 'intake',
        label: 'Intake',
        kind: 'entry',
        completionPercent: 10,
        color: 'blue',
      },
      { key: 'design', label: 'Design', completionPercent: 35, color: 'blue' },
      {
        key: 'enrollment',
        label: 'Enrollment',
        completionPercent: 65,
        color: 'amber',
        requiredDocuments: ['census', 'plan_docs'],
      },
      { key: 'servicing', label: 'Servicing', completionPercent: 90, color: 'green' },
      {
        key: 'closed',
        label: 'Closed',
        kind: 'terminal',
        completionPercent: 100,
        color: 'slate',
      },
    ],
  }),
] as const

const BY_KEY = new Map(
  WORKFLOW_DEFINITIONS.map((definition) => [definition.workflowKey, definition]),
)
const BY_CASE_TYPE = new Map(
  WORKFLOW_DEFINITIONS.map((definition) => [definition.caseType, definition]),
)

export function listWorkflowDefinitions(): readonly WorkflowDefinition[] {
  return WORKFLOW_DEFINITIONS
}

export function listWorkflowKeys(): string[] {
  return WORKFLOW_DEFINITIONS.map((definition) => definition.workflowKey).sort()
}

export function getWorkflowDefinition(
  workflowKey: WorkflowKey,
): WorkflowDefinition | undefined {
  return BY_KEY.get(workflowKey)
}

export function requireWorkflowDefinition(workflowKey: WorkflowKey): WorkflowDefinition {
  const definition = getWorkflowDefinition(workflowKey)
  if (!definition) {
    throw new Error(`Workflow Engine: unknown workflowKey "${workflowKey}"`)
  }
  return definition
}

export function getWorkflowForCaseType(caseType: string): WorkflowDefinition | undefined {
  return BY_CASE_TYPE.get(caseType)
}

export function requireWorkflowForCaseType(caseType: string): WorkflowDefinition {
  const definition = getWorkflowForCaseType(caseType)
  if (!definition) {
    throw new Error(`Workflow Engine: no workflow registered for caseType "${caseType}"`)
  }
  return definition
}

export function listWorkflowsForModule(moduleKey: string): WorkflowDefinition[] {
  return WORKFLOW_DEFINITIONS.filter((definition) => definition.moduleKey === moduleKey)
}

export function isKnownWorkflowKey(workflowKey: string): boolean {
  return BY_KEY.has(workflowKey)
}

/**
 * Validate registry integrity against Case Engine + Module Registry.
 * Pure compile-time/test helper — does not grant authorization.
 */
export function validateWorkflowRegistry(): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const keys = new Set<string>()
  const caseTypes = new Set<string>()

  for (const definition of WORKFLOW_DEFINITIONS) {
    if (keys.has(definition.workflowKey)) {
      errors.push(`Duplicate workflowKey "${definition.workflowKey}"`)
    }
    keys.add(definition.workflowKey)

    if (caseTypes.has(definition.caseType)) {
      errors.push(`Duplicate workflow for caseType "${definition.caseType}"`)
    }
    caseTypes.add(definition.caseType)

    if (!getCaseTypeDefinition(definition.caseType)) {
      errors.push(
        `Workflow "${definition.workflowKey}" references unknown caseType "${definition.caseType}"`,
      )
    }
    if (!getModule(definition.moduleKey)) {
      errors.push(
        `Workflow "${definition.workflowKey}" references unknown moduleKey "${definition.moduleKey}"`,
      )
    }

    const stageKeys = definition.stages.map((stage) => stage.key)
    if (new Set(stageKeys).size !== stageKeys.length) {
      errors.push(`Workflow "${definition.workflowKey}" has duplicate stage keys`)
    }
    if (!stageKeys.includes(definition.entryStage)) {
      errors.push(`Workflow "${definition.workflowKey}" entryStage is not in stages`)
    }
    for (const terminal of definition.terminalStages) {
      if (!stageKeys.includes(terminal)) {
        errors.push(
          `Workflow "${definition.workflowKey}" terminal stage "${terminal}" is not in stages`,
        )
      }
    }
    for (const blocked of definition.blockedStages) {
      if (!stageKeys.includes(blocked)) {
        errors.push(
          `Workflow "${definition.workflowKey}" blocked stage "${blocked}" is not in stages`,
        )
      }
    }

    const orders = definition.stages.map((stage) => stage.order)
    if (new Set(orders).size !== orders.length) {
      errors.push(`Workflow "${definition.workflowKey}" has non-unique stage order values`)
    }

    const transitionPairs = new Set<string>()
    const terminalSet = new Set(definition.terminalStages)
    for (const transition of definition.transitions) {
      const pair = `${transition.from}->${transition.to}`
      if (transitionPairs.has(pair)) {
        errors.push(`Workflow "${definition.workflowKey}" has duplicate transition ${pair}`)
      }
      transitionPairs.add(pair)

      if (!stageKeys.includes(transition.from) || !stageKeys.includes(transition.to)) {
        errors.push(
          `Workflow "${definition.workflowKey}" transition ${transition.from}→${transition.to} references unknown stage`,
        )
      }
      if (terminalSet.has(transition.from)) {
        errors.push(
          `Workflow "${definition.workflowKey}" has outbound transition from terminal stage "${transition.from}"`,
        )
      }
      for (const guardKey of transition.guardKeys ?? []) {
        if (!isKnownWorkflowGuard(guardKey)) {
          errors.push(
            `Workflow "${definition.workflowKey}" transition ${pair} references unknown guard "${guardKey}"`,
          )
        }
      }
    }

    // Reachability from entry via declared transitions (reopen is not a transition edge).
    const adjacency = new Map<string, string[]>()
    for (const key of stageKeys) adjacency.set(key, [])
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
    for (const stageKey of stageKeys) {
      if (!reachable.has(stageKey)) {
        errors.push(
          `Workflow "${definition.workflowKey}" stage "${stageKey}" is unreachable from entry`,
        )
      }
    }

    if (definition.reopen.enabled) {
      if (!stageKeys.includes(definition.reopen.toStage)) {
        errors.push(`Workflow "${definition.workflowKey}" reopen.toStage is invalid`)
      }
      for (const from of definition.reopen.fromStages) {
        if (!stageKeys.includes(from)) {
          errors.push(`Workflow "${definition.workflowKey}" reopen.fromStages includes "${from}"`)
        }
      }
    }

    const orderedStages = definition.stages.slice().sort((a, b) => a.order - b.order)
    for (let i = 0; i < orderedStages.length; i += 1) {
      const stage = orderedStages[i]
      if (stage.completionPercent < 0 || stage.completionPercent > 100) {
        errors.push(
          `Workflow "${definition.workflowKey}" stage "${stage.key}" has invalid completionPercent`,
        )
      }
      if (i > 0 && stage.completionPercent < orderedStages[i - 1].completionPercent) {
        errors.push(
          `Workflow "${definition.workflowKey}" completionPercent is not monotonic at "${stage.key}"`,
        )
      }
    }
  }

  // Every registered case type should have exactly one workflow in the foundation.
  for (const caseType of listCaseTypes()) {
    if (!caseTypes.has(caseType)) {
      errors.push(`Case type "${caseType}" has no registered workflow`)
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}
