import type { SpecializedAnswerMap, SpecializedCopyCatalog, SpecializedField, SpecializedQuestion } from '../specialized/types'
import { isFieldComplete, isFieldVisible, pruneHiddenQuestionAnswers } from '../specialized/answers.js'
import { HOME_BUYER_QUESTIONS } from './questions.js'

type Labels = readonly [string, string]
type Choice = readonly [string, string, string]
const catalog = (): SpecializedCopyCatalog => ({ questions: {}, helpers: {}, fields: {}, answers: {}, placeholders: {}, validation: {}, ui: {}, results: {} })
export const HOME_BUYER_V2_COPY = { en: catalog(), es: catalog() }
function copy(section: keyof SpecializedCopyCatalog, key: string, labels: Labels) {
  HOME_BUYER_V2_COPY.en[section][key] = labels[0]
  HOME_BUYER_V2_COPY.es[section][key] = labels[1]
  return key
}
const yesNo: Choice[] = [['yes', 'Yes', 'Sí'], ['no', 'No', 'No'], ['not_sure', 'Not sure', 'No estoy seguro/a']]
function select(id: string, labels: Labels, choices: readonly Choice[], extra: Partial<SpecializedField> = {}): SpecializedField {
  return { id, input: 'single', labelKey: copy('fields', id, labels), options: choices.map(([value, en, es]) => ({ value, labelKey: copy('answers', `${id}.${value}`, [en, es]) })), ...extra } as SpecializedField
}
function text(id: string, labels: Labels, when?: SpecializedField['when']): SpecializedField {
  return { id, input: 'short_text', labelKey: copy('fields', id, labels), maxLength: 200, required: false, when, format: id === 'agent_email' ? 'email' : id === 'agent_phone' ? 'phone' : undefined }
}
function money(id: string, labels: Labels, when?: SpecializedField['when']): SpecializedField {
  return { ...text(id, labels, when), input: 'short_text', maxLength: 14, numeric: { max: id === 'hoa' ? 100_000 : 100_000_000, min: id.endsWith('_net_business') ? -100_000_000 : id === 'target_price' ? 1 : 0 } }
}
function group(id: string, labels: Labels, helper: Labels, fields: SpecializedField[]): SpecializedQuestion {
  return { id, kind: 'group', diagnostic: true, labelKey: copy('questions', id, labels), helperKey: copy('helpers', id, helper), fields }
}
export const INCOME_SOURCES = ['w2', 'net_business', 'commission', 'bonus', 'other'] as const
function incomeFields(prefix: string): SpecializedField[] {
  const enabled = prefix === 'co' ? { field: 'co_applying', equals: 'yes' } : undefined
  const sources = select(`${prefix}_sources`, ['Income sources (select all that apply)', 'Fuentes de ingresos (seleccione todas)'], [
    ['w2', 'W-2 salary / hourly', 'Salario / pago por hora W-2'], ['net_business', '1099 / self-employed net income', 'Ingreso neto 1099 / trabajo por cuenta propia'],
    ['commission', 'Recurring commission', 'Comisiones recurrentes'], ['bonus', 'Recurring bonuses', 'Bonos recurrentes'],
    ['other', 'Other recurring income (including retirement / benefits)', 'Otros ingresos recurrentes (incluye jubilación / beneficios)'],
    ['none', 'No income', 'Sin ingresos'], ['not_sure', 'Not sure', 'No estoy seguro/a'],
  ], { when: enabled })
  const names: Labels[] = [['W-2 gross base income, excluding separately entered commission/bonus ($)', 'Ingreso bruto base W-2, sin comisiones/bonos indicados por separado ($)'], ['Business net income after expenses, before personal taxes ($; losses may be negative)', 'Ingreso neto del negocio después de gastos, antes de impuestos personales ($; pérdidas pueden ser negativas)'], ['Recurring commission not included elsewhere ($)', 'Comisiones recurrentes no incluidas en otra parte ($)'], ['Recurring bonus not included elsewhere ($)', 'Bonos recurrentes no incluidos en otra parte ($)'], ['Other recurring income ($)', 'Otros ingresos recurrentes ($)']]
  return [
    { ...sources, input: 'multi', exclusiveValues: ['none', 'not_sure'] } as SpecializedField,
    select(`${prefix}_period`, ['Income amounts are', 'Los montos de ingresos son'], [['monthly', 'Monthly', 'Mensuales'], ['annual', 'Annual', 'Anuales']], { when: enabled }),
    ...INCOME_SOURCES.map((source, i) => money(`${prefix}_${source}`, names[i], { field: `${prefix}_sources`, includes: source })),
  ]
}
const goal = group('v2_goal', ['Your home-buying goal', 'Su meta de compra'], ['These answers describe your plans; they do not establish program eligibility.', 'Estas respuestas describen sus planes; no determinan elegibilidad para programas.'], [
  select('home_type', ['What type of home?', '¿Qué tipo de vivienda?'], [['new', 'New construction', 'Construcción nueva'], ['resale', 'Resale', 'Reventa'], ['either', 'Either', 'Cualquiera'], ['not_sure', 'Not sure', 'No estoy seguro/a']]),
  select('target_timing', ['When would you like to buy?', '¿Cuándo le gustaría comprar?'], [['asap', 'ASAP / actively looking', 'Lo antes posible / buscando'], ['0_3_months', 'Within 3 months', 'En 3 meses'], ['3_6_months', '3–6 months', '3–6 meses'], ['6_12_months', '6–12 months', '6–12 meses'], ['1_2_years', '1–2 years', '1–2 años'], ['2_plus_years', 'More than 2 years', 'Más de 2 años'], ['exploring', 'Just exploring', 'Solo explorando']]),
  select('buyer_history', ['First-time home buyer?', '¿Primera compra de vivienda?'], [['first_time', 'Yes', 'Sí'], ['repeat', 'No', 'No'], ['not_sure', 'Not sure', 'No estoy seguro/a']]),
  ...HOME_BUYER_QUESTIONS[8].fields.filter(f => f.id !== 'buyer_history'),
  money('target_price', ['Target home price ($, optional)', 'Precio objetivo ($, opcional)']),
])
export const HOME_BUYER_V2_QUESTIONS: readonly SpecializedQuestion[] = [
  HOME_BUYER_QUESTIONS[0], HOME_BUYER_QUESTIONS[1], goal,
  group('v2_income', ['Your income and stability', 'Sus ingresos y estabilidad'], ['Enter reliable recurring amounts once. Leave unknown amounts blank; enter 0 only when known to be zero. All amounts are USD. Income is self-reported, not lender-verified.', 'Ingrese montos recurrentes confiables una sola vez. Deje en blanco lo desconocido; ingrese 0 solo cuando sea cero. Todos los montos son USD. Son ingresos declarados, no verificados por un prestamista.'], [
    ...incomeFields('primary'),
    select('industry_years', ['How long have you worked consistently in your industry?', '¿Cuánto tiempo ha trabajado de forma continua en su sector?'], [['under_1', 'Less than 1 year', 'Menos de 1 año'], ['1_2', '1–2 years', '1–2 años'], ['2_5', '2–5 years', '2–5 años'], ['5_plus', '5+ years', '5+ años'], ['not_applicable', 'Not applicable (e.g. retirement income)', 'No aplica (p. ej., jubilación)'], ['not_sure', 'Not sure', 'No estoy seguro/a']]),
  ]),
  group('v2_applicants', ['Who is applying?', '¿Quién solicita el préstamo?'], ['Include only another applicant’s income. Do not repeat your own income. A spouse or family relationship alone does not include their income.', 'Incluya solo los ingresos de otro solicitante. No repita sus ingresos. Ser cónyuge o familiar no incluye automáticamente sus ingresos.'], [
    select('applicants', ['Who is buying / applying?', '¿Quién compra / solicita?'], [['self', 'Myself', 'Yo'], ['self_spouse', 'Myself and spouse', 'Yo y mi cónyuge'], ['self_family', 'Myself and family member', 'Yo y un familiar'], ['other', 'Someone else / still deciding', 'Otra persona / por decidir']]),
    select('co_applying', ['Will another person apply with you?', '¿Otra persona solicitará con usted?'], yesNo, { when: { field: 'applicants', in: ['self_spouse', 'self_family'] } }),
    ...incomeFields('co'),
  ]),
  group('v2_debts', ['Monthly debts and housing', 'Deudas mensuales y vivienda'], ['Include both applicants’ obligations when applying together. Count shared debts once. Exclude housing from debt categories below; report it separately. Blank means unknown, not zero.', 'Incluya las obligaciones de ambos solicitantes si solicitan juntos. Cuente deudas compartidas una sola vez. Excluya vivienda de las categorías de deuda; indíquela por separado. En blanco significa desconocido, no cero.'], [
    ...(['auto', 'student', 'cards', 'installment', 'support', 'other'] as const).map((id, i) => money(`debt_${id}`, [ ['Auto payments ($/month)', 'Student loan payments ($/month)', 'Credit-card minimums ($/month)', 'Personal / installment loans ($/month)', 'Required support / alimony payments ($/month)', 'Other recurring debts ($/month)'][i], ['Pagos de auto ($/mes)', 'Préstamos estudiantiles ($/mes)', 'Mínimos de tarjetas ($/mes)', 'Préstamos personales / a plazos ($/mes)', 'Pagos obligatorios de manutención / pensión ($/mes)', 'Otras deudas recurrentes ($/mes)'][i] ])),
    money('current_housing_payment', ['Current total housing payment ($/month)', 'Pago total actual de vivienda ($/mes)']),
    money('retained_housing_payment', ['Housing obligations continuing after purchase ($/month; 0 if none)', 'Obligaciones de vivienda que continúan tras comprar ($/mes; 0 si ninguna)']),
    money('hoa', ['Expected HOA / condo fees ($/month; blank uses displayed assumption)', 'Cuotas HOA / condominio esperadas ($/mes; en blanco usa el supuesto mostrado)']),
  ]),
  group('v2_assets', ['Savings and purchase funds', 'Ahorros y fondos para comprar'], ['Report total balances separately. Purchase funds means money you are comfortable using after protecting reserves; exclude unavailable retirement balances and unconfirmed assistance. Do not add the same funds twice.', 'Indique saldos totales por separado. Fondos para comprar es dinero que acepta usar después de proteger reservas; excluya jubilación no disponible y ayuda no confirmada. No sume fondos dos veces.'], [
    money('liquid_savings', ['Checking / savings ($)', 'Cuentas corrientes / ahorros ($)']),
    money('retirement', ['Retirement / investments ($)', 'Jubilación / inversiones ($)']),
    money('available_funds', ['Total available purchase funds, after reserves ($)', 'Fondos totales disponibles para comprar, después de reservas ($)']),
    money('protected_reserves', ['Reserves already set aside, excluded from purchase funds ($)', 'Reservas ya separadas, excluidas de los fondos de compra ($)']),
    ...HOME_BUYER_QUESTIONS[4].fields.filter(f => f.id === 'emergency_reserve_months'),
    ...HOME_BUYER_QUESTIONS[6].fields,
  ]),
  group('v2_preparation', ['Documents and monthly cushion', 'Documentos y margen mensual'], ['A readiness grade is separate from the educational price estimate.', 'La calificación de preparación es independiente de la estimación educativa del precio.'], [
    ...HOME_BUYER_QUESTIONS[7].fields,
    ...HOME_BUYER_QUESTIONS[3].fields.filter(f => f.id === 'monthly_debt_burden'),
    ...HOME_BUYER_QUESTIONS[5].fields.filter(f => f.id === 'cash_flow_cushion'),
    ...HOME_BUYER_QUESTIONS[9].fields.filter(f => f.id === 'readiness_confidence'),
  ]),
  group('v2_team', ['Your home-buying team', 'Su equipo de compra'], ['Having an agent or lender does not lower your grade. Share professional contact details only; no credentials or account numbers.', 'Tener agente o prestamista no reduce su calificación. Comparta solo datos de contacto profesional; no credenciales ni números de cuenta.'], [
    select('loan_officer', ['Working with a loan officer / lender?', '¿Trabaja con un oficial de préstamos / prestamista?'], yesNo),
    select('approval_stage', ['Have you been prequalified or preapproved?', '¿Ha recibido precalificación o preaprobación?'], [['preapproved', 'Preapproved', 'Preaprobado/a'], ['prequalified', 'Prequalified', 'Precalificado/a'], ['applied', 'Applied, not approved', 'Solicitó, sin aprobación'], ['no', 'No', 'No'], ['not_sure', 'Not sure', 'No estoy seguro/a']]),
    select('has_agent', ['Working with a real estate agent?', '¿Trabaja con un agente inmobiliario?'], yesNo),
    text('agent_name', ['Agent name (optional)', 'Nombre del agente (opcional)'], { field: 'has_agent', equals: 'yes' }),
    text('agent_agency', ['Brokerage / agency (optional)', 'Correduría / agencia (opcional)'], { field: 'has_agent', equals: 'yes' }),
    text('agent_phone', ['Agent phone (optional)', 'Teléfono del agente (opcional)'], { field: 'has_agent', equals: 'yes' }),
    text('agent_email', ['Agent email (optional)', 'Correo del agente (opcional)'], { field: 'has_agent', equals: 'yes' }),
  ]),
  group('v2_onboarding', ['Your purchase plan', 'Su plan de compra'], ['These answers help an advisor understand your plans. Do not enter sensitive identifiers or private details about another person.', 'Estas respuestas ayudan al asesor a entender sus planes. No ingrese identificadores sensibles ni datos privados de otra persona.'], [
    text('barriers', ['What could stop you from buying? (optional)', '¿Qué podría impedirle comprar? (opcional)']),
    select('years_in_home', ['How long do you expect to live in the home?', '¿Cuánto tiempo espera vivir en la vivienda?'], [['under_3', 'Less than 3 years', 'Menos de 3 años'], ['3_5', '3–5 years', '3–5 años'], ['5_10', '5–10 years', '5–10 años'], ['10_plus', '10+ years', '10+ años'], ['not_sure', 'Not sure / not applicable', 'No estoy seguro/a / no aplica']]),
  ]),
]
export const V2_FIELDS = HOME_BUYER_V2_QUESTIONS.flatMap(q => q.fields)
export function initialV2Answers(): SpecializedAnswerMap {
  return Object.fromEntries(V2_FIELDS.map(f => [f.id, f.input === 'multi' ? [] : '']))
}
export function pruneV2Answers(values: SpecializedAnswerMap): SpecializedAnswerMap {
  return HOME_BUYER_V2_QUESTIONS.reduce((next, question) => pruneHiddenQuestionAnswers(question, next), values)
}
/** Shared runtime validation: exact keys, closed enums, bounded text/decimals, no stale hidden values. */
export function validateV2Answers(raw: unknown): raw is SpecializedAnswerMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const values = raw as SpecializedAnswerMap
  if (Object.keys(values).length !== V2_FIELDS.length || V2_FIELDS.some(f => !Object.prototype.hasOwnProperty.call(values, f.id))) return false
  return V2_FIELDS.every(field => {
    const value = values[field.id]
    if (field.input === 'multi') {
      if (!Array.isArray(value) || value.some(v => typeof v !== 'string') || new Set(value).size !== value.length) return false
      if (value.some(v => !field.options.some(o => o.value === v))) return false
      if (value.some(v => field.exclusiveValues?.includes(v)) && value.length !== 1) return false
    } else {
      if (typeof value !== 'string') return false
      if (field.input === 'single' && value !== '' && !field.options.some(o => o.value === value)) return false
      if (field.input === 'short_text' && value.length > field.maxLength) return false
    }
    if (!isFieldVisible(field, values)) return Array.isArray(value) ? value.length === 0 : value === ''
    if (field.id === 'agent_email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) return false
    if (field.id === 'agent_phone' && value && !/^[+()\d .-]{7,30}$/.test(String(value))) return false
    return isFieldComplete(field, values)
  })
}

copy('validation', 'amount', ['Enter a valid amount with up to two decimal places, no currency symbols or separators (maximum 100,000,000). Leave blank if unknown.', 'Ingrese un monto válido con hasta dos decimales, sin símbolos ni separadores (máximo 100,000,000). Deje en blanco si lo desconoce.'])
copy('validation', 'contact_format', ['Check this professional email address or phone number.', 'Revise este correo o teléfono profesional.'])

const categoryNames: Record<string, Labels> = {
  credit_readiness: ['Credit preparation', 'Preparación del crédito'], income_employment: ['Income and stability', 'Ingresos y estabilidad'],
  debt_dti_readiness: ['Debt readiness', 'Preparación de deudas'], savings_reserves: ['Savings and reserves', 'Ahorros y reservas'],
  cash_flow_housing: ['Housing and monthly cushion', 'Vivienda y margen mensual'], down_payment_readiness: ['Down-payment preparation', 'Preparación del anticipo'],
  documentation_readiness: ['Document preparation', 'Preparación de documentos'], purchase_timeline: ['Purchase preparation', 'Preparación de compra'],
}
for (const [id, [en, es]] of Object.entries(categoryNames)) {
  copy('results', `v2.strength.${id}.title`, [en, es])
  copy('results', `v2.strength.${id}.body`, ['Your reported answers score well in this readiness category. This does not establish mortgage eligibility.', 'Sus respuestas obtienen una buena puntuación en esta categoría. Esto no determina elegibilidad hipotecaria.'])
  copy('results', `v2.review.${id}.title`, [`Review: ${en.toLowerCase()}`, `Revisar: ${es.toLowerCase()}`])
  copy('results', `v2.review.${id}.body`, ['Review the answers and category points with an advisor. The educational price scenarios are separate from this readiness grade.', 'Revise las respuestas y puntos de esta categoría con un asesor. Los escenarios educativos de precio son independientes de esta calificación.'])
}
copy('results', 'v2.disclaimer', ['Your readiness grade is based on self-reported information and is separate from the educational affordability scenarios. Neither is a credit pull, underwriting decision, mortgage approval, or lending offer.', 'Su calificación se basa en información declarada y es independiente de los escenarios educativos de compra. Ninguno es una consulta de crédito, decisión de suscripción, aprobación hipotecaria ni oferta de préstamo.'])
copy('ui', 'v2.nextStepSupport', ['An optional conversation to review your answers, assumptions, and next steps.', 'Una conversación opcional para revisar sus respuestas, supuestos y próximos pasos.'])
