import {
  resolveContactPermissionState,
  type FollowUpConsentInput,
  type PublicFamilyMatchStatus,
  type PublicFamilyTaskWorkflowType,
} from './workflowTypes'

export type GeneratedTaskLanguage = {
  title: string
  description: string
  workflowType: PublicFamilyTaskWorkflowType
}

/**
 * Pure consent-aware task title/description generation.
 * Workflow identity is only review_initial_diagnostic | resolve_possible_duplicate.
 * Contact permission changes wording, not workflow type.
 */
export function generatePublicFamilyTaskLanguage(input: {
  matchStatus: PublicFamilyMatchStatus
  consent: FollowUpConsentInput
  workflowType: PublicFamilyTaskWorkflowType
}): GeneratedTaskLanguage {
  const { matchStatus, consent, workflowType } = input
  const contact = resolveContactPermissionState(consent)

  if (workflowType === 'resolve_possible_duplicate') {
    return {
      workflowType,
      title: 'Resolve possible duplicate diagnostic submission',
      description: [
        'Owner review required for a possible duplicate public Family Report Card submission.',
        'Review provisional and candidate household identity in Intake.',
        'Do not initiate outreach before identity review is complete.',
        'Resolve through Confirm Same Household or Keep as Separate Household.',
      ].join('\n'),
    }
  }

  if (contact === 'granted') {
    const title =
      matchStatus === 'exact_trusted_match'
        ? 'Review new Initial Financial Diagnostic for existing household'
        : 'Review Initial Financial Diagnostic and follow up'
    return {
      workflowType: 'review_initial_diagnostic',
      title,
      description: [
        'Internal CRM review task for a public Family Report Card Initial Financial Diagnostic.',
        'Contact permission was granted on this submission.',
        consent.emailMarketingConsent === true
          ? 'Email marketing consent was granted (marketing only; not general contact).'
          : 'Email marketing consent was not granted.',
        consent.smsMarketingConsent === true
          ? 'SMS marketing consent was granted (marketing only; not general contact).'
          : 'SMS marketing consent was not granted.',
        'Review the diagnostic before any outreach.',
        'Do not assume a communication channel without its channel consent.',
        'Completing this task does not mark the diagnostic as advisor-reviewed.',
      ].join('\n'),
    }
  }

  if (contact === 'denied') {
    const title =
      matchStatus === 'exact_trusted_match'
        ? 'Review new diagnostic for existing household — verify contact authority'
        : 'Review Initial Financial Diagnostic — no contact permission'
    return {
      workflowType: 'review_initial_diagnostic',
      title,
      description: [
        'Internal CRM review task for a public Family Report Card Initial Financial Diagnostic.',
        'Contact permission was not granted.',
        'Internal review only. Do not initiate outreach based solely on this submission.',
        'Completing this task does not mark the diagnostic as advisor-reviewed.',
      ].join('\n'),
    }
  }

  return {
    workflowType: 'review_initial_diagnostic',
    title: 'Review Initial Financial Diagnostic — verify contact permission',
    description: [
      'Internal CRM review task for a public Family Report Card Initial Financial Diagnostic.',
      'Contact permission could not be determined from the consent snapshot.',
      'Verify contact authority before any outreach based on this diagnostic.',
      'Completing this task does not mark the diagnostic as advisor-reviewed.',
    ].join('\n'),
  }
}

export function taskLanguageImpliesUnauthorizedOutreach(
  language: GeneratedTaskLanguage,
  consent: FollowUpConsentInput,
): boolean {
  const text = `${language.title}\n${language.description}`.toLowerCase()
  const contact = resolveContactPermissionState(consent)

  if (contact !== 'granted') {
    if (/\b(call|text|sms|email)\s+(the\s+)?(client|prospect|household)\b/.test(text)) {
      return true
    }
    if (/\binitiate outreach\b/.test(text) && !/do not initiate outreach/.test(text)) {
      return true
    }
  }

  if (consent.smsMarketingConsent !== true && /\bsms approved\b|\btext approved\b/.test(text)) {
    return true
  }
  if (consent.emailMarketingConsent !== true && /\bemail approved\b/.test(text)) {
    return true
  }

  return false
}
