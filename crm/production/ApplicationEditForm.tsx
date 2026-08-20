import { type FormEvent } from 'react'
import { formatMemberDisplayName } from './daysInStage'
import {
  formatApplicationProductLineLabel,
  formatProductionParticipantRoleLabel,
  formatProductionPremiumModeLabel,
} from './labels'
import {
  applicationNumberLockExplanation,
  allocationLockExplanation,
  catalogLockExplanation,
  canEditPolicyNumber,
  participantLockExplanation,
} from './applicationEditView'
import { requiredParticipantRoles, US_STATES } from './applicationView'
import type { ApplicationEditIntent } from './applicationEditView'
import WritingAdvisorsFields from './WritingAdvisorsFields'
import { PRODUCTION_PREMIUM_MODES as PREMIUM_MODES } from './types'
import type {
  ProductionAdvisorOption,
  ProductionAllocationDraft,
  ProductionEntryProductOption,
  ProductionMemberOption,
  ProductionParticipantRole,
  ProductionProductLine,
  ProductionStage,
} from './types'

export type ApplicationEditFormProps = {
  applicationId: string
  stage: ProductionStage
  isOwner: boolean
  submitting: boolean
  error: string | null
  success: string | null
  householdName: string
  members: ProductionMemberOption[]
  carriers: Array<{ id: string; name: string; code: string }>
  products: ProductionEntryProductOption[]
  advisors: ProductionAdvisorOption[]
  catalogLocked: boolean
  moneyLocked: boolean
  participantsLocked: boolean
  allocationsLocked: boolean
  numberMode: 'locked_pre_submit' | 'set' | 'correct' | 'locked_set'
  carrierId: string
  productId: string
  productLine: ProductionProductLine | ''
  state: string
  premiumMode: string
  plannedPremium: string
  faceAmount: string
  initialDeposit: string
  submissionDate: string
  nextFollowUpDate: string
  applicationNumber: string
  policyNumber: string
  applicationNumberReason: string
  participantReason: string
  allocationReason: string
  roleMembers: Partial<Record<ProductionParticipantRole, string>>
  allocations: ProductionAllocationDraft[]
  fieldErrors: Record<string, string | undefined>
  intents: ApplicationEditIntent[]
  onCarrierChange: (carrierId: string) => void
  onProductChange: (productId: string) => void
  onStateChange: (state: string) => void
  onPremiumModeChange: (mode: string) => void
  onPlannedPremiumChange: (value: string) => void
  onFaceAmountChange: (value: string) => void
  onInitialDepositChange: (value: string) => void
  onSubmissionDateChange: (value: string) => void
  onNextFollowUpDateChange: (value: string) => void
  onApplicationNumberChange: (value: string) => void
  onPolicyNumberChange: (value: string) => void
  onApplicationNumberReasonChange: (value: string) => void
  onParticipantReasonChange: (value: string) => void
  onAllocationReasonChange: (value: string) => void
  onRoleMemberChange: (role: ProductionParticipantRole, memberId: string) => void
  onAllocationsChange: (rows: ProductionAllocationDraft[]) => void
  onCancel: () => void
  onSubmit: (intent: ApplicationEditIntent) => void
}

export default function ApplicationEditForm(props: ApplicationEditFormProps) {
  const headingId = 'application-edit-heading'
  const isLife = props.productLine === 'life_term' || props.productLine === 'life_permanent'
  const isFia = props.productLine === 'fia'
  const roles = requiredParticipantRoles(props.productLine || null)
  const catalogNote = catalogLockExplanation(props.stage)
  const participantNote = participantLockExplanation({
    stage: props.stage,
    isOwner: props.isOwner,
  })
  const allocationNote = allocationLockExplanation({
    stage: props.stage,
    isOwner: props.isOwner,
  })
  const numberNote = applicationNumberLockExplanation(props.numberMode)
  const policyNumberEditable = canEditPolicyNumber(props.stage)
  const showParticipantReason =
    !props.participantsLocked &&
    participantLockExplanation({ stage: props.stage, isOwner: props.isOwner }) == null &&
    props.stage !== 'draft' &&
    props.stage !== 'pre_submitted'
  const showAllocationReason =
    !props.allocationsLocked && props.stage !== 'draft' && props.stage !== 'pre_submitted'

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (props.submitting) return
    props.onSubmit('save')
  }

  return (
    <section
      className="crm-panel crm-opportunity-form-panel crm-application-entry-form crm-application-edit-form"
      aria-labelledby={headingId}
    >
      <div className="crm-panel-head">
        <h2 id={headingId}>Edit application</h2>
      </div>

      {props.error ? (
        <p className="crm-banner crm-banner-error" role="alert">
          {props.error}
        </p>
      ) : null}
      {props.success ? (
        <p className="crm-banner crm-banner-success" role="status">
          {props.success}
        </p>
      ) : null}

      <p className="crm-muted">
        This screen edits application details. Move the case through stages from the Case workspace.
        Issued and in-force historical corrections are not handled here. Changes use separate RPCs
        and are not one database transaction. Saved steps stay saved if a later step fails.
      </p>

      <form className="crm-opportunity-form" onSubmit={handleSubmit} noValidate>
        <fieldset className="crm-application-entry-fieldset">
          <legend>Client</legend>
          <label className="crm-field crm-field-locked">
            <span>Household</span>
            <input value={props.householdName} disabled aria-label="Household" />
            <span className="crm-muted">Household cannot be changed on an existing application.</span>
          </label>
        </fieldset>

        <fieldset className="crm-application-entry-fieldset" disabled={props.submitting}>
          <legend>Product</legend>
          <label className={`crm-field${props.catalogLocked ? ' crm-field-locked' : ''}`}>
            <span>Carrier</span>
            <select
              aria-label="Carrier"
              value={props.carrierId}
              onChange={(e) => props.onCarrierChange(e.target.value)}
              disabled={props.submitting || props.catalogLocked}
              aria-invalid={Boolean(props.fieldErrors.carrierId)}
            >
              {props.carriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </select>
            {catalogNote ? <span className="crm-muted">{catalogNote}</span> : null}
            {props.fieldErrors.carrierId ? (
              <span className="crm-field-error">{props.fieldErrors.carrierId}</span>
            ) : null}
          </label>

          <label className={`crm-field${props.catalogLocked ? ' crm-field-locked' : ''}`}>
            <span>Product</span>
            <select
              aria-label="Product"
              value={props.productId}
              onChange={(e) => props.onProductChange(e.target.value)}
              disabled={props.submitting || props.catalogLocked}
              aria-invalid={Boolean(props.fieldErrors.productId)}
            >
              {props.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {formatApplicationProductLineLabel(product.product_line)}
                </option>
              ))}
            </select>
            <span className="crm-muted">
              Product line: {formatApplicationProductLineLabel(props.productLine || '')}
            </span>
            {props.fieldErrors.productId ? (
              <span className="crm-field-error">{props.fieldErrors.productId}</span>
            ) : null}
          </label>

          <label className={`crm-field${props.catalogLocked ? ' crm-field-locked' : ''}`}>
            <span>State</span>
            <select
              aria-label="State"
              value={props.state}
              onChange={(e) => props.onStateChange(e.target.value)}
              disabled={props.submitting || props.catalogLocked}
              aria-invalid={Boolean(props.fieldErrors.state)}
            >
              {US_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
            {props.fieldErrors.state ? (
              <span className="crm-field-error">{props.fieldErrors.state}</span>
            ) : null}
          </label>
        </fieldset>

        <fieldset className="crm-application-entry-fieldset" disabled={props.submitting}>
          <legend>Policy details</legend>
          {isLife ? (
            <>
              <label className={`crm-field${props.moneyLocked ? ' crm-field-locked' : ''}`}>
                <span>Submitted premium</span>
                <input
                  aria-label="Submitted premium (USD)"
                  inputMode="decimal"
                  value={props.plannedPremium}
                  onChange={(e) => props.onPlannedPremiumChange(e.target.value)}
                  disabled={props.submitting || props.moneyLocked}
                  aria-invalid={Boolean(props.fieldErrors.plannedPremium)}
                />
                {props.fieldErrors.plannedPremium ? (
                  <span className="crm-field-error">{props.fieldErrors.plannedPremium}</span>
                ) : null}
              </label>
              <label className={`crm-field${props.moneyLocked ? ' crm-field-locked' : ''}`}>
                <span>Premium mode</span>
                <select
                  aria-label="Premium mode"
                  value={props.premiumMode}
                  onChange={(e) => props.onPremiumModeChange(e.target.value)}
                  disabled={props.submitting || props.moneyLocked}
                  aria-invalid={Boolean(props.fieldErrors.premiumMode)}
                >
                  <option value="">Select a premium mode</option>
                  {PREMIUM_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {formatProductionPremiumModeLabel(mode)}
                    </option>
                  ))}
                </select>
                {props.fieldErrors.premiumMode ? (
                  <span className="crm-field-error">{props.fieldErrors.premiumMode}</span>
                ) : null}
              </label>
              <label className={`crm-field${props.moneyLocked ? ' crm-field-locked' : ''}`}>
                <span>Face amount (optional)</span>
                <input
                  aria-label="Face amount (USD)"
                  inputMode="decimal"
                  value={props.faceAmount}
                  onChange={(e) => props.onFaceAmountChange(e.target.value)}
                  disabled={props.submitting || props.moneyLocked}
                  aria-invalid={Boolean(props.fieldErrors.faceAmount)}
                />
                {props.fieldErrors.faceAmount ? (
                  <span className="crm-field-error">{props.fieldErrors.faceAmount}</span>
                ) : null}
              </label>
            </>
          ) : null}

          {isFia ? (
            <label className={`crm-field${props.moneyLocked ? ' crm-field-locked' : ''}`}>
              <span>Annuity deposit</span>
              <input
                aria-label="Annuity deposit (USD)"
                inputMode="decimal"
                value={props.initialDeposit}
                onChange={(e) => props.onInitialDepositChange(e.target.value)}
                disabled={props.submitting || props.moneyLocked}
                aria-invalid={Boolean(props.fieldErrors.initialDeposit)}
              />
              {props.fieldErrors.initialDeposit ? (
                <span className="crm-field-error">{props.fieldErrors.initialDeposit}</span>
              ) : null}
            </label>
          ) : null}

          <label className={`crm-field${props.moneyLocked ? ' crm-field-locked' : ''}`}>
            <span>Submission date</span>
            <input
              aria-label="Submission date"
              type="date"
              value={props.submissionDate}
              onChange={(e) => props.onSubmissionDateChange(e.target.value)}
              disabled={props.submitting || props.moneyLocked}
              aria-invalid={Boolean(props.fieldErrors.submissionDate)}
            />
            <span className="crm-muted">Optional. Stage-history timestamps cannot be backdated.</span>
            {props.fieldErrors.submissionDate ? (
              <span className="crm-field-error">{props.fieldErrors.submissionDate}</span>
            ) : null}
          </label>

          <label className={`crm-field${props.moneyLocked ? ' crm-field-locked' : ''}`}>
            <span>Next follow-up date</span>
            <input
              aria-label="Next follow-up date"
              type="date"
              value={props.nextFollowUpDate}
              onChange={(e) => props.onNextFollowUpDateChange(e.target.value)}
              disabled={props.submitting || props.moneyLocked}
              aria-invalid={Boolean(props.fieldErrors.nextFollowUpDate)}
            />
            {props.fieldErrors.nextFollowUpDate ? (
              <span className="crm-field-error">{props.fieldErrors.nextFollowUpDate}</span>
            ) : null}
          </label>

          <label
            className={`crm-field${props.numberMode === 'set' || props.numberMode === 'correct' ? '' : ' crm-field-locked'}`}
          >
            <span>Application number</span>
            <input
              aria-label="Application number"
              value={props.applicationNumber}
              onChange={(e) => props.onApplicationNumberChange(e.target.value)}
              disabled={
                props.submitting ||
                props.numberMode === 'locked_pre_submit' ||
                props.numberMode === 'locked_set'
              }
              aria-invalid={Boolean(props.fieldErrors.applicationNumber)}
            />
            {numberNote ? <span className="crm-muted">{numberNote}</span> : null}
            {props.numberMode === 'correct' ? (
              <span className="crm-muted">
                Changing an assigned number is an owner correction and writes one audit-log entry.
              </span>
            ) : null}
            {props.fieldErrors.applicationNumber ? (
              <span className="crm-field-error">{props.fieldErrors.applicationNumber}</span>
            ) : null}
          </label>
          {props.numberMode === 'correct' ? (
            <label className="crm-field">
              <span>Application-number correction reason</span>
              <input
                aria-label="Application-number correction reason"
                value={props.applicationNumberReason}
                onChange={(e) => props.onApplicationNumberReasonChange(e.target.value)}
                disabled={props.submitting}
                aria-invalid={Boolean(props.fieldErrors.applicationNumberReason)}
              />
              {props.fieldErrors.applicationNumberReason ? (
                <span className="crm-field-error">{props.fieldErrors.applicationNumberReason}</span>
              ) : null}
            </label>
          ) : null}

          <label className={`crm-field${policyNumberEditable ? '' : ' crm-field-locked'}`}>
            <span>Policy number</span>
            <input
              aria-label="Policy number"
              value={props.policyNumber}
              onChange={(e) => props.onPolicyNumberChange(e.target.value)}
              disabled={props.submitting || !policyNumberEditable}
              aria-invalid={Boolean(props.fieldErrors.policyNumber)}
            />
            {policyNumberEditable ? (
              <span className="crm-muted">Optional. Available after the application is submitted.</span>
            ) : (
              <span className="crm-muted">
                Policy number can be entered after submission through the existing update path.
              </span>
            )}
            {props.fieldErrors.policyNumber ? (
              <span className="crm-field-error">{props.fieldErrors.policyNumber}</span>
            ) : null}
          </label>

          <fieldset
            className="crm-application-entry-fieldset"
            disabled={props.submitting || props.participantsLocked}
          >
            <legend>Participants</legend>
            <p className="crm-muted">
              One household member may hold more than one role. The named client is assumed to be
              the insured or annuitant and the owner unless you assign someone else. FIA does not use an insured.
              {participantNote ? ` ${participantNote}` : ''}
            </p>
            {roles.map((role) => (
              <label key={role} className="crm-field">
                <span>{formatProductionParticipantRoleLabel(role)}</span>
                <select
                  aria-label={formatProductionParticipantRoleLabel(role)}
                  value={props.roleMembers[role] ?? ''}
                  onChange={(e) => props.onRoleMemberChange(role, e.target.value)}
                >
                  <option value="">Select a household member</option>
                  {props.members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {formatMemberDisplayName(member)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {showParticipantReason ? (
              <label className="crm-field">
                <span>Participant change reason</span>
                <input
                  aria-label="Participant change reason"
                  value={props.participantReason}
                  onChange={(e) => props.onParticipantReasonChange(e.target.value)}
                  aria-invalid={Boolean(props.fieldErrors.participantReason)}
                />
                {props.fieldErrors.participantReason ? (
                  <span className="crm-field-error">{props.fieldErrors.participantReason}</span>
                ) : null}
              </label>
            ) : null}
            {props.fieldErrors.participants ? (
              <span className="crm-field-error">{props.fieldErrors.participants}</span>
            ) : null}
          </fieldset>
        </fieldset>

        <WritingAdvisorsFields
          advisors={props.advisors}
          allocations={props.allocations}
          state={props.state}
          disabled={props.submitting || props.allocationsLocked}
          fieldError={props.fieldErrors.allocations}
          note={allocationNote}
          showReason={showAllocationReason}
          reason={props.allocationReason}
          reasonError={props.fieldErrors.allocationReason}
          onAllocationsChange={props.onAllocationsChange}
          onReasonChange={props.onAllocationReasonChange}
        />

        <div className="crm-form-actions crm-application-edit-actions">
          <button type="button" className="crm-secondary-btn" onClick={props.onCancel}>
            Cancel
          </button>
          <button type="submit" className="crm-primary-btn" disabled={props.submitting}>
            {props.submitting ? 'Saving…' : 'Save changes'}
          </button>
          {props.intents.includes('submitted') ? (
            <button
              type="button"
              className="crm-primary-btn"
              disabled={props.submitting}
              onClick={() => props.onSubmit('submitted')}
            >
              Save and mark submitted
            </button>
          ) : null}
          {props.intents.includes('in_underwriting') ? (
            <button
              type="button"
              className="crm-primary-btn"
              disabled={props.submitting}
              onClick={() => props.onSubmit('in_underwriting')}
            >
              Save and catch up to in underwriting
            </button>
          ) : null}
        </div>
      </form>
    </section>
  )
}
