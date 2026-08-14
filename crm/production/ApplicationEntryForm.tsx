import { useId, useMemo, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { formatMemberDisplayName } from './daysInStage'
import {
  formatCatalogProductLineLabel,
  formatProductionEntryStageLabel,
  formatProductionParticipantRoleLabel,
  formatProductionPremiumModeLabel,
} from './labels'
import {
  US_STATES,
  requiredParticipantRoles,
  writingBpsTotals,
} from './applicationView'
import { PRODUCTION_ENTRY_STAGES, PRODUCTION_PREMIUM_MODES } from './types'
import type {
  ProductionAdvisorOption,
  ProductionAllocationDraft,
  ProductionEntryProductOption,
  ProductionEntryStage,
  ProductionHouseholdOption,
  ProductionMemberOption,
  ProductionParticipantRole,
  ProductionProductLine,
} from './types'

export type ApplicationEntryFormProps = {
  submitting: boolean
  error: string | null
  recoveryApplicationId: string | null
  households: ProductionHouseholdOption[]
  members: ProductionMemberOption[]
  carriers: Array<{ id: string; name: string; code: string }>
  products: ProductionEntryProductOption[]
  advisors: ProductionAdvisorOption[]
  householdId: string
  carrierId: string
  productId: string
  productLine: ProductionProductLine | ''
  state: string
  targetStage: ProductionEntryStage | ''
  premiumMode: string
  plannedPremium: string
  faceAmount: string
  initialDeposit: string
  applicationNumber: string
  submissionDate: string
  roleMembers: Partial<Record<ProductionParticipantRole, string>>
  allocations: ProductionAllocationDraft[]
  fieldErrors: Record<string, string | undefined>
  onHouseholdChange: (householdId: string) => void
  onCarrierChange: (carrierId: string) => void
  onProductChange: (productId: string) => void
  onStateChange: (state: string) => void
  onTargetStageChange: (stage: ProductionEntryStage) => void
  onPremiumModeChange: (mode: string) => void
  onPlannedPremiumChange: (value: string) => void
  onFaceAmountChange: (value: string) => void
  onInitialDepositChange: (value: string) => void
  onApplicationNumberChange: (value: string) => void
  onSubmissionDateChange: (value: string) => void
  onRoleMemberChange: (role: ProductionParticipantRole, memberId: string) => void
  onAllocationsChange: (rows: ProductionAllocationDraft[]) => void
  onSubmit: () => void
}

export default function ApplicationEntryForm(props: ApplicationEntryFormProps) {
  const headingId = useId()
  const isLife = props.productLine === 'life_term' || props.productLine === 'life_permanent'
  const isFia = props.productLine === 'fia'
  const roles = requiredParticipantRoles(props.productLine || null)
  const totals = writingBpsTotals(props.allocations)
  const selectedAdvisorIds = useMemo(
    () => new Set(props.allocations.map((row) => row.advisor_id)),
    [props.allocations],
  )

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (props.submitting) return
    props.onSubmit()
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
      className="crm-panel crm-opportunity-form-panel crm-application-entry-form"
      aria-labelledby={headingId}
    >
      <div className="crm-panel-head">
        <h2 id={headingId}>Application details</h2>
      </div>

      {props.error ? (
        <p className="crm-banner crm-banner-error" role="alert">
          {props.error}
          {props.recoveryApplicationId ? (
            <>
              {' '}
              <Link to={`${ROUTES.crmProduction}/${props.recoveryApplicationId}`}>
                Open the saved draft
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <form className="crm-opportunity-form" onSubmit={handleSubmit} noValidate>
        <label className="crm-field">
          <span>Household</span>
          <select
            aria-label="Household"
            value={props.householdId}
            onChange={(e) => props.onHouseholdChange(e.target.value)}
            required
            disabled={props.submitting}
            aria-invalid={Boolean(props.fieldErrors.householdId)}
          >
            <option value="">Select a household</option>
            {props.households.map((household) => (
              <option key={household.id} value={household.id}>
                {household.display_name}
              </option>
            ))}
          </select>
          {props.fieldErrors.householdId ? (
            <span className="crm-field-error">{props.fieldErrors.householdId}</span>
          ) : null}
        </label>

        <label className="crm-field">
          <span>Carrier</span>
          <select
            aria-label="Carrier"
            value={props.carrierId}
            onChange={(e) => props.onCarrierChange(e.target.value)}
            required
            disabled={props.submitting}
            aria-invalid={Boolean(props.fieldErrors.carrierId)}
          >
            <option value="">Select a carrier</option>
            {props.carriers.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name} ({carrier.code})
              </option>
            ))}
          </select>
          {props.fieldErrors.carrierId ? (
            <span className="crm-field-error">{props.fieldErrors.carrierId}</span>
          ) : null}
        </label>

        <label className="crm-field">
          <span>Product</span>
          <select
            aria-label="Product"
            value={props.productId}
            onChange={(e) => props.onProductChange(e.target.value)}
            required
            disabled={props.submitting || !props.carrierId}
            aria-invalid={Boolean(props.fieldErrors.productId)}
          >
            <option value="">Select a product</option>
            {props.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} — {formatCatalogProductLineLabel(product.product_line)}
              </option>
            ))}
          </select>
          {props.productLine ? (
            <span className="crm-muted">
              Product line is {formatCatalogProductLineLabel(props.productLine)} and cannot be changed.
            </span>
          ) : null}
          {props.fieldErrors.productId ? (
            <span className="crm-field-error">{props.fieldErrors.productId}</span>
          ) : null}
        </label>

        <label className="crm-field">
          <span>State</span>
          <select
            aria-label="State"
            value={props.state}
            onChange={(e) => props.onStateChange(e.target.value)}
            required
            disabled={props.submitting}
            aria-invalid={Boolean(props.fieldErrors.state)}
          >
            <option value="">Select a state</option>
            {US_STATES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          {props.fieldErrors.state ? (
            <span className="crm-field-error">{props.fieldErrors.state}</span>
          ) : null}
        </label>

        <label className="crm-field">
          <span>Current stage</span>
          <select
            aria-label="Current stage"
            value={props.targetStage}
            onChange={(e) => props.onTargetStageChange(e.target.value as ProductionEntryStage)}
            required
            disabled={props.submitting}
            aria-invalid={Boolean(props.fieldErrors.targetStage)}
          >
            <option value="">Select the current stage</option>
            {PRODUCTION_ENTRY_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {formatProductionEntryStageLabel(stage)}
              </option>
            ))}
          </select>
          <span className="crm-muted">
            Catch-up to In underwriting records Draft → Submitted → In underwriting. Stage history
            timestamps are the time of entry, not a backdated carrier timeline.
          </span>
          {props.fieldErrors.targetStage ? (
            <span className="crm-field-error">{props.fieldErrors.targetStage}</span>
          ) : null}
        </label>

        {isLife ? (
          <>
            <label className="crm-field">
              <span>Planned premium (USD)</span>
              <input
                aria-label="Planned premium (USD)"
                type="text"
                inputMode="decimal"
                value={props.plannedPremium}
                onChange={(e) => props.onPlannedPremiumChange(e.target.value)}
                required
                disabled={props.submitting}
                aria-invalid={Boolean(props.fieldErrors.plannedPremium)}
                autoComplete="off"
              />
              {props.fieldErrors.plannedPremium ? (
                <span className="crm-field-error">{props.fieldErrors.plannedPremium}</span>
              ) : null}
            </label>
            <label className="crm-field">
              <span>Premium mode</span>
              <select
                aria-label="Premium mode"
                value={props.premiumMode}
                onChange={(e) => props.onPremiumModeChange(e.target.value)}
                required
                disabled={props.submitting}
                aria-invalid={Boolean(props.fieldErrors.premiumMode)}
              >
                <option value="">Select a premium mode</option>
                {PRODUCTION_PREMIUM_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {formatProductionPremiumModeLabel(mode)}
                  </option>
                ))}
              </select>
              {props.fieldErrors.premiumMode ? (
                <span className="crm-field-error">{props.fieldErrors.premiumMode}</span>
              ) : null}
            </label>
            <label className="crm-field">
              <span>Face amount (USD, optional)</span>
              <input
                type="text"
                inputMode="decimal"
                value={props.faceAmount}
                onChange={(e) => props.onFaceAmountChange(e.target.value)}
                disabled={props.submitting}
                aria-invalid={Boolean(props.fieldErrors.faceAmount)}
                autoComplete="off"
              />
              {props.fieldErrors.faceAmount ? (
                <span className="crm-field-error">{props.fieldErrors.faceAmount}</span>
              ) : null}
            </label>
          </>
        ) : null}

        {isFia ? (
          <label className="crm-field">
            <span>Initial deposit (USD)</span>
            <input
              aria-label="Initial deposit (USD)"
              type="text"
              inputMode="decimal"
              value={props.initialDeposit}
              onChange={(e) => props.onInitialDepositChange(e.target.value)}
              required
              disabled={props.submitting}
              aria-invalid={Boolean(props.fieldErrors.initialDeposit)}
              autoComplete="off"
            />
            {props.fieldErrors.initialDeposit ? (
              <span className="crm-field-error">{props.fieldErrors.initialDeposit}</span>
            ) : null}
          </label>
        ) : null}

        <label className="crm-field">
          <span>Application number (optional)</span>
          <input
            value={props.applicationNumber}
            onChange={(e) => props.onApplicationNumberChange(e.target.value)}
            maxLength={60}
            disabled={props.submitting}
            aria-invalid={Boolean(props.fieldErrors.applicationNumber)}
            autoComplete="off"
          />
          <span className="crm-muted">Leave blank to let the system leave it unset until later.</span>
          {props.fieldErrors.applicationNumber ? (
            <span className="crm-field-error">{props.fieldErrors.applicationNumber}</span>
          ) : null}
        </label>

        {props.targetStage === 'submitted' || props.targetStage === 'in_underwriting' ? (
          <label className="crm-field">
            <span>Submission date (optional)</span>
            <input
              type="date"
              value={props.submissionDate}
              onChange={(e) => props.onSubmissionDateChange(e.target.value)}
              disabled={props.submitting}
              aria-invalid={Boolean(props.fieldErrors.submissionDate)}
            />
            <span className="crm-muted">
              Stored on the application. Stage history still records the time this catch-up is entered.
            </span>
            {props.fieldErrors.submissionDate ? (
              <span className="crm-field-error">{props.fieldErrors.submissionDate}</span>
            ) : null}
          </label>
        ) : null}

        {roles.length > 0 ? (
          <fieldset className="crm-application-entry-fieldset" disabled={props.submitting}>
            <legend>Participants</legend>
            <p className="crm-muted">
              One household member may hold more than one role. FIA does not use an insured.
            </p>
            {roles.map((role) => (
              <label key={role} className="crm-field">
                <span>{formatProductionParticipantRoleLabel(role)}</span>
                <select
                  value={props.roleMembers[role] ?? ''}
                  onChange={(e) => props.onRoleMemberChange(role, e.target.value)}
                  required
                  aria-invalid={Boolean(props.fieldErrors.participants)}
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
            {props.fieldErrors.participants ? (
              <span className="crm-field-error">{props.fieldErrors.participants}</span>
            ) : null}
          </fieldset>
        ) : null}

        <fieldset className="crm-application-entry-fieldset" disabled={props.submitting}>
          <legend>Writing allocation</legend>
          <p className="crm-muted">
            Commission bps and production credit bps must each total 10,000. House share is not used
            in this step.
          </p>
          {props.allocations.map((row, index) => (
            <div key={`${row.advisor_id}-${index}`} className="crm-application-allocation-row">
              <label className="crm-field">
                <span>Writing advisor</span>
                <select
                  value={row.advisor_id}
                  onChange={(e) => updateWriter(index, { advisor_id: e.target.value })}
                  required
                >
                  <option value="">Select an advisor</option>
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
                  type="number"
                  min={0}
                  max={10000}
                  value={row.commission_bps}
                  onChange={(e) => updateWriter(index, { commission_bps: Number(e.target.value) })}
                  required
                />
              </label>
              <label className="crm-field">
                <span>Production credit bps</span>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={row.production_credit_bps}
                  onChange={(e) =>
                    updateWriter(index, { production_credit_bps: Number(e.target.value) })
                  }
                  required
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
          {props.fieldErrors.allocations ? (
            <span className="crm-field-error">{props.fieldErrors.allocations}</span>
          ) : null}
        </fieldset>

        <div className="crm-form-actions">
          <Link to={ROUTES.crmProduction} className="crm-secondary-btn">
            Cancel
          </Link>
          <button type="submit" className="crm-primary-btn" disabled={props.submitting}>
            {props.submitting ? 'Saving…' : 'Create application'}
          </button>
        </div>
      </form>
    </section>
  )
}
