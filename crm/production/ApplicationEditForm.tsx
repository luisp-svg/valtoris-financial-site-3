import { useId, useMemo, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { crmProductionPath } from '../../constants/routes'
import { formatMemberDisplayName } from './daysInStage'
import {
  formatCatalogProductLineLabel,
  formatProductionParticipantRoleLabel,
  formatProductionPremiumModeLabel,
} from './labels'
import {
  applicationNumberLockExplanation,
  allocationLockExplanation,
  catalogLockExplanation,
  participantLockExplanation,
} from './applicationEditView'
import { requiredParticipantRoles, US_STATES, writingBpsTotals } from './applicationView'
import type { ApplicationEditIntent } from './applicationEditView'
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
  onApplicationNumberReasonChange: (value: string) => void
  onParticipantReasonChange: (value: string) => void
  onAllocationReasonChange: (value: string) => void
  onRoleMemberChange: (role: ProductionParticipantRole, memberId: string) => void
  onAllocationsChange: (rows: ProductionAllocationDraft[]) => void
  onSubmit: (intent: ApplicationEditIntent) => void
}

export default function ApplicationEditForm(props: ApplicationEditFormProps) {
  const headingId = useId()
  const isLife = props.productLine === 'life_term' || props.productLine === 'life_permanent'
  const isFia = props.productLine === 'fia'
  const roles = requiredParticipantRoles(props.productLine || null)
  const totals = writingBpsTotals(props.allocations)
  const selectedAdvisorIds = useMemo(
    () => new Set(props.allocations.map((row) => row.advisor_id)),
    [props.allocations],
  )
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

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (props.submitting) return
    props.onSubmit('save')
  }

  function addWriter() {
    const next = props.advisors.find((advisor) => !selectedAdvisorIds.has(advisor.id))
    if (!next) return
    props.onAllocationsChange([
      ...props.allocations,
      {
        recipient_type: 'advisor',
        advisor_id: next.id,
        allocation_role: 'writing',
        commission_bps: 0,
        production_credit_bps: 0,
      },
    ])
  }

  function updateWriter(index: number, patch: Partial<ProductionAllocationDraft>) {
    props.onAllocationsChange(
      props.allocations.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    )
  }

  function removeWriter(index: number) {
    props.onAllocationsChange(props.allocations.filter((_, i) => i !== index))
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
        Changes use separate RPCs and are not one database transaction. Saved steps stay saved if a
        later step fails. Nothing is rolled back.
      </p>

      <form className="crm-opportunity-form" onSubmit={handleSubmit} noValidate>
        <label className="crm-field crm-field-locked">
          <span>Household</span>
          <input value={props.householdName} disabled aria-label="Household" />
          <span className="crm-muted">Household cannot be changed on an existing application.</span>
        </label>

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
                {product.name} · {formatCatalogProductLineLabel(product.product_line)}
              </option>
            ))}
          </select>
          <span className="crm-muted">
            Product line is {formatCatalogProductLineLabel(props.productLine || '')} and comes from
            the selected product.
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

        {isLife ? (
          <>
            <label className={`crm-field${props.moneyLocked ? ' crm-field-locked' : ''}`}>
              <span>Planned premium</span>
              <input
                aria-label="Planned premium (USD)"
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
            <span>Initial deposit</span>
            <input
              aria-label="Initial deposit (USD)"
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
          <span className="crm-muted">
            Optional. Stage-history timestamps cannot be backdated.
          </span>
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

        <label className={`crm-field${props.numberMode === 'set' || props.numberMode === 'correct' ? '' : ' crm-field-locked'}`}>
          <span>Application number</span>
          <input
            aria-label="Application number"
            value={props.applicationNumber}
            onChange={(e) => props.onApplicationNumberChange(e.target.value)}
            disabled={props.submitting || props.numberMode === 'locked_pre_submit' || props.numberMode === 'locked_set'}
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

        <fieldset className="crm-application-entry-fieldset" disabled={props.submitting || props.participantsLocked}>
          <legend>Participants</legend>
          <p className="crm-muted">
            One household member may hold more than one role. FIA does not use an insured.
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
          {props.participantsLocked ? null : participantNote ? (
            <p className="crm-muted">{participantNote}</p>
          ) : null}
          {!props.participantsLocked && participantLockExplanation({ stage: props.stage, isOwner: props.isOwner }) == null &&
          props.stage !== 'draft' &&
          props.stage !== 'pre_submitted' ? (
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

        <fieldset className="crm-application-entry-fieldset" disabled={props.submitting || props.allocationsLocked}>
          <legend>Writing allocation</legend>
          <p className="crm-muted">
            Commission and production credit must each total 10,000 bps. House allocations are
            omitted. Existing writing rows are preserved until you edit them.
            {allocationNote ? ` ${allocationNote}` : ''}
          </p>
          {props.allocations.map((row, index) => (
            <div key={`${row.advisor_id}-${index}`} className="crm-application-allocation-row">
              <label className="crm-field">
                <span>Writing advisor</span>
                <select
                  aria-label={`Writing advisor ${index + 1}`}
                  value={row.advisor_id}
                  onChange={(e) => updateWriter(index, { advisor_id: e.target.value })}
                >
                  {props.advisors.map((advisor) => (
                    <option key={advisor.id} value={advisor.id}>
                      {advisor.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="crm-field">
                <span>Commission bps</span>
                <input
                  aria-label={`Commission bps ${index + 1}`}
                  inputMode="numeric"
                  value={String(row.commission_bps)}
                  onChange={(e) =>
                    updateWriter(index, { commission_bps: Number(e.target.value || 0) })
                  }
                />
              </label>
              <label className="crm-field">
                <span>Production credit bps</span>
                <input
                  aria-label={`Production credit bps ${index + 1}`}
                  inputMode="numeric"
                  value={String(row.production_credit_bps)}
                  onChange={(e) =>
                    updateWriter(index, { production_credit_bps: Number(e.target.value || 0) })
                  }
                />
              </label>
              {props.allocations.length > 1 ? (
                <button type="button" className="crm-text-btn" onClick={() => removeWriter(index)}>
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          <p className="crm-muted">
            Totals: {totals.commission} / {totals.productionCredit} bps
            {totals.valid ? ' (valid)' : ' (must equal 10,000 / 10,000)'}
          </p>
          {props.advisors.some((advisor) => !selectedAdvisorIds.has(advisor.id)) ? (
            <button type="button" className="crm-secondary-btn" onClick={addWriter}>
              Add writing advisor
            </button>
          ) : null}
          {!props.allocationsLocked &&
          props.stage !== 'draft' &&
          props.stage !== 'pre_submitted' ? (
            <label className="crm-field">
              <span>Allocation change reason</span>
              <input
                aria-label="Allocation change reason"
                value={props.allocationReason}
                onChange={(e) => props.onAllocationReasonChange(e.target.value)}
                aria-invalid={Boolean(props.fieldErrors.allocationReason)}
              />
              {props.fieldErrors.allocationReason ? (
                <span className="crm-field-error">{props.fieldErrors.allocationReason}</span>
              ) : null}
            </label>
          ) : null}
          {props.fieldErrors.allocations ? (
            <span className="crm-field-error">{props.fieldErrors.allocations}</span>
          ) : null}
        </fieldset>

        <div className="crm-form-actions crm-application-edit-actions">
          <Link to={crmProductionPath(props.applicationId)} className="crm-secondary-btn">
            Cancel
          </Link>
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