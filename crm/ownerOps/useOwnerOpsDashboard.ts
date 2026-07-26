import { useCallback, useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { localDateString } from '../dashboard/dates'
import { AGENCY_TIMEZONE, agencyMonthBounds } from './agencyTimezone'
import { fetchOwnerOpsDashboard } from './ownerOpsApi'
import type { OwnerOpsDashboardData } from './types'

function emptyData(): OwnerOpsDashboardData {
  const month = agencyMonthBounds()
  return {
    snapshot: {
      ok: true,
      value: {
        activeHouseholds: 0,
        openOpportunities: 0,
        wonThisMonth: 0,
        lostThisMonth: 0,
        tasksDueToday: 0,
        overdueTasks: 0,
        unassignedHouseholds: 0,
        unassignedOpportunities: 0,
        staleOpportunities: 0,
        opportunitiesWithoutNextAction: 0,
        monthKey: month.monthKey,
        monthTimeZone: AGENCY_TIMEZONE,
      },
    },
    stageHealth: { ok: true, value: [] },
    workload: { ok: true, value: [] },
    alerts: { ok: true, value: [] },
    recentActivity: { ok: true, value: [] },
  }
}

export function useOwnerOpsDashboard(enabled: boolean) {
  const [data, setData] = useState<OwnerOpsDashboardData>(() => emptyData())
  const [loading, setLoading] = useState(enabled)
  const [reloadKey, setReloadKey] = useState(0)
  const today = localDateString()

  const reload = useCallback(() => {
    setReloadKey((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      setData(emptyData())
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const supabase = createSupabaseBrowserClient()
        const next = await fetchOwnerOpsDashboard(supabase, { today })
        if (!cancelled) setData(next)
      } catch (error) {
        if (!cancelled) {
          if (import.meta.env.DEV) {
            console.error('[crm/ownerOps] fatal load', error)
          }
          const fallback = emptyData()
          setData({
            snapshot: {
              ok: false,
              value: fallback.snapshot.value,
              error: 'Unable to load agency operations.',
            },
            stageHealth: { ok: false, value: [], error: 'Unable to load agency operations.' },
            workload: { ok: false, value: [], error: 'Unable to load agency operations.' },
            alerts: { ok: false, value: [], error: 'Unable to load agency operations.' },
            recentActivity: { ok: false, value: [], error: 'Unable to load agency operations.' },
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, reloadKey, today])

  return { loading, data, today, reload }
}
