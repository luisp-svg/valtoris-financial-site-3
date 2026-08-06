import { CONTACT_CATEGORIES, type ContactCategory } from './types'

const LABELS: Record<ContactCategory, string> = {
  potential_client: 'Potential client',
  referral_partner: 'Referral partner',
  professional_partner: 'Professional partner',
  vendor: 'Vendor',
  other: 'Other',
}

export function contactCategoryLabel(value: string | null | undefined): string {
  if (!value) return 'Uncategorized'
  if ((CONTACT_CATEGORIES as readonly string[]).includes(value)) {
    return LABELS[value as ContactCategory]
  }
  return 'Other'
}

export function isContactCategory(value: unknown): value is ContactCategory {
  return typeof value === 'string' && (CONTACT_CATEGORIES as readonly string[]).includes(value)
}

export const CONTACT_CATEGORY_OPTIONS: ReadonlyArray<{
  value: ContactCategory
  label: string
}> = CONTACT_CATEGORIES.map((value) => ({
  value,
  label: LABELS[value],
}))
