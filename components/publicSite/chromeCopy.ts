import type { PublicLocale } from './locale'

export type ChromeCopyKey =
  | 'primaryNavLabel'
  | 'mobileMenuLabel'
  | 'menuOpen'
  | 'menuClose'
  | 'navPersonalFamily'
  | 'navPrivateClient'
  | 'navBusinessOwners'
  | 'navHome'
  | 'navGetQuote'
  | 'navServices'
  | 'navTools'
  | 'navAbout'
  | 'navContact'
  | 'bookMeeting'
  | 'advisorLogin'
  | 'languageGroup'
  | 'languageEnglish'
  | 'languageSpanish'
  | 'servicesFamilies'
  | 'servicesBusiness'
  | 'servicesProtection'
  | 'servicesRetirement'
  | 'servicesCredit'
  | 'servicesStudentLoans'
  | 'servicesInsurance'
  | 'servicesHealth'
  | 'servicesAmazeHealth'
  | 'servicesBusinessFormation'
  | 'servicesEstate'
  | 'servicesTax'
  | 'servicesGroupIndividuals'
  | 'servicesGroupBusiness'
  | 'servicesViewSolutions'
  | 'exploreAllSolutions'
  | 'toolsCommercial'
  | 'toolsTrucking'
  | 'toolsFamily'
  | 'toolsBusiness'
  | 'toolsRetirement'
  | 'toolsProtection'
  | 'toolsStudentLoan'
  | 'toolsCredit'
  | 'toolsHomeBuyer'
  | 'toolsTsp'
  | 'toolsHealth'
  | 'toolsBenefits'
  | 'toolsTax'
  | 'toolsLifestyle'
  | 'footerCompany'
  | 'footerFamilies'
  | 'footerBusiness'
  | 'footerTools'
  | 'footerPrivacy'
  | 'footerBrandLine'
  | 'footerDisclaimer'
  | 'footerLegalNav'

export type ChromeCopyCatalog = Record<ChromeCopyKey, string>

export const chromeCopy: Record<PublicLocale, ChromeCopyCatalog> = {
  en: {
    primaryNavLabel: 'Primary',
    mobileMenuLabel: 'Menu',
    menuOpen: 'Open menu',
    menuClose: 'Close menu',
    navHome: 'Home',
    navPersonalFamily: 'Personal & Family',
    navPrivateClient: 'Private Client',
    navBusinessOwners: 'Business Owners',
    navGetQuote: 'Get a Quote',
    navServices: 'Services',
    navTools: 'Report Cards',
    navAbout: 'About',
    navContact: 'Contact',
    bookMeeting: 'Book a Meeting',
    advisorLogin: 'Advisor Login',
    languageGroup: 'Language',
    languageEnglish: 'English',
    languageSpanish: 'Español',
    servicesFamilies: 'Individuals & Families',
    servicesBusiness: 'Business Owners',
    servicesProtection: 'Protection',
    servicesRetirement: 'Retirement',
    servicesCredit: 'Credit',
    servicesStudentLoans: 'Student Loans',
    servicesInsurance: 'Property & Business Insurance',
    servicesHealth: 'Health & Disability',
    servicesAmazeHealth: 'Amaze Health',
    servicesBusinessFormation: 'Business Formation',
    servicesEstate: 'Estate & Legacy',
    servicesTax: 'Tax Strategy',
    servicesGroupIndividuals: 'Individuals & Families',
    servicesGroupBusiness: 'Business',
    servicesViewSolutions: 'View Solutions',
    exploreAllSolutions: 'Explore All Solutions',
    toolsCommercial: 'Commercial Insurance Report Card',
    toolsTrucking: 'Commercial Trucking Report Card',
    toolsFamily: 'Family Financial Discovery (Optional)',
    toolsBusiness: 'Business Owner Discovery (Optional)',
    toolsRetirement: 'Retirement, TSP & Government Benefits',
    toolsProtection: 'Life Insurance / Protection Gap',
    toolsStudentLoan: 'Student Loan Report Card™',
    toolsCredit: 'Credit Repair Report Card',
    toolsHomeBuyer: 'Homebuyer Readiness Report Card',
    toolsTsp: 'TSP & Federal Retirement Report Card',
    toolsHealth: 'Health & Disability Report Card',
    toolsBenefits: 'Employee Benefits Report Card',
    toolsTax: 'Tax Planning Report Card',
    toolsLifestyle: 'Personal Home & Auto Report Card',
    footerCompany: 'Company',
    footerFamilies: 'Families',
    footerBusiness: 'Business',
    footerTools: 'Tools',
    footerPrivacy: 'Privacy Policy',
    footerBrandLine: 'Your financial life. One coordinated strategy.',
    footerDisclaimer:
      'For educational purposes only. Insurance products depend on underwriting, carrier availability, and state rules. Valtoris does not provide legal or tax advice, and outcomes are not guaranteed.',
    footerLegalNav: 'Legal',
  },
  es: {
    primaryNavLabel: 'Principal',
    mobileMenuLabel: 'Menú',
    menuOpen: 'Abrir menú',
    menuClose: 'Cerrar menú',
    navHome: 'Inicio',
    navPersonalFamily: 'Personas y familias',
    navPrivateClient: 'Protección patrimonial',
    navBusinessOwners: 'Dueños de negocios',
    navGetQuote: 'Cotizar',
    navServices: 'Servicios',
    navTools: 'Reportes',
    navAbout: 'Nosotros',
    navContact: 'Contacto',
    bookMeeting: 'Agendar una reunión',
    advisorLogin: 'Acceso para estrategas',
    languageGroup: 'Idioma',
    languageEnglish: 'English',
    languageSpanish: 'Español',
    servicesFamilies: 'Personas y familias',
    servicesBusiness: 'Dueños de negocio',
    servicesProtection: 'Protección',
    servicesRetirement: 'Jubilación',
    servicesCredit: 'Crédito',
    servicesStudentLoans: 'Préstamos estudiantiles',
    servicesInsurance: 'Seguros de propiedad y negocio',
    servicesAmazeHealth: 'Amaze Health',
    servicesHealth: 'Salud y discapacidad',
    servicesBusinessFormation: 'Constitución de negocio',
    servicesEstate: 'Patrimonio y legado',
    servicesTax: 'Estrategia fiscal',
    servicesGroupIndividuals: 'Personas y familias',
    servicesGroupBusiness: 'Negocios',
    servicesViewSolutions: 'Ver soluciones',
    exploreAllSolutions: 'Explorar todas las soluciones',
    toolsCommercial: 'Reporte de seguro comercial',
    toolsTrucking: 'Reporte de transporte comercial',
    toolsFamily: 'Revisión financiera familiar (opcional)',
    toolsBusiness: 'Revisión empresarial (opcional)',
    toolsRetirement: 'Jubilación, TSP y beneficios gubernamentales',
    toolsProtection: 'Life Insurance / Protection Gap',
    toolsStudentLoan: 'Student Loan Report Card™',
    toolsCredit: 'Report Card de reparación crediticia',
    toolsHomeBuyer: 'Reporte de preparación para comprar vivienda',
    toolsTsp: 'Reporte de TSP y jubilación federal',
    toolsHealth: 'Reporte de cobertura de salud',
    toolsBenefits: 'Reporte de beneficios para empleados',
    toolsTax: 'Reporte de planificación fiscal',
    toolsLifestyle: 'Reporte de protección patrimonial y estilo de vida',
    footerCompany: 'Compañía',
    footerFamilies: 'Familias',
    footerBusiness: 'Negocios',
    footerTools: 'Herramientas',
    footerPrivacy: 'Política de privacidad',
    footerBrandLine: 'Tu vida financiera. Una estrategia coordinada.',
    footerDisclaimer:
      'Solo con fines educativos. Los productos de seguros dependen de la suscripción, la disponibilidad de las aseguradoras y las normas estatales. Valtoris no ofrece asesoría legal ni fiscal, y los resultados no están garantizados.',
    footerLegalNav: 'Legal',
  },
}

export function resolveChromeCopy(locale: PublicLocale, key: ChromeCopyKey): string {
  return chromeCopy[locale][key] ?? chromeCopy.en[key]
}
