import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { crmHouseholdOnboardingPath } from '../../../constants/routes'
import { createSupabaseBrowserClient } from '../../../lib/supabase/client'
import EmptyState from '../../components/ui/EmptyState'
import Widget from '../../components/ui/Widget'
import {
  fetchOnboardingEntryStatus,
  onboardingEntryLabel,
  type OnboardingEntryStatus,
} from './loadHouseholdOnboarding'

type OnboardingEntryWidgetProps = {
  householdId: string
}

/** Minimal workspace entry point for Start / Resume / View onboarding. */
export default function OnboardingEntryWidget({ householdId }: OnboardingEntryWidgetProps) {
  const [status, setStatus] = useState<OnboardingEntryStatus>({ kind: 'none' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const supabase = createSupabaseBrowserClient()
      const next = await fetchOnboardingEntryStatus(supabase, householdId)
      if (!cancelled) {
        setStatus(next)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [householdId])

  const label = onboardingEntryLabel(status)
  const href = crmHouseholdOnboardingPath(householdId)

  return (
    <Widget title="Household Onboarding" titleId="crm-widget-household-onboarding">
      {loading ? <p className="crm-muted">Checking onboarding status…</p> : null}
      {!loading ? (
        <EmptyState
          title={
            status.kind === 'draft'
              ? 'Onboarding in progress'
              : status.kind === 'completed'
                ? 'Onboarding completed'
                : 'Onboarding not started'
          }
          description={
            status.kind === 'error'
              ? 'Status could not be loaded. You can still open onboarding.'
              : 'Capture household evidence for Household Financial Progress through a guided workflow.'
          }
          action={
            <Link to={href} className="crm-primary-btn">
              {label}
            </Link>
          }
        />
      ) : null}
    </Widget>
  )
}
