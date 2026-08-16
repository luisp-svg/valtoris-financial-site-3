import { type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../constants/routes'
import { formatMemberDisplayName } from './daysInStage'
import {
  formatApplicationProductLineLabel,
  formatProductionEntryStageLabel,
  formatProductionParticipantRoleLabel,
  formatProductionPremiumModeLabel,
} from './labels'
import { US_STATES, requiredParticipantRoles } from './applicationView'
import WritingAdvisorsFields from './WritingAdvisorsFields'
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
  onCancel: () => void
  onSubmit: () => void
}

function householdLabel(
  households: ProductionHouseholdOption[],
  householdId: string,
): string {
  return households.find((row) => row.id === householdId)?.display_name ?? '—'
}

function carrierLabel(
  carriers: Array<{ id: string; name: string }>,
  carrierId: string,
): string {
  return carriers.find((row) => row.id === carrierId)?.name ?? '—'
}

function productLabel(products: ProductionEntryProductOption[], productId: string): string {
  return products.find((row) => row.id === productId)?.name ?? '—'
}

export default function ApplicationEntryForm(props: ApplicationEntryFormProps) {
  const headingId = 'application-entry-heading'
  const isLife = props.productLine === 'life_term' || props.productLine === 'life_permanent'
  const isFia = props.productLine === 'fia'
  const roles = requiredParticipantRoles(props.productLine || null)
  const selectedHousehold = householdLabel(props.households, props.householdId)
  const selectedCarrier = carrierLabel(props.carriers, props.carrierId)
  const selectedProduct = productLabel(props.products, props.productId)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (props.submitting) return
    props.onSubmit()
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
        <fieldset className="crm-application-entry-fieldset" disabled={props.submitting}>
          <legend>Client</legend>
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
        </fieldset>

        <fieldset className="crm-application-entry-fieldset" disabled={props.submitting}>
          <legend>Product</legend>
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
                  {product.name} — {formatApplicationProductLineLabel(product.product_line)}
                </option>
              ))}
            </select>
            {props.productLine ? (
              <span className="crm-muted">
                Product line: {formatApplicationProductLineLabel(props.productLine)}
              </span>
            ) : (
              <span className="crm-muted">Choose a carrier first. Products are filtered to that carrier.</span>
            )}
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
        </fieldset>

        <fieldset className="crm-application-entry-fieldset" disabled={props.submitting}>
          <legend>Policy details</legend>
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
              {PRODUCTION_ENTRY_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {formatProductionEntryStageLabel(stage)}
                </option>
              ))}
            </select>
            <span className="crm-muted">
              Draft saves without submitting. Catch-up to In underwriting records Draft → Submitted →
              In underwriting through existing stage controls.
            </span>
            {props.fieldErrors.targetStage ? (
              <span className="crm-field-error">{props.fieldErrors.targetStage}</span>
            ) : null}
          </label>

          {isLife ? (
            <>
              <label className="crm-field">
                <span>Submitted premium (USD)</span>
                <input
                  aria-label="Submitted premium (USD)"
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
              <span>Annuity deposit (USD)</span>
              <input
                aria-label="Annuity deposit (USD)"
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
            <>
              <p className="crm-muted">
                One household member may hold more than one role. The named client is assumed to be
                the insured or annuitant and the owner unless you assign someone else. FIA does not use an insured.
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
            </>
          ) : null}
        </fieldset>

        <WritingAdvisorsFields
          advisors={props.advisors}
          allocations={props.allocations}
          state={props.state}
          disabled={props.submitting}
          fieldError={props.fieldErrors.allocations}
          onAllocationsChange={props.onAllocationsChange}
        />

        <fieldset className="crm-application-entry-fieldset crm-application-review">
          <legend>Review</legend>
          <dl className="crm-opportunity-form-readonly">
            <div>
              <dt>Client</dt>
              <dd>{selectedHousehold}</dd>
            </div>
            <div>
              <dt>Carrier</dt>
              <dd>{selectedCarrier}</dd>
            </div>
            <div>
              <dt>Product</dt>
              <dd>
                {selectedProduct}
                {props.productLine
                  ? ` · ${formatApplicationProductLineLabel(props.productLine)}`
                  : ''}
              </dd>
            </div>
            <div>
              <dt>Stage</dt>
              <dd>{formatProductionEntryStageLabel(props.targetStage || '')}</dd>
            </div>
          </dl>
          <p className="crm-muted">
            Expected compensation is calculated after submit. Drafts do not fabricate it, and
            unresolved compensation does not block saving this application.
          </p>
        </fieldset>

        <div className="crm-form-actions">
          <button type="button" className="crm-secondary-btn" onClick={props.onCancel}>
            Cancel
          </button>
          <button type="submit" className="crm-primary-btn" disabled={props.submitting}>
            {props.submitting ? 'Saving…' : 'Create application'}
          </button>
        </div>
      </form>
    </section>
  )
}
