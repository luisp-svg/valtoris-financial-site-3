/**
 * Pure helpers for CRM in-app navigation guarding (BrowserRouter-compatible).
 */

export type ClickLike = {
  button?: number
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  defaultPrevented?: boolean
}

export function isModifiedClick(event: ClickLike): boolean {
  if (event.defaultPrevented) return true
  if (event.button != null && event.button !== 0) return true
  return Boolean(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
}

export function isExternalOrSpecialAnchor(anchor: {
  target: string
  hasAttribute: (name: string) => boolean
  getAttribute: (name: string) => string | null
}): boolean {
  const target = (anchor.target || '').toLowerCase()
  if (target && target !== '_self') return true
  if (anchor.hasAttribute('download')) return true
  const rel = anchor.getAttribute('rel') || ''
  if (/\bopener\b/i.test(rel) && target === '_blank') return true
  return false
}

/** Resolve same-origin absolute/relative href to pathname+search, or null if external. */
export function resolveSameOriginPath(
  href: string,
  origin: string,
): { pathname: string; search: string; hash: string } | null {
  try {
    const url = new URL(href, origin)
    if (url.origin !== origin) return null
    return { pathname: url.pathname, search: url.search, hash: url.hash }
  } catch {
    return null
  }
}

/**
 * True when navigating away from a guarded route scope.
 * Same-path query changes (e.g. ?section=) stay inside the scope.
 */
export function isLeavingGuardedScope(args: {
  currentPathname: string
  nextPathname: string
  scopePathname: string
}): boolean {
  if (args.currentPathname !== args.scopePathname) return false
  return args.nextPathname !== args.scopePathname
}

export function shouldInterceptInternalNavigation(args: {
  event: ClickLike
  anchor: {
    href: string
    target: string
    hasAttribute: (name: string) => boolean
    getAttribute: (name: string) => string | null
  }
  origin: string
  currentPathname: string
  scopePathname: string
  isBlocked: boolean
}): { intercept: false } | { intercept: true; to: string } {
  if (!args.isBlocked) return { intercept: false }
  if (isModifiedClick(args.event)) return { intercept: false }
  if (isExternalOrSpecialAnchor(args.anchor)) return { intercept: false }

  const resolved = resolveSameOriginPath(args.anchor.href, args.origin)
  if (!resolved) return { intercept: false }

  // Hash-only / same document anchors on the guarded page: allow.
  if (
    resolved.pathname === args.currentPathname &&
    resolved.search === '' &&
    resolved.hash !== ''
  ) {
    return { intercept: false }
  }

  if (
    !isLeavingGuardedScope({
      currentPathname: args.currentPathname,
      nextPathname: resolved.pathname,
      scopePathname: args.scopePathname,
    })
  ) {
    return { intercept: false }
  }

  return { intercept: true, to: `${resolved.pathname}${resolved.search}` }
}

export type UnsavedNavigationDialogState = {
  open: boolean
  pendingTo: string | null
  saving: boolean
  error: string | null
}

export function createIdleUnsavedDialogState(): UnsavedNavigationDialogState {
  return { open: false, pendingTo: null, saving: false, error: null }
}

export function openUnsavedDialog(
  state: UnsavedNavigationDialogState,
  pendingTo: string,
): UnsavedNavigationDialogState {
  if (state.open && state.saving) return state
  return { open: true, pendingTo, saving: false, error: null }
}

export function cancelUnsavedDialog(): UnsavedNavigationDialogState {
  return createIdleUnsavedDialogState()
}

export function beginSaveAndLeave(
  state: UnsavedNavigationDialogState,
): UnsavedNavigationDialogState {
  if (!state.open || !state.pendingTo || state.saving) return state
  return { ...state, saving: true, error: null }
}

export function failSaveAndLeave(
  state: UnsavedNavigationDialogState,
  error: string,
): UnsavedNavigationDialogState {
  if (!state.open) return state
  return { ...state, saving: false, error }
}

export function completeSaveAndLeave(): UnsavedNavigationDialogState {
  return createIdleUnsavedDialogState()
}
