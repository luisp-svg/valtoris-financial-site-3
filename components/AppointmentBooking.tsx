import { useState } from 'react'
import { HEALTH_BOOKING_URL, STUDENT_LOAN_BOOKING_URL, type BookingService } from '../constants/booking'
import { STRATEGY_SESSION_BOOKING_URL } from '../constants/urls'
import type { PublicLocale } from './publicSite/locale'

const agents = [
  { id: 'luis', name: 'Luis Perez', en: 'Family · Business · Retirement / TSP', es: 'Familia · Negocio · Jubilación / TSP', url: STRATEGY_SESSION_BOOKING_URL },
  { id: 'jazmin', name: 'Jazmin Perez', en: 'Health insurance', es: 'Seguro de salud', url: HEALTH_BOOKING_URL },
  { id: 'lizbeth', name: 'Lizbeth Barajas', en: 'Student loan review', es: 'Revisión de préstamos estudiantiles', url: STUDENT_LOAN_BOOKING_URL },
] as const
const services = [
  {id:'family',en:'Family Report Card review',es:'Revisión del Report Card familiar',agent:'luis'},
  {id:'business',en:'Business Owner Report Card review',es:'Revisión del Report Card empresarial',agent:'luis'},
  {id:'life',en:'Life and income protection review',es:'Revisión de protección de vida e ingresos',agent:'luis'},
  {id:'credit',en:'Credit preparation review',es:'Revisión de preparación crediticia',agent:'luis'},
  {id:'home_buyer',en:'Homebuying preparation review',es:'Revisión de preparación para comprar vivienda',agent:'luis'},
  {id:'retirement',en:'Retirement planning review',es:'Revisión de preparación para la jubilación',agent:'luis'},
  {id:'commercial',en:'Business protection conversation',es:'Conversación sobre protección empresarial',agent:'luis'},
  { id: 'general', en: 'Choose your review topic', es: 'Elige el tema de revisión', agent: null },
  { id: 'tsp', en: 'Strategy meeting / TSP', es: 'Reunión estratégica / TSP', agent: 'luis' },
  { id: 'health', en: 'Health insurance', es: 'Seguro de salud', agent: 'jazmin' },
  { id: 'student_loan', en: 'Student loan review', es: 'Revisión de préstamos estudiantiles', agent: 'lizbeth' },
] as const

export default function AppointmentBooking({ locale, initialService }: { locale: PublicLocale; initialService?: BookingService }) {
  const es = locale === 'es'
  const [serviceId, setServiceId] = useState<string>(initialService ?? 'general')
  const [agentId, setAgentId] = useState<string>(()=>services.find(s=>s.id===initialService)?.agent??'')
  const service = services.find(item => item.id === serviceId) ?? services.find(s=>s.id==='general')!
  const availableAgents = agents.filter(agent => !service.agent || service.agent === agent.id)
  const selectedAgent = availableAgents.find(agent => agent.id === agentId)

  return (
    <section className="appointment-booking" aria-label={es ? 'Agendar una cita' : 'Appointment booking'}>
      <label className="booking-service-label" htmlFor="booking-service">{es ? '1. ¿En qué podemos ayudarte?' : '1. What can we help you with?'}</label>
      <select id="booking-service" value={serviceId} onChange={event => { setServiceId(event.target.value); setAgentId(services.find(s=>s.id===event.target.value)?.agent??'') }}>
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
          <p>{es ? 'Consulta inicial de 30 minutos. Confirma tus prioridades y los pasos posibles. No necesitas elegir un producto. Cualquier servicio posterior debe explicar alcance, costos y compensación antes de que aceptes.' : 'A 30-minute introductory consultation to confirm your priorities and possible next steps. No product decision is required. Any later service should explain its scope, costs and compensation before you agree.'}</p>
          <h2 id="booking-calendar-title">{es ? '3. Elige una hora con' : '3. Choose a time with'} {selectedAgent.name}</h2>
          <p>{es ? 'Revisa la zona horaria y los detalles antes de confirmar. La cita se confirma al completar el formulario del calendario.' : 'Review the time zone and meeting details before confirming. Your appointment is confirmed when you complete the calendar form.'}</p>
          <a href={selectedAgent.url} target="_blank" rel="noopener noreferrer">{es ? 'Abrir el calendario en otra pestaña' : 'Open calendar in a new tab'}</a>
          <iframe key={selectedAgent.url} src={selectedAgent.url} title={`${es ? 'Agendar con' : 'Book with'} ${selectedAgent.name}`} className="booking-calendar-frame" />
        </section>
      ) : <p className="booking-empty">{es ? 'Selecciona un agente para ver su calendario.' : 'Select an agent to see their calendar.'}</p>}
    </section>
  )
}
