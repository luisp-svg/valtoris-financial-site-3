import { describe, expect, it } from 'vitest'
import { canSubmitApplicationForm } from './applicationView'
import {
  allowedNextStages,
  canShowStageTransitionControls,
  expectedCompensationDoesNotBlockSubmit,
  isBackwardStageTransition,
  isOwnerOnlyStageTransition,
  isTerminalProductionStage,
  PRODUCTION_STAGE_TRANSITIONS,
  stageTransitionAction,
} from './stageTransitionView'

describe('production stage transition UX (032 matrix)', () => {
  it('renders the current tracked stages and no compensation statuses', () => {
    expect(new Set(Object.keys(PRODUCTION_STAGE_TRANSITIONS))).toEqual(
      new Set([
        'draft',
        'pre_submitted',
        'submitted',
        'in_underwriting',
        'postponed',
        'approved',
        'issued',
        'declined',
        'withdrawn',
        'incomplete',
        'not_taken',
        'in_force',
      ]),
    )
    const blob = JSON.stringify(PRODUCTION_STAGE_TRANSITIONS)
    expect(blob).not.toMatch(/pending|eligible|released/i)
    expect(isTerminalProductionStage('in_force')).toBe(true)
    expect(isTerminalProductionStage('draft')).toBe(false)
  })

  it('offers owner valid next stages and does not offer invalid ones', () => {
    expect(
      allowedNextStages({ from: 'draft', role: 'owner' }),
    ).toEqual(['pre_submitted', 'submitted', 'withdrawn'])
    expect(allowedNextStages({ from: 'draft', role: 'owner' })).not.toContain('issued')
    expect(allowedNextStages({ from: 'draft', role: 'owner' })).not.toContain('in_force')
    expect(allowedNextStages({ from: 'in_force', role: 'owner' })).toEqual([])
    expect(allowedNextStages({ from: 'approved', role: 'owner' })).toEqual([
      'in_underwriting',
      'issued',
      'not_taken',
      'withdrawn',
    ])
  })

  it('does not expose unauthorized or owner-only controls to advisors', () => {
    expect(canShowStageTransitionControls({ from: 'draft', role: 'advisor' })).toBe(true)
    expect(allowedNextStages({ from: 'approved', role: 'advisor' })).toEqual([
      'issued',
      'not_taken',
      'withdrawn',
    ])
    expect(allowedNextStages({ from: 'approved', role: 'advisor' })).not.toContain('in_underwriting')
    expect(isOwnerOnlyStageTransition('approved', 'in_underwriting')).toBe(true)
    expect(canShowStageTransitionControls({ from: 'draft', role: null })).toBe(false)
    expect(canShowStageTransitionControls({ from: 'draft', role: 'owner', deletedAt: '2026-01-01' })).toBe(
      false,
    )
  })

  it('requires confirmation copy for issue, withdrawn, and declined', () => {
    expect(stageTransitionAction('approved', 'issued').confirmTitle).toBe('Issue this policy?')
    expect(stageTransitionAction('approved', 'issued').confirmBody.join(' ')).toMatch(/finalizes expected compensation/)
    expect(stageTransitionAction('draft', 'withdrawn').confirmTitle).toBe(
      'Mark this application withdrawn?',
    )
    expect(stageTransitionAction('in_underwriting', 'declined').confirmTitle).toBe(
      'Mark this application declined?',
    )
    expect(isBackwardStageTransition('approved', 'in_underwriting')).toBe(true)
    expect(stageTransitionAction('approved', 'in_underwriting').needsReason).toBe(true)
    expect(stageTransitionAction('approved', 'issued', { policyNumber: null }).needsPolicyNumber).toBe(
      true,
    )
  })

  it('does not let unresolved expected compensation block submit UI', () => {
    expect(expectedCompensationDoesNotBlockSubmit({ from: 'draft', expectedStatus: 'review_required' })).toBe(
      true,
    )
    expect(expectedCompensationDoesNotBlockSubmit({ from: 'draft', expectedStatus: 'unavailable' })).toBe(
      true,
    )
    expect(canSubmitApplicationForm({ submitting: false, invalid: false })).toBe(true)
  })

  it('hides in_force until delivery is complete or not required', () => {
    expect(
      allowedNextStages({ from: 'issued', role: 'owner', deliveryStatus: 'not_started' }),
    ).toEqual(['not_taken'])
    expect(
      allowedNextStages({ from: 'issued', role: 'owner', deliveryStatus: 'complete' }),
    ).toEqual(['in_force', 'not_taken'])
  })
})
