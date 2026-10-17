import { useLocation } from 'react-router-dom'
import AssessmentBrandHeader from '../components/AssessmentBrandHeader'
import ScheduleReportCardLink from '../components/ScheduleReportCardLink'
import { chromeCopy } from '../components/publicSite/chromeCopy'
import { readPublicLocale, type PublicLocale } from '../components/publicSite/locale'
import PublicLink from '../components/publicSite/PublicLink'
import PublicLocaleSwitcher from '../components/publicSite/PublicLocaleSwitcher'
import { usePublicDocumentLang } from '../components/publicSite/usePublicDocumentLang'
import { ROUTES } from '../constants/routes'
import { useHomeDocumentMeta } from '../components/publicSite/home/useHomeDocumentMeta'
import { readBookingService } from '../constants/booking'

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
  const bookingService = readBookingService(location.search)
  const specialist = bookingService === 'health' ? 'Jazmin' : bookingService === 'student_loan' ? 'Lizbeth' : bookingService === 'tsp' ? 'Luis' : null
  const chrome = chromeCopy[locale]
  usePublicDocumentLang(locale)
  useHomeDocumentMeta({
    metaTitle: `${copy.title} | Valtoris Financial`,
    metaDescription: copy.lead,
  })

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
          {specialist && <p>{locale === 'es' ? 'Tu reunión será con' : 'Your meeting will be with'} {specialist}.</p>}

          <div className="schedule-expectations">
            <h2>{locale === 'es' ? 'Qué esperar' : 'What to expect'}</h2>
            <ul>
              <li>{locale === 'es' ? 'Comparta su prioridad y las preguntas que desea resolver.' : 'Share your main priority and the questions you want to address.'}</li>
              <li>{locale === 'es' ? 'Tenga a mano su Report Card, si ya completó uno. No necesita enviar números de cuenta para agendar.' : 'Have your Report Card handy if you completed one. You do not need to send account numbers to book.'}</li>
              <li>{locale === 'es' ? 'Conversen sobre posibles próximos pasos; no necesita elegir un producto para iniciar la conversación.' : 'Discuss possible next steps; you do not need to choose a product to start the conversation.'}</li>
            </ul>
            <p>{locale === 'es' ? 'El botón abre el calendario de Valtoris en otra pestaña. Revisa allí los horarios y detalles disponibles antes de confirmar tu cita.' : 'The button opens the Valtoris booking calendar in a new tab. Review available times and meeting details there before confirming your appointment.'}</p>
          </div>

          <ScheduleReportCardLink bookingService={bookingService} className="platform-btn platform-btn-primary">
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
