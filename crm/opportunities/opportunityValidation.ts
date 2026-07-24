import type {
  CreateOpportunityFormValues,
  OpportunityAdvisorOption,
  OpportunityPipelineOption,
  OpportunityStageOption,
  OpportunityValidationResult,
  UpdateOpportunityInput,
} from './types'

const TITLE_MAX = 200
const NEXT_ACTION_MAX = 500

export type CreateOpportunityValidationContext = {
  pipelines: OpportunityPipelineOption[]
  stages: OpportunityStageOption[]
  advisors: OpportunityAdvisorOption[]
  /** When role is advisor, only this advisor_profiles.id may be assigned. */
  actorAdvisorId: string | null
  role: 'owner' | 'advisor'
}

export type UpdateOpportunityValidationContext = {
  /** Stage options for the opportunity's existing pipeline (edit stage via RPC). */
  stages?: OpportunityStageOption[]
}

function trimOrEmpty(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function validateCreateOpportunityInput(
  input: CreateOpportunityFormValues,
  context: CreateOpportunityValidationContext,
): OpportunityValidationResult {
  const fieldErrors: OpportunityValidationResult['fieldErrors'] = {}

  const title = trimOrEmpty(input.title)
  if (!title) {
    fieldErrors.title = 'Opportunity title is required.'
  } else if (title.length > TITLE_MAX) {
    fieldErrors.title = `Title must be ${TITLE_MAX} characters or fewer.`
  }

  if (!trimOrEmpty(input.household_id)) {
    fieldErrors.household_id = 'Household is required.'
  }

  if (!trimOrEmpty(input.service_vertical_id)) {
    fieldErrors.service_vertical_id = 'Service vertical is required.'
  }

  if (!trimOrEmpty(input.pipeline_id)) {
    fieldErrors.pipeline_id = 'Pipeline is required.'
  }

  if (!trimOrEmpty(input.stage_id)) {
    fieldErrors.stage_id = 'Initial stage is required.'
  }

  const pipeline = context.pipelines.find((row) => row.id === input.pipeline_id)
  if (input.pipeline_id && !pipeline) {
    fieldErrors.pipeline_id = 'Selected pipeline is not available.'
  } else if (pipeline) {
    if (!pipeline.is_active) {
      fieldErrors.pipeline_id = 'Selected pipeline is inactive.'
    }
    if (
      input.service_vertical_id &&
      pipeline.service_vertical_id &&
      pipeline.service_vertical_id !== input.service_vertical_id
    ) {
      fieldErrors.pipeline_id = 'Pipeline does not match the selected service vertical.'
      fieldErrors.service_vertical_id =
        fieldErrors.service_vertical_id ??
        'Service vertical does not match the selected pipeline.'
    }
    if (pipeline.pipeline_type === 'relationship' || !pipeline.service_vertical_id) {
      fieldErrors.pipeline_id =
        'Choose a service pipeline. Relationship pipelines cannot be used for opportunities.'
    }
  }

  const stage = context.stages.find((row) => row.id === input.stage_id)
  if (input.stage_id && !stage) {
    fieldErrors.stage_id = 'Selected stage is not available.'
  } else if (stage && input.pipeline_id && stage.pipeline_id !== input.pipeline_id) {
    fieldErrors.stage_id = 'Stage does not belong to the selected pipeline.'
  } else if (stage && (stage.is_won || stage.is_lost || stage.is_terminal)) {
    // Initial create must not start on closed/terminal stages (lifecycle owned by DB/RPC later).
    fieldErrors.stage_id = 'Choose an open pipeline stage for a new opportunity.'
  }

  if (input.assigned_advisor_id) {
    const advisor = context.advisors.find((row) => row.id === input.assigned_advisor_id)
    if (!advisor) {
      fieldErrors.assigned_advisor_id = 'Selected advisor is not available.'
    } else if (
      context.role === 'advisor' &&
      context.actorAdvisorId &&
      input.assigned_advisor_id !== context.actorAdvisorId
    ) {
      // Usability guard; createOpportunity also re-checks from the authenticated session.
      fieldErrors.assigned_advisor_id = 'Advisors may only assign opportunities to themselves.'
    }
  }

  const nextAction = trimOrEmpty(input.next_action ?? '')
  if (nextAction.length > NEXT_ACTION_MAX) {
    fieldErrors.next_action = `Next action must be ${NEXT_ACTION_MAX} characters or fewer.`
  }

  const due = trimOrEmpty(input.next_action_due_at ?? '')
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    fieldErrors.next_action_due_at = 'Enter a valid due date.'
  }

  const ok = Object.keys(fieldErrors).length === 0
  return {
    ok,
    fieldErrors,
    formError: ok ? undefined : 'Please fix the highlighted fields and try again.',
  }
}

export function validateUpdateOpportunityInput(
  input: UpdateOpportunityInput,
): OpportunityValidationResult {
  const fieldErrors: OpportunityValidationResult['fieldErrors'] = {}

  const title = trimOrEmpty(input.title)
  if (!title) {
    fieldErrors.title = 'Opportunity title is required.'
  } else if (title.length > TITLE_MAX) {
    fieldErrors.title = `Title must be ${TITLE_MAX} characters or fewer.`
  }

  const nextAction = trimOrEmpty(input.next_action ?? '')
  if (nextAction.length > NEXT_ACTION_MAX) {
    fieldErrors.next_action = `Next action must be ${NEXT_ACTION_MAX} characters or fewer.`
  }

  const due = trimOrEmpty(input.next_action_due_at ?? '')
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    fieldErrors.next_action_due_at = 'Enter a valid due date.'
  }

  const ok = Object.keys(fieldErrors).length === 0
  return {
    ok,
    fieldErrors,
    formError: ok ? undefined : 'Please fix the highlighted fields and try again.',
  }
}

export function validateStageMove(
  stageId: string,
  stages: OpportunityStageOption[],
  currentPipelineId: string,
): OpportunityValidationResult {
  const fieldErrors: OpportunityValidationResult['fieldErrors'] = {}
  if (!trimOrEmpty(stageId)) {
    fieldErrors.stage_id = 'Stage is required.'
  } else {
    const stage = stages.find((row) => row.id === stageId)
    if (!stage) {
      fieldErrors.stage_id = 'Selected stage is not available.'
    } else if (stage.pipeline_id !== currentPipelineId) {
      fieldErrors.stage_id = 'Stage does not belong to this opportunity’s pipeline.'
    }
  }
  const ok = Object.keys(fieldErrors).length === 0
  return {
    ok,
    fieldErrors,
    formError: ok ? undefined : 'Please choose a valid stage and try again.',
  }
}

/** Normalize create payload after validation passes. Status omitted — DB default applies. */
export function normalizeCreateOpportunityInput(
  input: CreateOpportunityFormValues,
): CreateOpportunityFormValues {
  return {
    title: input.title.trim(),
    household_id: input.household_id.trim(),
    pipeline_id: input.pipeline_id.trim(),
    stage_id: input.stage_id.trim(),
    service_vertical_id: input.service_vertical_id.trim(),
    assigned_advisor_id: input.assigned_advisor_id?.trim() || null,
    next_action: input.next_action?.trim() || null,
    next_action_due_at: input.next_action_due_at?.trim() || null,
    need_identified: input.need_identified ?? true,
  }
}

export function normalizeUpdateOpportunityInput(
  input: UpdateOpportunityInput,
): UpdateOpportunityInput {
  return {
    title: input.title.trim(),
    next_action: input.next_action?.trim() || null,
    next_action_due_at: input.next_action_due_at?.trim() || null,
    need_identified: input.need_identified ?? true,
  }
}
