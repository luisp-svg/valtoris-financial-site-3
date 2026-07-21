export type CrmNavItem = {
  label: string
  path: string
  /** When true, route is a placeholder until Phase 3+ */
  placeholder?: boolean
}

export const CRM_NAV_ITEMS: CrmNavItem[] = [
  { label: 'Home', path: '/crm' },
  { label: 'Leads', path: '/crm/leads', placeholder: true },
  { label: 'Households', path: '/crm/households' },
  { label: 'Pipeline', path: '/crm/pipeline', placeholder: true },
  { label: 'Tasks', path: '/crm/tasks' },
  { label: 'Appointments', path: '/crm/appointments', placeholder: true },
  { label: 'Policies', path: '/crm/policies', placeholder: true },
  { label: 'Annual Reviews', path: '/crm/annual-reviews', placeholder: true },
  { label: 'Documents', path: '/crm/documents', placeholder: true },
  { label: 'Settings', path: '/crm/settings', placeholder: true },
]
