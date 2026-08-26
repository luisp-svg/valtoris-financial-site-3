import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import {
  fetchActiveApplicationCarriers,
  fetchActiveApplicationProducts,
  fetchActiveWritingAdvisors,
  fetchApplicationMembers,
} from '../production/applicationApi'
import {
  formatApplicationProductLineLabel,
  formatProductionParticipantRoleLabel,
  formatProductionStageLabel,
} from '../production/labels'
import { formatMemberDisplayName } from '../production/daysInStage'
import WritingAdvisorsFields from '../production/WritingAdvisorsFields'
import {
  requiredParticipantRoles,
  US_STATES,
} from '../production/applicationView'
import { PRODUCTION_PREMIUM_MODES } from '../production/types'
import type {
  ProductionAdvisorOption,
  ProductionAllocationDraft,
  ProductionEntryProductOption,
  ProductionMemberOption,
  ProductionParticipantRole,
  ProductionProductLine,
} from '../production/types'
import {
  convertOpportunityToPolicyApplication,
  formatConvertOpportunityUserError,
  type ConvertOpportunityResult,
} from './convertOpportunityApi'
import {
  carriersForConversion,
  productsForConversion,
  START_APPLICATION_DIALOG_COPY,
  suggestedWritingAllocations,
  validateConversionDraft,
} from './convertOpportunityView'
import {
  formatOpportunityStatusLabel,
  getOpportunityHouseholdLabel,
  getOpportunityVerticalLabel,
} from './opportunitiesApi'
import { getOpportunityPrimaryProductLabel } from './pipelineView'
import type { OpportunityDetail } from './types'

export type ConvertOpportunityToCaseDialogProps = {
  opportunity: OpportunityDetail
  onCancel: () => void
  onConverted: (result: ConvertOpportunityResult) => void
}

function memberLabel(member: ProductionMemberOption): string {
  return formatMemberDisplayName(member)
}

export default function ConvertOpportunityToCaseDialog({
  opportunity,
  onCancel,
  onConverted,
}: ConvertOpportunityToCaseDialogProps) {
  const headingId = useId()
  const firstFieldRef = useRef<HTMLSelectElement>(null)
  const verticalCode = opportunity.service_vertical?.code ?? null
  const isLife = verticalCode === 'life'
  const isRetirement = verticalCode === 'retirement'

  const [carrierId, setCarrierId] = useState('')
  const [productId, setProductId] = useState('')
  const [state, setState] = useState('')
  const [plannedPremium, setPlannedPremium] = useState('')
  const [premiumMode, setPremiumMode] = useState('')
  const [faceAmount, setFaceAmount] = useState('')
  const [initialDeposit, setInitialDeposit] = useState('')
  const [roleMembers, setRoleMembers] = useState<Partial<Record<ProductionParticipantRole, string>>>(
    {},
  )
  const [allocations, setAllocations] = useState<ProductionAllocationDraft[]>([])

  const [carriers, setCarriers] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [products, setProducts] = useState<ProductionEntryProductOption[]>([])
  const [members, setMembers] = useState<ProductionMemberOption[]>([])
  const [advisors, setAdvisors] = useState<ProductionAdvisorOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({})

  const visibleCarriers = useMemo(
    () => carriersForConversion(carriers, products, verticalCode),
    [carriers, products, verticalCode],
  )
  const visibleProducts = useMemo(
    () => productsForConversion(products, carrierId, verticalCode),
    [products, carrierId, verticalCode],
  )
  const selectedProduct = visibleProducts.find((row) => row.id === productId) ?? null
  const productLine: ProductionProductLine | null = selectedProduct?.product_line ?? null
  const roles = requiredParticipantRoles(productLine)

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setOptionsLoading(true)
      setOptionsError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const [carrierRows, productRows, memberRows, advisorRows] = await Promise.all([
          fetchActiveApplicationCarriers(supabase),
          fetchActiveApplicationProducts(supabase),
          fetchApplicationMembers(supabase, opportunity.household_id),
          fetchActiveWritingAdvisors(supabase),
        ])
        if (cancelled) return
        setCarriers(carrierRows)
        setProducts(productRows)
        setMembers(memberRows)
        setAdvisors(advisorRows)
        setAllocations(
          suggestedWritingAllocations(opportunity.assigned_advisor_id, advisorRows),
        )
      } catch (err) {
        if (cancelled) return
        setOptionsError('Unable to load conversion options. Please try again.')
        if (import.meta.env.DEV) console.error('[crm/opportunities/convert]', err)
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [opportunity.assigned_advisor_id, opportunity.household_id])

  function setRole(role: ProductionParticipantRole, memberId: string) {
    setRoleMembers((current) => ({ ...current, [role]: memberId }))
  }

  function handleCarrierChange(next: string) {
    setCarrierId(next)
    setProductId('')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    if (!productLine) {
      setFieldErrors({ productId: 'Choose a product' })
      setSubmitError('Choose a carrier and product to continue.')
      return
    }
    const validation = validateConversionDraft({
      verticalCode,
      carrierId,
      productId,
      productLine,
      state,
      plannedPremium,
      premiumMode,
      faceAmount,
      initialDeposit,
      roleMembers,
      allocations,
      householdMemberIds: members.map((row) => row.id),
    })
    if (validation.invalid) {
      setFieldErrors(validation.fieldErrors)
      setSubmitError('Please fix the highlighted fields and try again.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const result = await convertOpportunityToPolicyApplication(supabase, opportunity.id, {
        carrierId,
        productId,
        productLine,
        state,
        plannedPremium,
        premiumMode,
        faceAmount,
        initialDeposit,
        roleMembers,
        allocations,
      })
      onConverted(result)
    } catch (err) {
      setSubmitError(formatConvertOpportunityUserError(err))
      if (import.meta.env.DEV) console.error('[crm/opportunities/convert]', err)
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting || optionsLoading

  return (
    <div className="crm-opportunity-convert-overlay" role="presentation">
      <section
        className="crm-panel crm-opportunity-form-panel crm-opportunity-convert-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <div className="crm-panel-head">
          <h2 id={headingId}>Start Application</h2>
          <button type="button" className="crm-text-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        </div>

        <p className="crm-muted">{START_APPLICATION_DIALOG_COPY}</p>

        <dl className="crm-opportunity-convert-locked">
          <div>
            <dt>Household</dt>
            <dd>{getOpportunityHouseholdLabel(opportunity)}</dd>
          </div>
          <div>
            <dt>Opportunity</dt>
            <dd>{opportunity.title}</dd>
          </div>
          <div>
            <dt>Primary Product / Service</dt>
            <dd>{getOpportunityPrimaryProductLabel(opportunity)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{formatOpportunityStatusLabel(opportunity.status)}</dd>
          </div>
        </dl>

        {optionsLoading ? <p className="crm-muted">Loading conversion options…</p> : null}
        {optionsError ? (
          <p className="crm-banner crm-banner-error" role="alert">
            {optionsError}
          </p>
        ) : null}
        {submitError ? (
          <p className="crm-banner crm-banner-error" role="alert">
            {submitError}
          </p>
        ) : null}

        <form className="crm-opportunity-form crm-opportunity-convert-form" onSubmit={handleSubmit} noValidate>
          <fieldset className="crm-application-entry-fieldset" disabled={busy}>
            <legend>Product</legend>
            <label className="crm-field">
              <span>Carrier</span>
              <select
                ref={firstFieldRef}
                aria-label="Carrier"
                value={carrierId}
                onChange={(e) => handleCarrierChange(e.target.value)}
                required
                disabled={busy}
                aria-invalid={Boolean(fieldErrors.carrierId)}
              >
                <option value="">Select a carrier</option>
                {visibleCarriers.map((carrier) => (
                  <option key={carrier.id} value={carrier.id}>
                    {carrier.name} ({carrier.code})
                  </option>
                ))}
              </select>
              {fieldErrors.carrierId ? <span className="crm-field-error">{fieldErrors.carrierId}</span> : null}
            </label>

            <label className="crm-field">
              <span>{isRetirement ? 'FIA product' : 'Product'}</span>
              <select
                aria-label={isRetirement ? 'FIA product' : 'Product'}
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
                disabled={busy || !carrierId}
                aria-invalid={Boolean(fieldErrors.productId)}
              >
                <option value="">Select a product</option>
                {visibleProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {formatApplicationProductLineLabel(product.product_line)}
                  </option>
                ))}
              </select>
              {fieldErrors.productId ? <span className="crm-field-error">{fieldErrors.productId}</span> : null}
            </label>

            <label className="crm-field">
              <span>Application state</span>
              <select
                aria-label="Application state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                disabled={busy}
                aria-invalid={Boolean(fieldErrors.state)}
              >
                <option value="">Select a state</option>
                {US_STATES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              {fieldErrors.state ? <span className="crm-field-error">{fieldErrors.state}</span> : null}
            </label>
          </fieldset>

          {roles.length > 0 ? (
            <fieldset className="crm-application-entry-fieldset" disabled={busy}>
              <legend>Participants</legend>
              <p className="crm-muted">
                Choose household members for each role. Do not assume the household primary contact
                is the {isRetirement ? 'annuitant' : 'insured'}.
              </p>
              {roles.map((role) => (
                <label key={role} className="crm-field">
                  <span>{formatProductionParticipantRoleLabel(role)}</span>
                  <select
                    value={roleMembers[role] ?? ''}
                    onChange={(e) => setRole(role, e.target.value)}
                    required
                    aria-invalid={Boolean(fieldErrors.participants)}
                  >
                    <option value="">Select a household member</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {memberLabel(member)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {fieldErrors.participants ? (
                <span className="crm-field-error">{fieldErrors.participants}</span>
              ) : null}
            </fieldset>
          ) : null}

          {isLife && productLine ? (
            <fieldset className="crm-application-entry-fieldset" disabled={busy}>
              <legend>Premium</legend>
              <label className="crm-field">
                <span>Planned premium (USD, optional)</span>
                <input
                  aria-label="Planned premium (USD, optional)"
                  type="text"
                  inputMode="decimal"
                  value={plannedPremium}
                  onChange={(e) => setPlannedPremium(e.target.value)}
                  disabled={busy}
                  aria-invalid={Boolean(fieldErrors.plannedPremium)}
                  autoComplete="off"
                />
                {fieldErrors.plannedPremium ? (
                  <span className="crm-field-error">{fieldErrors.plannedPremium}</span>
                ) : null}
              </label>
              <label className="crm-field">
                <span>Premium mode</span>
                <select
                  aria-label="Premium mode"
                  value={premiumMode}
                  onChange={(e) => setPremiumMode(e.target.value)}
                  disabled={busy}
                  aria-invalid={Boolean(fieldErrors.premiumMode)}
                >
                  <option value="">Select if known</option>
                  {PRODUCTION_PREMIUM_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                {fieldErrors.premiumMode ? (
                  <span className="crm-field-error">{fieldErrors.premiumMode}</span>
                ) : null}
              </label>
              <label className="crm-field">
                <span>Face amount (USD, optional)</span>
                <input
                  aria-label="Face amount (USD, optional)"
                  type="text"
                  inputMode="decimal"
                  value={faceAmount}
                  onChange={(e) => setFaceAmount(e.target.value)}
                  disabled={busy}
                  aria-invalid={Boolean(fieldErrors.faceAmount)}
                  autoComplete="off"
                />
                {fieldErrors.faceAmount ? <span className="crm-field-error">{fieldErrors.faceAmount}</span> : null}
              </label>
            </fieldset>
          ) : null}

          {isRetirement && productLine ? (
            <fieldset className="crm-application-entry-fieldset" disabled={busy}>
              <legend>Deposit</legend>
              <label className="crm-field">
                <span>Initial deposit (USD, optional)</span>
                <input
                  aria-label="Initial deposit (USD, optional)"
                  type="text"
                  inputMode="decimal"
                  value={initialDeposit}
                  onChange={(e) => setInitialDeposit(e.target.value)}
                  disabled={busy}
                  aria-invalid={Boolean(fieldErrors.initialDeposit)}
                  autoComplete="off"
                />
                {fieldErrors.initialDeposit ? (
                  <span className="crm-field-error">{fieldErrors.initialDeposit}</span>
                ) : null}
              </label>
            </fieldset>
          ) : null}

          <WritingAdvisorsFields
            advisors={advisors}
            allocations={allocations}
            state={state}
            disabled={busy}
            fieldError={fieldErrors.allocations}
            note="Opportunity assigned advisor is only a suggestion. Confirm the writing split before starting the application. The application is created as Application Draft."
            onAllocationsChange={setAllocations}
          />

          <fieldset className="crm-application-entry-fieldset crm-application-review" disabled={busy}>
            <legend>Review</legend>
            <dl className="crm-opportunity-form-readonly">
              <div>
                <dt>Production stage</dt>
                <dd>{formatProductionStageLabel('draft')}</dd>
              </div>
              <div>
                <dt>Service</dt>
                <dd>{getOpportunityVerticalLabel(opportunity)}</dd>
              </div>
            </dl>
          </fieldset>

          <div className="crm-form-actions crm-opportunity-convert-actions">
            <button type="submit" className="crm-primary-btn" disabled={busy || Boolean(optionsError)}>
              {submitting ? 'Starting application…' : 'Start Application'}
            </button>
            <button type="button" className="crm-secondary-btn" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
