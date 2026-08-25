import type { PublicLocale } from '../locale'

export type SolutionsCopy = {
  metaTitle: string
  metaDescription: string
  heroEyebrow: string
  heroTitle: string
  heroSupport: string
  heroPrimaryCta: string
  heroSecondaryCta: string
  familyHeading: string
  familyLead: string
  familyProtectionTitle: string
  familyProtectionBody: string
  familyProtectionCta: string
  familyInsuranceTitle: string
  familyInsuranceBody: string
  familyInsuranceCta: string
  familyHealthTitle: string
  familyHealthBody: string
  familyHealthCta: string
  familyCreditTitle: string
  familyCreditBody: string
  familyCreditCta: string
  familyStudentTitle: string
  familyStudentBody: string
  familyStudentCta: string
  familyEstateTitle: string
  familyEstateBody: string
  familyEstateCta: string
  familyTaxTitle: string
  familyTaxBody: string
  familyTaxCta: string
  businessHeading: string
  businessLead: string
  businessFormationTitle: string
  businessFormationBody: string
  businessFormationCta: string
  businessInsuranceTitle: string
  businessInsuranceBody: string
  businessInsuranceCta: string
  businessTaxTitle: string
  businessTaxBody: string
  businessTaxCta: string
  businessEstateTitle: string
  businessEstateBody: string
  businessEstateCta: string
  businessCreditTitle: string
  businessCreditBody: string
  businessCreditCta: string
  toolsHeading: string
  toolsBrand: string
  toolsLead: string
  toolFamilyTitle: string
  toolFamilyBody: string
  toolFamilyCta: string
  toolBusinessTitle: string
  toolBusinessBody: string
  toolBusinessCta: string
  toolRetirementTitle: string
  toolRetirementBody: string
  toolRetirementCta: string
  toolProtectionTitle: string
  toolProtectionBody: string
  toolProtectionCta: string
  toolStudentTitle: string
  toolStudentBody: string
  toolStudentCta: string
  toolCreditTitle: string
  toolCreditBody: string
  toolCreditCta: string
  coordinationHeading: string
  coordinationLead: string
  coordination1: string
  coordination2: string
  coordination3: string
  coordination4: string
  coordination5: string
  coordinationClose: string
  finalHeading: string
  finalLead: string
  finalPrimaryCta: string
  finalSecondaryCta: string
  disclaimer: string
}

export type SolutionsCopyKey = keyof SolutionsCopy

export const solutionsCopy: Record<PublicLocale, SolutionsCopy> = {
  en: {
    metaTitle: 'Explore All Solutions | Valtoris Financial',
    metaDescription:
      'Explore Valtoris services for protection, retirement readiness, insurance, health, credit, student loans, business formation, estate planning, tax strategy, and financial diagnostics.',
    heroEyebrow: 'Valtoris Financial',
    heroTitle: 'Explore the Areas Where Valtoris Can Help',
    heroSupport:
      'From protection and retirement to credit, student loans, business planning, estate coordination, and tax strategy, Valtoris helps bring the pieces together around your priorities.',
    heroPrimaryCta: 'Book a Meeting',
    heroSecondaryCta: 'Explore Diagnostic Tools',
    familyHeading: 'Individuals & Families',
    familyLead:
      'Explore the areas where Valtoris can help coordinate strategy and next steps.',
    familyProtectionTitle: 'Protection',
    familyProtectionBody:
      'Review life-insurance need and where a family protection gap may still exist.',
    familyProtectionCta: 'Review Protection Gap',
    familyInsuranceTitle: 'Insurance & Risk Management',
    familyInsuranceBody:
      'Coordinate personal and household coverage conversations around the risks that matter most.',
    familyInsuranceCta: 'Explore Insurance',
    familyHealthTitle: 'Health & Disability',
    familyHealthBody:
      'Look at health, disability, and income-protection questions in one coordinated conversation.',
    familyHealthCta: 'Explore Health & Disability',
    familyCreditTitle: 'Credit Strategy',
    familyCreditBody:
      'Organize credit challenges and next steps without treating a score as a promise.',
    familyCreditCta: 'Explore Credit Strategy',
    familyStudentTitle: 'Student Loan Strategy',
    familyStudentBody:
      'Review repayment, consolidation, and program questions with an educational student-loan strategy.',
    familyStudentCta: 'Explore Student Loans',
    familyEstateTitle: 'Estate & Legacy Planning',
    familyEstateBody:
      'Identify wills, beneficiaries, and legacy questions, then coordinate with the right legal resources.',
    familyEstateCta: 'Explore Estate & Legacy',
    familyTaxTitle: 'Tax Strategy Coordination',
    familyTaxBody:
      'See where tax planning may affect other decisions and coordinate with qualified tax professionals.',
    familyTaxCta: 'Explore Tax Strategy',
    businessHeading: 'Business Owners',
    businessLead:
      'Explore the areas where Valtoris can help owners coordinate structure, risk, tax, and legacy decisions.',
    businessFormationTitle: 'Business Formation & LLC Setup',
    businessFormationBody:
      'Review entity, ownership, and setup questions before they create avoidable complexity later.',
    businessFormationCta: 'Explore Business Formation',
    businessInsuranceTitle: 'Insurance & Risk Management',
    businessInsuranceBody:
      'Coordinate coverage conversations for the business, owners, and the household that depends on them.',
    businessInsuranceCta: 'Explore Insurance',
    businessTaxTitle: 'Tax Strategy Coordination',
    businessTaxBody:
      'Identify where business structure, compensation, and tax planning may need a coordinated review.',
    businessTaxCta: 'Explore Tax Strategy',
    businessEstateTitle: 'Estate & Legacy Planning',
    businessEstateBody:
      'Connect succession and legacy questions to the people, ownership, and documents that need attention.',
    businessEstateCta: 'Explore Estate & Legacy',
    businessCreditTitle: 'Credit Strategy',
    businessCreditBody:
      'Review personal credit readiness that can affect an owner’s financing options and next steps.',
    businessCreditCta: 'Explore Credit Strategy',
    toolsHeading: 'Diagnostic Tools',
    toolsBrand: 'Know Your Score. See Your Risks. Build Your Plan.',
    toolsLead:
      'Use a Report Card or diagnostic to organize your current situation and identify areas worth reviewing.',
    toolFamilyTitle: 'Family Report Card™',
    toolFamilyBody: 'See where household cash flow, protection, and priorities stand today.',
    toolFamilyCta: 'Start Family Report Card™',
    toolBusinessTitle: 'Business Report Card™',
    toolBusinessBody: 'Organize the financial health of the business and the owner’s next priorities.',
    toolBusinessCta: 'Start Business Report Card™',
    toolRetirementTitle: 'Retirement Report Card™',
    toolRetirementBody: 'Review retirement readiness, income sources, and gaps before you need them.',
    toolRetirementCta: 'Start Retirement Report Card™',
    toolProtectionTitle: 'Protection Gap',
    toolProtectionBody: 'Estimate life-insurance need after income, housing, debt, and current coverage.',
    toolProtectionCta: 'Start Protection Gap',
    toolStudentTitle: 'Student Loan Report Card™',
    toolStudentBody: 'Organize student-loan balances, repayment questions, and review priorities.',
    toolStudentCta: 'Start Student Loan Report Card™',
    toolCreditTitle: 'Credit Report Card™',
    toolCreditBody: 'See credit pressure points and the areas worth reviewing first.',
    toolCreditCta: 'Start Credit Report Card™',
    coordinationHeading: 'How the Pieces Work Together',
    coordinationLead: 'Your financial decisions do not exist in isolation.',
    coordination1: 'Protection can affect estate planning.',
    coordination2: 'Credit can affect financing.',
    coordination3: 'Student loans can affect home-buying readiness.',
    coordination4: 'Business structure can affect insurance and tax planning.',
    coordination5: 'Retirement and legacy decisions often overlap.',
    coordinationClose: 'Valtoris helps coordinate the conversation.',
    finalHeading: 'Not Sure Where to Start?',
    finalLead: 'A Financial Strategist can help you identify which areas deserve attention first.',
    finalPrimaryCta: 'Book a Meeting',
    finalSecondaryCta: 'Take the Family Report Card™',
    disclaimer:
      'Valtoris Financial provides financial education, insurance services, and strategic coordination. Certain services, including legal, tax, estate planning, and other specialized professional services, may be provided by independent third-party professionals. Valtoris Financial does not provide legal or tax advice. Insurance products and availability vary by state, carrier, eligibility, and individual circumstances.',
  },
  es: {
    metaTitle: 'Explorar todas las soluciones | Valtoris Financial',
    metaDescription:
      'Explore los servicios de Valtoris en protección, preparación para el retiro, seguros, salud, crédito, préstamos estudiantiles, constitución de negocios, planificación patrimonial, estrategia fiscal y diagnósticos financieros.',
    heroEyebrow: 'Valtoris Financial',
    heroTitle: 'Explore las áreas en las que Valtoris puede ayudar',
    heroSupport:
      'Desde protección y retiro hasta crédito, préstamos estudiantiles, planificación empresarial, coordinación patrimonial y estrategia fiscal, Valtoris ayuda a reunir las piezas en torno a sus prioridades.',
    heroPrimaryCta: 'Agendar una reunión',
    heroSecondaryCta: 'Explorar herramientas de diagnóstico',
    familyHeading: 'Personas y familias',
    familyLead:
      'Explore las áreas en las que Valtoris puede ayudar a coordinar la estrategia y los siguientes pasos.',
    familyProtectionTitle: 'Protección',
    familyProtectionBody:
      'Revise la necesidad de seguro de vida y dónde puede existir una brecha de protección familiar.',
    familyProtectionCta: 'Revisar Protection Gap',
    familyInsuranceTitle: 'Seguros y gestión de riesgo',
    familyInsuranceBody:
      'Coordine las conversaciones de cobertura personal y del hogar en torno a los riesgos más importantes.',
    familyInsuranceCta: 'Explorar seguros',
    familyHealthTitle: 'Salud y discapacidad',
    familyHealthBody:
      'Revise preguntas de salud, discapacidad y protección de ingresos en una conversación coordinada.',
    familyHealthCta: 'Explorar salud y discapacidad',
    familyCreditTitle: 'Estrategia de crédito',
    familyCreditBody:
      'Organice los retos de crédito y los siguientes pasos sin tratar una puntuación como una promesa.',
    familyCreditCta: 'Explorar estrategia de crédito',
    familyStudentTitle: 'Estrategia de préstamos estudiantiles',
    familyStudentBody:
      'Revise preguntas de pago, consolidación y programas con una estrategia educativa de préstamos estudiantiles.',
    familyStudentCta: 'Explorar préstamos estudiantiles',
    familyEstateTitle: 'Planificación patrimonial y de legado',
    familyEstateBody:
      'Identifique testamentos, beneficiarios y preguntas de legado, y coordine con los recursos legales adecuados.',
    familyEstateCta: 'Explorar patrimonio y legado',
    familyTaxTitle: 'Coordinación de estrategia fiscal',
    familyTaxBody:
      'Vea dónde la planificación fiscal puede afectar otras decisiones y coordine con profesionales calificados.',
    familyTaxCta: 'Explorar estrategia fiscal',
    businessHeading: 'Dueños de negocio',
    businessLead:
      'Explore las áreas en las que Valtoris puede ayudar a coordinar estructura, riesgo, impuestos y decisiones de legado.',
    businessFormationTitle: 'Constitución de negocio y LLC',
    businessFormationBody:
      'Revise preguntas de entidad, propiedad y constitución antes de que creen complejidad innecesaria.',
    businessFormationCta: 'Explorar constitución de negocio',
    businessInsuranceTitle: 'Seguros y gestión de riesgo',
    businessInsuranceBody:
      'Coordine las conversaciones de cobertura para el negocio, los dueños y el hogar que depende de ellos.',
    businessInsuranceCta: 'Explorar seguros',
    businessTaxTitle: 'Coordinación de estrategia fiscal',
    businessTaxBody:
      'Identifique dónde la estructura del negocio, la compensación y la planificación fiscal pueden necesitar una revisión coordinada.',
    businessTaxCta: 'Explorar estrategia fiscal',
    businessEstateTitle: 'Planificación patrimonial y de legado',
    businessEstateBody:
      'Conecte las preguntas de sucesión y legado con las personas, la propiedad y los documentos que requieren atención.',
    businessEstateCta: 'Explorar patrimonio y legado',
    businessCreditTitle: 'Estrategia de crédito',
    businessCreditBody:
      'Revise la preparación crediticia personal que puede afectar las opciones de financiamiento de un dueño.',
    businessCreditCta: 'Explorar estrategia de crédito',
    toolsHeading: 'Herramientas de diagnóstico',
    toolsBrand: 'Know Your Score. See Your Risks. Build Your Plan.',
    toolsLead:
      'Use un Report Card o un diagnóstico para organizar su situación actual e identificar áreas que conviene revisar.',
    toolFamilyTitle: 'Family Report Card™',
    toolFamilyBody: 'Vea cómo están hoy el flujo de efectivo, la protección y las prioridades del hogar.',
    toolFamilyCta: 'Comenzar Family Report Card™',
    toolBusinessTitle: 'Business Report Card™',
    toolBusinessBody: 'Organice la salud financiera del negocio y las siguientes prioridades del dueño.',
    toolBusinessCta: 'Comenzar Business Report Card™',
    toolRetirementTitle: 'Retirement Report Card™',
    toolRetirementBody: 'Revise la preparación para el retiro, las fuentes de ingreso y las brechas antes de necesitarlas.',
    toolRetirementCta: 'Comenzar Retirement Report Card™',
    toolProtectionTitle: 'Protection Gap',
    toolProtectionBody:
      'Estime la necesidad de seguro de vida después de ingresos, vivienda, deudas y cobertura actual.',
    toolProtectionCta: 'Comenzar Protection Gap',
    toolStudentTitle: 'Student Loan Report Card™',
    toolStudentBody: 'Organice saldos, preguntas de pago y prioridades de revisión de préstamos estudiantiles.',
    toolStudentCta: 'Comenzar Student Loan Report Card™',
    toolCreditTitle: 'Credit Report Card™',
    toolCreditBody: 'Vea los puntos de presión crediticia y las áreas que conviene revisar primero.',
    toolCreditCta: 'Comenzar Credit Report Card™',
    coordinationHeading: 'Cómo se conectan las piezas',
    coordinationLead: 'Sus decisiones financieras no existen de forma aislada.',
    coordination1: 'La protección puede afectar la planificación patrimonial.',
    coordination2: 'El crédito puede afectar el financiamiento.',
    coordination3: 'Los préstamos estudiantiles pueden afectar la preparación para comprar una vivienda.',
    coordination4: 'La estructura del negocio puede afectar los seguros y la planificación fiscal.',
    coordination5: 'Las decisiones de retiro y legado suelen superponerse.',
    coordinationClose: 'Valtoris ayuda a coordinar la conversación.',
    finalHeading: '¿No está seguro de por dónde empezar?',
    finalLead: 'Un estratega financiero puede ayudarle a identificar qué áreas merecen atención primero.',
    finalPrimaryCta: 'Agendar una reunión',
    finalSecondaryCta: 'Tomar el Family Report Card™',
    disclaimer:
      'Valtoris Financial ofrece educación financiera, servicios de seguros y coordinación estratégica. Ciertos servicios, incluidos los legales, fiscales, de planificación patrimonial y otros servicios profesionales especializados, pueden ser prestados por profesionales independientes. Valtoris Financial no ofrece asesoría legal ni fiscal. Los productos de seguros y su disponibilidad varían según el estado, la aseguradora, la elegibilidad y las circunstancias individuales.',
  },
}
