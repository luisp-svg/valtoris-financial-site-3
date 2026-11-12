import type { CombinedQuestion, Priority } from './engine.js'
import type { ShortDiagnostic } from '../shortForm/contract.js'

const readiness = (id: string, en: string, es: string, area: Priority): CombinedQuestion => ({
  id, reviews: [area], question: { id, kind: 'select', label: { en, es }, options: [
    { value: 'current', label: { en: 'Current and reviewed', es: 'Actualizado y revisado' } },
    { value: 'partial', label: { en: 'Partly addressed / needs updating', es: 'Parcial / requiere actualización' } },
    { value: 'missing', label: { en: 'Not yet addressed', es: 'Aún no se ha atendido' } },
    { value: 'unknown', label: { en: 'Not sure / prefer to discuss', es: 'No sé / prefiero conversar' } },
  ] },
})
/** New assessments opt in; previously saved reports retain their original rubric. */
export function planningQuestions(profile: 'family' | 'business', answers: ShortDiagnostic): CombinedQuestion[] {
  if (profile === 'business') return [
    readiness('owner_retirement.status', 'Do you have a funded retirement plan for yourself as a business owner?', '¿Tienes un plan de jubilación financiado como dueño del negocio?', 'retirement'),
    readiness('owner_retirement.review', 'Have you reviewed your retirement contributions and future income needs?', '¿Has revisado tus aportaciones de jubilación y futuras necesidades de ingresos?', 'retirement'),
    readiness('owner_estate.will.review', 'Have you reviewed a will and decision-making documents with a qualified professional?', '¿Has revisado un testamento y documentos para la toma de decisiones con un profesional calificado?', 'business'),
    readiness('owner_estate.trust.review', 'Have you reviewed with a qualified professional whether a trust is needed for your estate and business ownership plan?', '¿Has revisado con un profesional calificado si tu plan patrimonial y de propiedad del negocio necesita un fideicomiso?', 'business'),
    readiness('owner_estate.exit.review', 'Is your business exit or succession strategy documented and reviewed?', '¿Está documentada y revisada tu estrategia de salida o sucesión del negocio?', 'business'),
  ]
  const questions = [
    readiness('family_health.plan.review', 'Have you reviewed health coverage, benefits and expected out-of-pocket costs for your household?', '¿Has revisado cobertura de salud, beneficios y gastos de bolsillo previstos para tu hogar?', 'health'),
    readiness('family_disability.status', 'Do you have a plan to replace income if illness or injury prevents you from working?', '¿Tienes un plan para reemplazar ingresos si una enfermedad o lesión te impide trabajar?', 'health'),
    readiness('family_disability.review', 'Have you reviewed disability benefit amounts, waiting periods and how long benefits last?', '¿Has revisado los montos, períodos de espera y duración de los beneficios por discapacidad?', 'health'),
  ]
  if (answers['family_loans.has_loans'] === 'yes') questions.push(
    readiness('family_loans.plan.review', 'Have you reviewed your student loan records, payment affordability and repayment options?', '¿Has revisado tus registros de préstamos estudiantiles, pagos asequibles y opciones de pago?', 'credit'),
  )
  return questions
}
