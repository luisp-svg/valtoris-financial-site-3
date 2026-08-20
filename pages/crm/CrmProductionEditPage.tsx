import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ROUTES, crmProductionPath } from '../../constants/routes'
import { useCrmAuth } from '../../crm/auth/CrmAuthContext'
import ApplicationEditForm from '../../crm/production/ApplicationEditForm'
import {
  fetchActiveApplicationCarriers,
  fetchActiveApplicationProducts,
  fetchActiveWritingAdvisors,
  fetchApplicationMembers,
  formatApplicationDevError,
  saveProductionApplicationEdit,
} from '../../crm/production/applicationApi'
import { APPLICATION_LOAD_ERROR } from '../../crm/production/applicationErrors'
import {
  applicationNumberMode,
  availableEditIntents,
  canEditCatalogFields,
  canEditMoneyAndDates,
  canReplaceAllocations,
  canReplaceParticipants,
  canShowProductionEditAction,
  draftFromOriginal,
  isApplicationEditDirty,
  originalFromApplication,
  validateApplicationEdit,
  type ApplicationEditDraft,
  type ApplicationEditIntent,
} from '../../crm/production/applicationEditView'
import { productsForCarrier } from '../../crm/production/applicationView'
import {
  fetchProductionApplicationById,
  formatProductionSupabaseError,
} from '../../crm/production/productionApi'
import type {
  ProductionAdvisorOption,
  ProductionAllocationDraft,
  ProductionApplicationDetail,
  ProductionEntryProductOption,
  ProductionMemberOption,
  ProductionParticipantRole,
  ProductionProductLine,
} from '../../crm/production/types'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import {
  confirmLeaveUnsavedForm,
  useUnsavedChangesWarning,
} from '../../crm/production/useUnsavedChangesWarning'

export default function CrmProductionEditPage() {
  const { applicationId = '' } = useParams<{ applicationId: string }>()
  const { role } = useCrmAuth()
  const navigate = useNavigate()
  const isOwner = role === 'owner'

  const [application, setApplication] = useState<ProductionApplicationDetail | null>(null)
  const [members, setMembers] = useState<ProductionMemberOption[]>([])
  const [carriers, setCarriers] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [products, setProducts] = useState<ProductionEntryProductOption[]>([])
  const [advisors, setAdvisors] = useState<ProductionAdvisorOption[]>([])
  const [draft, setDraft] = useState<ApplicationEditDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      setNotFound(false)
      try {
        const supabase = createSupabaseBrowserClient()
        const result = await fetchProductionApplicationById(supabase, applicationId)
        if (cancelled) return
        if (!result.ok && result.kind === 'not_found') {
          setNotFound(true)
          setApplication(null)
          return
        }
        if (!result.ok) {
          setLoadError(result.message)
          return
        }
        const app = result.application
        const [memberRows, carrierRows, productRows, advisorRows] = await Promise.all([
          fetchApplicationMembers(supabase, app.household_id),
          fetchActiveApplicationCarriers(supabase),
          fetchActiveApplicationProducts(supabase),
          fetchActiveWritingAdvisors(supabase),
        ])
        if (cancelled) return
        if (!carrierRows.some((row) => row.id === app.carrier_id) && app.carrier) {
          carrierRows.unshift({
            id: app.carrier_id,
            name: app.carrier.name,
            code: app.carrier.code,
          })
        }
        if (!productRows.some((row) => row.id === app.product_id) && app.product) {
          productRows.unshift({
            id: app.product_id,
            carrier_id: app.carrier_id,
            name: app.product.name,
            product_line: app.product.product_line,
          })
        }
        setApplication(app)
        setMembers(memberRows)
        setCarriers(carrierRows)
        setProducts(productRows)
        setAdvisors(advisorRows)
        setDraft(draftFromOriginal(originalFromApplication(app)))
      } catch (err) {
        if (!cancelled) {
          setLoadError(APPLICATION_LOAD_ERROR)
          if (import.meta.env.DEV) {
            console.error('[crm/production/edit]', formatApplicationDevError('edit-load', err))
            console.error(formatProductionSupabaseError('production-edit', err))
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applicationId, reloadKey])

  const original = application ? originalFromApplication(application) : null
  const carrierProducts = useMemo(
    () => (draft ? productsForCarrier(products, draft.carrierId) : []),
    [products, draft],
  )
  const canEdit = canShowProductionEditAction({
    role,
    stage: application?.production_stage,
    deletedAt: application?.deleted_at,
  })
  const isDirty = Boolean(original && draft && isApplicationEditDirty(original, draft))
  useUnsavedChangesWarning(isDirty && !submitting)

  function patchDraft(patch: Partial<ApplicationEditDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  function handleCarrierChange(carrierId: string) {
    patchDraft({ carrierId, productId: '', productLine: '' })
  }

  function handleProductChange(productId: string) {
    const product = carrierProducts.find((row) => row.id === productId)
    patchDraft({
      productId,
      productLine: (product?.product_line ?? '') as ProductionProductLine | '',
    })
  }

  function handleAllocationsChange(rows: ProductionAllocationDraft[]) {
    patchDraft({ allocations: rows })
  }

  function handleCancel() {
    if (!application) {
      navigate(ROUTES.crmProduction)
      return
    }
    if (!confirmLeaveUnsavedForm(isDirty)) return
    navigate(crmProductionPath(application.id))
  }

  async function handleSubmit(intent: ApplicationEditIntent) {
    if (submitting) return
    if (!application || !draft || !original) return
    const validation = validateApplicationEdit({
      stage: application.production_stage,
      isOwner,
      original,
      draft,
      intent,
    })
    setFieldErrors(validation.fieldErrors)
    if (validation.invalid) return
    setSubmitting(true)
    setFormError(null)
    setSuccess(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const result = await saveProductionApplicationEdit(supabase, {
        applicationId: application.id,
        stage: application.production_stage,
        isOwner,
        original,
        draft,
        intent,
      })
      setReloadKey((n) => n + 1)
      if (!result.ok) {
        setFormError(result.message)
        return
      }
      if (intent !== 'save') {
        navigate(crmProductionPath(application.id))
        return
      }
      setSuccess(
        result.saved.length > 0
          ? 'Saved. The page reloaded from the server.'
          : 'No changes to save. The page reloaded from the server.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="crm-page crm-production-page">
        <p className="crm-muted">Loading application…</p>
      </div>
    )
  }

  if (notFound || (application && !canEdit)) {
    return (
      <div className="crm-page crm-production-page">
        <header className="crm-page-header">
          <div>
            <p className="crm-page-eyebrow">Production</p>
            <h1 className="crm-page-title">Application cannot be edited</h1>
            <p className="crm-page-subtitle">
              This application can no longer be edited from this screen, or it is not visible for
              your account.
            </p>
          </div>
        </header>
        <Link to={ROUTES.crmProduction} className="crm-secondary-btn">
          Back to Production
        </Link>
      </div>
    )
  }

  if (loadError || !application || !draft) {
    return (
      <div className="crm-page crm-production-page">
        <div className="crm-banner crm-banner-error" role="alert">
          {loadError || APPLICATION_LOAD_ERROR}
        </div>
        <Link to={ROUTES.crmProduction} className="crm-secondary-btn">
          Back to Production
        </Link>
      </div>
    )
  }

  const stage = application.production_stage
  const numberMode = applicationNumberMode({
    stage,
    applicationNumber: original?.applicationNumber,
    isOwner,
  })

  return (
    <div className="crm-page crm-opportunities-page crm-production-page crm-production-edit-page">
      <header className="crm-page-header crm-opportunities-header">
        <div>
          <p className="crm-page-eyebrow">Production</p>
          <h1 className="crm-page-title">Edit Application</h1>
          <p className="crm-page-subtitle">
            Update application details for this case. Stage changes stay in the Case workspace.
            Issued and in-force historical corrections are not handled on this screen.
          </p>
        </div>
        <button type="button" className="crm-secondary-btn" onClick={handleCancel}>
          Back to application
        </button>
      </header>

      <ApplicationEditForm
        applicationId={application.id}
        stage={stage}
        isOwner={isOwner}
        submitting={submitting}
        error={formError}
        success={success}
        householdName={application.household?.display_name?.trim() || 'Household'}
        members={members}
        carriers={carriers}
        products={carrierProducts}
        advisors={advisors}
        catalogLocked={!canEditCatalogFields(stage)}
        moneyLocked={!canEditMoneyAndDates(stage)}
        participantsLocked={!canReplaceParticipants({ stage, isOwner })}
        allocationsLocked={!canReplaceAllocations({ stage, isOwner })}
        numberMode={numberMode}
        carrierId={draft.carrierId}
        productId={draft.productId}
        productLine={draft.productLine}
        state={draft.state}
        premiumMode={draft.premiumMode}
        plannedPremium={draft.plannedPremium}
        faceAmount={draft.faceAmount}
        initialDeposit={draft.initialDeposit}
        submissionDate={draft.submissionDate}
        nextFollowUpDate={draft.nextFollowUpDate}
        applicationNumber={draft.applicationNumber}
        policyNumber={draft.policyNumber}
        applicationNumberReason={draft.applicationNumberReason}
        participantReason={draft.participantReason}
        allocationReason={draft.allocationReason}
        roleMembers={draft.roleMembers}
        allocations={draft.allocations}
        fieldErrors={fieldErrors}
        intents={availableEditIntents(stage)}
        onCarrierChange={handleCarrierChange}
        onProductChange={handleProductChange}
        onStateChange={(state) => patchDraft({ state })}
        onPremiumModeChange={(premiumMode) => patchDraft({ premiumMode })}
        onPlannedPremiumChange={(plannedPremium) => patchDraft({ plannedPremium })}
        onFaceAmountChange={(faceAmount) => patchDraft({ faceAmount })}
        onInitialDepositChange={(initialDeposit) => patchDraft({ initialDeposit })}
        onSubmissionDateChange={(submissionDate) => patchDraft({ submissionDate })}
        onNextFollowUpDateChange={(nextFollowUpDate) => patchDraft({ nextFollowUpDate })}
        onApplicationNumberChange={(applicationNumber) => patchDraft({ applicationNumber })}
        onPolicyNumberChange={(policyNumber) => patchDraft({ policyNumber })}
        onApplicationNumberReasonChange={(applicationNumberReason) =>
          patchDraft({ applicationNumberReason })
        }
        onParticipantReasonChange={(participantReason) => patchDraft({ participantReason })}
        onAllocationReasonChange={(allocationReason) => patchDraft({ allocationReason })}
        onRoleMemberChange={(roleName: ProductionParticipantRole, memberId: string) =>
          patchDraft({ roleMembers: { ...draft.roleMembers, [roleName]: memberId } })
        }
        onAllocationsChange={handleAllocationsChange}
        onCancel={handleCancel}
        onSubmit={(intent) => void handleSubmit(intent)}
      />
    </div>
  )
}