import { QUOTE_CONSENT_VERSION } from './catalog'
import type { QuoteKind } from './catalog'
export function quoteFixture(kind: QuoteKind = 'auto') {
  return { version: 1, kind, submissionId: '90000000-0000-4000-8000-000000000001', formStartedAt: Date.now()-60000, website: '', contact: { firstName: 'Synthetic', lastName: 'QuoteTest', email: 'quote-test@example.invalid', phone: '2025550148', preferredContact: 'Email' }, answers: kind === 'auto' ? { address: '123 Test Street, Austin, TX 78701', drivers: [{ name: 'Synthetic QuoteTest' }], vehicles: [{ makeModel: 'Test Sedan' }] } : kind === 'home' ? { address: '123 Test Street, Austin, TX 78701', occupancy: 'Owner-occupied', policyType: 'Homeowners (HO-3)' } : { address: '123 Test Street, Austin, TX 78701', businessName: 'Synthetic Test Business', entityType: 'LLC', operations: 'Software consulting', lines: ['Workers’ Compensation'] }, consent: { version: QUOTE_CONSENT_VERSION, storage: true, contact: true, privacy: true } }
}
