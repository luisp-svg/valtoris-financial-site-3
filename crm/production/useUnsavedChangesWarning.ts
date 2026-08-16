import { useEffect } from 'react'

/** Warn on refresh/close when the production form has unsaved edits. */
export function useUnsavedChangesWarning(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])
}

export function confirmLeaveUnsavedForm(isDirty: boolean): boolean {
  if (!isDirty) return true
  return window.confirm('You have unsaved changes. Leave this page?')
}
