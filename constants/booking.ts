import { STRATEGY_SESSION_BOOKING_URL } from './urls'

export type BookingService = 'tsp' | 'health' | 'student_loan'

/** Existing active calendars, with staff verified in AgentCRM. */
export const HEALTH_BOOKING_URL = 'https://link.agent-crm.com/widget/booking/Ln1RKtSCFS0HdKTfoX4q'
export const STUDENT_LOAN_BOOKING_URL = 'https://link.agent-crm.com/widget/booking/3FFPZLEp8mOjqxZlFvnw'

export function readBookingService(search: string): BookingService | undefined {
  const service = new URLSearchParams(search).get('service')
  return service === 'health' || service === 'tsp' || service === 'student_loan' ? service : undefined
}

/** Only fixed, verified destinations; query parameters can never supply an external URL. */
export function bookingUrlForAssessment(service?: string): string {
  if (service === 'health') return HEALTH_BOOKING_URL
  if (service === 'student_loan') return STUDENT_LOAN_BOOKING_URL
  return STRATEGY_SESSION_BOOKING_URL
}

export function schedulePathForAssessment(assessmentType: string, search = ''): string {
  const params = new URLSearchParams(search)
  params.delete('service')
  if (assessmentType === 'health' || assessmentType === 'tsp' || assessmentType === 'student_loan') params.set('service', assessmentType)
  return `/schedule${params.size ? `?${params.toString()}` : ''}`
}
