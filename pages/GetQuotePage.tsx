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

const entryCopy = {
  en: {
    personal: {
      title: 'Personal Property & Casualty Insurance',
      intro: 'Start a home or auto quote request. Tell us about your property or vehicles, current coverage, and what you would like to insure.',
    },
    commercial: {
      title: 'Commercial Insurance',
      intro: 'Start a quote request with details about your operations, current coverage, and when you need coverage to begin. The form adapts to the coverages you select.',
    },
  },
  es: {
    personal: {
      title: 'Seguros personales de propiedad y responsabilidad',
      intro: 'Inicia una solicitud de seguro de vivienda o auto. Comparte los detalles de tu propiedad o vehículos, tu cobertura actual y lo que deseas asegurar.',
    },
    commercial: {
      title: 'Seguros comerciales',
      intro: 'Inicia una solicitud con los detalles de tus operaciones, tu cobertura actual y cuándo necesitas que comience. El formulario se adapta a las coberturas que elijas.',
    },
  },
}

export default function GetQuotePage({ audience }: { audience?: "personal" | "commercial" }) {
  const location = useLocation()
  const locale = readPublicLocale(location.search)
  const copy = content[locale]
  const entry = audience ? entryCopy[locale][audience] : copy
  const cards = audience === 'personal'
    ? copy.cards.filter(card => card.kind !== 'commercial')
    : audience === 'commercial' ? copy.cards.filter(card => card.kind === 'commercial') : copy.cards
  useServiceDocumentMeta({ metaTitle: `${entry.title} | Valtoris Financial`, metaDescription: entry.intro })
  return <div className="quote-shell">
    <div className="quote-intro">
      <span className="quote-eyebrow">VALTORIS FINANCIAL</span>
      <h1>{entry.title}</h1>
      <p>{entry.intro}</p>
      {copy.language ? <p className="quote-note">{copy.language}</p> : null}
    </div>
    <div className="quote-choice-grid">
      {cards.map(card => <section className="quote-card quote-choice-card" key={card.kind}>
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
