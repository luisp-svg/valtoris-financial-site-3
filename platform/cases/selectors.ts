/**
 * Case selectors and draft builders.
 * Pure / in-memory only — no database I/O and no `public.cases` queries.
 */

import { getModule, listEnabledModules } from '../registry'
import { getCaseTypeDefinition, requireCaseTypeDefinition } from './caseTypeRegistry'
import { applyCaseClosure, canSetCaseStage, isOpenCaseStatus } from './lifecycle'
import { buildCaseMetadata } from './metadata'
import type {
  CaseId,
  CasePriority,
  CaseStatus,
  CreateCaseDraftInput,
  PlatformCase,
} from './types'

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

/** Client-generated draft id — never a DB-confirmed Case identity. */
function createDraftCaseId(): CaseId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`
}

export function validateCreateCaseDraftInput(
  input: CreateCaseDraftInput,
): { ok: true } | { ok: false; error: string } {
  const definition = getCaseTypeDefinition(input.caseType)
  if (!definition) {
    return { ok: false, error: 'Unknown caseType' }
  }
  if (!getModule(definition.moduleKey)) {
    return { ok: false, error: 'Case type moduleKey is not registered' }
  }
  if (!input.householdId || !isUuid(input.householdId)) {
    return { ok: false, error: 'householdId must be a valid UUID' }
  }
  for (const key of ['leadId', 'assessmentId', 'opportunityId', 'id'] as const) {
    const value = input[key]
    if (value == null || value === '') continue
    if (typeof value !== 'string' || !isUuid(value)) {
      return { ok: false, error: `${key} must be a valid UUID when provided` }
    }
  }
  if (input.status && !definition.allowedStatuses.includes(input.status)) {
    return { ok: false, error: `Status "${input.status}" is not allowed for this caseType` }
  }
  if (input.stage) {
    const stageCheck = canSetCaseStage(input.caseType, input.stage)
    if (!stageCheck.ok) return stageCheck
  }
  return { ok: true }
}

/**
 * Build an in-memory Case draft.
 * Does not persist, does not query a cases table, does not convert CRM rows.
 * `id` is a client-generated draft id only.
 */
export function createCaseDraft(input: CreateCaseDraftInput): PlatformCase {
  const validation = validateCreateCaseDraftInput(input)
  if (!validation.ok) {
    throw new Error(`Case Engine: ${validation.error}`)
  }

  const definition = requireCaseTypeDefinition(input.caseType)
  const openedAt = input.openedAt ?? new Date().toISOString()
  const status: CaseStatus = input.status ?? definition.initialStatus
  const stage = input.stage ?? definition.initialStage
  const closure = applyCaseClosure({ status, nowIso: openedAt })
  const summary =
    input.summary == null ? null : String(input.summary).trim() || null

  return {
    id: input.id ?? createDraftCaseId(),
    caseType: definition.caseType,
    // Module always from registry definition — callers cannot override.
    moduleKey: definition.moduleKey,
    status: closure.status,
    stage,
    priority: input.priority ?? definition.defaultPriority,
    title: (input.title ?? definition.displayName).trim(),
    summary,
    links: {
      householdId: input.householdId,
      businessId: null,
      leadId: input.leadId ?? null,
      assessmentId: input.assessmentId ?? null,
      opportunityId: input.opportunityId ?? null,
    },
    ownerUserId: input.ownerUserId ?? null,
    assignedAdvisorUserId: input.assignedAdvisorUserId ?? null,
    createdByUserId: input.createdByUserId ?? null,
    openedAt,
    closedAt: closure.closedAt,
    dueDate: input.dueDate ?? null,
    metadata: buildCaseMetadata(input.metadata),
    aiSummaryRef: null,
    workflowDefinitionId: null,
    workflowRunId: null,
    isDraft: true,
  }
}

/** Deterministic sort: dueDate asc (nulls last), then openedAt desc, then id. */
export function sortCasesDeterministically(
  cases: readonly PlatformCase[],
): PlatformCase[] {
  return cases.slice().sort((a, b) => {
    const aDue = a.dueDate ?? ''
    const bDue = b.dueDate ?? ''
    if (aDue && bDue) {
      const byDue = aDue.localeCompare(bDue)
      if (byDue !== 0) return byDue
    } else if (aDue && !bDue) {
      return -1
    } else if (!aDue && bDue) {
      return 1
    }
    const byOpened = b.openedAt.localeCompare(a.openedAt)
    if (byOpened !== 0) return byOpened
    return a.id.localeCompare(b.id)
  })
}

export function selectCasesByHousehold(
  cases: readonly PlatformCase[],
  householdId: string,
): PlatformCase[] {
  return sortCasesDeterministically(
    cases.filter((item) => item.links.householdId === householdId),
  )
}

export function selectOpenCases(cases: readonly PlatformCase[]): PlatformCase[] {
  return sortCasesDeterministically(cases.filter((item) => isOpenCaseStatus(item.status)))
}

export function selectClosedCases(cases: readonly PlatformCase[]): PlatformCase[] {
  return sortCasesDeterministically(cases.filter((item) => !isOpenCaseStatus(item.status)))
}

export function selectCasesByType(
  cases: readonly PlatformCase[],
  caseType: string,
): PlatformCase[] {
  return sortCasesDeterministically(cases.filter((item) => item.caseType === caseType))
}

export function selectCasesByModule(
  cases: readonly PlatformCase[],
  moduleKey: string,
): PlatformCase[] {
  return sortCasesDeterministically(cases.filter((item) => item.moduleKey === moduleKey))
}

export function selectCasesByStatus(
  cases: readonly PlatformCase[],
  status: CaseStatus,
): PlatformCase[] {
  return sortCasesDeterministically(cases.filter((item) => item.status === status))
}

export function selectCasesByPriority(
  cases: readonly PlatformCase[],
  priority: CasePriority,
): PlatformCase[] {
  return sortCasesDeterministically(cases.filter((item) => item.priority === priority))
}

/**
 * Cases whose module is currently feature-enabled in the Module Registry.
 * Disabled product modules are excluded unless callers use unfiltered selectors.
 */
export function selectCasesForEnabledModules(
  cases: readonly PlatformCase[],
): PlatformCase[] {
  const enabled = new Set(listEnabledModules().map((module) => module.key))
  return sortCasesDeterministically(cases.filter((item) => enabled.has(item.moduleKey)))
}

export function selectCaseById(
  cases: readonly PlatformCase[],
  caseId: string,
): PlatformCase | undefined {
  return cases.find((item) => item.id === caseId)
}

/**
 * Attach a soft activity id reference onto a Case (in-memory only).
 */
export function linkActivityToCase(
  platformCase: PlatformCase,
  activityId: string,
): PlatformCase {
  if (!isUuid(activityId)) {
    throw new Error('Case Engine: activityId must be a valid UUID')
  }
  const existing = platformCase.links.activityIds ?? []
  if (existing.includes(activityId)) return platformCase
  return {
    ...platformCase,
    links: {
      ...platformCase.links,
      activityIds: [...existing, activityId],
    },
  }
}

/**
 * Build the Activity Engine metadata.caseId payload for a Case (soft link).
 */
export function toActivityCaseLinkMetadata(platformCase: PlatformCase): {
  caseId: string
  module?: string
  entityType: 'case'
  entityId: string
} {
  return {
    caseId: platformCase.id,
    module: platformCase.moduleKey,
    entityType: 'case',
    entityId: platformCase.id,
  }
}
