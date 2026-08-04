/**
 * CTA configuration builders for Digital Identity advisor cards.
 */

import { LETS_CONNECT_CTA_LABEL } from './constants.js'
import type { IdentityCtaConfigItem, IdentityCtaConfiguration } from './types.js'

/** Default CTA set for v1 advisor cards. */
export function createDefaultAdvisorCardCtas(input?: {
  calendlyUrl?: string | null
  familyReportCardHref?: string | null
  businessReportCardHref?: string | null
  protectionGapHref?: string | null
}): IdentityCtaConfiguration {
  const items: IdentityCtaConfigItem[] = [
    {
      key: 'lets_connect',
      label: LETS_CONNECT_CTA_LABEL,
      enabled: true,
    },
    {
      key: 'save_contact',
      label: 'Save Contact',
      enabled: true,
    },
    {
      key: 'book_appointment',
      label: 'Book Appointment',
      enabled: Boolean(input?.calendlyUrl?.trim()),
      href: input?.calendlyUrl?.trim() || null,
    },
    {
      key: 'family_report_card',
      label: 'Family Financial Report Card',
      enabled: true,
      href: input?.familyReportCardHref ?? '/family-assessment',
    },
    {
      key: 'business_report_card',
      label: 'Business Financial Report Card',
      enabled: true,
      href: input?.businessReportCardHref ?? '/business-report-card',
    },
    {
      key: 'protection_gap',
      label: 'Protection Gap',
      enabled: true,
      href: input?.protectionGapHref ?? '/protection-gap',
    },
    {
      key: 'credit_assessment',
      label: 'Future Credit Assessment',
      enabled: false,
      href: null,
    },
  ]

  return {
    primaryConnectLabel: LETS_CONNECT_CTA_LABEL,
    items,
  }
}

export function getEnabledPublicCtas(
  config: IdentityCtaConfiguration,
): readonly IdentityCtaConfigItem[] {
  return config.items.filter((item) => item.enabled)
}
