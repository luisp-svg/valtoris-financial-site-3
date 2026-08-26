import { useLocation } from 'react-router-dom'
import AssessmentBrandHeader from '../components/AssessmentBrandHeader'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import { chromeCopy } from '../components/publicSite/chromeCopy'
import { readPublicLocale, type PublicLocale } from '../components/publicSite/locale'
import PublicLink from '../components/publicSite/PublicLink'
import PublicLocaleSwitcher from '../components/publicSite/PublicLocaleSwitcher'
import { usePublicDocumentLang } from '../components/publicSite/usePublicDocumentLang'
import { ROUTES } from '../constants/routes'

const scheduleCopy = {
  en: {
    kicker: 'Book a Meeting',
    title: 'Book a Strategy Meeting',
    lead: 'Talk with a Valtoris Financial Strategist about where you stand, what deserves attention, and which next step may make sense.',
    cta: 'Choose a Time',
    back: 'Return Home',
  },
  es: {
    kicker: 'Agenda una reunión',
    title: 'Agenda una reunión estratégica',
    lead: 'Habla con un Financial Strategist de Valtoris sobre dónde te encuentras, qué merece atención y cuál podría ser el siguiente paso adecuado.',
    cta: 'Elegir una hora',
    back: 'Volver al inicio',
  },
} as const satisfies Record<
  PublicLocale,
  { kicker: string; title: string; lead: string; cta: string; back: string }
>

export default function ScheduleReportCardPage() {
  const location = useLocation()
  const locale = readPublicLocale(location.search)
  const copy = scheduleCopy[locale]
  const chrome = chromeCopy[locale]
  usePublicDocumentLang(locale)

  return (
    <div className="schedule-shell">
      <div className="schedule-container">
        <header className="schedule-header">
          <AssessmentBrandHeader />
          <PublicLocaleSwitcher
            locale={locale}
            groupLabel={chrome.languageGroup}
            englishLabel={chrome.languageEnglish}
            spanishLabel={chrome.languageSpanish}
          />
        </header>

        <section className="schedule-card">
          <p className="schedule-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="schedule-lead">{copy.lead}</p>

          <ScheduleReportCardLink className="platform-btn platform-btn-primary">
            {copy.cta}
          </ScheduleReportCardLink>

          <PublicLink className="schedule-back-link" to={ROUTES.home}>
            {copy.back}
          </PublicLink>
        </section>
      </div>
    </div>
  )
}
