import type { AuthChangeEvent } from '@supabase/supabase-js'

/** Keep Supabase requests outside the auth notification lock, including fire-and-forget calls. */
export function deferredAuthRefresh(refresh: () => Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  return {
    onChange(event: AuthChangeEvent) {
      if (disposed || event === 'INITIAL_SESSION') return
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        if (!disposed) void refresh()
      }, 0)
    },
    dispose() {
      disposed = true
      if (timer !== undefined) clearTimeout(timer)
    },
  }
}
