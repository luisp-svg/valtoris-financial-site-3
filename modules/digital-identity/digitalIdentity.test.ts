import { describe, expect, it } from 'vitest'
import {
  getModule,
  listEnabledModules,
  listTaskWorkflowTypes,
  moduleDeclaresPermission,
  requireModule,
} from '../../platform/registry'
import { isCrmSupportedRole } from '../../crm/types'
import {
  DIGITAL_IDENTITY_CAPABILITIES,
  DIGITAL_IDENTITY_CRM_ACTIVITY_EVENTS,
  DIGITAL_IDENTITY_MODULE_KEY,
  DIGITAL_IDENTITY_TASK_WORKFLOWS,
  LETS_CONNECT_CTA_LABEL,
  V1_IDENTITY_SURFACE_KIND,
  anonymousEventCreatesCrmRecord,
  contactExchangeCreatesCase,
  createDefaultAdvisorCardCtas,
  generateIdentityPublicKey,
  isValidIdentityPublicKey,
  normalizeIdentitySlug,
  rejectsTrustedAdvisorIds,
  toIdentitySurfacePublicDto,
  validateAnonymousEventDraft,
  validateDigitalIdentitySubmissionInput,
  viewOrDownloadCreatesHousehold,
} from './index'
import type { IdentitySurface } from './types'

function sampleSurface(overrides?: Partial<IdentitySurface>): IdentitySurface {
  const ctas = createDefaultAdvisorCardCtas({
    calendlyUrl: 'https://calendly.com/valtoris/example',
  })
  return {
    id: 'surface-internal-id',
    publicKey: 'pk_test_public_key_01',
    slug: 'jane-advisor',
    kind: V1_IDENTITY_SURFACE_KIND,
    status: 'published',
    advisorProfileId: '11111111-1111-4111-8111-111111111111',
    themeKey: 'default',
    publishProfile: {
      displayName: 'Jane Advisor',
      approvedTitle: 'Financial Advisor',
      approvedCompany: 'Valtoris Financial',
      headline: 'Here to help',
      bio: 'Bio text',
      headshotUrl: 'https://cdn.example.com/jane.jpg',
      phoneVisible: true,
      phone: '555-0100',
      emailVisible: true,
      email: 'jane@example.com',
      website: 'https://valtoris.example',
      socialLinks: [{ key: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/in/jane' }],
      specialties: ['Retirement'],
      calendlyUrl: 'https://calendly.com/valtoris/example',
      themeKey: 'default',
    },
    ctaConfig: ctas,
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    publishedAt: '2026-08-03T00:00:00.000Z',
    disabledAt: null,
    deletedAt: null,
    ...overrides,
  }
}

describe('digital_identity module registry alignment', () => {
  it('registers digital_identity as disabled and hidden', () => {
    const module = requireModule(DIGITAL_IDENTITY_MODULE_KEY)
    expect(module.status).toBe('registered')
    expect(module.featureFlag.enabled).toBe(false)
    expect(module.navigation.visible).toBe(false)
    expect(module.kind).toBe('experience')
    expect(module.futureExtensions?.v1Experience).toBe('advisor_card')
    expect(listEnabledModules().some((item) => item.key === DIGITAL_IDENTITY_MODULE_KEY)).toBe(
      false,
    )
    expect(getModule(DIGITAL_IDENTITY_MODULE_KEY)?.navigation.route).toBeUndefined()
  })

  it('declares capabilities without granting runtime authorization', () => {
    for (const capability of DIGITAL_IDENTITY_CAPABILITIES) {
      expect(moduleDeclaresPermission(DIGITAL_IDENTITY_MODULE_KEY, capability)).toBe(true)
    }
    expect(isCrmSupportedRole('advisor')).toBe(true)
    // Declared capability ≠ authorized role expansion.
    expect(isCrmSupportedRole('client')).toBe(false)
  })

  it('declares CRM activity events and task workflows', () => {
    const module = requireModule(DIGITAL_IDENTITY_MODULE_KEY)
    expect(module.activityTypes.map((item) => item.eventKey)).toEqual([
      ...DIGITAL_IDENTITY_CRM_ACTIVITY_EVENTS,
    ])
    expect(module.taskWorkflows.map((item) => item.workflowType)).toEqual([
      ...DIGITAL_IDENTITY_TASK_WORKFLOWS,
    ])
    expect(listTaskWorkflowTypes()).toContain('review_digital_identity_lead')
    expect(listTaskWorkflowTypes()).toContain('resolve_digital_identity_duplicate')
  })

  it('declares required dependencies', () => {
    expect(requireModule(DIGITAL_IDENTITY_MODULE_KEY).dependencies).toEqual([
      'households',
      'intake',
      'tasks',
      'activities',
      'documents',
    ])
  })
})

describe('CTA configuration', () => {
  it('uses exact Let’s Connect primary label and disables credit assessment by default', () => {
    const ctas = createDefaultAdvisorCardCtas()
    expect(ctas.primaryConnectLabel).toBe(LETS_CONNECT_CTA_LABEL)
    expect(LETS_CONNECT_CTA_LABEL).toBe("Let's Connect")
    const connect = ctas.items.find((item) => item.key === 'lets_connect')
    expect(connect?.label).toBe("Let's Connect")
    expect(connect?.enabled).toBe(true)
    const credit = ctas.items.find((item) => item.key === 'credit_assessment')
    expect(credit?.enabled).toBe(false)
    expect(credit?.label).toBe('Future Credit Assessment')
  })
})

describe('public DTO allowlisting', () => {
  it('excludes draft/disabled cards and internal advisor ids', () => {
    expect(
      toIdentitySurfacePublicDto({
        surface: sampleSurface({ status: 'draft' }),
        cardUrl: '/c/k/pk_test_public_key_01',
      }),
    ).toBeNull()
    expect(
      toIdentitySurfacePublicDto({
        surface: sampleSurface({ status: 'disabled' }),
        cardUrl: '/c/k/pk_test_public_key_01',
      }),
    ).toBeNull()

    const dto = toIdentitySurfacePublicDto({
      surface: sampleSurface(),
      cardUrl: '/c/k/pk_test_public_key_01',
    })
    expect(dto).not.toBeNull()
    expect(dto?.primaryConnectLabel).toBe("Let's Connect")
    expect(dto?.publicKey).toBe('pk_test_public_key_01')
    expect(dto?.phone).toBe('555-0100')
    expect(dto?.approvedTitle).toBe('Financial Strategist')
    expect(dto?.approvedTitle).not.toBe('Financial Advisor')
    expect('advisorProfileId' in (dto as object)).toBe(false)
    expect('id' in (dto as object)).toBe(false)
  })

  it('hides phone/email when visibility flags are false', () => {
    const dto = toIdentitySurfacePublicDto({
      surface: sampleSurface({
        publishProfile: {
          ...sampleSurface().publishProfile,
          phoneVisible: false,
          emailVisible: false,
        },
      }),
      cardUrl: '/c/jane-advisor',
    })
    expect(dto?.phone).toBeNull()
    expect(dto?.email).toBeNull()
  })
})

describe('slug normalization', () => {
  it('normalizes and rejects invalid slugs', () => {
    expect(normalizeIdentitySlug(' Jane Advisor ')).toBe('jane-advisor')
    expect(normalizeIdentitySlug('!!!')).toBeNull()
  })
})

describe('identity public key generation', () => {
  it('generates durable keys that match the stored format without using slugs', () => {
    const keys = new Set<string>()
    for (let i = 0; i < 20; i += 1) {
      const key = generateIdentityPublicKey()
      expect(isValidIdentityPublicKey(key)).toBe(true)
      expect(key.startsWith('pk_')).toBe(true)
      expect(key).not.toMatch(/[/:?]/)
      keys.add(key)
    }
    expect(keys.size).toBe(20)
  })
})

describe('anonymous analytics', () => {
  it('rejects PII metadata and never creates CRM records', () => {
    const rejected = validateAnonymousEventDraft({
      eventKey: 'digital_identity.viewed',
      anonymousSessionId: 'session_abc_123',
      surfacePublicKey: 'pk_test_public_key_01',
      sourceChannel: 'qr',
      safeMetadata: { email: 'leak@example.com' },
    })
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.reason).toBe('pii_metadata_forbidden')

    const ok = validateAnonymousEventDraft({
      eventKey: 'digital_identity.contact_downloaded',
      anonymousSessionId: 'session_abc_123',
      surfacePublicKey: 'pk_test_public_key_01',
      sourceChannel: 'link',
      safeMetadata: { linkKey: 'save_contact' },
    })
    expect(ok.ok).toBe(true)
    expect(anonymousEventCreatesCrmRecord('digital_identity.viewed')).toBe(false)
    expect(viewOrDownloadCreatesHousehold()).toBe(false)
  })
})

describe('relationship submission contract', () => {
  it('rejects trusted advisor IDs from the browser', () => {
    expect(
      rejectsTrustedAdvisorIds({
        submissionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        advisorProfileId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toBe(true)

    const result = validateDigitalIdentitySubmissionInput({
      submissionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      cardPublicKey: 'pk_test_public_key_01',
      firstName: 'Pat',
      lastName: 'Lee',
      email: 'pat@example.com',
      phone: '',
      advisorId: '11111111-1111-4111-8111-111111111111',
      consent: { privacyAcknowledged: true },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('trusted_advisor_id_forbidden')
  })

  it('accepts a valid Let’s Connect payload without creating a Case', () => {
    const result = validateDigitalIdentitySubmissionInput({
      submissionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      cardSlug: 'Jane-Advisor',
      firstName: 'Pat',
      lastName: 'Lee',
      email: 'pat@example.com',
      phone: '5552223333',
      campaignCode: 'expo-2026',
      consent: {
        privacyAcknowledged: true,
        contactPermission: true,
        emailMarketingConsent: false,
        smsMarketingConsent: false,
      },
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.submission.cardSlug).toBe('jane-advisor')
      expect(result.submission.campaignCode).toBe('expo-2026')
    }
    expect(contactExchangeCreatesCase()).toBe(false)
  })
})
