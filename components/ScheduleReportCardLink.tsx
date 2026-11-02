import { ReactNode } from 'react'
import { schedulePathForAssessment } from '../constants/booking'
import { Link, useLocation } from 'react-router-dom'
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
  const location = useLocation()
  return (
    <Link className={className} to={schedulePathForAssessment(bookingService ?? '', location.search)}>
      {children}
    </Link>
  )
}
