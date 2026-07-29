import { describe, expect, it } from 'vitest'
import {
  beginSaveAndLeave,
  cancelUnsavedDialog,
  completeSaveAndLeave,
  createIdleUnsavedDialogState,
  failSaveAndLeave,
  isLeavingGuardedScope,
  isModifiedClick,
  openUnsavedDialog,
  resolveSameOriginPath,
  shouldInterceptInternalNavigation,
} from './navigationGuardUtils'

const ORIGIN = 'http://127.0.0.1:5173'
const SCOPE = '/crm/households/hh-1/onboarding'

function anchor(partial: {
  href: string
  target?: string
  download?: boolean
  rel?: string
}) {
  return {
    href: partial.href,
    target: partial.target ?? '',
    hasAttribute: (name: string) => name === 'download' && Boolean(partial.download),
    getAttribute: (name: string) => {
      if (name === 'rel') return partial.rel ?? null
      return null
    },
  }
}

describe('navigationGuardUtils', () => {
  it('allows clean navigation when not blocked', () => {
    const decision = shouldInterceptInternalNavigation({
      event: {},
      anchor: anchor({ href: `${ORIGIN}/crm/households` }),
      origin: ORIGIN,
      currentPathname: SCOPE,
      scopePathname: SCOPE,
      isBlocked: false,
    })
    expect(decision).toEqual({ intercept: false })
  })

  it('opens guard for dirty internal navigation and retains destination', () => {
    const decision = shouldInterceptInternalNavigation({
      event: {},
      anchor: anchor({ href: `${ORIGIN}/crm/tasks` }),
      origin: ORIGIN,
      currentPathname: SCOPE,
      scopePathname: SCOPE,
      isBlocked: true,
    })
    expect(decision).toEqual({ intercept: true, to: '/crm/tasks' })
  })

  it('does not intercept same-page onboarding section navigation', () => {
    const decision = shouldInterceptInternalNavigation({
      event: {},
      anchor: anchor({ href: `${ORIGIN}${SCOPE}?section=income` }),
      origin: ORIGIN,
      currentPathname: SCOPE,
      scopePathname: SCOPE,
      isBlocked: true,
    })
    expect(decision).toEqual({ intercept: false })
    expect(
      isLeavingGuardedScope({
        currentPathname: SCOPE,
        nextPathname: SCOPE,
        scopePathname: SCOPE,
      }),
    ).toBe(false)
  })

  it('does not intercept modified clicks or new-tab links', () => {
    expect(isModifiedClick({ metaKey: true })).toBe(true)
    expect(isModifiedClick({ ctrlKey: true })).toBe(true)

    expect(
      shouldInterceptInternalNavigation({
        event: { metaKey: true },
        anchor: anchor({ href: `${ORIGIN}/crm/tasks` }),
        origin: ORIGIN,
        currentPathname: SCOPE,
        scopePathname: SCOPE,
        isBlocked: true,
      }),
    ).toEqual({ intercept: false })

    expect(
      shouldInterceptInternalNavigation({
        event: {},
        anchor: anchor({ href: `${ORIGIN}/crm/tasks`, target: '_blank' }),
        origin: ORIGIN,
        currentPathname: SCOPE,
        scopePathname: SCOPE,
        isBlocked: true,
      }),
    ).toEqual({ intercept: false })
  })

  it('does not intercept external origins', () => {
    expect(resolveSameOriginPath('https://example.com/x', ORIGIN)).toBeNull()
    expect(
      shouldInterceptInternalNavigation({
        event: {},
        anchor: anchor({ href: 'https://example.com/x' }),
        origin: ORIGIN,
        currentPathname: SCOPE,
        scopePathname: SCOPE,
        isBlocked: true,
      }),
    ).toEqual({ intercept: false })
  })

  it('guards household and workspace destinations', () => {
    expect(
      shouldInterceptInternalNavigation({
        event: {},
        anchor: anchor({ href: `${ORIGIN}/crm/households/hh-1` }),
        origin: ORIGIN,
        currentPathname: SCOPE,
        scopePathname: SCOPE,
        isBlocked: true,
      }),
    ).toEqual({ intercept: true, to: '/crm/households/hh-1' })
  })

  it('orchestrates cancel / leave-without-save destination retention / save flow', () => {
    let state = createIdleUnsavedDialogState()
    state = openUnsavedDialog(state, '/crm/pipeline')
    expect(state.open).toBe(true)
    expect(state.pendingTo).toBe('/crm/pipeline')

    state = cancelUnsavedDialog()
    expect(state.open).toBe(false)
    expect(state.pendingTo).toBeNull()

    state = openUnsavedDialog(createIdleUnsavedDialogState(), '/crm/tasks')
    state = beginSaveAndLeave(state)
    expect(state.saving).toBe(true)
    // Double begin ignored
    expect(beginSaveAndLeave(state).saving).toBe(true)

    state = failSaveAndLeave(state, 'Save failed')
    expect(state.open).toBe(true)
    expect(state.saving).toBe(false)
    expect(state.error).toBe('Save failed')
    expect(state.pendingTo).toBe('/crm/tasks')

    state = beginSaveAndLeave(state)
    state = completeSaveAndLeave()
    expect(state).toEqual(createIdleUnsavedDialogState())
  })

  it('does not open a second dialog while save-and-leave is in flight', () => {
    let state = openUnsavedDialog(createIdleUnsavedDialogState(), '/crm/tasks')
    state = beginSaveAndLeave(state)
    const next = openUnsavedDialog(state, '/crm/pipeline')
    expect(next.pendingTo).toBe('/crm/tasks')
    expect(next.saving).toBe(true)
  })
})
