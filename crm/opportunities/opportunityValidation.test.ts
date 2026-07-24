import { describe, expect, it } from 'vitest'
import {
  normalizeCreateOpportunityInput,
  normalizeUpdateOpportunityInput,
  validateCreateOpportunityInput,
  validateStageMove,
  validateUpdateOpportunityInput,
} from './opportunityValidation'
import type {
  OpportunityAdvisorOption,
  OpportunityPipelineOption,
  OpportunityStageOption,
} from './types'

const pipelines: OpportunityPipelineOption[] = [
  {
    id: 'pipe-life',
    name: 'Life Insurance Pipeline',
    service_vertical_id: 'vert-life',
    pipeline_type: 'service',
    is_default: true,
    is_active: true,
  },
  {
    id: 'pipe-rel',
    name: 'Relationship Pipeline',
    service_vertical_id: null,
    pipeline_type: 'relationship',
    is_default: true,
    is_active: true,
  },
]

const stages: OpportunityStageOption[] = [
  {
    id: 'stage-1',
    pipeline_id: 'pipe-life',
    name: 'Opportunity Identified',
    code: 'opportunity_identified',
    sort_order: 1,
    is_won: false,
    is_lost: false,
    is_terminal: false,
  },
  {
    id: 'stage-won',
    pipeline_id: 'pipe-life',
    name: 'Placed / Paid',
    code: 'placed_paid',
    sort_order: 8,
    is_won: true,
    is_lost: false,
    is_terminal: false,
  },
]

const advisors: OpportunityAdvisorOption[] = [
  { id: 'adv-a', display_name: 'Advisor A', user_id: 'user-a' },
  { id: 'adv-b', display_name: 'Advisor B', user_id: 'user-b' },
]

const baseInput = {
  title: 'Term Life Review',
  household_id: 'hh-1',
  pipeline_id: 'pipe-life',
  stage_id: 'stage-1',
  service_vertical_id: 'vert-life',
  assigned_advisor_id: 'adv-a' as string | null,
}

describe('validateCreateOpportunityInput', () => {
  it('accepts a complete valid create payload', () => {
    const result = validateCreateOpportunityInput(baseInput, {
      pipelines,
      stages,
      advisors,
      actorAdvisorId: 'adv-a',
      role: 'owner',
    })
    expect(result.ok).toBe(true)
    expect(result.fieldErrors).toEqual({})
  })

  it('requires title, household, pipeline, stage, and service vertical', () => {
    const result = validateCreateOpportunityInput(
      {
        title: '  ',
        household_id: '',
        pipeline_id: '',
        stage_id: '',
        service_vertical_id: '',
        assigned_advisor_id: null,
      },
      {
        pipelines,
        stages,
        advisors,
        actorAdvisorId: null,
        role: 'owner',
      },
    )
    expect(result.ok).toBe(false)
    expect(result.fieldErrors.title).toMatch(/title/i)
    expect(result.fieldErrors.household_id).toMatch(/household/i)
    expect(result.fieldErrors.pipeline_id).toMatch(/pipeline/i)
    expect(result.fieldErrors.stage_id).toMatch(/stage/i)
    expect(result.fieldErrors.service_vertical_id).toMatch(/service/i)
  })

  it('rejects pipeline/vertical mismatches and relationship pipelines', () => {
    const mismatch = validateCreateOpportunityInput(
      { ...baseInput, service_vertical_id: 'vert-other' },
      { pipelines, stages, advisors, actorAdvisorId: null, role: 'owner' },
    )
    expect(mismatch.ok).toBe(false)
    expect(mismatch.fieldErrors.pipeline_id).toMatch(/match/i)

    const relationship = validateCreateOpportunityInput(
      { ...baseInput, pipeline_id: 'pipe-rel', stage_id: 'stage-1' },
      { pipelines, stages, advisors, actorAdvisorId: null, role: 'owner' },
    )
    expect(relationship.ok).toBe(false)
    expect(relationship.fieldErrors.pipeline_id).toMatch(/service pipeline/i)
  })

  it('rejects stages that do not belong to the selected pipeline', () => {
    const result = validateCreateOpportunityInput(
      { ...baseInput, stage_id: 'stage-other' },
      { pipelines, stages, advisors, actorAdvisorId: null, role: 'owner' },
    )
    expect(result.ok).toBe(false)
    expect(result.fieldErrors.stage_id).toMatch(/not available|belong/i)
  })

  it('rejects closed/terminal stages as the initial create stage', () => {
    const result = validateCreateOpportunityInput(
      { ...baseInput, stage_id: 'stage-won' },
      { pipelines, stages, advisors, actorAdvisorId: null, role: 'owner' },
    )
    expect(result.ok).toBe(false)
    expect(result.fieldErrors.stage_id).toMatch(/open pipeline stage/i)
  })

  it('prevents advisors from assigning opportunities to other advisors', () => {
    const result = validateCreateOpportunityInput(
      { ...baseInput, assigned_advisor_id: 'adv-b' },
      {
        pipelines,
        stages,
        advisors,
        actorAdvisorId: 'adv-a',
        role: 'advisor',
      },
    )
    expect(result.ok).toBe(false)
    expect(result.fieldErrors.assigned_advisor_id).toMatch(/themselves/i)
  })
})

describe('validateUpdateOpportunityInput', () => {
  it('requires a title and validates optional next-action due date', () => {
    expect(validateUpdateOpportunityInput({ title: '' }).ok).toBe(false)
    expect(
      validateUpdateOpportunityInput({
        title: 'Keep title',
        next_action_due_at: 'not-a-date',
      }).fieldErrors.next_action_due_at,
    ).toMatch(/due date/i)
    expect(validateUpdateOpportunityInput({ title: 'Keep title' }).ok).toBe(true)
  })
})

describe('validateStageMove', () => {
  it('requires a stage on the opportunity pipeline', () => {
    expect(validateStageMove('', stages, 'pipe-life').ok).toBe(false)
    expect(validateStageMove('stage-won', stages, 'pipe-life').ok).toBe(true)
    expect(validateStageMove('stage-won', stages, 'pipe-other').ok).toBe(false)
  })
})

describe('normalize helpers', () => {
  it('trims create and update payloads', () => {
    expect(
      normalizeCreateOpportunityInput({
        ...baseInput,
        title: '  Trimmed  ',
        next_action: '  Call  ',
        assigned_advisor_id: '',
      }),
    ).toMatchObject({
      title: 'Trimmed',
      next_action: 'Call',
      assigned_advisor_id: null,
    })
    expect(
      normalizeUpdateOpportunityInput({
        title: '  Edit  ',
        next_action: '',
        next_action_due_at: '2026-08-01',
      }),
    ).toEqual({
      title: 'Edit',
      next_action: null,
      next_action_due_at: '2026-08-01',
      need_identified: true,
    })
  })
})
