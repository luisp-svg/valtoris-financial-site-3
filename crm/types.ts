export type CrmRole = 'owner' | 'advisor' | 'manager' | 'operations' | 'client'

export type CrmSupportedRole = 'owner' | 'advisor'

export type CrmProfile = {
  id: string
  email: string
  full_name: string
  role: CrmRole
  is_active: boolean
}

export function isCrmSupportedRole(role: string | null | undefined): role is CrmSupportedRole {
  return role === 'owner' || role === 'advisor'
}
