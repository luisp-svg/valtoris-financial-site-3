import { useCallback, useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '../../../../lib/supabase/client'
import {
  fetchHouseholdWorkspace,
  formatSupabaseError,
} from '../../householdsApi'
import type { CrmHouseholdWorkspace } from '../../types'

export type UseHouseholdWorkspaceResult = {
  workspace: CrmHouseholdWorkspace | null
  loading: boolean
  error: string | null
  notFound: boolean
  reload: (options?: { clearError?: boolean }) => Promise<CrmHouseholdWorkspace | null>
  setError: (message: string | null) => void
  setWorkspace: (workspace: CrmHouseholdWorkspace | null) => void
}

/**
 * Loads the household workspace once and exposes a shared reload helper.
 * Tabs and widgets must consume this data — do not re-fetch per tab.
 */
export function useHouseholdWorkspace(householdId: string | undefined): UseHouseholdWorkspaceResult {
  const [workspace, setWorkspace] = useState<CrmHouseholdWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const loadWorkspace = useCallback(async (id: string) => {
    const supabase = createSupabaseBrowserClient()
    return fetchHouseholdWorkspace(supabase, id)
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
