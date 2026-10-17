import type { PublicLocale } from '../locale'

export type Answer = { question: string; answer: string }
export type AnswerPage = 'home' | 'reportCards' | 'education'

type AnswerCopy = { heading: string; summary: string; answers: readonly Answer[] }

export const answerContent: Record<PublicLocale, Record<AnswerPage, AnswerCopy>> = {
  en: {
    home: {
      heading: 'Start With Clear Answers',
      summary: 'Valtoris Financial helps families and business owners organize their financial picture, identify review priorities, and explore next steps. A Report Card is the educational starting point.',
      answers: [
        { question: 'What is a Valtoris Financial Report Card?', answer: 'A Valtoris Financial Report Card is an educational review based on your answers. It organizes your reported situation, identifies information to confirm, and suggests topics for a fuller planning conversation.' },
        { question: 'Should I start with the Family or Business Report Card?', answer: 'Choose Family to review household priorities. Choose Business to review your business situation. You can explore a more focused review for retirement, student loans, credit, homebuying, or protection in the Report Card hub.' },
        { question: 'Will I receive a numeric score?', answer: 'Most current short Report Cards provide observations and next steps rather than a numeric score. The homebuyer review includes an educational buyer-readiness grade and, when enough information is provided, a monthly home-payment estimate. Neither is mortgage approval.' },
      ],
    },
    reportCards: {
      heading: 'Questions About Your Report Card',
      summary: 'Choose one review that matches your current priority. Each review uses self-reported information and helps organize the next conversation.',
      answers: [
        { question: 'Which Report Cards are available?', answer: 'Valtoris offers Family, Business, Retirement, Student Loan, Credit, Homebuyer, and Protection reviews. Start with Family or Business for a broader starting point, or choose the review closest to your immediate goal.' },
        { question: 'Is the Report Card free?', answer: 'The educational Report Card review is free and has no obligation to purchase a service. Any later service has its own scope and terms.' },
        { question: 'What information do I need to provide?', answer: 'Answer the questions for your chosen review and provide your full name and email to save it. Storage and privacy acknowledgments are required. Your phone number and follow-up or marketing permissions are optional.' },
        { question: 'What does my result mean?', answer: 'Most short reviews summarize observations and next steps without a numeric score or letter grade. The homebuyer review includes a buyer-readiness grade. Results are based on what you report and do not establish loan approval, insurance eligibility, or guaranteed outcomes.' },
        { question: 'What happens after I submit?', answer: 'After the site confirms your review was saved, you can view your results and decide whether to schedule a conversation. If saving fails, stay on the form and retry; a failed save does not send you to a results page.' },
      ],
    },
    education: {
      heading: 'Understand the Four Planning Areas',
      summary: 'Explore Protect, Strengthen, Build, and Preserve to understand how the existing Valtoris resources connect to your goals. Start with a Report Card when you want to organize your own situation.',
      answers: [
        { question: 'What does Protect cover?', answer: 'Protect brings together protection reviews, insurance information, and health and income protection resources. These help you identify topics to discuss about your household or business protection.' },
        { question: 'What does Strengthen cover?', answer: 'Strengthen brings together credit-readiness and student loan resources. It helps you organize questions about your current situation and explore areas for further review.' },
        { question: 'What does Build cover?', answer: 'Build brings together retirement readiness, homebuyer readiness, and business formation resources. Choose the area that matches your current goal.' },
        { question: 'What does Preserve cover?', answer: 'Preserve brings together estate, legacy, and tax strategy coordination resources. Legal and tax advice belongs with appropriately qualified professionals.' },
      ],
    },
  },
  es: {
    home: {
      heading: 'Empieza Con Respuestas Claras',
      summary: 'Valtoris Financial ayuda a familias y dueños de negocios a organizar su panorama financiero, identificar prioridades y explorar próximos pasos. El Report Card es el punto de partida educativo.',
      answers: [
        { question: '¿Qué es un Report Card de Valtoris Financial?', answer: 'Un Report Card de Valtoris Financial es una revisión educativa basada en tus respuestas. Organiza tu situación reportada, identifica información por confirmar y propone temas para una conversación de planificación más completa.' },
        { question: '¿Debo empezar con el reporte familiar o de negocio?', answer: 'Elige Family para revisar prioridades de tu hogar. Elige Business para revisar la situación de tu negocio. En el centro de reportes puedes explorar revisiones específicas de jubilación, préstamos estudiantiles, crédito, vivienda o protección.' },
        { question: '¿Recibiré un puntaje numérico?', answer: 'La mayoría de las revisiones breves ofrecen observaciones y próximos pasos en lugar de un puntaje numérico. La revisión de vivienda incluye una calificación educativa de preparación y, cuando hay suficiente información, una estimación de pago mensual. Ninguna representa aprobación hipotecaria.' },
      ],
    },
    reportCards: {
      heading: 'Preguntas Sobre Tu Report Card',
      summary: 'Elige una revisión que corresponda a tu prioridad actual. Cada revisión usa información proporcionada por ti y ayuda a organizar la próxima conversación.',
      answers: [
        { question: '¿Qué reportes están disponibles?', answer: 'Valtoris ofrece revisiones familiares, de negocio, jubilación, préstamos estudiantiles, crédito, vivienda y protección. Empieza con Family o Business para una visión más amplia, o elige el área más cercana a tu meta inmediata.' },
        { question: '¿El Report Card es gratuito?', answer: 'La revisión educativa es gratuita y no te obliga a comprar un servicio. Cualquier servicio posterior tiene su propio alcance y condiciones.' },
        { question: '¿Qué información debo proporcionar?', answer: 'Responde las preguntas de tu revisión y proporciona tu nombre completo y correo para guardarla. Las confirmaciones de almacenamiento y privacidad son obligatorias. El teléfono y los permisos de contacto o marketing son opcionales.' },
        { question: '¿Qué significa mi resultado?', answer: 'La mayoría de las revisiones breves resumen observaciones y próximos pasos sin puntajes numéricos ni calificaciones. La revisión de vivienda incluye una calificación de preparación. Los resultados dependen de tus respuestas y no determinan aprobación de préstamos, elegibilidad de seguros ni resultados garantizados.' },
        { question: '¿Qué sucede después de enviar?', answer: 'Cuando el sitio confirma que tu revisión se guardó, puedes ver tus resultados y decidir si deseas agendar una conversación. Si falla el guardado, permanece en el formulario y reintenta; un fallo no te envía a los resultados.' },
      ],
    },
    education: {
      heading: 'Conoce las Cuatro Áreas de Planificación',
      summary: 'Explora Proteger, Fortalecer, Construir y Preservar para entender cómo los recursos de Valtoris se conectan con tus metas. Empieza con un Report Card para organizar tu situación.',
      answers: [
        { question: '¿Qué incluye Proteger?', answer: 'Proteger reúne revisiones de protección, información de seguros y recursos de salud y protección de ingresos. Ayudan a identificar temas para conversar sobre la protección de tu hogar o negocio.' },
        { question: '¿Qué incluye Fortalecer?', answer: 'Fortalecer reúne recursos de preparación crediticia y préstamos estudiantiles. Te ayuda a organizar preguntas sobre tu situación y explorar áreas para una revisión más completa.' },
        { question: '¿Qué incluye Construir?', answer: 'Construir reúne recursos de preparación para la jubilación, compra de vivienda y formación de negocios. Elige el área que corresponda a tu meta actual.' },
        { question: '¿Qué incluye Preservar?', answer: 'Preservar reúne recursos de coordinación de patrimonio, legado y estrategia fiscal. La asesoría legal y fiscal corresponde a profesionales debidamente calificados.' },
      ],
    },
  },
}
