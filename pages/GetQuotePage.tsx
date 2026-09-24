import { useLocation } from 'react-router-dom'
import PublicLink from '../components/publicSite/PublicLink'
import { readPublicLocale } from '../components/publicSite/locale'
import { useServiceDocumentMeta } from '../components/publicSite/services/useServiceDocumentMeta'
import '../components/insuranceQuote.css'

const content = {
  en: {
    title: 'Get an insurance quote',
    intro: 'Choose the coverage you need. Share a few details so a Valtoris advisor can review your request and follow up with you.',
    action: 'Start request',
    note: 'Submitting a request does not bind coverage or guarantee a price. A Valtoris advisor will review your information with you.',
    language: '',
    cards: [
      { kind: 'auto', title: 'Auto insurance', description: 'Tell us about your drivers, vehicles, and the coverage you’re looking for.' },
      { kind: 'home', title: 'Home insurance', description: 'Share details about your property, current coverage, and protection needs.' },
      { kind: 'commercial', title: 'Commercial insurance', description: 'Tell us about your business and the coverage you need for your operations, property, employees, or vehicles.' },
    ],
  },
  es: {
    title: 'Solicita una cotización de seguro',
    intro: 'Elige la cobertura que necesitas. Comparte tus datos para que un asesor de Valtoris revise tu solicitud y se comunique contigo.',
    action: 'Iniciar solicitud',
    note: 'Enviar una solicitud no activa cobertura ni garantiza un precio. Un asesor de Valtoris revisará la información contigo.',
    language: 'Los formularios de solicitud están disponibles en inglés.',
    cards: [
      { kind: 'auto', title: 'Seguro de auto', description: 'Cuéntanos sobre tus conductores, vehículos y la cobertura que buscas.' },
      { kind: 'home', title: 'Seguro de vivienda', description: 'Comparte los detalles de tu propiedad, cobertura actual y necesidades de protección.' },
      { kind: 'commercial', title: 'Seguro comercial', description: 'Cuéntanos sobre tu negocio y la cobertura que necesitas para tus operaciones, propiedad, empleados o vehículos.' },
    ],
  },
}

export default function GetQuotePage() {
  const location = useLocation()
  const copy = content[readPublicLocale(location.search)]
  useServiceDocumentMeta({ metaTitle: `${copy.title} | Valtoris Financial`, metaDescription: copy.intro })
  return <div className="quote-shell">
    <div className="quote-intro">
      <span className="quote-eyebrow">VALTORIS FINANCIAL</span>
      <h1>{copy.title}</h1>
      <p>{copy.intro}</p>
      {copy.language ? <p className="quote-note">{copy.language}</p> : null}
    </div>
    <div className="quote-choice-grid">
      {copy.cards.map(card => <section className="quote-card quote-choice-card" key={card.kind}>
        <h2>{card.title}</h2>
        <p>{card.description}</p>
        <PublicLink className="quote-primary" to={`/${card.kind}-quote`} aria-label={`${copy.action}: ${card.title}`}>
          {copy.action} <span aria-hidden="true">→</span>
        </PublicLink>
      </section>)}
    </div>
    <p className="quote-note quote-choice-note">{copy.note}</p>
  </div>
}
