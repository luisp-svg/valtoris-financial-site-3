import { useState } from 'react'
import { HEALTH_BOOKING_URL, STUDENT_LOAN_BOOKING_URL, type BookingService } from '../constants/booking'
import { STRATEGY_SESSION_BOOKING_URL } from '../constants/urls'
import type { PublicLocale } from './publicSite/locale'

const agents = [
  { id: 'luis', name: 'Luis Perez', en: 'Strategy meeting · TSP', es: 'Reunión estratégica · TSP', url: STRATEGY_SESSION_BOOKING_URL },
  { id: 'jazmin', name: 'Jazmin Perez', en: 'Health insurance', es: 'Seguro de salud', url: HEALTH_BOOKING_URL },
  { id: 'lizbeth', name: 'Lizbeth Barajas', en: 'Student loan review', es: 'Revisión de préstamos estudiantiles', url: STUDENT_LOAN_BOOKING_URL },
] as const
const services = [
  { id: 'general', en: 'Choose an agent', es: 'Elegir un agente', agent: null },
  { id: 'tsp', en: 'Strategy meeting / TSP', es: 'Reunión estratégica / TSP', agent: 'luis' },
  { id: 'health', en: 'Health insurance', es: 'Seguro de salud', agent: 'jazmin' },
  { id: 'student_loan', en: 'Student loan review', es: 'Revisión de préstamos estudiantiles', agent: 'lizbeth' },
] as const

export default function AppointmentBooking({ locale, initialService }: { locale: PublicLocale; initialService?: BookingService }) {
  const es = locale === 'es'
  const [serviceId, setServiceId] = useState<string>(initialService ?? 'general')
  const [agentId, setAgentId] = useState<string>('')
  const service = services.find(item => item.id === serviceId) ?? services[0]
  const availableAgents = agents.filter(agent => !service.agent || service.agent === agent.id)
  const selectedAgent = availableAgents.find(agent => agent.id === agentId)

  return (
    <section className="appointment-booking" aria-label={es ? 'Agendar una cita' : 'Appointment booking'}>
      <label className="booking-service-label" htmlFor="booking-service">{es ? '1. ¿En qué podemos ayudarte?' : '1. What can we help you with?'}</label>
      <select id="booking-service" value={serviceId} onChange={event => { setServiceId(event.target.value); setAgentId('') }}>
        {services.map(item => <option key={item.id} value={item.id}>{item[locale]}</option>)}
      </select>
      <fieldset className="booking-agent-options">
        <legend>{es ? '2. Elige tu agente' : '2. Choose your agent'}</legend>
        {availableAgents.map(agent => (
          <label key={agent.id} className={`booking-agent${agent.id === selectedAgent?.id ? ' booking-agent-selected' : ''}`}>
            <input type="radio" name="booking-agent" value={agent.id} checked={selectedAgent?.id === agent.id} onChange={() => setAgentId(agent.id)} />
            <span><strong>{agent.name}</strong><span className="booking-agent-specialty">{agent[locale]}</span></span>
          </label>
        ))}
      </fieldset>
      {selectedAgent ? (
        <section className="booking-calendar" aria-labelledby="booking-calendar-title">
          <h2 id="booking-calendar-title">{es ? '3. Elige una hora con' : '3. Choose a time with'} {selectedAgent.name}</h2>
          <p>{es ? 'Revisa la zona horaria y los detalles antes de confirmar. La cita se confirma al completar el formulario del calendario.' : 'Review the time zone and meeting details before confirming. Your appointment is confirmed when you complete the calendar form.'}</p>
          <a href={selectedAgent.url} target="_blank" rel="noopener noreferrer">{es ? 'Abrir el calendario en otra pestaña' : 'Open calendar in a new tab'}</a>
          <iframe key={selectedAgent.url} src={selectedAgent.url} title={`${es ? 'Agendar con' : 'Book with'} ${selectedAgent.name}`} className="booking-calendar-frame" />
        </section>
      ) : <p className="booking-empty">{es ? 'Selecciona un agente para ver su calendario.' : 'Select an agent to see their calendar.'}</p>}
    </section>
  )
}
