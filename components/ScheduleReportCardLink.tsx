import { MouseEvent, ReactNode } from 'react'
import { bookingUrlForAssessment } from '../constants/booking'
import {
  CALENDLY_REPORT_CARD_BUTTON_LABEL,
} from '../constants/urls'

type ScheduleReportCardLinkProps = {
  className?: string
  children?: ReactNode
  bookingService?: string
}

export default function ScheduleReportCardLink({
  className,
  children = CALENDLY_REPORT_CARD_BUTTON_LABEL,
  bookingService,
}: ScheduleReportCardLinkProps) {
  const bookingUrl = bookingUrlForAssessment(bookingService)
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    window.open(bookingUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <a
      className={className}
      href={bookingUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
    >
      {children}
    </a>
  )
}
