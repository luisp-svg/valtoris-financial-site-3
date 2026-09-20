import type { PublicLocale } from '../locale'

export type ServiceReviewArea = {
  readonly title: string
  readonly body: string
}

export type ServiceProcessStep = {
  readonly title: string
  readonly body: string
}

export type ServiceOfferPlan = {
  readonly name: string
  readonly price: string
  readonly cadence: string
  readonly description: string
  readonly features: readonly string[]
  readonly badge?: string
}

export type ServicePackage = {
  readonly name: string
  readonly price: string
  readonly paymentNote: string
  readonly description: string
  readonly features: readonly string[]
  readonly cta: string
  readonly featured?: boolean
  readonly badge?: string
}

export type ServiceCopy = {
  metaTitle: string
  metaDescription: string
  heroEyebrow: string
  heroTitle: string
  heroSupport: string
  heroPrimaryCta: string
  heroSecondaryCta: string
  heroTertiaryCta: string
  heroImage?: string
  heroImageAlt?: string
  audienceHeading: string
  audienceLead: string
  audienceItems: readonly string[]
  reviewHeading: string
  reviewLead: string
  reviewAreas: readonly ServiceReviewArea[]
  processHeading: string
  processLead: string
  processNote: string
  processSteps: readonly ServiceProcessStep[]
  bridgeKicker: string
  bridgeTitle: string
  bridgeBody: string
  bridgePrimaryCta: string
  bridgeSecondaryCta: string
  complianceHeading: string
  complianceBody: string
  complianceResourceLabel: string
  complianceResourceHref: string
  finalHeading: string
  finalLead: string
  finalPrimaryCta: string
  finalSecondaryCta: string
  offerKicker?: string
  offerTitle?: string
  offerLead?: string
  offerPriceNote?: string
  offerPlans?: readonly ServiceOfferPlan[]
  offerCta?: string
  packagesHeading?: string
  packagesLead?: string
  packagesNote?: string
  packages?: readonly ServicePackage[]
  partnerKicker?: string
  partnerTitle?: string
  partnerName?: string
  partnerBody?: string
  relatedKicker?: string
  relatedTitle?: string
  relatedBody?: string
  relatedCta?: string
}

export const studentLoanServiceCopy: Record<PublicLocale, ServiceCopy> = {
  en: {
    metaTitle: 'Student Loan Strategy | Valtoris Financial',
    metaDescription:
      'Educational student loan strategy and repayment review for borrowers seeking a clearer understanding of their loans and next steps.',
    heroEyebrow: 'Student Loan Strategy',
    heroTitle: 'Understand Your Student Loans. Build a Clearer Path Forward.',
    heroSupport:
      'Student loans can affect monthly cash flow, credit, home-buying plans, and long-term financial decisions. Valtoris helps you organize the picture, identify areas worth reviewing, and prepare for a more informed strategy conversation.',
    heroPrimaryCta: 'Take the Student Loan Report Card™',
    heroSecondaryCta: 'Book a Meeting',
    heroTertiaryCta: 'See How It Works',
    audienceHeading: 'This May Be Helpful If...',
    audienceLead:
      'A student-loan review can be useful when the current picture is unclear, circumstances have changed, or you want more context before making a move.',
    audienceItems: [
      'Monthly payments feel confusing or difficult to manage',
      'Income or household circumstances have changed',
      'You have multiple loans or more than one servicer',
      'Repayment options are difficult to understand',
      'Homeownership is a near-term goal',
      'Your loans have not been reviewed recently',
      'You want clarity before making changes',
    ],
    reviewHeading: 'What We Help Review',
    reviewLead:
      'Valtoris helps you organize the parts of a student-loan picture that usually sit in separate conversations. This is educational review, not an eligibility determination.',
    reviewAreas: [
      {
        title: 'Loan Overview',
        body: 'Organize loan types, balance context, and servicer awareness so the current picture is easier to discuss.',
      },
      {
        title: 'Repayment Strategy',
        body: 'Review how current or recent repayment choices fit monthly cash flow and the rest of your financial plan.',
      },
      {
        title: 'Program Awareness',
        body: 'Clarify what you know about repayment and program options so a later conversation can stay grounded and educational.',
      },
      {
        title: 'Income & Household Changes',
        body: 'Consider how income, household size, or employment shifts may affect what is worth reviewing next.',
      },
      {
        title: 'Credit & Home-Buying Readiness',
        body: 'See how student loans may connect to credit, cash flow, and housing plans without treating any one factor as a decision.',
      },
      {
        title: 'Next-Step Planning',
        body: 'Identify priorities and prepare for a more informed strategy conversation with Valtoris.',
      },
    ],
    packagesHeading: 'Student Loan Services and Pricing',
    packagesLead:
      'Start with the Report Card so we can understand your loan picture before the consultation confirms the appropriate service.',
    packagesNote:
      'Package fit is confirmed during intake. Pricing does not include payments owed to a loan servicer or government agency, and no outcome is guaranteed.',
    packages: [
      {
        name: 'Income-Driven Repayment (IDR)',
        price: '$299',
        paymentNote: 'one-time',
        description: 'Support for borrowers reviewing an income-driven repayment path.',
        features: [
          'Student-loan situation review',
          'IDR option and documentation review',
          'Guided next-step checklist',
        ],
        cta: 'Start with the Report Card',
      },
      {
        name: 'Default + IDR',
        price: '$1,200',
        paymentNote: 'service-specific support',
        description: 'Guided support for borrowers addressing default before moving toward an IDR path.',
        features: [
          'Default-status situation review',
          'IDR planning and document checklist',
          'Scheduled strategy follow-ups',
        ],
        cta: 'Start with the Report Card',
        featured: true,
        badge: 'Guided support',
      },
      {
        name: 'Public Service Loan Forgiveness (PSLF)',
        price: 'Starting at $799',
        paymentNote: 'final scope confirmed after consultation',
        description: 'Support for borrowers reviewing public-service employment and PSLF requirements.',
        features: [
          'Employment and loan-picture review',
          'PSLF documentation checklist',
          'Guided next-step strategy',
        ],
        cta: 'Start with the Report Card',
      },
      {
        name: 'Special Cases',
        price: 'Custom pricing',
        paymentNote: 'based on complexity and scope',
        description: 'A consultation-led path for situations that do not fit the standard service categories.',
        features: [
          'Situation and document review',
          'Defined support scope',
          'Pricing explained before engagement',
        ],
        cta: 'Start with the Report Card',
      },
    ],
    processHeading: 'How Valtoris Works',
    processLead: 'Start with education, then decide whether a strategy conversation is useful.',
    processNote:
      'The Student Loan Report Card™ is an educational diagnostic. It is not an approval, a federal determination, or a finding of eligibility.',
    processSteps: [
      {
        title: 'Take the Report Card',
        body: 'Complete the Student Loan Report Card™ to organize your current situation.',
      },
      {
        title: 'Review the Situation',
        body: 'Use the results to see what looks stable and which areas may deserve a closer look.',
      },
      {
        title: 'Identify Priorities',
        body: 'Focus on the issues that matter most for cash flow, timing, and your broader goals.',
      },
      {
        title: 'Discuss Available Paths',
        body: 'Walk through educational options in a strategy conversation if you want a closer review.',
      },
      {
        title: 'Build the Next-Step Strategy',
        body: 'Decide what to review, what to leave alone, and what to revisit as circumstances change.',
      },
    ],
    bridgeKicker: 'Educational diagnostic',
    bridgeTitle: 'Student Loan Report Card™',
    bridgeBody:
      'The Student Loan Report Card™ helps organize your current repayment situation, highlight areas that may deserve attention, and prepare you for a more productive review.',
    bridgePrimaryCta: 'Take the Student Loan Report Card™',
    bridgeSecondaryCta: 'Book a Meeting',
    complianceHeading: 'Important information',
    complianceBody:
      'Valtoris is not the U.S. Department of Education and is not affiliated with or endorsed by the federal government. This information is educational and does not guarantee eligibility, forgiveness, approval, savings, repayment, discharge, or a particular payment. Valtoris is not a federal loan servicer. Official federal student-loan information is available at StudentAid.gov.',
    complianceResourceLabel: 'StudentAid.gov',
    complianceResourceHref: 'https://studentaid.gov',
    finalHeading: 'Ready to Organize Your Student Loan Picture?',
    finalLead:
      'Start with the Student Loan Report Card™, or book a meeting if you would rather talk through the situation first.',
    finalPrimaryCta: 'Take the Student Loan Report Card™',
    finalSecondaryCta: 'Book a Meeting',
  },
  es: {
    metaTitle: 'Estrategia de préstamos estudiantiles | Valtoris Financial',
    metaDescription:
      'Estrategia educativa de préstamos estudiantiles y revisión de pago para quienes buscan entender mejor sus préstamos y los siguientes pasos.',
    heroEyebrow: 'Estrategia de préstamos estudiantiles',
    heroTitle: 'Entienda sus préstamos estudiantiles. Trace un camino más claro.',
    heroSupport:
      'Los préstamos estudiantiles pueden afectar el flujo de efectivo mensual, el crédito, los planes de compra de vivienda y las decisiones financieras a largo plazo. Valtoris le ayuda a organizar el panorama, identificar áreas que conviene revisar y prepararse para una conversación de estrategia más informada.',
    heroPrimaryCta: 'Hacer el Reporte de Préstamos Estudiantiles™',
    heroSecondaryCta: 'Agendar una reunión',
    heroTertiaryCta: 'Vea cómo funciona',
    audienceHeading: 'Esto puede ser útil si...',
    audienceLead:
      'Una revisión de préstamos estudiantiles puede ayudar cuando el panorama actual no está claro, cambiaron las circunstancias o quiere más contexto antes de tomar una decisión.',
    audienceItems: [
      'Los pagos mensuales se sienten confusos o difíciles de manejar',
      'Cambiaron sus ingresos o las circunstancias del hogar',
      'Tiene varios préstamos o más de un administrador',
      'Las opciones de pago son difíciles de entender',
      'Comprar una vivienda es una meta cercana',
      'Hace tiempo que no revisa sus préstamos',
      'Quiere más claridad antes de hacer cambios',
    ],
    reviewHeading: 'Qué ayudamos a revisar',
    reviewLead:
      'Valtoris le ayuda a organizar las partes de un panorama de préstamos estudiantiles que casi siempre se conversan por separado. Esto es una revisión educativa, no una determinación de elegibilidad.',
    reviewAreas: [
      {
        title: 'Panorama del préstamo',
        body: 'Organizar tipos de préstamo, contexto de saldo y conocimiento del administrador para que el panorama actual sea más fácil de conversar.',
      },
      {
        title: 'Estrategia de pago',
        body: 'Revisar cómo las decisiones de pago actuales o recientes encajan con el flujo de efectivo mensual y el resto de su plan financiero.',
      },
      {
        title: 'Conocimiento de programas',
        body: 'Aclarar lo que sabe sobre opciones de pago y programas para que una conversación posterior se mantenga educativa y bien fundamentada.',
      },
      {
        title: 'Cambios de ingreso y hogar',
        body: 'Considerar cómo los cambios de ingreso, tamaño del hogar o empleo pueden afectar lo que conviene revisar después.',
      },
      {
        title: 'Crédito y preparación para comprar vivienda',
        body: 'Ver cómo los préstamos estudiantiles pueden conectarse con el crédito, el flujo de efectivo y los planes de vivienda, sin tratar ningún factor como una decisión.',
      },
      {
        title: 'Planificación del siguiente paso',
        body: 'Identificar prioridades y prepararse para una conversación de estrategia más informada con Valtoris.',
      },
    ],
    packagesHeading: 'Servicios y precios de préstamos estudiantiles',
    packagesLead:
      'Empiece con el Reporte para que podamos entender sus préstamos antes de que la consulta confirme el servicio adecuado.',
    packagesNote:
      'La opción adecuada se confirma durante la admisión. Los precios no incluyen pagos adeudados a un administrador de préstamos o agencia gubernamental, y no se garantiza ningún resultado.',
    packages: [
      {
        name: 'Pago basado en los ingresos (IDR)',
        price: '$299',
        paymentNote: 'pago único',
        description: 'Apoyo para quienes están revisando una opción de pago basada en los ingresos.',
        features: [
          'Revisión de la situación de préstamos estudiantiles',
          'Revisión de opciones y documentos de IDR',
          'Lista guiada de próximos pasos',
        ],
        cta: 'Empezar con el Reporte',
      },
      {
        name: 'Incumplimiento + IDR',
        price: '$1,200',
        paymentNote: 'apoyo específico para el servicio',
        description: 'Apoyo guiado para abordar el incumplimiento antes de avanzar hacia una opción IDR.',
        features: [
          'Revisión de la situación de incumplimiento',
          'Planificación de IDR y lista de documentos',
          'Seguimientos estratégicos programados',
        ],
        cta: 'Empezar con el Reporte',
        featured: true,
        badge: 'Apoyo guiado',
      },
      {
        name: 'Condonación de Préstamos por Servicio Público (PSLF)',
        price: 'Desde $799',
        paymentNote: 'el alcance final se confirma después de la consulta',
        description: 'Apoyo para revisar el empleo de servicio público y los requisitos de PSLF.',
        features: [
          'Revisión del empleo y los préstamos',
          'Lista de documentos de PSLF',
          'Estrategia guiada de próximos pasos',
        ],
        cta: 'Empezar con el Reporte',
      },
      {
        name: 'Casos especiales',
        price: 'Precio personalizado',
        paymentNote: 'según la complejidad y el alcance',
        description: 'Un camino guiado por consulta para situaciones fuera de las categorías estándar.',
        features: [
          'Revisión de la situación y documentos',
          'Alcance de apoyo definido',
          'Precio explicado antes de contratar',
        ],
        cta: 'Empezar con el Reporte',
      },
    ],
    processHeading: 'Cómo trabaja Valtoris',
    processLead: 'Empiece con educación y luego decida si una conversación de estrategia le resulta útil.',
    processNote:
      'El Reporte de Préstamos Estudiantiles™ es un diagnóstico educativo. No es una aprobación, una determinación federal ni un hallazgo de elegibilidad.',
    processSteps: [
      {
        title: 'Haga el Reporte',
        body: 'Complete el Reporte de Préstamos Estudiantiles™ para organizar su situación actual.',
      },
      {
        title: 'Revise la situación',
        body: 'Use los resultados para ver qué se ve estable y qué áreas pueden merecer una mirada más de cerca.',
      },
      {
        title: 'Identifique prioridades',
        body: 'Enfóquese en lo que más importa para el flujo de efectivo, los plazos y sus metas más amplias.',
      },
      {
        title: 'Converse sobre caminos disponibles',
        body: 'Repase opciones educativas en una conversación de estrategia si quiere una revisión más cercana.',
      },
      {
        title: 'Arme la estrategia del siguiente paso',
        body: 'Decida qué revisar, qué dejar como está y qué volver a ver cuando cambien las circunstancias.',
      },
    ],
    bridgeKicker: 'Diagnóstico educativo',
    bridgeTitle: 'Student Loan Report Card™',
    bridgeBody:
      'El Reporte de Préstamos Estudiantiles™ ayuda a organizar su situación de pago actual, destacar áreas que pueden merecer atención y prepararlo para una revisión más productiva.',
    bridgePrimaryCta: 'Hacer el Reporte de Préstamos Estudiantiles™',
    bridgeSecondaryCta: 'Agendar una reunión',
    complianceHeading: 'Información importante',
    complianceBody:
      'Valtoris no es el Departamento de Educación de EE. UU. y no está afiliado ni respaldado por el gobierno federal. Esta información es educativa y no garantiza elegibilidad, condonación, aprobación, ahorros, pago, descargo ni un pago en particular. Valtoris no es un administrador federal de préstamos. La información oficial federal sobre préstamos estudiantiles está disponible en StudentAid.gov.',
    complianceResourceLabel: 'StudentAid.gov',
    complianceResourceHref: 'https://studentaid.gov',
    finalHeading: '¿Listo para organizar su panorama de préstamos estudiantiles?',
    finalLead:
      'Empiece con el Reporte de Préstamos Estudiantiles™, o agende una reunión si prefiere conversar primero.',
    finalPrimaryCta: 'Hacer el Reporte de Préstamos Estudiantiles™',
    finalSecondaryCta: 'Agendar una reunión',
  },
}

export const creditServiceCopy: Record<PublicLocale, ServiceCopy> = {
  en: {
    metaTitle: 'Credit Strategy | Valtoris Financial',
    metaDescription:
      'Credit-readiness education and strategy to help consumers understand their credit profile and identify areas worth reviewing.',
    heroEyebrow: 'Credit Strategy',
    heroTitle: 'Understand Your Credit. Know What to Work on Next.',
    heroSupport:
      'Your credit profile can affect housing, financing, borrowing costs, and other financial decisions. Valtoris helps you understand the current picture, identify areas worth reviewing, and build a clearer next-step strategy.',
    heroPrimaryCta: 'Take the Credit Report Card™',
    heroSecondaryCta: 'Book a Meeting',
    heroTertiaryCta: 'See How It Works',
    audienceHeading: 'This May Be Helpful If...',
    audienceLead:
      'A credit-readiness review can help when you want a clearer picture of priorities before a major financial decision.',
    audienceItems: [
      'You are preparing to buy a home',
      'You are rebuilding after financial setbacks',
      'Revolving utilization feels high',
      'Collections or other negative items are on the report',
      'You are unsure what is affecting your credit profile',
      'You are preparing for major financing',
      'You want a clearer strategy for what to review next',
    ],
    reviewHeading: 'What We Help Review',
    reviewLead:
      'Valtoris helps you organize the factors that commonly affect credit readiness. This is educational review, not a bureau pull and not a promise that accurate information can be removed.',
    reviewAreas: [
      {
        title: 'Payment History',
        body: 'Review recent payment patterns and whether consistency or past late payments may deserve attention.',
      },
      {
        title: 'Utilization',
        body: 'Organize how revolving balances relate to available credit so you can see where review may help.',
      },
      {
        title: 'Negative Items',
        body: 'Identify collections, charge-offs, or other derogatory items that may affect the current picture.',
      },
      {
        title: 'Credit Structure',
        body: 'Look at open accounts, mix, and age so the overall profile is easier to discuss.',
      },
      {
        title: 'Recent Credit Activity',
        body: 'Consider inquiries and new accounts that may be part of the current snapshot.',
      },
      {
        title: 'Report Accuracy',
        body: 'Talk through whether anything looks inaccurate so you can decide what to verify with official reports.',
      },
      {
        title: 'Goal Readiness',
        body: 'Connect the current picture to housing, financing, or other goals without treating the diagnostic as an approval.',
      },
    ],
    processHeading: 'How Valtoris Works',
    processLead: 'Understand the current picture first. Then decide what, if anything, to review more closely.',
    processNote:
      'The Credit Report Card™ is an educational diagnostic. It is not a bureau score, a lending decision, or a credit-repair case.',
    processSteps: [
      {
        title: 'Take the Credit Report Card',
        body: 'Complete the Credit Report Card™ to organize self-reported credit-readiness factors.',
      },
      {
        title: 'Understand the Current Picture',
        body: 'Review the score, grade, and flags as educational context—not as a FICO®, VantageScore®, or bureau result.',
      },
      {
        title: 'Identify Priority Areas',
        body: 'Focus on the factors that appear most relevant to your goals and timeline.',
      },
      {
        title: 'Review Available Actions',
        body: 'Discuss educational next steps. Accurate negative information may remain, and no outcome is guaranteed.',
      },
      {
        title: 'Build a Next-Step Strategy',
        body: 'Decide what to monitor, what to verify, and whether a later strategy conversation would help.',
      },
    ],
    offerKicker: 'Credit improvement service',
    offerTitle: 'Choose the Level of Support That Fits You',
    offerLead:
      'Start with self-guided tools or choose professional support after your consultation. We review your actual reports, explain the scope, and help you select the right level without promising a score increase or removal of accurate information.',
    offerPriceNote:
      'IDIQ features remain subject to the final vendor plan. No payment is collected through the Credit Report Card. Professional credit-repair fees are billed only after the applicable work is performed and after required disclosures and a written agreement.',
    offerPlans: [
      {
        name: 'DIY Credit Builder',
        price: '$39',
        cadence: 'per month',
        description: 'For clients who want monitoring, education, and a plan they can carry out themselves.',
        features: [
          'IDIQ monitoring access',
          'Credit Report Card™ and DIY action checklist',
          'Educational dispute-letter templates',
          'Utilization and rebuilding guidance',
          'You prepare and submit your own disputes',
        ],
      },
      {
        name: 'Basic Credit Support',
        price: '$99',
        cadence: 'per month',
        description: 'For clients who want professional review and focused support on their highest-priority items.',
        badge: 'Most popular',
        features: [
          'Everything in DIY',
          'Professional three-bureau report review',
          'Targeted dispute work when appropriate',
          'Monthly progress review',
          'Updated action plan and standard support',
        ],
      },
      {
        name: 'Premium Credit Restoration',
        price: '$149',
        cadence: 'per month',
        description: 'For complex credit files that need more hands-on review, follow-up, and planning.',
        features: [
          'Everything in Basic',
          'More comprehensive dispute strategy',
          'Appropriate bureau and direct-creditor correspondence',
          'Priority document review and support',
          'Monthly one-on-one strategy review',
          'Home-buying or financing readiness planning',
        ],
      },
    ],
    offerCta: 'Book My Credit Consultation',
    bridgeKicker: 'Educational diagnostic',
    bridgeTitle: 'Credit Report Card™',
    bridgeBody:
      'The Credit Report Card™ is an educational diagnostic designed to organize the current picture and identify areas worth reviewing. It does not pull a bureau score.',
    bridgePrimaryCta: 'Take the Credit Report Card™',
    bridgeSecondaryCta: 'Book a Meeting',
    complianceHeading: 'Important information',
    complianceBody:
      'This is an educational diagnostic. It is not a FICO® score, VantageScore®, or credit-bureau score, and it is not a lending decision. Outcomes depend on individual circumstances. Valtoris does not guarantee score increases, deletion of accurate information, financing approval, or specific credit outcomes. Accurate negative information may remain.',
    complianceResourceLabel: '',
    complianceResourceHref: '',
    finalHeading: 'Ready to Understand What to Work on Next?',
    finalLead:
      'Start with the Credit Report Card™, or book a meeting if you would rather talk through your credit-readiness questions first.',
    finalPrimaryCta: 'Take the Credit Report Card™',
    finalSecondaryCta: 'Book a Meeting',
  },
  es: {
    metaTitle: 'Estrategia de crédito | Valtoris Financial',
    metaDescription:
      'Educación de preparación crediticia y estrategia para entender el perfil de crédito e identificar áreas que conviene revisar.',
    heroEyebrow: 'Estrategia de crédito',
    heroTitle: 'Entienda su crédito. Sepa en qué enfocarse después.',
    heroSupport:
      'Su perfil de crédito puede afectar vivienda, financiamiento, costos de préstamo y otras decisiones financieras. Valtoris le ayuda a entender el panorama actual, identificar áreas que conviene revisar y armar una estrategia más clara para los siguientes pasos.',
    heroPrimaryCta: 'Hacer el Reporte de Crédito™',
    heroSecondaryCta: 'Agendar una reunión',
    heroTertiaryCta: 'Vea cómo funciona',
    audienceHeading: 'Esto puede ser útil si...',
    audienceLead:
      'Una revisión de preparación crediticia puede ayudar cuando quiere un panorama más claro de prioridades antes de una decisión financiera importante.',
    audienceItems: [
      'Se está preparando para comprar una vivienda',
      'Está reconstruyendo después de contratiempos financieros',
      'El uso revolvente se siente alto',
      'Hay cobranzas u otros elementos negativos en el reporte',
      'No tiene claro qué está afectando su perfil de crédito',
      'Se está preparando para un financiamiento importante',
      'Quiere una estrategia más clara sobre qué revisar después',
    ],
    reviewHeading: 'Qué ayudamos a revisar',
    reviewLead:
      'Valtoris le ayuda a organizar los factores que suelen afectar la preparación crediticia. Esto es una revisión educativa, no una consulta a una agencia de crédito y no una promesa de que se pueda eliminar información precisa.',
    reviewAreas: [
      {
        title: 'Historial de pagos',
        body: 'Revisar patrones recientes de pago y si la consistencia o atrasos anteriores pueden merecer atención.',
      },
      {
        title: 'Uso del crédito',
        body: 'Organizar cómo los saldos revolventes se relacionan con el crédito disponible para ver dónde una revisión puede ayudar.',
      },
      {
        title: 'Elementos negativos',
        body: 'Identificar cobranzas, cuentas dadas de baja u otros elementos negativos que pueden afectar el panorama actual.',
      },
      {
        title: 'Estructura del crédito',
        body: 'Mirar cuentas abiertas, mezcla y antigüedad para que el perfil general sea más fácil de conversar.',
      },
      {
        title: 'Actividad crediticia reciente',
        body: 'Considerar consultas y cuentas nuevas que pueden formar parte de la foto actual.',
      },
      {
        title: 'Exactitud del reporte',
        body: 'Conversar si algo parece inexacto para que pueda decidir qué verificar con reportes oficiales.',
      },
      {
        title: 'Preparación según su meta',
        body: 'Conectar el panorama actual con vivienda, financiamiento u otras metas, sin tratar el diagnóstico como una aprobación.',
      },
    ],
    processHeading: 'Cómo trabaja Valtoris',
    processLead: 'Entienda primero el panorama actual. Luego decida qué, si acaso, conviene revisar más de cerca.',
    processNote:
      'El Reporte de Crédito™ es un diagnóstico educativo. No es un puntaje de agencia, una decisión de préstamo ni un caso de reparación de crédito.',
    processSteps: [
      {
        title: 'Haga el Reporte de Crédito',
        body: 'Complete el Reporte de Crédito™ para organizar factores de preparación crediticia que usted informa.',
      },
      {
        title: 'Entienda el panorama actual',
        body: 'Revise el puntaje, la calificación y las señales como contexto educativo, no como un resultado FICO®, VantageScore® o de agencia.',
      },
      {
        title: 'Identifique áreas prioritarias',
        body: 'Enfóquese en los factores que parecen más relevantes para sus metas y su plazo.',
      },
      {
        title: 'Revise acciones disponibles',
        body: 'Converse siguientes pasos educativos. La información negativa precisa puede permanecer y ningún resultado está garantizado.',
      },
      {
        title: 'Arme una estrategia para el siguiente paso',
        body: 'Decida qué vigilar, qué verificar y si una conversación de estrategia posterior le ayudaría.',
      },
    ],
    offerKicker: 'Servicio de mejoramiento de crédito',
    offerTitle: 'Elija el nivel de apoyo adecuado para usted',
    offerLead:
      'Comience con herramientas de autoservicio o elija apoyo profesional después de su consulta. Revisamos sus reportes reales, explicamos el alcance y le ayudamos a elegir el nivel adecuado sin prometer un aumento de puntaje ni la eliminación de información precisa.',
    offerPriceNote:
      'Las funciones de IDIQ están sujetas al plan final del proveedor. No se cobra ningún pago mediante el Reporte de Crédito. Los cargos profesionales de reparación de crédito se facturan solamente después de realizar el trabajo correspondiente y después de las divulgaciones requeridas y un acuerdo por escrito.',
    offerPlans: [
      {
        name: 'Constructor de Crédito DIY',
        price: '$39',
        cadence: 'al mes',
        description: 'Para clientes que desean monitoreo, educación y un plan que puedan ejecutar por sí mismos.',
        features: [
          'Acceso al monitoreo de IDIQ',
          'Reporte de Crédito™ y lista de acciones DIY',
          'Modelos educativos de cartas de disputa',
          'Orientación sobre utilización y reconstrucción',
          'Usted prepara y presenta sus propias disputas',
        ],
      },
      {
        name: 'Apoyo de Crédito Básico',
        price: '$99',
        cadence: 'al mes',
        description: 'Para clientes que desean revisión profesional y apoyo enfocado en sus asuntos prioritarios.',
        badge: 'Más popular',
        features: [
          'Todo lo incluido en DIY',
          'Revisión profesional de los reportes de las tres agencias',
          'Trabajo de disputa dirigido cuando corresponda',
          'Revisión mensual del progreso',
          'Plan de acción actualizado y apoyo estándar',
        ],
      },
      {
        name: 'Restauración de Crédito Premium',
        price: '$149',
        cadence: 'al mes',
        description: 'Para expedientes complejos que necesitan más revisión, seguimiento y planificación personalizada.',
        features: [
          'Todo lo incluido en Básico',
          'Estrategia de disputas más completa',
          'Correspondencia apropiada con agencias y acreedores directos',
          'Revisión prioritaria de documentos y apoyo',
          'Revisión estratégica individual cada mes',
          'Planificación para comprar vivienda o solicitar financiamiento',
        ],
      },
    ],
    offerCta: 'Agendar mi consulta de crédito',
    bridgeKicker: 'Diagnóstico educativo',
    bridgeTitle: 'Credit Report Card™',
    bridgeBody:
      'El Reporte de Crédito™ es un diagnóstico educativo diseñado para organizar el panorama actual e identificar áreas que conviene revisar. No consulta un puntaje de agencia de crédito.',
    bridgePrimaryCta: 'Hacer el Reporte de Crédito™',
    bridgeSecondaryCta: 'Agendar una reunión',
    complianceHeading: 'Información importante',
    complianceBody:
      'Este es un diagnóstico educativo. No es un puntaje FICO®, VantageScore® ni de una agencia de crédito, y no es una decisión de préstamo. Los resultados dependen de las circunstancias de cada persona. Valtoris no garantiza aumentos de puntaje, la eliminación de información precisa, la aprobación de financiamiento ni resultados específicos de crédito. La información negativa precisa puede permanecer.',
    complianceResourceLabel: '',
    complianceResourceHref: '',
    finalHeading: '¿Listo para entender en qué enfocarse después?',
    finalLead:
      'Empiece con el Reporte de Crédito™, o agende una reunión si prefiere conversar primero sus preguntas de preparación crediticia.',
    finalPrimaryCta: 'Hacer el Reporte de Crédito™',
    finalSecondaryCta: 'Agendar una reunión',
  },
}
