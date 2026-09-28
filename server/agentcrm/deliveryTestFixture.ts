// Test-only delivery context for existing contact-classification regression cases.
import type { ReportCardDeliveryContext } from './reportCardSync'
export function deliveryTestFixture(): ReportCardDeliveryContext {
  return { contactId: null, createStarted: false, tagStarted: false, tagApplied: false,
    async checkpoint() {}, async verifyContact() { return { hasTag: false } },
  }
}
