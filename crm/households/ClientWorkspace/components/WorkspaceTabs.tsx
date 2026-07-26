import type { KeyboardEvent } from 'react'
import { CLIENT_WORKSPACE_TABS } from '../tabConfig'
import type { ClientWorkspaceTabId } from '../types'

type WorkspaceTabsProps = {
  activeTab: ClientWorkspaceTabId
  onChange: (tab: ClientWorkspaceTabId) => void
}

const ENABLED_TABS = CLIENT_WORKSPACE_TABS.filter((tab) => tab.enabled)

export default function WorkspaceTabs({ activeTab, onChange }: WorkspaceTabsProps) {
  function focusTabButton(tabId: ClientWorkspaceTabId) {
    const el = document.getElementById(`crm-client-workspace-tab-${tabId}`)
    if (el instanceof HTMLButtonElement) el.focus()
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, tabId: ClientWorkspaceTabId) {
    const index = ENABLED_TABS.findIndex((tab) => tab.id === tabId)
    if (index < 0) return

    let nextIndex: number | null = null
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % ENABLED_TABS.length
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + ENABLED_TABS.length) % ENABLED_TABS.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = ENABLED_TABS.length - 1
        break
      default:
        return
    }

    event.preventDefault()
    const nextTab = ENABLED_TABS[nextIndex]
    if (!nextTab) return
    onChange(nextTab.id)
    queueMicrotask(() => focusTabButton(nextTab.id))
  }

  return (
    <div
      className="crm-household-workspace-tabs"
      role="tablist"
      aria-label="Client workspace sections"
      aria-orientation="horizontal"
    >
      {CLIENT_WORKSPACE_TABS.map((tab) =>
        tab.enabled ? (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`crm-client-workspace-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`crm-client-workspace-tab-${tab.id}-panel`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`crm-household-workspace-tab${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onTabKeyDown(event, tab.id)}
          >
            {tab.label}
          </button>
        ) : (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`crm-client-workspace-tab-${tab.id}`}
            aria-selected="false"
            aria-disabled="true"
            disabled
            className="crm-household-workspace-tab is-disabled"
            title="Coming soon"
          >
            {tab.label}
          </button>
        ),
      )}
    </div>
  )
}
