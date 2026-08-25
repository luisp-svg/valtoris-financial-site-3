import type { ReportCardCopyFn } from '../assessment/reportCardLocale'
import type { SpecializedCopyCatalog, SpecializedProductCopy } from '../assessment/specialized/types'

const PROTECTION_COPY_EN: SpecializedCopyCatalog = {
  questions: {},
  helpers: {
    step1: 'Tell us about your household so we can personalize your protection estimate.',
    step2: 'Income replacement is usually the largest part of a family protection estimate.',
    step3: 'Housing protection helps your family stay in their home while they adjust.',
    step4: 'Include balances your family would still be responsible for.',
    step5: 'Education funding is often the most overlooked part of a protection plan.',
    step6: 'Final expenses cover end-of-life costs so your family is not burdened unexpectedly.',
    step7: 'Enter your existing life insurance coverage so we can estimate your Protection Gap™.',
    incomeFormulaLabel: 'Income Protection',
    incomeFormula: 'Annual Income × Selected Years',
    housingFormulaLabel: 'Housing Protection',
    housingFormula: 'Annual Mortgage or Rent × 5 Years',
  },
  fields: {
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    phone: 'Phone',
    age: 'Age',
    state: 'State',
    maritalStatus: 'Marital Status',
    numberOfChildren: 'Number of Children',
    annualHouseholdIncome: 'Annual Household Income',
    incomeReplacementYears: 'Years of Income Replacement',
    customIncomeYears: 'Custom Years',
    housingType: 'Do you',
    annualMortgagePayment: 'Annual Mortgage Payment',
    annualRentPayment: 'Annual Rent Payment',
    creditCardDebt: 'Credit Card Debt',
    autoLoans: 'Auto Loans',
    personalLoans: 'Personal Loans',
    studentLoans: 'Student Loans',
    totalDebt: 'Total Debt',
    educationChildren: 'Number of Children',
    collegeFundPerChild: 'Desired College Fund Per Child',
    customCollegeFund: 'Custom College Fund Per Child',
    finalExpenses: 'Estimated Final Expenses',
    customFinalExpenses: 'Custom Final Expenses',
    currentLifeInsurance: 'Current Life Insurance Coverage',
  },
  answers: {
    'maritalStatus.single': 'Single',
    'maritalStatus.married': 'Married',
    'maritalStatus.divorced': 'Divorced',
    'maritalStatus.widowed': 'Widowed',
    'maritalStatus.domestic-partnership': 'Domestic Partnership',
    'housingType.own': 'Own a Home',
    'housingType.rent': 'Rent',
    'incomeReplacementYears.10': '10 Years',
    'incomeReplacementYears.15': '15 Years (Recommended)',
    'incomeReplacementYears.20': '20 Years',
    'incomeReplacementYears.custom': 'Custom',
    'incomeReplacementYears.badge.15': 'Recommended',
    'collegeFundPerChild.50000': '$50,000',
    'collegeFundPerChild.100000': '$100,000',
    'collegeFundPerChild.150000': '$150,000',
    'collegeFundPerChild.custom': 'Custom',
    'finalExpenses.15000': '$15,000',
    'finalExpenses.25000': '$25,000',
    'finalExpenses.50000': '$50,000',
    'finalExpenses.custom': 'Custom',
  },
  placeholders: {
    firstName: 'Enter your first name',
    lastName: 'Enter your last name',
    email: 'you@email.com',
    phone: '(555) 555-5555',
    age: 'Enter your age',
    children: '0',
    selectState: 'Select state',
    selectMaritalStatus: 'Select marital status',
    income: '150,000',
    customYears: '15',
    mortgage: '24,000',
    rent: '18,000',
    debt: '0',
    collegeFund: '100,000',
    finalExpenses: '25,000',
    coverage: '0',
  },
  validation: {
    consentRequired: 'Please confirm the required acknowledgments before continuing.',
    submitFailed: 'We could not save your Protection Gap™ estimate. Please try again.',
    retry: 'Try again',
    ingestUnavailable:
      'Your answers were reviewed on this device. They were not sent to Valtoris CRM.',
  },
  ui: {
    landingEyebrow: 'VALTORIS FAMILY PROTECTION ANALYSIS™',
    landingTitle: 'Is Your Family Financially Protected?',
    landingHero1:
      'Take the complimentary Valtoris Family Protection Analysis™ to evaluate income replacement, housing protection, debt payoff, education funding, final expenses, and your current life insurance coverage.',
    landingHero2:
      'See your estimated Protection Gap™, what may leave your household exposed, and what to address next.',
    landingMicrocopy:
      'Takes under two minutes. No cost. No obligation. Results are estimates, not guarantees.',
    startCta: 'Start My Family Protection Analysis™',
    landingReceiveHeading: "What You'll Receive",
    landingReceiveLead:
      'Four deliverables that turn a short calculator into clearer protection direction.',
    landingReceive1Title: 'Recommended Coverage',
    landingReceive1Description:
      'An estimated life insurance amount designed to help protect your household.',
    landingReceive2Title: 'Protection Gap',
    landingReceive2Description:
      'The difference between what your family may need and what you already have.',
    landingReceive3Title: 'Needs Analysis',
    landingReceive3Description:
      'A clear breakdown across income, housing, debt, education, and final expenses.',
    landingReceive4Title: 'Action Recommendations',
    landingReceive4Description:
      'Focused next steps so you know where protection planning should begin.',
    landingSampleHeading: 'Sample Report Preview',
    landingSampleLead:
      'An illustrative look at coverage need, current coverage, Protection Gap™, and priority recommendations.',
    landingSampleAriaLabel: 'Sample Family Protection Analysis preview',
    landingSampleBadge: 'Sample Report Preview',
    landingSampleCoverageLabel: 'Coverage Needed',
    landingSampleCurrentLabel: 'Current Coverage',
    landingSampleGapLabel: 'Protection Gap',
    landingSampleGapNote: 'Additional estimated protection your family may still need.',
    landingSamplePrioritiesTitle: 'Priority Recommendations',
    landingSamplePriority1: 'Confirm income replacement needs',
    landingSamplePriority2: 'Review mortgage and debt coverage',
    landingSamplePriority3: 'Align education funding with family goals',
    landingSampleDisclaimer:
      'Illustrative sample only. Your personalized results will reflect your answers.',
    landingCategoriesHeading: 'Categories Evaluated',
    landingCategoriesLead:
      'Your Protection Analysis reviews the planning inputs that shape estimated coverage need.',
    landingCategory1Title: 'Income Protection',
    landingCategory1Description:
      'Replacement income to help your family maintain their standard of living.',
    landingCategory2Title: 'Mortgage / Rent Protection',
    landingCategory2Description: 'Housing payment support to preserve stability at home.',
    landingCategory3Title: 'Debt Payoff',
    landingCategory3Description:
      'Outstanding consumer debt and liabilities your family would inherit.',
    landingCategory4Title: 'Child Education',
    landingCategory4Description:
      'Future education funding considerations for each child in your household.',
    landingCategory5Title: 'Final Expenses',
    landingCategory5Description: 'End-of-life costs so your family is not burdened unexpectedly.',
    landingCategory6Title: 'Existing Coverage',
    landingCategory6Description: 'Current life insurance applied as a deduction from total need.',
    landingCategory7Title: 'Protection Gap™',
    landingCategory7Description:
      'The remaining difference between estimated need and current coverage.',
    landingCategory8Title: 'Coverage Recommendation',
    landingCategory8Description:
      'A clear total estimate of protection that may be appropriate for your family.',
    landingHowHeading: 'How It Works',
    landingHowLead: 'From your first answers to a clearer next step in four focused stages.',
    landingHow1Title: 'Answer Questions',
    landingHow1Description:
      'Share focused details about income, housing, debt, education, and coverage.',
    landingHow2Title: 'Receive Results',
    landingHow2Description:
      'Get recommended coverage, a needs breakdown, and your estimated Protection Gap™.',
    landingHow3Title: 'Review Blueprint',
    landingHow3Description: 'See which protection priorities deserve attention first.',
    landingHow4Title: 'Schedule Strategy Session',
    landingHow4Description:
      'Optionally review your analysis in a complimentary strategy conversation.',
    landingFaqHeading: 'Frequently Asked Questions',
    landingFaqLead: 'Straightforward answers before you begin.',
    landingFaq1: 'How long does the Family Protection Analysis take?',
    landingFaqA1: 'Most households finish in under two minutes.',
    landingFaq2: 'Is it free?',
    landingFaqA2: 'Yes. The Valtoris Family Protection Analysis™ is complimentary and educational.',
    landingFaq3: 'Are the estimates guaranteed?',
    landingFaqA3:
      'No. Results are educational estimates based on your answers. They do not guarantee coverage amounts, underwriting outcomes, or product availability.',
    landingFaq4: 'Do I have to purchase anything?',
    landingFaqA4: 'No. You can review your results with no purchase required.',
    landingFaq5: 'Will someone contact me?',
    landingFaqA5:
      'Only if you choose to schedule a follow-up conversation. Completing the analysis alone does not create a sales commitment.',
    landingFaq6: 'Is my information secure?',
    landingFaqA6:
      'Your answers are used to generate your protection estimate and are handled with care for educational planning purposes.',
    landingFaq7: 'Can I retake it later?',
    landingFaqA7:
      'Yes. Retake the analysis anytime your income, coverage, or family situation changes.',
    landingClosingTitle: 'Know Your Gap Before It Becomes a Risk',
    landingClosingCopy:
      'Start with a focused protection estimate and leave with clearer next-step direction.',
    landingClosingMicrocopy:
      'Takes under two minutes. No cost. No obligation. Results are estimates, not guarantees.',
    calculatorTitle: 'Family Protection Analysis™',
    calculatorSubtitle:
      'Find out how much life insurance your family may need in less than 2 minutes.',
    calculatorDisclaimer:
      'This calculator provides an educational estimate and is not an insurance quote.',
    stepIndicator: 'Step {current} of {total}',
    languageGroupLabel: 'Language',
    languageEnglish: 'English',
    languageSpanish: 'Español',
    back: 'Back',
    continue: 'Continue',
    viewResults: 'View My Protection Analysis',
    saving: 'Saving your Protection Gap…',
    step1Title: 'About Your Family',
    step2Title: 'Income Protection',
    step3Title: 'Housing',
    step4Title: 'Outstanding Debt',
    step5Title: "Children's Education",
    step6Title: 'Final Expenses',
    step7Title: 'Current Coverage',
    consentHeading: 'Acknowledgments',
    consentIntro:
      'Your Protection Gap™ estimate is based on the information you shared. Required acknowledgments are marked with an asterisk.',
    consentStorage:
      'I understand that Valtoris will use the information I provide to calculate and store my {storageResultName} and related results.',
    consentStorageHint: 'Required acknowledgment to save and calculate your estimate.',
    consentStorageError:
      'Please acknowledge that your information will be used to calculate and store your estimate.',
    consentContact:
      'I give Valtoris permission to contact me about my results and possible next steps.',
    consentEmailMarketing:
      'I agree to receive occasional marketing emails from Valtoris. I can unsubscribe at any time.',
    consentSms:
      'I agree to receive recurring marketing text messages from Valtoris at the number provided. Consent is not a condition of receiving my results. Message and data rates may apply. Reply STOP to opt out.',
    consentSmsPhoneNote: 'Add a phone number earlier in the analysis to enable this option.',
    consentPrivacyBefore: 'I acknowledge that I have reviewed the',
    consentPrivacyLink: 'Valtoris Privacy Policy',
    consentPrivacyAfter: '.',
    consentPrivacyHint: 'Required privacy acknowledgment. Opens the Privacy Policy in a new tab.',
    consentPrivacyError: 'Please review and acknowledge the Privacy Policy before continuing.',
    consentDisclaimer:
      'Results are educational estimates based on self-reported information. They are not financial, legal, tax, investment, credit, or insurance advice, and they are not a guarantee. An advisor review may reach different conclusions.',
    consentHoneypot: 'Company website',
    productTitle: 'Protection Gap™',
    storageResultName: 'Protection Gap',
  },
  results: {
    headline: 'Your Family Protection Analysis™',
    headlineNamed: "{name}, here's your Family Protection Analysis™",
    subheading:
      'Based on the information you provided, we have estimated the amount of life insurance your family may need to help protect their financial future.',
    recommendedTitle: 'Recommended Life Insurance Coverage™',
    recommendedSubtitle:
      "Estimated amount needed to help protect your family's financial future.",
    breakdownTitle: 'Protection Breakdown',
    'row.income.label': 'Income Protection',
    'row.income.description': 'Replacement income for your loved ones.',
    'row.housing.label': 'Mortgage / Rent Protection (5 Years)',
    'row.housing.description': 'Five years of housing payments.',
    'row.debt.label': 'Outstanding Debt',
    'row.debt.description': 'Consumer debt and liabilities.',
    'row.education.label': "Children's Education",
    'row.education.description': 'Future education funding.',
    'row.finalExpenses.label': 'Final Expenses',
    'row.finalExpenses.description': 'End-of-life expenses.',
    'row.existingCoverage.label': 'Existing Life Insurance',
    'row.existingCoverage.description': 'Current coverage applied as a deduction.',
    gapTitle: 'Estimated Protection Gap™',
    gapCopy:
      'This represents the estimated additional protection your family may still need after considering your current life insurance.',
    meansTitle: 'What This Means',
    meansCopy:
      'This calculator provides an educational estimate based on the information you entered. It is not an insurance quote or financial recommendation. Your Family Financial Report Card™ will provide a personalized analysis and recommendations.',
    scheduleTitle: 'Schedule Complimentary Strategy Session™',
    scheduleCopy:
      'Review your Family Protection Analysis™ with a Valtoris Financial Advisor and receive personalized recommendations.',
    scheduleCta: 'Schedule Complimentary Strategy Session™',
    learnMoreCta: 'Learn About the Full Family Report Card™',
    restartCta: 'Restart Assessment',
    footer1: 'Powered by Valtoris Financial™',
    footer2: 'Helping Families Become Legacy Ready™',
  },
}

const PROTECTION_COPY_ES: SpecializedCopyCatalog = {
  questions: {},
  helpers: {
    step1: 'Cuéntenos sobre su hogar para personalizar su estimación de protección.',
    step2:
      'El reemplazo de ingresos suele ser la parte más grande de una estimación de protección familiar.',
    step3: 'La protección de vivienda ayuda a que su familia permanezca en su hogar mientras se adapta.',
    step4: 'Incluya los saldos de los que su familia seguiría siendo responsable.',
    step5:
      'El financiamiento educativo suele ser la parte más olvidada de un plan de protección.',
    step6:
      'Los gastos finales cubren los costos de fin de vida para que su familia no cargue con un gasto inesperado.',
    step7:
      'Indique su seguro de vida actual para poder estimar su Protection Gap™.',
    incomeFormulaLabel: 'Protección de ingresos',
    incomeFormula: 'Ingreso anual × años seleccionados',
    housingFormulaLabel: 'Protección de vivienda',
    housingFormula: 'Hipoteca o renta anual × 5 años',
  },
  fields: {
    firstName: 'Nombre',
    lastName: 'Apellido',
    email: 'Correo electrónico',
    phone: 'Teléfono',
    age: 'Edad',
    state: 'Estado',
    maritalStatus: 'Estado civil',
    numberOfChildren: 'Número de hijos',
    annualHouseholdIncome: 'Ingreso anual del hogar',
    incomeReplacementYears: 'Años de reemplazo de ingresos',
    customIncomeYears: 'Años personalizados',
    housingType: 'Usted',
    annualMortgagePayment: 'Pago anual de hipoteca',
    annualRentPayment: 'Pago anual de renta',
    creditCardDebt: 'Deuda de tarjetas de crédito',
    autoLoans: 'Préstamos de auto',
    personalLoans: 'Préstamos personales',
    studentLoans: 'Préstamos estudiantiles',
    totalDebt: 'Deuda total',
    educationChildren: 'Número de hijos',
    collegeFundPerChild: 'Fondo universitario deseado por hijo',
    customCollegeFund: 'Fondo universitario personalizado por hijo',
    finalExpenses: 'Gastos finales estimados',
    customFinalExpenses: 'Gastos finales personalizados',
    currentLifeInsurance: 'Cobertura actual de seguro de vida',
  },
  answers: {
    'maritalStatus.single': 'Soltero(a)',
    'maritalStatus.married': 'Casado(a)',
    'maritalStatus.divorced': 'Divorciado(a)',
    'maritalStatus.widowed': 'Viudo(a)',
    'maritalStatus.domestic-partnership': 'Unión doméstica',
    'housingType.own': 'Es dueño(a) de su casa',
    'housingType.rent': 'Renta',
    'incomeReplacementYears.10': '10 años',
    'incomeReplacementYears.15': '15 años (recomendado)',
    'incomeReplacementYears.20': '20 años',
    'incomeReplacementYears.custom': 'Personalizado',
    'incomeReplacementYears.badge.15': 'Recomendado',
    'collegeFundPerChild.50000': '$50,000',
    'collegeFundPerChild.100000': '$100,000',
    'collegeFundPerChild.150000': '$150,000',
    'collegeFundPerChild.custom': 'Personalizado',
    'finalExpenses.15000': '$15,000',
    'finalExpenses.25000': '$25,000',
    'finalExpenses.50000': '$50,000',
    'finalExpenses.custom': 'Personalizado',
  },
  placeholders: {
    firstName: 'Escriba su nombre',
    lastName: 'Escriba su apellido',
    email: 'usted@correo.com',
    phone: '(555) 555-5555',
    age: 'Escriba su edad',
    children: '0',
    selectState: 'Seleccione un estado',
    selectMaritalStatus: 'Seleccione su estado civil',
    income: '150,000',
    customYears: '15',
    mortgage: '24,000',
    rent: '18,000',
    debt: '0',
    collegeFund: '100,000',
    finalExpenses: '25,000',
    coverage: '0',
  },
  validation: {
    consentRequired: 'Confirme los reconocimientos obligatorios antes de continuar.',
    submitFailed:
      'No pudimos guardar su estimación de Protection Gap™. Inténtelo de nuevo.',
    retry: 'Intentar de nuevo',
    ingestUnavailable:
      'Sus respuestas se revisaron en este dispositivo. No se enviaron al CRM de Valtoris.',
  },
  ui: {
    landingEyebrow: 'VALTORIS FAMILY PROTECTION ANALYSIS™',
    landingTitle: '¿Está su familia protegida financieramente?',
    landingHero1:
      'Complete sin costo el Valtoris Family Protection Analysis™ para evaluar el reemplazo de ingresos, la protección de vivienda, el pago de deudas, el financiamiento educativo, los gastos finales y su seguro de vida actual.',
    landingHero2:
      'Vea su Protection Gap™ estimado, qué podría dejar expuesto a su hogar y qué atender después.',
    landingMicrocopy:
      'Toma menos de dos minutos. Sin costo. Sin compromiso. Los resultados son estimaciones, no garantías.',
    startCta: 'Comenzar mi Family Protection Analysis™',
    landingReceiveHeading: 'Qué recibirá',
    landingReceiveLead:
      'Cuatro entregables que convierten una calculadora breve en una dirección de protección más clara.',
    landingReceive1Title: 'Cobertura recomendada',
    landingReceive1Description:
      'Un monto estimado de seguro de vida pensado para ayudar a proteger a su hogar.',
    landingReceive2Title: 'Protection Gap',
    landingReceive2Description:
      'La diferencia entre lo que su familia podría necesitar y lo que ya tiene.',
    landingReceive3Title: 'Análisis de necesidades',
    landingReceive3Description:
      'Un desglose claro de ingresos, vivienda, deudas, educación y gastos finales.',
    landingReceive4Title: 'Recomendaciones de acción',
    landingReceive4Description:
      'Pasos enfocados para que sepa dónde debe comenzar su planificación de protección.',
    landingSampleHeading: 'Vista previa de un reporte de ejemplo',
    landingSampleLead:
      'Una muestra ilustrativa de la necesidad de cobertura, la cobertura actual, el Protection Gap™ y las recomendaciones prioritarias.',
    landingSampleAriaLabel: 'Vista previa de ejemplo del Family Protection Analysis™',
    landingSampleBadge: 'Vista previa de ejemplo',
    landingSampleCoverageLabel: 'Cobertura necesaria',
    landingSampleCurrentLabel: 'Cobertura actual',
    landingSampleGapLabel: 'Protection Gap',
    landingSampleGapNote: 'Protección adicional estimada que su familia podría necesitar.',
    landingSamplePrioritiesTitle: 'Recomendaciones prioritarias',
    landingSamplePriority1: 'Confirmar las necesidades de reemplazo de ingresos',
    landingSamplePriority2: 'Revisar la cobertura de hipoteca y deudas',
    landingSamplePriority3: 'Alinear el financiamiento educativo con las metas familiares',
    landingSampleDisclaimer:
      'Solo es un ejemplo ilustrativo. Sus resultados personalizados reflejarán sus respuestas.',
    landingCategoriesHeading: 'Categorías evaluadas',
    landingCategoriesLead:
      'Su Protection Analysis revisa los datos de planificación que determinan la necesidad estimada de cobertura.',
    landingCategory1Title: 'Protección de ingresos',
    landingCategory1Description:
      'Ingreso de reemplazo para ayudar a que su familia mantenga su nivel de vida.',
    landingCategory2Title: 'Protección de hipoteca o renta',
    landingCategory2Description:
      'Apoyo para el pago de vivienda y así preservar la estabilidad en el hogar.',
    landingCategory3Title: 'Pago de deudas',
    landingCategory3Description:
      'Deudas de consumo y obligaciones pendientes que su familia heredaría.',
    landingCategory4Title: 'Educación de los hijos',
    landingCategory4Description:
      'Consideraciones de financiamiento educativo futuro para cada hijo de su hogar.',
    landingCategory5Title: 'Gastos finales',
    landingCategory5Description:
      'Costos de fin de vida para que su familia no cargue con un gasto inesperado.',
    landingCategory6Title: 'Cobertura existente',
    landingCategory6Description:
      'El seguro de vida actual se aplica como deducción de la necesidad total.',
    landingCategory7Title: 'Protection Gap™',
    landingCategory7Description:
      'La diferencia restante entre la necesidad estimada y la cobertura actual.',
    landingCategory8Title: 'Recomendación de cobertura',
    landingCategory8Description:
      'Una estimación total y clara de la protección que podría ser apropiada para su familia.',
    landingHowHeading: 'Cómo funciona',
    landingHowLead:
      'De sus primeras respuestas a un siguiente paso más claro, en cuatro etapas enfocadas.',
    landingHow1Title: 'Responda las preguntas',
    landingHow1Description:
      'Comparta detalles puntuales sobre ingresos, vivienda, deudas, educación y cobertura.',
    landingHow2Title: 'Reciba sus resultados',
    landingHow2Description:
      'Obtenga la cobertura recomendada, un desglose de necesidades y su Protection Gap™ estimado.',
    landingHow3Title: 'Revise su plan',
    landingHow3Description: 'Vea qué prioridades de protección merecen atención primero.',
    landingHow4Title: 'Agende una sesión de estrategia',
    landingHow4Description:
      'De forma opcional, revise su análisis en una conversación de estrategia sin costo.',
    landingFaqHeading: 'Preguntas frecuentes',
    landingFaqLead: 'Respuestas claras antes de comenzar.',
    landingFaq1: '¿Cuánto tiempo toma el Family Protection Analysis™?',
    landingFaqA1: 'La mayoría de los hogares termina en menos de dos minutos.',
    landingFaq2: '¿Es gratis?',
    landingFaqA2:
      'Sí. El Valtoris Family Protection Analysis™ es sin costo y tiene fines educativos.',
    landingFaq3: '¿Las estimaciones están garantizadas?',
    landingFaqA3:
      'No. Los resultados son estimaciones educativas basadas en sus respuestas. No garantizan montos de cobertura, resultados de suscripción ni disponibilidad de productos.',
    landingFaq4: '¿Tengo que comprar algo?',
    landingFaqA4: 'No. Puede revisar sus resultados sin necesidad de comprar nada.',
    landingFaq5: '¿Alguien se comunicará conmigo?',
    landingFaqA5:
      'Solo si usted decide agendar una conversación de seguimiento. Completar el análisis por sí solo no crea ningún compromiso de compra.',
    landingFaq6: '¿Mi información está segura?',
    landingFaqA6:
      'Sus respuestas se usan para generar su estimación de protección y se manejan con cuidado para fines educativos de planificación.',
    landingFaq7: '¿Puedo repetirlo más adelante?',
    landingFaqA7:
      'Sí. Repita el análisis cuando cambien sus ingresos, su cobertura o la situación de su familia.',
    landingClosingTitle: 'Conozca su brecha antes de que se convierta en un riesgo',
    landingClosingCopy:
      'Comience con una estimación de protección enfocada y termine con una dirección más clara para el siguiente paso.',
    landingClosingMicrocopy:
      'Toma menos de dos minutos. Sin costo. Sin compromiso. Los resultados son estimaciones, no garantías.',
    calculatorTitle: 'Family Protection Analysis™',
    calculatorSubtitle:
      'Descubra en menos de 2 minutos cuánto seguro de vida podría necesitar su familia.',
    calculatorDisclaimer:
      'Esta calculadora ofrece una estimación educativa y no es una cotización de seguro.',
    stepIndicator: 'Paso {current} de {total}',
    languageGroupLabel: 'Idioma',
    languageEnglish: 'English',
    languageSpanish: 'Español',
    back: 'Atrás',
    continue: 'Continuar',
    viewResults: 'Ver mi Protection Analysis',
    saving: 'Guardando su Protection Gap™…',
    step1Title: 'Sobre su familia',
    step2Title: 'Protección de ingresos',
    step3Title: 'Vivienda',
    step4Title: 'Deudas pendientes',
    step5Title: 'Educación de los hijos',
    step6Title: 'Gastos finales',
    step7Title: 'Cobertura actual',
    consentHeading: 'Reconocimientos',
    consentIntro:
      'Su estimación de Protection Gap™ se basa en la información que compartió. Los reconocimientos obligatorios están marcados con un asterisco.',
    consentStorage:
      'Entiendo que Valtoris usará la información que proporciono para calcular y guardar mi {storageResultName} y los resultados relacionados.',
    consentStorageHint: 'Reconocimiento obligatorio para guardar y calcular su estimación.',
    consentStorageError:
      'Confirme que su información se usará para calcular y guardar su estimación.',
    consentContact:
      'Doy permiso a Valtoris para comunicarse conmigo sobre mis resultados y los posibles pasos siguientes.',
    consentEmailMarketing:
      'Acepto recibir correos electrónicos promocionales ocasionales de Valtoris. Puedo cancelar la suscripción en cualquier momento.',
    consentSms:
      'Acepto recibir mensajes de texto promocionales recurrentes de Valtoris al número indicado. Este consentimiento no es requisito para recibir mis resultados. Pueden aplicar tarifas de mensajes y datos. Responda STOP para darse de baja.',
    consentSmsPhoneNote:
      'Agregue un número de teléfono antes en el análisis para habilitar esta opción.',
    consentPrivacyBefore: 'Confirmo que he revisado la',
    consentPrivacyLink: 'Política de privacidad de Valtoris',
    consentPrivacyAfter: '.',
    consentPrivacyHint:
      'Reconocimiento de privacidad obligatorio. Abre la Política de privacidad en una pestaña nueva.',
    consentPrivacyError: 'Revise y confirme la Política de privacidad antes de continuar.',
    consentDisclaimer:
      'Los resultados son estimaciones educativas basadas en la información que usted reporta. No son asesoría financiera, legal, fiscal, de inversiones, de crédito ni de seguros, y no constituyen una garantía. La revisión de un asesor puede llegar a conclusiones distintas.',
    consentHoneypot: 'Sitio web de la empresa',
    productTitle: 'Protection Gap™',
    storageResultName: 'Protection Gap',
  },
  results: {
    headline: 'Su Family Protection Analysis™',
    headlineNamed: '{name}, este es su Family Protection Analysis™',
    subheading:
      'Según la información que proporcionó, estimamos el monto de seguro de vida que su familia podría necesitar para ayudar a proteger su futuro financiero.',
    recommendedTitle: 'Cobertura de seguro de vida recomendada™',
    recommendedSubtitle:
      'Monto estimado necesario para ayudar a proteger el futuro financiero de su familia.',
    breakdownTitle: 'Desglose de la protección',
    'row.income.label': 'Protección de ingresos',
    'row.income.description': 'Ingreso de reemplazo para sus seres queridos.',
    'row.housing.label': 'Protección de hipoteca o renta (5 años)',
    'row.housing.description': 'Cinco años de pagos de vivienda.',
    'row.debt.label': 'Deudas pendientes',
    'row.debt.description': 'Deudas de consumo y obligaciones.',
    'row.education.label': 'Educación de los hijos',
    'row.education.description': 'Financiamiento educativo futuro.',
    'row.finalExpenses.label': 'Gastos finales',
    'row.finalExpenses.description': 'Gastos de fin de vida.',
    'row.existingCoverage.label': 'Seguro de vida existente',
    'row.existingCoverage.description': 'La cobertura actual se aplica como deducción.',
    gapTitle: 'Protection Gap™ estimado',
    gapCopy:
      'Esto representa la protección adicional estimada que su familia podría necesitar después de considerar su seguro de vida actual.',
    meansTitle: 'Qué significa esto',
    meansCopy:
      'Esta calculadora ofrece una estimación educativa basada en la información que usted ingresó. No es una cotización de seguro ni una recomendación financiera. Su Family Financial Report Card™ ofrecerá un análisis y recomendaciones personalizados.',
    scheduleTitle: 'Agende su sesión de estrategia sin costo™',
    scheduleCopy:
      'Revise su Family Protection Analysis™ con un asesor financiero de Valtoris y reciba recomendaciones personalizadas.',
    scheduleCta: 'Agende su sesión de estrategia sin costo™',
    learnMoreCta: 'Conozca el Family Report Card™ completo',
    restartCta: 'Reiniciar la evaluación',
    footer1: 'Desarrollado por Valtoris Financial™',
    footer2: 'Ayudamos a las familias a ser Legacy Ready™',
  },
}

export const protectionCopy: SpecializedProductCopy = {
  en: PROTECTION_COPY_EN,
  es: PROTECTION_COPY_ES,
}

export type LocalizedCalculatorOption = {
  value: string
  label: string
  badge?: string
}

/**
 * Localizes calculator option labels while preserving canonical option values.
 * Values stay language-neutral so scoring and ingest never see translated input.
 */
export function localizeCalculatorOptions(
  options: ReadonlyArray<{ value: string; label: string; badge?: string }>,
  t: ReportCardCopyFn,
  prefix: string,
): LocalizedCalculatorOption[] {
  return options.map((option) =>
    option.badge
      ? {
          value: option.value,
          label: t('answers', `${prefix}.${option.value}`),
          badge: t('answers', `${prefix}.badge.${option.value}`),
        }
      : {
          value: option.value,
          label: t('answers', `${prefix}.${option.value}`),
        },
  )
}
