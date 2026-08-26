import type { PublicLocale } from '../locale'

export type SolutionsCopy = {
  metaTitle: string
  metaDescription: string
  heroEyebrow: string
  heroTitle: string
  heroSupport: string
  heroBrand: string
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
    metaTitle: 'Solutions Built Around Your Strategy | Valtoris Financial',
    metaDescription:
      'Valtoris solutions are built around your strategy. Start with a diagnostic to understand where you stand, then coordinate the areas that deserve attention.',
    heroEyebrow: 'Valtoris Financial',
    heroTitle: 'Solutions Built Around Your Strategy.',
    heroSupport:
      "Your financial decisions don't exist in isolation. The right solution depends on where you are today, what you're trying to accomplish, and which risks and opportunities deserve attention first.",
    heroBrand: 'Your Strategy Determines the Solution. Not the Other Way Around.',
    heroPrimaryCta: 'Find Out Where I Stand',
    heroSecondaryCta: 'Book a Meeting',
    familyHeading: 'Solutions for Individuals & Families',
    familyLead:
      'Once you understand where you stand, the next step is determining which areas deserve attention. Depending on your situation, your strategy may involve one solution or several working together.',
    familyProtectionTitle: 'Protection',
    familyProtectionBody:
      'Start with the Protection Gap diagnostic to review life-insurance need and where a family gap may still exist.',
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
    businessHeading: 'Solutions for Business Owners',
    businessLead:
      'Business and personal financial decisions often overlap. Valtoris helps business owners identify the areas that deserve attention and coordinate appropriate solutions around the bigger picture.',
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
    toolsHeading: 'Start With Clarity.',
    toolsBrand: 'Know Your Score. See Your Risks. Build Your Plan.',
    toolsLead:
      'Before exploring solutions, start by understanding where you stand. Valtoris Report Cards and diagnostic tools help identify strengths, risks and priorities so the conversation begins with your situation—not a product.',
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
    coordinationLead:
      "The value isn't simply having multiple financial products. The value is understanding how the pieces affect one another and coordinating decisions around your priorities.",
    coordination1: 'Protection can affect estate planning.',
    coordination2: 'Credit can affect financing.',
    coordination3: 'Student loans can affect home-buying readiness.',
    coordination4: 'Business structure can affect insurance and tax planning.',
    coordination5: 'Retirement and legacy decisions often overlap.',
    coordinationClose: 'Valtoris helps coordinate the conversation around what matters most.',
    finalHeading: 'Not Sure Where to Start?',
    finalLead:
      'Start by understanding where you stand, or talk with a Financial Strategist about which area deserves attention first.',
    finalPrimaryCta: 'Find Out Where I Stand',
    finalSecondaryCta: 'Book a Meeting',
    disclaimer:
      'Valtoris Financial provides financial education, insurance services, and strategic coordination. Certain services, including legal, tax, estate planning, and other specialized professional services, may be provided by independent third-party professionals. Valtoris Financial does not provide legal or tax advice. Insurance products and availability vary by state, carrier, eligibility, and individual circumstances.',
  },
  es: {
    metaTitle: 'Soluciones alrededor de tu estrategia | Valtoris Financial',
    metaDescription:
      'Las soluciones de Valtoris se construyen alrededor de tu estrategia. Empieza con un diagnóstico para entender en qué punto estás y coordina las áreas que merecen atención.',
    heroEyebrow: 'Valtoris Financial',
    heroTitle: 'Soluciones construidas alrededor de tu estrategia.',
    heroSupport:
      'Tus decisiones financieras no existen de forma aislada. La solución adecuada depende de dónde estás hoy, de lo que quieres lograr y de qué riesgos y oportunidades merecen atención primero.',
    heroBrand: 'Tu estrategia determina la solución. No al revés.',
    heroPrimaryCta: 'Descubre en qué punto estás',
    heroSecondaryCta: 'Agendar una reunión',
    familyHeading: 'Soluciones para personas y familias',
    familyLead:
      'Una vez que entiendes en qué punto estás, el siguiente paso es determinar qué áreas merecen atención. Según tu situación, tu estrategia puede involucrar una solución o varias trabajando juntas.',
    familyProtectionTitle: 'Protección',
    familyProtectionBody:
      'Empieza con el diagnóstico Protection Gap para revisar la necesidad de seguro de vida y dónde puede existir una brecha de protección familiar.',
    familyProtectionCta: 'Revisar Protection Gap',
    familyInsuranceTitle: 'Seguros y gestión de riesgo',
    familyInsuranceBody:
      'Coordina las conversaciones de cobertura personal y del hogar en torno a los riesgos más importantes.',
    familyInsuranceCta: 'Explorar seguros',
    familyHealthTitle: 'Salud y discapacidad',
    familyHealthBody:
      'Revisa preguntas de salud, discapacidad y protección de ingresos en una conversación coordinada.',
    familyHealthCta: 'Explorar salud y discapacidad',
    familyCreditTitle: 'Estrategia de crédito',
    familyCreditBody:
      'Organiza los retos de crédito y los siguientes pasos sin tratar una puntuación como una promesa.',
    familyCreditCta: 'Explorar estrategia de crédito',
    familyStudentTitle: 'Estrategia de préstamos estudiantiles',
    familyStudentBody:
      'Revisa preguntas de pago, consolidación y programas con una estrategia educativa de préstamos estudiantiles.',
    familyStudentCta: 'Explorar préstamos estudiantiles',
    familyEstateTitle: 'Planificación patrimonial y de legado',
    familyEstateBody:
      'Identifica testamentos, beneficiarios y preguntas de legado, y coordina con los recursos legales adecuados.',
    familyEstateCta: 'Explorar patrimonio y legado',
    familyTaxTitle: 'Coordinación de estrategia fiscal',
    familyTaxBody:
      'Ve dónde la planificación fiscal puede afectar otras decisiones y coordina con profesionales calificados.',
    familyTaxCta: 'Explorar estrategia fiscal',
    businessHeading: 'Soluciones para dueños de negocio',
    businessLead:
      'Las decisiones financieras del negocio y las personales suelen superponerse. Valtoris ayuda a los dueños de negocio a identificar las áreas que merecen atención y a coordinar soluciones apropiadas alrededor del panorama más amplio.',
    businessFormationTitle: 'Constitución de negocio y LLC',
    businessFormationBody:
      'Revisa preguntas de entidad, propiedad y constitución antes de que creen complejidad innecesaria.',
    businessFormationCta: 'Explorar constitución de negocio',
    businessInsuranceTitle: 'Seguros y gestión de riesgo',
    businessInsuranceBody:
      'Coordina las conversaciones de cobertura para el negocio, los dueños y el hogar que depende de ellos.',
    businessInsuranceCta: 'Explorar seguros',
    businessTaxTitle: 'Coordinación de estrategia fiscal',
    businessTaxBody:
      'Identifica dónde la estructura del negocio, la compensación y la planificación fiscal pueden necesitar una revisión coordinada.',
    businessTaxCta: 'Explorar estrategia fiscal',
    businessEstateTitle: 'Planificación patrimonial y de legado',
    businessEstateBody:
      'Conecta las preguntas de sucesión y legado con las personas, la propiedad y los documentos que requieren atención.',
    businessEstateCta: 'Explorar patrimonio y legado',
    businessCreditTitle: 'Estrategia de crédito',
    businessCreditBody:
      'Revisa la preparación crediticia personal que puede afectar las opciones de financiamiento de un dueño.',
    businessCreditCta: 'Explorar estrategia de crédito',
    toolsHeading: 'Empieza con claridad.',
    toolsBrand: 'Know Your Score. See Your Risks. Build Your Plan.',
    toolsLead:
      'Antes de explorar soluciones, empieza por entender en qué punto estás. Los Report Cards y las herramientas de diagnóstico de Valtoris ayudan a identificar fortalezas, riesgos y prioridades para que la conversación empiece con tu situación, no con un producto.',
    toolFamilyTitle: 'Family Report Card™',
    toolFamilyBody: 'Ve cómo están hoy el flujo de efectivo, la protección y las prioridades del hogar.',
    toolFamilyCta: 'Comenzar Family Report Card™',
    toolBusinessTitle: 'Business Report Card™',
    toolBusinessBody: 'Organiza la salud financiera del negocio y las siguientes prioridades del dueño.',
    toolBusinessCta: 'Comenzar Business Report Card™',
    toolRetirementTitle: 'Retirement Report Card™',
    toolRetirementBody: 'Revisa la preparación para el retiro, las fuentes de ingreso y las brechas antes de necesitarlas.',
    toolRetirementCta: 'Comenzar Retirement Report Card™',
    toolProtectionTitle: 'Protection Gap',
    toolProtectionBody:
      'Estima la necesidad de seguro de vida después de ingresos, vivienda, deudas y cobertura actual.',
    toolProtectionCta: 'Comenzar Protection Gap',
    toolStudentTitle: 'Student Loan Report Card™',
    toolStudentBody: 'Organiza saldos, preguntas de pago y prioridades de revisión de préstamos estudiantiles.',
    toolStudentCta: 'Comenzar Student Loan Report Card™',
    toolCreditTitle: 'Credit Report Card™',
    toolCreditBody: 'Ve los puntos de presión crediticia y las áreas que conviene revisar primero.',
    toolCreditCta: 'Comenzar Credit Report Card™',
    coordinationHeading: 'Cómo se conectan las piezas',
    coordinationLead:
      'El valor no está simplemente en tener varios productos financieros. El valor está en entender cómo se afectan las piezas entre sí y coordinar las decisiones alrededor de tus prioridades.',
    coordination1: 'La protección puede afectar la planificación patrimonial.',
    coordination2: 'El crédito puede afectar el financiamiento.',
    coordination3: 'Los préstamos estudiantiles pueden afectar la preparación para comprar una vivienda.',
    coordination4: 'La estructura del negocio puede afectar los seguros y la planificación fiscal.',
    coordination5: 'Las decisiones de retiro y legado suelen superponerse.',
    coordinationClose: 'Valtoris ayuda a coordinar la conversación alrededor de lo que más importa.',
    finalHeading: '¿No estás seguro de por dónde empezar?',
    finalLead:
      'Empieza por entender en qué punto estás, o habla con un Financial Strategist sobre qué área merece atención primero.',
    finalPrimaryCta: 'Descubre en qué punto estás',
    finalSecondaryCta: 'Agendar una reunión',
    disclaimer:
      'Valtoris Financial ofrece educación financiera, servicios de seguros y coordinación estratégica. Ciertos servicios, incluidos los legales, fiscales, de planificación patrimonial y otros servicios profesionales especializados, pueden ser prestados por profesionales independientes. Valtoris Financial no ofrece asesoría legal ni fiscal. Los productos de seguros y su disponibilidad varían según el estado, la aseguradora, la elegibilidad y las circunstancias individuales.',
  },
}
