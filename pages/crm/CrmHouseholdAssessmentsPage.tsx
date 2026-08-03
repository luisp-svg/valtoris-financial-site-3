import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchPublicFamilyDiagnosticDetailSafe,
  fetchPublicFamilyDiagnosticHistorySafe,
} from '../../crm/households/assessments/householdAssessmentsApi'
import PublicFamilyDiagnosticDetailView from '../../crm/households/assessments/PublicFamilyDiagnosticDetailView'
import PublicFamilyDiagnosticHistoryList from '../../crm/households/assessments/PublicFamilyDiagnosticHistoryList'
import type {
  PublicFamilyDiagnosticDetail,
  PublicFamilyDiagnosticListItem,
} from '../../crm/households/assessments/types'
import {
  PUBLIC_FAMILY_DIAGNOSTIC_DISCLAIMER,
  PUBLIC_FAMILY_DIAGNOSTIC_PRODUCT_LABEL,
} from '../../crm/households/assessments/types'
import { crmHouseholdPath } from '../../constants/routes'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'

/**
 * Household assessment history / public Family diagnostic detail.
 * Scalable shell: currently implements public Family diagnostics only.
 */
export default function CrmHouseholdAssessmentsPage() {
  const { householdId = '', assessmentId } = useParams<{
    householdId: string
    assessmentId?: string
  }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<PublicFamilyDiagnosticListItem[]>([])
  const [detail, setDetail] = useState<PublicFamilyDiagnosticDetail | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!householdId) {
        setError('Household not found.')
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      setNotFound(false)
      try {
        const supabase = createSupabaseBrowserClient()
        if (assessmentId) {
          const result = await fetchPublicFamilyDiagnosticDetailSafe(
            supabase,
            householdId,
            assessmentId,
          )
          if (cancelled) return
          if (!result.ok) {
            setError(result.error)
            setDetail(null)
            return
          }
          if (!result.value) {
            setNotFound(true)
            setDetail(null)
            return
          }
          setDetail(result.value)
        } else {
          const result = await fetchPublicFamilyDiagnosticHistorySafe(supabase, householdId)
          if (cancelled) return
          if (!result.ok) {
            setError(result.error)
            setItems([])
            return
          }
          setItems(result.value)
        }
      } catch {
        if (!cancelled) setError('Unable to load assessments for this household.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [householdId, assessmentId])

  if (loading) {
    return (
      <div className="crm-page">
        <p className="crm-muted" role="status">
          Loading assessments…
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="crm-page">
        <p className="crm-banner crm-banner-error" role="alert">
          {error}
        </p>
        <Link to={crmHouseholdPath(householdId)}>Back to household</Link>
      </div>
    )
  }

  if (assessmentId) {
    if (notFound || !detail) {
      return (
        <div className="crm-page">
          <h1>Diagnostic unavailable</h1>
          <p className="crm-muted">
            This Initial Financial Diagnostic could not be found for this household. It may have
            been removed or belongs to a different household.
          </p>
          <p>
            <Link to={crmHouseholdPath(householdId)}>Back to household overview</Link>
          </p>
        </div>
      )
    }
    return (
      <div className="crm-page">
        <PublicFamilyDiagnosticDetailView detail={detail} />
      </div>
    )
  }

  return (
    <div className="crm-page crm-ifd-history-page">
      <header className="crm-page-header">
        <div>
          <p className="crm-muted">
            <Link to={crmHouseholdPath(householdId)}>Household overview</Link>
          </p>
          <h1>Assessments</h1>
          <p className="crm-page-subtitle">
            {PUBLIC_FAMILY_DIAGNOSTIC_PRODUCT_LABEL} history for this household.{' '}
            {PUBLIC_FAMILY_DIAGNOSTIC_DISCLAIMER}
          </p>
        </div>
      </header>
      <p className="crm-banner crm-banner-warning" role="status">
        Public production release remains blocked until the Privacy Policy at /privacy receives
        legal review.
      </p>
      <PublicFamilyDiagnosticHistoryList householdId={householdId} items={items} />
    </div>
  )
}
