/**
 * Pure view-model helpers for the public advisor card page.
 * No I/O, no admin client, no analytics/CRM side effects.
 */

import { LETS_CONNECT_CTA_LABEL } from '../../modules/digital-identity'
import type {
  IdentityCtaConfigItem,
  IdentityCtaKey,
  IdentitySurfacePublicDto,
} from '../../modules/digital-identity'
import { ROUTES } from '../../constants/routes'

export type PublicCardPageStatus =
  | 'loading'
  | 'ready'
  | 'unavailable'
  | 'invalid_request'
  | 'network_error'
  | 'server_error'

export type PublicCardHeroAction = {
  key: 'lets_connect' | 'save_contact' | 'book_appointment'
  label: string
  /**
   * Let's Connect remains a disabled placeholder.
   * Save Contact triggers Smart vCard download via the public API.
   */
  mode: 'disabled_placeholder' | 'external_link' | 'vcard_download'
  href: string | null
  comingSoonBadge: boolean
}

export type PublicCardDiagnosticAction = {
  key: IdentityCtaKey
  label: string
  href: string | null
  mode: 'link' | 'coming_soon'
}

export type PublicCardOutcome = {
  key: string
  title: string
  description: string
  href: string | null
  comingSoon: boolean
  actionLabel: string | null
}

export type PublicCardContactVisibility = {
  phone: string | null
  email: string | null
  website: string | null
  showPhone: boolean
  showEmail: boolean
  showWebsite: boolean
}

export type PublicCardErrorCopy = {
  title: string
  message: string
}

const DIAGNOSTIC_KEYS: readonly IdentityCtaKey[] = [
  'family_report_card',
  'business_report_card',
  'protection_gap',
]

function ctaByKey(
  ctas: readonly IdentityCtaConfigItem[],
  key: IdentityCtaKey,
): IdentityCtaConfigItem | undefined {
  return ctas.find((item) => item.key === key)
}

export function getInitials(displayName: string): string {
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

export function resolveContactVisibility(
  card: IdentitySurfacePublicDto,
): PublicCardContactVisibility {
  const phone = card.phone?.trim() || null
  const email = card.email?.trim() || null
  const website = card.website?.trim() || null
  return {
    phone,
    email,
    website,
    showPhone: Boolean(phone),
    showEmail: Boolean(email),
    showWebsite: Boolean(website),
  }
}

/**
 * Hero actions:
 * - Let's Connect → disabled placeholder (no form yet)
 * - Save Contact → Smart vCard download (server-generated)
 * - Book Appointment → only when Calendly URL exists
 */
export function buildHeroActions(card: IdentitySurfacePublicDto): PublicCardHeroAction[] {
  const actions: PublicCardHeroAction[] = [
    {
      key: 'lets_connect',
      label: card.primaryConnectLabel || LETS_CONNECT_CTA_LABEL,
      mode: 'disabled_placeholder',
      href: null,
      comingSoonBadge: false,
    },
    {
      key: 'save_contact',
      label: 'Save Contact',
      mode: 'vcard_download',
      href: null,
      comingSoonBadge: false,
    },
  ]

  const book = ctaByKey(card.ctas, 'book_appointment')
  const calendly = card.calendlyUrl?.trim() || book?.href?.trim() || null
  if (calendly) {
    actions.push({
      key: 'book_appointment',
      label: book?.label?.trim() || 'Book Appointment',
      mode: 'external_link',
      href: calendly,
      comingSoonBadge: false,
    })
  }

  return actions
}

/**
 * Diagnostic CTAs from API config, plus Credit Assessment as Coming Soon.
 */
export function buildDiagnosticActions(
  card: IdentitySurfacePublicDto,
): PublicCardDiagnosticAction[] {
  const actions: PublicCardDiagnosticAction[] = []

  for (const key of DIAGNOSTIC_KEYS) {
    const item = ctaByKey(card.ctas, key)
    if (!item) continue
    actions.push({
      key,
      label: item.label,
      href: item.href?.trim() || null,
      mode: 'link',
    })
  }

  actions.push({
    key: 'credit_assessment',
    label: 'Credit Assessment',
    href: null,
    mode: 'coming_soon',
  })

  return actions
}

/**
 * Outcome-grouped help section (not a product dump / Linktree list).
 */
export function buildOutcomeSections(card: IdentitySurfacePublicDto): PublicCardOutcome[] {
  const outcomes: PublicCardOutcome[] = []
  const family = ctaByKey(card.ctas, 'family_report_card')
  const protection = ctaByKey(card.ctas, 'protection_gap')
  const business = ctaByKey(card.ctas, 'business_report_card')

  if (family) {
    outcomes.push({
      key: 'protect_family',
      title: 'Protect Your Family',
      description:
        'See where your household may be exposed and what to strengthen first.',
      href: family.href?.trim() || ROUTES.familyAssessment,
      comingSoon: false,
      actionLabel: family.label,
    })
  }

  if (protection) {
    outcomes.push({
      key: 'protection_gap',
      title: 'Close Protection Gaps',
      description:
        'Estimate the coverage gap that could leave the people who depend on you at risk.',
      href: protection.href?.trim() || ROUTES.protectionGap,
      comingSoon: false,
      actionLabel: protection.label,
    })
  }

  if (business) {
    outcomes.push({
      key: 'grow_business',
      title: 'Grow Your Business',
      description:
        'Clarify cash flow, protection, and the financial foundation behind your company.',
      href: business.href?.trim() || ROUTES.businessReportCard,
      comingSoon: false,
      actionLabel: business.label,
    })
  }

  outcomes.push({
    key: 'prepare_retirement',
    title: 'Prepare for Retirement',
    description: 'Check whether today’s habits support the income you’ll need later.',
    href: ROUTES.retirementReportCard,
    comingSoon: false,
    actionLabel: 'Retirement Report Card',
  })

  outcomes.push({
    key: 'build_business_wealth',
    title: 'Build Business Wealth',
    description: 'Connect business strength to long-term personal and family wealth.',
    href: business?.href?.trim() || ROUTES.businessReportCard,
    comingSoon: false,
    actionLabel: business?.label || 'Business Report Card',
  })

  outcomes.push({
    key: 'improve_credit',
    title: 'Improve Credit',
    description: 'A focused credit pathway for personal financial mobility.',
    href: null,
    comingSoon: true,
    actionLabel: 'Coming Soon',
  })

  outcomes.push({
    key: 'build_business_credit',
    title: 'Build Business Credit',
    description: 'Separate business credit strength from personal guarantees over time.',
    href: null,
    comingSoon: true,
    actionLabel: 'Coming Soon',
  })

  return outcomes
}

export function errorCopyForStatus(
  status: Exclude<PublicCardPageStatus, 'loading' | 'ready'>,
): PublicCardErrorCopy {
  switch (status) {
    case 'invalid_request':
      return {
        title: 'This card link is not valid',
        message: 'Check the link and try again, or ask your advisor for an updated card.',
      }
    case 'unavailable':
      return {
        title: 'This card is unavailable',
        message:
          'This advisor card is not published, or the advisor is currently unavailable.',
      }
    case 'network_error':
      return {
        title: 'Connection problem',
        message: 'We couldn’t load this card. Please check your connection and try again.',
      }
    case 'server_error':
    default:
      return {
        title: 'Something went wrong',
        message: 'We couldn’t load this card right now. Please try again in a moment.',
      }
  }
}

export function mapFetchFailureToStatus(
  code: 'invalid_request' | 'unavailable' | 'network' | 'timeout' | 'server' | 'malformed_response',
): Exclude<PublicCardPageStatus, 'loading' | 'ready'> {
  switch (code) {
    case 'invalid_request':
      return 'invalid_request'
    case 'unavailable':
      return 'unavailable'
    case 'network':
    case 'timeout':
      return 'network_error'
    case 'server':
    case 'malformed_response':
    default:
      return 'server_error'
  }
}

export function documentTitleForCard(card: IdentitySurfacePublicDto | null): string {
  if (!card) return 'Advisor Card · Valtoris Financial'
  return `${card.displayName} · Valtoris Financial`
}

/** Layout class helpers for responsive composition (unit-tested). */
export function publicCardLayoutClasses(): {
  page: string
  shell: string
  hero: string
  outcomes: string
  outcomeGrid: string
} {
  return {
    page: 'public-card-page',
    shell: 'public-card-shell',
    hero: 'public-card-hero',
    outcomes: 'public-card-outcomes',
    outcomeGrid: 'public-card-outcome-grid',
  }
}

export function publicCardPageSideEffects(): {
  writesAnalytics: false
  createsLead: false
  createsHousehold: false
  /** Smart vCard download via public API — never a CRM write. */
  downloadsVCard: true
  /** QR download via public API — key route only; never analytics. */
  downloadsQr: true
  opensConnectForm: false
  importsAdminClient: false
} {
  return {
    writesAnalytics: false,
    createsLead: false,
    createsHousehold: false,
    downloadsVCard: true,
    downloadsQr: true,
    opensConnectForm: false,
    importsAdminClient: false,
  }
}

export function vCardDownloadErrorCopy(
  code: 'unavailable' | 'network' | 'timeout' | 'server' | 'generation_failure' | 'malformed_response' | 'invalid_request',
): string {
  switch (code) {
    case 'unavailable':
      return 'This advisor card is not available for download.'
    case 'network':
    case 'timeout':
      return 'We couldn’t download the contact file. Please check your connection and try again.'
    case 'invalid_request':
      return 'This card link is not valid.'
    default:
      return 'We couldn’t generate the contact file right now. Please try again in a moment.'
  }
}

/** Accessibility contract enforced by PublicAdvisorCardView. */
export const PUBLIC_CARD_A11Y_CONTRACT = {
  loadingUsesAriaBusy: true,
  statesUseAriaLive: true,
  sectionsUseAriaLabelledBy: true,
  headshotUsesAltText: true,
  disabledActionsUseAriaDisabled: true,
  focusVisibleSupportedViaCss: true,
  prefersReducedMotionHonored: true,
} as const
