import type { ContactFormValues } from './types'
import { emptyContactFormValues } from './validation'

/** Pure Save & Add Another reset — clears PII/consent by default. */
export function resetFormAfterSaveAndAddAnother(
  prev: ContactFormValues,
  options: { keepDefaults: boolean; isOwner: boolean },
): ContactFormValues {
  const next = emptyContactFormValues()
  if (options.keepDefaults) {
    next.contact_category = prev.contact_category
    next.how_we_met = prev.how_we_met
    next.state = prev.state
    if (options.isOwner) next.assigned_advisor_id = prev.assigned_advisor_id
  }
  return next
}
