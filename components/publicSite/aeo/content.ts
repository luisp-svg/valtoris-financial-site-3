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
        { question: 'Will I receive a numeric score?', answer: 'Health Insurance, TSP, Employee Benefits, and Tax Review provide an educational planning-preparation grade. Missing scored information makes that grade preliminary. Existing short reviews provide observations and next steps. The homebuyer review includes an educational buyer-readiness grade and, when enough information is provided, a monthly home-payment estimate. Neither is mortgage approval.' },
      ],
    },
    reportCards: {
      heading: 'Questions About Your Report Card',
      summary: 'Select one or several financial priorities for a coordinated assessment. Questions adapt to your answers, with shared information requested once.',
      answers: [
        { question: 'Which Report Cards are available?', answer: 'Valtoris offers Family, Business, Retirement, Student Loan, Credit, Homebuyer, Protection, Health Insurance, TSP, Employee Benefits, Tax Review, and Lifestyle & Asset Protection Report Cards. Start with Family or Business for a broader starting point, or choose the review closest to your immediate goal.' },
        { question: 'Is the Report Card free?', answer: 'The educational Report Card review is free and has no obligation to purchase a service. Any later service has its own scope and terms.' },
        { question: 'What information do I need to provide?', answer: 'Answer the questions for your chosen review and provide your full name and email to save it. Storage and privacy acknowledgments are required. A phone number helps match your consultation booking. Follow-up and marketing permissions remain optional.' },
        { question: 'What does my result mean?', answer: 'Health Insurance, TSP, Employee Benefits, and Tax Review show an educational planning-preparation grade, marked preliminary when scored information is missing. The homebuyer review includes a buyer-readiness grade. Other short reviews summarize observations and next steps. Results are based on what you report and do not establish loan approval, insurance eligibility, or guaranteed outcomes.' },
        { question: 'What happens after I submit?', answer: 'After your assessment is saved, book a complimentary initial consultation. Detailed results unlock when your booking is verified. If saving fails, stay on the form and retry the same submission. Supporting details are collected during consultation intake.' },
      ],
    },
    education: {
      heading: 'Using These Guides',
      summary: 'Use these prompts to prepare for a conversation. When you are ready to organize your own situation, choose a focused Report Card or combine several priorities.',
      answers: [
        { question: 'Where should I begin?', answer: 'Start with the guide closest to your current question. Open its preparation questions and note what you would like to clarify during your consultation.' },
        { question: 'Can I review more than one area?', answer: 'Yes. The financial assessment lets you select several priorities and brings compatible shared questions into one coordinated review.' },
        { question: 'Are these guides personalized advice?', answer: 'No. They provide general educational prompts. Your circumstances, records and questions need an individual review; legal and tax advice belongs with qualified professionals.' },
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
        { question: '¿Recibiré un puntaje numérico?', answer: 'Salud, TSP, Beneficios para Empleados y Revisión Fiscal ofrecen una calificación educativa de preparación, preliminar cuando falta información puntuable. Las revisiones breves existentes ofrecen observaciones y próximos pasos. La revisión de vivienda incluye una calificación educativa de preparación y, cuando hay suficiente información, una estimación de pago mensual. Ninguna representa aprobación hipotecaria.' },
      ],
    },
    reportCards: {
      heading: 'Preguntas Sobre Tu Report Card',
      summary: 'Selecciona una o varias prioridades para una evaluación coordinada. Las preguntas se adaptan a tus respuestas y la información compartida se solicita una sola vez.',
      answers: [
        { question: '¿Qué reportes están disponibles?', answer: 'Valtoris ofrece Report Cards de familia, negocio, jubilación, préstamos estudiantiles, crédito, vivienda, protección, seguro de salud, TSP, beneficios para empleados, revisión fiscal y protección patrimonial y estilo de vida. Empieza con Family o Business para una visión más amplia, o elige el área más cercana a tu meta inmediata.' },
        { question: '¿El Report Card es gratuito?', answer: 'La revisión educativa es gratuita y no te obliga a comprar un servicio. Cualquier servicio posterior tiene su propio alcance y condiciones.' },
        { question: '¿Qué información debo proporcionar?', answer: 'Responde las preguntas de tu revisión y proporciona tu nombre completo y correo para guardarla. Las confirmaciones de almacenamiento y privacidad son obligatorias. El teléfono permite identificar tu reserva. Los permisos de seguimiento y publicidad siguen siendo opcionales.' },
        { question: '¿Qué significa mi resultado?', answer: 'Salud, TSP, Beneficios para Empleados y Revisión Fiscal muestran una calificación educativa de preparación, preliminar cuando falta información puntuable. Vivienda incluye una calificación de preparación para comprar. Otras revisiones breves resumen observaciones y próximos pasos. Los resultados dependen de tus respuestas y no determinan aprobación de préstamos, elegibilidad de seguros ni resultados garantizados.' },
        { question: '¿Qué sucede después de enviar?', answer: 'Después de guardar tu evaluación, reserva una consulta inicial sin costo. Los resultados detallados se desbloquean al verificar tu reserva. Si falla el guardado, reintenta el mismo envío. La información adicional se completa durante la consulta.' },
      ],
    },
    education: {
      heading: 'Cómo usar estas guías',
      summary: 'Usa estas preguntas para preparar una conversación. Cuando quieras organizar tu situación, elige un Report Card enfocado o combina varias prioridades.',
      answers: [
        { question: '¿Por dónde comienzo?', answer: 'Empieza con la guía más cercana a tu pregunta actual. Abre las preguntas de preparación y anota lo que deseas aclarar durante tu consulta.' },
        { question: '¿Puedo revisar varias áreas?', answer: 'Sí. La evaluación financiera permite seleccionar varias prioridades y reúne las preguntas compartidas compatibles en una revisión coordinada.' },
        { question: '¿Estas guías son asesoría personalizada?', answer: 'No. Son preguntas educativas generales. Tu situación, registros y preguntas necesitan una revisión individual; la asesoría legal y fiscal corresponde a profesionales calificados.' },
      ],
    },
  },
}
