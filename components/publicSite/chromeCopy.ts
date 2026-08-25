import type { PublicLocale } from './locale'

export type ChromeCopyKey =
  | 'primaryNavLabel'
  | 'mobileMenuLabel'
  | 'menuOpen'
  | 'menuClose'
  | 'navHome'
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
  | 'servicesBusinessFormation'
  | 'servicesEstate'
  | 'servicesTax'
  | 'servicesGroupIndividuals'
  | 'servicesGroupBusiness'
  | 'servicesViewSolutions'
  | 'exploreAllSolutions'
  | 'toolsFamily'
  | 'toolsBusiness'
  | 'toolsRetirement'
  | 'toolsProtection'
  | 'toolsStudentLoan'
  | 'toolsCredit'
  | 'footerCompany'
  | 'footerFamilies'
  | 'footerBusiness'
  | 'footerTools'
  | 'footerPrivacy'
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
    navServices: 'Services',
    navTools: 'Tools',
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
    servicesInsurance: 'Insurance & Risk Management',
    servicesHealth: 'Health & Disability',
    servicesBusinessFormation: 'Business Formation',
    servicesEstate: 'Estate & Legacy',
    servicesTax: 'Tax Strategy',
    servicesGroupIndividuals: 'Individuals & Families',
    servicesGroupBusiness: 'Business',
    servicesViewSolutions: 'View Solutions',
    exploreAllSolutions: 'Explore All Solutions',
    toolsFamily: 'Family Report Card™',
    toolsBusiness: 'Business Report Card™',
    toolsRetirement: 'Retirement Report Card™',
    toolsProtection: 'Protection Gap',
    toolsStudentLoan: 'Student Loan Report Card™',
    toolsCredit: 'Credit Report Card™',
    footerCompany: 'Company',
    footerFamilies: 'Families',
    footerBusiness: 'Business',
    footerTools: 'Tools',
    footerPrivacy: 'Privacy Policy',
    footerDisclaimer:
      'For educational purposes only. Coverage and solutions depend on underwriting, carrier availability, and state rules.',
    footerLegalNav: 'Legal',
  },
  es: {
    primaryNavLabel: 'Principal',
    mobileMenuLabel: 'Menú',
    menuOpen: 'Abrir menú',
    menuClose: 'Cerrar menú',
    navHome: 'Inicio',
    navServices: 'Servicios',
    navTools: 'Herramientas',
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
    servicesInsurance: 'Seguros y gestión de riesgo',
    servicesHealth: 'Salud y discapacidad',
    servicesBusinessFormation: 'Constitución de negocio',
    servicesEstate: 'Patrimonio y legado',
    servicesTax: 'Estrategia fiscal',
    servicesGroupIndividuals: 'Personas y familias',
    servicesGroupBusiness: 'Negocios',
    servicesViewSolutions: 'Ver soluciones',
    exploreAllSolutions: 'Explorar todas las soluciones',
    toolsFamily: 'Family Report Card™',
    toolsBusiness: 'Business Report Card™',
    toolsRetirement: 'Retirement Report Card™',
    toolsProtection: 'Protection Gap',
    toolsStudentLoan: 'Student Loan Report Card™',
    toolsCredit: 'Credit Report Card™',
    footerCompany: 'Compañía',
    footerFamilies: 'Familias',
    footerBusiness: 'Negocios',
    footerTools: 'Herramientas',
    footerPrivacy: 'Política de privacidad',
    footerDisclaimer:
      'Solo con fines educativos. La cobertura y las soluciones dependen de la suscripción, la disponibilidad de las aseguradoras y las normas estatales.',
    footerLegalNav: 'Legal',
  },
}

export function resolveChromeCopy(locale: PublicLocale, key: ChromeCopyKey): string {
  return chromeCopy[locale][key] ?? chromeCopy.en[key]
}
