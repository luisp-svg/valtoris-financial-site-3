import { useCallback, useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '../../../../lib/supabase/client'
import {
  fetchHouseholdWorkspace,
  formatSupabaseError,
} from '../../householdsApi'
import type { CrmHouseholdWorkspace } from '../../types'
import {
  attachFinancialProgress,
  type ClientWorkspaceModel,
} from '../financialProgress/attachFinancialProgress'

export type UseHouseholdWorkspaceResult = {
  workspace: ClientWorkspaceModel | null
  loading: boolean
  error: string | null
  notFound: boolean
  reload: (options?: { clearError?: boolean }) => Promise<ClientWorkspaceModel | null>
  setError: (message: string | null) => void
  setWorkspace: (workspace: ClientWorkspaceModel | null) => void
}

function toWorkspaceModel(data: CrmHouseholdWorkspace): ClientWorkspaceModel {
  return attachFinancialProgress(data)
}

/**
 * Loads the household workspace once, computes Household Financial Progress once,
 * and exposes a shared reload helper. Tabs/widgets must not recompute progress.
 */
export function useHouseholdWorkspace(householdId: string | undefined): UseHouseholdWorkspaceResult {
  const [workspace, setWorkspace] = useState<ClientWorkspaceModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const loadWorkspace = useCallback(async (id: string) => {
    const supabase = createSupabaseBrowserClient()
    const data = await fetchHouseholdWorkspace(supabase, id)
    if (!data) return null
    return toWorkspaceModel(data)
  }, [])

  const reload = useCallback(
    async (options?: { clearError?: boolean }) => {
      if (!householdId) {
        setWorkspace(null)
        setNotFound(true)
        return null
      }
      if (options?.clearError) setError(null)
      const data = await loadWorkspace(householdId)
      if (!data) {
        setWorkspace(null)
        setNotFound(true)
        return null
      }
      setWorkspace(data)
      setNotFound(false)
      return data
    },
    [householdId, loadWorkspace],
  )

  useEffect(() => {
    if (!householdId) {
      setLoading(false)
      setNotFound(true)
      setWorkspace(null)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      setNotFound(false)
      try {
        const data = await loadWorkspace(householdId)
        if (cancelled) return
        if (!data) {
          setWorkspace(null)
          setNotFound(true)
          return
        }
        setWorkspace(data)
      } catch (err) {
        if (!cancelled) {
          setError('Unable to load household workspace. Please try again.')
          if (import.meta.env.DEV) {
            console.error(
              '[crm/households/workspace]',
              formatSupabaseError('household_workspace', err),
            )
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [householdId, loadWorkspace])

  return {
    workspace,
    loading,
    error,
    notFound,
    reload,
    setError,
    setWorkspace,
  }
}
