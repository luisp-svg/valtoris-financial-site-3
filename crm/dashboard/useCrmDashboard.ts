import { useCallback, useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '../../lib/supabase/client'
import { fetchCrmDashboard } from './dashboardApi'
import { localDateString } from './dates'
import { buildNeedsAttentionItems } from './needsAttention'
import type { AttentionItem, CrmDashboardData } from './types'

const EMPTY: CrmDashboardData = {
  statusCounts: { ok: true, value: { open: 0, won: 0, lost: 0 } },
  stageSnapshot: { ok: true, value: [] },
  tasksDueToday: { ok: true, value: [] },
  overdueTasks: { ok: true, value: [] },
  openOpportunities: { ok: true, value: [] },
  recentActivities: { ok: true, value: [] },
  recentHouseholds: { ok: true, value: [] },
}

export function useCrmDashboard() {
  const [data, setData] = useState<CrmDashboardData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const today = localDateString()

  const reload = useCallback(() => {
    setReloadKey((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const supabase = createSupabaseBrowserClient()
        const next = await fetchCrmDashboard(supabase, { today })
        if (!cancelled) setData(next)
      } catch (error) {
        if (!cancelled) {
          if (import.meta.env.DEV) {
            console.error('[crm/dashboard] fatal load', error)
          }
          setData({
            statusCounts: {
              ok: false,
              value: { open: 0, won: 0, lost: 0 },
              error: 'Unable to load dashboard.',
            },
            stageSnapshot: { ok: false, value: [], error: 'Unable to load dashboard.' },
            tasksDueToday: { ok: false, value: [], error: 'Unable to load dashboard.' },
            overdueTasks: { ok: false, value: [], error: 'Unable to load dashboard.' },
            openOpportunities: { ok: false, value: [], error: 'Unable to load dashboard.' },
            recentActivities: { ok: false, value: [], error: 'Unable to load dashboard.' },
            recentHouseholds: { ok: false, value: [], error: 'Unable to load dashboard.' },
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey, today])

  const attentionSourcesOk = {
    overdueTasks: data.overdueTasks.ok,
    tasksDueToday: data.tasksDueToday.ok,
    openOpportunities: data.openOpportunities.ok,
  }
  const attentionAnyOk =
    attentionSourcesOk.overdueTasks ||
    attentionSourcesOk.tasksDueToday ||
    attentionSourcesOk.openOpportunities
  const attentionAllFailed = !attentionAnyOk
  const attentionPartialFailure =
    attentionAnyOk &&
    (!attentionSourcesOk.overdueTasks ||
      !attentionSourcesOk.tasksDueToday ||
      !attentionSourcesOk.openOpportunities)

  const attentionError = attentionAllFailed
    ? 'Unable to load this section. Please try again.'
    : null
  const attentionWarning = attentionPartialFailure
    ? 'Some attention sources could not be loaded. Showing available items.'
    : null

  const attentionItems: AttentionItem[] = useMemo(() => {
    if (attentionAllFailed) return []
    return buildNeedsAttentionItems({
      overdueTasks: data.overdueTasks.ok ? data.overdueTasks.value : [],
      tasksDueToday: data.tasksDueToday.ok ? data.tasksDueToday.value : [],
      openOpportunities: data.openOpportunities.ok ? data.openOpportunities.value : [],
      today,
    })
  }, [
    attentionAllFailed,
    data.overdueTasks.ok,
    data.overdueTasks.value,
    data.tasksDueToday.ok,
    data.tasksDueToday.value,
    data.openOpportunities.ok,
    data.openOpportunities.value,
    today,
  ])

  const tasksError =
    !data.tasksDueToday.ok && !data.overdueTasks.ok
      ? 'Unable to load this section. Please try again.'
      : null
  const tasksWarning =
    data.tasksDueToday.ok !== data.overdueTasks.ok
      ? 'Some task queues could not be loaded. Showing available items.'
      : null

  return {
    loading,
    data,
    today,
    attentionItems,
    attentionError,
    attentionWarning,
    tasksError,
    tasksWarning,
    reload,
  }
}
