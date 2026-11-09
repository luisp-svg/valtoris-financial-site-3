import type { CombinedQuestion } from './engine.js'
import type { ShortDiagnostic } from '../shortForm/contract.js'
import type { ShortQuestion } from '../shortForm/catalog.js'

const copy = (en: string, es: string) => ({ en, es })
const option = (value: string, en: string, es: string) => ({ value, label: copy(en, es) })
const unknown = option('unknown', 'Not sure / prefer to discuss', 'No sé / prefiero conversar')
const yesNo = [option('yes', 'Yes', 'Sí'), option('no', 'No', 'No'), unknown]
function choice(id: string, en: string, es: string, options = yesNo): CombinedQuestion {
  return { id, reviews: [], question: { id, kind: 'select', label: copy(en, es), options } }
}
function amount(id: string, en: string, es: string): CombinedQuestion {
  const question: ShortQuestion = { id, kind: 'number', label: copy(en, es), allowUnknown: true, max: 10000000, unit: copy('USD', 'USD') }
  return { id, question, reviews: [] }
}
/** Intake context only: no scoring indicators, category expansion, or result sections. */
export function familySupplementQuestions(answers: ShortDiagnostic): CombinedQuestion[] {
  const questions = [choice('family_health.coverage', 'Does everyone in your household have health insurance?', '¿Todos en tu hogar tienen seguro de salud?', [option('all', 'Everyone', 'Todos'), option('some', 'Some household members', 'Algunos miembros'), option('none', 'No one', 'Nadie'), unknown])]
  if (answers['family_health.coverage'] !== 'all') questions.push(choice('family_health.needs', 'Who needs health coverage?', '¿Quién necesita cobertura de salud?', [option('self', 'Me', 'Yo'), option('partner', 'My spouse or partner', 'Mi cónyuge o pareja'), option('children', 'Children or dependents', 'Hijos o dependientes'), option('multiple', 'Multiple household members', 'Varios miembros del hogar'), unknown]))
  if (['all', 'some'].includes(String(answers['family_health.coverage']))) questions.push(amount('family_health.premium', 'About how much does your household pay monthly for health insurance?', '¿Cuánto paga tu hogar aproximadamente al mes por seguro de salud?'))
  questions.push(choice('family_health.cost_difficulty', 'Is your household having difficulty paying medical costs?', '¿Tu hogar tiene dificultad para pagar gastos médicos?'))
  questions.push(choice('family_loans.has_loans', 'Does anyone in your household have student loans?', '¿Alguien en tu hogar tiene préstamos estudiantiles?'))
  if (answers['family_loans.has_loans'] === 'yes') questions.push(
    choice('family_loans.type', 'What type of student loans does your household have?', '¿Qué tipo de préstamos estudiantiles tiene tu hogar?', [option('federal', 'Federal', 'Federales'), option('private', 'Private', 'Privados'), option('both', 'Both', 'Ambos'), unknown]),
    amount('family_loans.balance', 'Approximate total student loan balance', 'Saldo total aproximado de préstamos estudiantiles'),
    amount('family_loans.payment', 'Approximate monthly student loan payment', 'Pago mensual aproximado de préstamos estudiantiles'),
    choice('family_loans.repayment', 'What is the current repayment status?', '¿Cuál es el estado actual de pago?', [option('current', 'Payments current', 'Pagos al día'), option('deferred', 'In school / deferment / forbearance', 'Estudios / aplazamiento / indulgencia'), option('late', 'Past due or in default', 'En atraso o incumplimiento'), option('mixed', 'Different statuses across loans', 'Diferentes estados entre préstamos'), unknown]),
  )
  return questions
}
