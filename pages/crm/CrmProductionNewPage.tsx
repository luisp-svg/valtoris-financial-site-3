import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ROUTES, crmProductionPath } from '../../constants/routes'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import ApplicationEntryForm from '../../crm/production/ApplicationEntryForm'
import NewClientFromApplicationDialog from '../../crm/production/NewClientFromApplicationDialog'
import {
  fetchActiveApplicationCarriers,
  fetchActiveApplicationProducts,
  fetchActiveWritingAdvisors,
  fetchApplicationHouseholds,
  fetchApplicationMembers,
  fetchCurrentAdvisorProfileId,
  formatApplicationDevError,
  submitProductionApplication,
} from '../../crm/production/applicationApi'
import { APPLICATION_LOAD_ERROR } from '../../crm/production/applicationErrors'
import {
  buildParticipantPayload,
  canSubmitApplicationForm,
  catalogReadyForApplications,
  defaultRoleMembers,
  defaultWritingAllocations,
  isCreateFormDirty,
  productsForCarrier,
  validateApplicationDraft,
} from '../../crm/production/applicationView'
import { existingBusinessCatchUpStages } from '../../crm/production/stageTransitionView'
import { shouldShowCatalogManagement } from '../../crm/production/catalogView'
import type {
  ProductionAdvisorOption,
  ProductionAllocationDraft,
  ProductionEntryMode,
  ProductionEntryProductOption,
  ProductionHouseholdOption,
  ProductionMemberOption,
  ProductionParticipantRole,
  ProductionProductLine,
  ProductionStage,
} from '../../crm/production/types'
import { PRODUCTION_ENTRY_STAGES } from '../../crm/production/types'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import {
  confirmLeaveUnsavedForm,
  useUnsavedChangesWarning,
} from '../../crm/production/useUnsavedChangesWarning'

export default function CrmProductionNewPage() {
  const { role, user } = useCrmAuth()
  const navigate = useNavigate()
  const canManageCatalog = shouldShowCatalogManagement(role)
  const isOwner = role === 'owner'

  const [households, setHouseholds] = useState<ProductionHouseholdOption[]>([])
  const [members, setMembers] = useState<ProductionMemberOption[]>([])
  const [carriers, setCarriers] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [products, setProducts] = useState<ProductionEntryProductOption[]>([])
  const [advisors, setAdvisors] = useState<ProductionAdvisorOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [householdId, setHouseholdId] = useState('')
  const [carrierId, setCarrierId] = useState('')
  const [productId, setProductId] = useState('')
  const [state, setState] = useState('')
  const [entryMode, setEntryMode] = useState<ProductionEntryMode>('new_business')
  const [targetStage, setTargetStage] = useState<ProductionStage | ''>('draft')
  const [premiumMode, setPremiumMode] = useState('')
  const [plannedPremium, setPlannedPremium] = useState('')
  const [faceAmount, setFaceAmount] = useState('')
  const [initialDeposit, setInitialDeposit] = useState('')
  const [applicationNumber, setApplicationNumber] = useState('')
  const [submissionDate, setSubmissionDate] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [roleMembers, setRoleMembers] = useState<Partial<Record<ProductionParticipantRole, string>>>({})
  const [allocations, setAllocations] = useState<ProductionAllocationDraft[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [recoveryApplicationId, setRecoveryApplicationId] = useState<string | null>(null)
  const [newClientOpen, setNewClientOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const [householdRows, carrierRows, productRows, advisorRows, advisorId] = await Promise.all([
          fetchApplicationHouseholds(supabase),
          fetchActiveApplicationCarriers(supabase),
          fetchActiveApplicationProducts(supabase),
          fetchActiveWritingAdvisors(supabase),
          fetchCurrentAdvisorProfileId(supabase, user?.id),
        ])
        if (cancelled) return
        setHouseholds(householdRows)
        setCarriers(carrierRows)
        setProducts(productRows)
        setAdvisors(advisorRows)
        if (advisorId) setAllocations(defaultWritingAllocations(advisorId))
        else if (advisorRows.length === 1) setAllocations(defaultWritingAllocations(advisorRows[0].id))
      } catch (err) {
        if (!cancelled) {
          setLoadError(APPLICATION_LOAD_ERROR)
          if (import.meta.env.DEV) {
            console.error('[crm/production/new]', formatApplicationDevError('application-options', err))
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    if (!householdId) {
      setMembers([])
      setRoleMembers({})
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        const rows = await fetchApplicationMembers(supabase, householdId)
        if (cancelled) return
        setMembers(rows)
        setRoleMembers(defaultRoleMembers(rows))
      } catch {
        if (!cancelled) {
          setMembers([])
          setRoleMembers({})
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [householdId])

  const catalogReady = catalogReadyForApplications({
    activeCarrierCount: carriers.length,
    activeProductCount: products.length,
  })
  const carrierProducts = useMemo(() => productsForCarrier(products, carrierId), [products, carrierId])
  const selectedProduct = carrierProducts.find((row) => row.id === productId) ?? null
  const productLine: ProductionProductLine | '' = selectedProduct?.product_line ?? ''
  const stageOptions = useMemo(
    () =>
      entryMode === 'existing_business'
        ? existingBusinessCatchUpStages({ isOwner })
        : [...PRODUCTION_ENTRY_STAGES],
    [entryMode, isOwner],
  )
  const isDirty = isCreateFormDirty({
    householdId,
    carrierId,
    productId,
    productLine,
    state,
    targetStage,
    entryMode,
    premiumMode,
    plannedPremium,
    faceAmount,
    initialDeposit,
    applicationNumber,
    submissionDate,
    policyNumber,
    roleMembers,
    allocations,
  })
  useUnsavedChangesWarning(isDirty && !submitting)

  function handleCarrierChange(nextCarrierId: string) {
    setCarrierId(nextCarrierId)
    setProductId('')
  }

  function handleAllocationsChange(rows: ProductionAllocationDraft[]) {
    setAllocations(rows)
  }

  function handleEntryModeChange(mode: ProductionEntryMode) {
    setEntryMode(mode)
    const nextOptions =
      mode === 'existing_business'
        ? existingBusinessCatchUpStages({ isOwner })
        : [...PRODUCTION_ENTRY_STAGES]
    if (targetStage && !(nextOptions as readonly string[]).includes(targetStage)) {
      setTargetStage('draft')
    }
  }

  async function handleHouseholdCreated(nextHouseholdId: string) {
    try {
      const supabase = createSupabaseBrowserClient()
      const householdRows = await fetchApplicationHouseholds(supabase)
      setHouseholds(householdRows)
    } catch {
      /* Keep the current list; the new household id is still selected. */
    }
    setHouseholdId(nextHouseholdId)
  }

  function handleCancel() {
    if (!confirmLeaveUnsavedForm(isDirty)) return
    navigate(ROUTES.crmProduction)
  }

  async function handleSubmit() {
    if (submitting) return
    const draft = validateApplicationDraft({
      householdId,
      carrierId,
      productId,
      productLine,
      state,
      targetStage,
      entryMode,
      isOwner,
      premiumMode,
      plannedPremium,
      faceAmount,
      initialDeposit,
      applicationNumber,
      submissionDate,
      policyNumber,
      roleMembers,
      allocations,
    })
    setFieldErrors(draft.fieldErrors)
    if (!canSubmitApplicationForm({ submitting, invalid: draft.invalid }) || !productLine || !targetStage) {
      return
    }
    setSubmitting(true)
    setFormError(null)
    setRecoveryApplicationId(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const result = await submitProductionApplication(supabase, {
        householdId,
        carrierId,
        productId,
        productLine,
        state,
        targetStage,
        entryMode,
        premiumMode,
        plannedPremium,
        faceAmount,
        initialDeposit,
        applicationNumber,
        submissionDate,
        policyNumber,
        participants: buildParticipantPayload({ productLine, roleMembers }),
        allocations,
      })
      if (!result.ok) {
        setFormError(result.message)
        if (result.recovery && result.applicationId) setRecoveryApplicationId(result.applicationId)
        return
      }
      navigate(crmProductionPath(result.applicationId))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="crm-page crm-opportunities-page crm-production-page crm-production-new-page">
      <header className="crm-page-header crm-opportunities-header">
        <div>
          <p className="crm-page-eyebrow">Production</p>
          <h1 className="crm-page-title">New application</h1>
          <p className="crm-page-subtitle">
            Enter new or existing Life, IUL, or FIA business. New business starts through the
            controlled workflow. Existing business is created as Application Draft, then advanced
            through server-side transitions to the selected current stage.
          </p>
        </div>
        <button type="button" className="crm-secondary-btn" onClick={handleCancel}>
          Back to Production
        </button>
      </header>

      {loading ? <p className="crm-muted">Loading application options…</p> : null}

      {loadError ? (
        <div className="crm-banner crm-banner-error" role="alert">
          {loadError}
        </div>
      ) : null}

      {!loading && !loadError && !catalogReady ? (
        <div className="crm-empty-state">
          <p className="crm-empty-state-title">Catalog setup required</p>
          <p>
            {canManageCatalog
              ? 'Add an active carrier and product before creating a production application.'
              : 'An owner needs to add an active carrier and product before applications can be created. Catalog management is owner-only.'}
          </p>
          {canManageCatalog ? (
            <Link to={ROUTES.crmProductionCatalog} className="crm-primary-btn">
              Manage carriers & products
            </Link>
          ) : null}
        </div>
      ) : null}

      {!loading && !loadError && catalogReady ? (
        <>
          <ApplicationEntryForm
            submitting={submitting}
            error={formError}
            recoveryApplicationId={recoveryApplicationId}
            households={households}
            members={members}
            carriers={carriers}
            products={carrierProducts}
            advisors={advisors}
            householdId={householdId}
            carrierId={carrierId}
            productId={productId}
            productLine={productLine}
            state={state}
            entryMode={entryMode}
            targetStage={targetStage}
            stageOptions={stageOptions}
            premiumMode={premiumMode}
            plannedPremium={plannedPremium}
            faceAmount={faceAmount}
            initialDeposit={initialDeposit}
            applicationNumber={applicationNumber}
            submissionDate={submissionDate}
            policyNumber={policyNumber}
            roleMembers={roleMembers}
            allocations={allocations}
            fieldErrors={fieldErrors}
            onHouseholdChange={setHouseholdId}
            onNewClient={() => setNewClientOpen(true)}
            onCarrierChange={handleCarrierChange}
            onProductChange={setProductId}
            onStateChange={setState}
            onEntryModeChange={handleEntryModeChange}
            onTargetStageChange={setTargetStage}
            onPremiumModeChange={setPremiumMode}
            onPlannedPremiumChange={setPlannedPremium}
            onFaceAmountChange={setFaceAmount}
            onInitialDepositChange={setInitialDeposit}
            onApplicationNumberChange={setApplicationNumber}
            onSubmissionDateChange={setSubmissionDate}
            onPolicyNumberChange={setPolicyNumber}
            onRoleMemberChange={(role, memberId) =>
              setRoleMembers((prev) => ({ ...prev, [role]: memberId }))
            }
            onAllocationsChange={handleAllocationsChange}
            onCancel={handleCancel}
            onSubmit={() => void handleSubmit()}
          />
          <NewClientFromApplicationDialog
            open={newClientOpen}
            onClose={() => setNewClientOpen(false)}
            onHouseholdReady={(nextHouseholdId) => void handleHouseholdCreated(nextHouseholdId)}
          />
        </>
      ) : null}
    </div>
  )
}
