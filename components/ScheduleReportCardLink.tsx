import { MouseEvent, ReactNode } from 'react'
import {
  CALENDLY_REPORT_CARD_BUTTON_LABEL,
  CALENDLY_REPORT_CARD_URL,
} from '../constants/urls'

type ScheduleReportCardLinkProps = {
  className?: string
  children?: ReactNode
}

export default function ScheduleReportCardLink({
  className,
  children = CALENDLY_REPORT_CARD_BUTTON_LABEL,
}: ScheduleReportCardLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    window.open(CALENDLY_REPORT_CARD_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <a
      className={className}
      href={CALENDLY_REPORT_CARD_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
    >
      {children}
    </a>
  )
}
