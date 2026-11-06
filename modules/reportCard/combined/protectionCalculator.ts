import { numericAnswer, type ShortDiagnostic } from '../shortForm/contract.js';
import type { Copy, ShortQuestion } from '../shortForm/catalog.js';

const copy = (en: string, es: string): Copy => ({ en, es });
export const isProtectionArea = (area: string): area is 'family' | 'protection' =>
  area === 'family' || area === 'protection';

function amount(id: string, label: Copy, helper?: Copy): ShortQuestion {
  return { id, label, kind: 'number', unit: copy('USD', 'USD'), helper };
}

const mortgage = amount('family.mortgage_balance', copy('What is your remaining mortgage balance?', '¿Cuál es el saldo pendiente de tu hipoteca?'), copy('Enter 0 if your home is paid off.', 'Ingresa 0 si tu vivienda está pagada.'));
const rent = amount('family.monthly_rent', copy('How much is your monthly rent?', '¿Cuánto pagas de alquiler al mes?'));
const annualSupport = amount('family.annual_support', copy('How much annual support would your family need if you died?', '¿Cuánto apoyo anual necesitaría tu familia si fallecieras?'), copy('Leave out housing and one-time costs you plan to cover separately.', 'Excluye la vivienda y los gastos únicos que planeas cubrir por separado.'));
const supportYears: ShortQuestion = {
  id: 'family.support_years', kind: 'select', label: copy('How many years should that support last?', '¿Cuántos años debería durar ese apoyo?'),
  options: [
    ...[1, 3, 5, 10, 15, 20, 25, 30].map(years => ({ value: String(years), label: copy(String(years), String(years)) })),
    { value: 'unknown', label: copy('Not sure', 'No sé') },
  ],
};
const otherNeeds = amount('family.other_needs', copy('How much would you set aside for other one-time needs?', '¿Cuánto reservarías para otras necesidades únicas?'), copy('Include debts, education or final expenses you want covered. Enter 0 if none.', 'Incluye deudas, educación o gastos finales que quieras cubrir. Ingresa 0 si no hay ninguno.'));
const dimeDebt = amount('family.dime_debt', copy('How much debt would you want paid off?', '¿Cuánta deuda quisieras liquidar?'), copy('Exclude your mortgage. Enter 0 if none.', 'Excluye la hipoteca. Ingresa 0 si no tienes deudas.'));
const dimeEducation = amount('family.dime_education', copy('How much would you want to set aside for education?', '¿Cuánto quisieras reservar para la educación?'), copy('Enter the total for everyone you want to support, or 0 if none.', 'Ingresa el total para todas las personas que quieras apoyar, o 0 si no corresponde.'));
const dimeIncome: ShortQuestion = {
  ...annualSupport,
  label: copy('How much annual income would your family need to replace?', '¿Cuánto ingreso anual necesitaría reemplazar tu familia?'),
};
const dimeYears: ShortQuestion = {
  ...supportYears,
  options: supportYears.options?.filter(option => ['10', '15', '20', '30', 'unknown'].includes(option.value)),
};
const lifeCoverage = amount('family.life_coverage', copy('How much life insurance would pay out today?', '¿Cuánto pagaría hoy tu seguro de vida?'), copy('Enter 0 if you have no life insurance. Choose Not sure if you need to check.', 'Ingresa 0 si no tienes seguro de vida. Elige No sé si necesitas confirmarlo.'));
const expenses = amount('protection.monthly_expenses', copy('What are your essential monthly expenses?', '¿Cuáles son tus gastos esenciales mensuales?'), copy('Include your regular rent or mortgage payment.', 'Incluye tu pago habitual de alquiler o hipoteca.'));
const continuingIncome = amount('protection.continuing_income', copy('How much monthly take-home income would continue if you could not work?', '¿Cuánto ingreso mensual neto seguirías recibiendo si no pudieras trabajar?'), copy('Exclude disability benefits. Enter 0 if none.', 'Excluye los beneficios por discapacidad. Ingresa 0 si no hay ninguno.'));
const benefit = amount('protection.monthly_benefit', copy('How much would disability coverage pay you per month after taxes?', '¿Cuánto te pagaría al mes tu cobertura por discapacidad después de impuestos?'), copy('Enter 0 if you have no coverage. Choose Not sure if you need to check.', 'Ingresa 0 si no tienes cobertura. Elige No sé si necesitas confirmarlo.'));

export function protectionQuestions(area: 'family' | 'protection', answers: ShortDiagnostic, useDime = false): ShortQuestion[] {
  if (area === 'protection') return [expenses, continuingIncome, benefit];
  const housing: ShortQuestion = {
    id: 'family.housing', kind: 'select', label: copy('Which best describes your housing?', '¿Qué describe mejor tu vivienda?'),
    options: [
      { value: 'own', label: copy('I own my home', 'Soy propietario de mi vivienda') },
      { value: 'rent', label: copy('I rent my home', 'Alquilo mi vivienda') },
      { value: 'other', label: copy('No housing amount to include', 'Sin gastos de vivienda para incluir') },
      { value: 'unknown', label: copy('Not sure', 'No sé') },
    ],
  };
  const housingType = answers[housing.id];
  const housingQuestions = [housing, ...(housingType === 'own' ? [mortgage] : housingType === 'rent' ? [rent] : [])];
  return useDime
    ? [dimeDebt, dimeIncome, dimeYears, ...housingQuestions, dimeEducation, lifeCoverage]
    : [...housingQuestions, annualSupport, supportYears, otherNeeds, lifeCoverage];
}

export function protectionEstimate(area: 'family' | 'protection', answers: ShortDiagnostic, locale: keyof Copy, useDime = false) {
  const fields = protectionQuestions(area, answers, useDime);
  const missing = fields.filter(field => answers[field.id] === 'unknown' || answers[field.id] === undefined);
  const value = (field: ShortQuestion) => numericAnswer(answers[field.id]) ?? 0;
  const row = (label: Copy, amount: number) => ({ label: label[locale], amount });
  const family = area === 'family';
  const housingType = answers['family.housing'];
  const housingCost = housingType === 'own' ? value(mortgage) : housingType === 'rent' ? value(rent) * 60 : 0;
  const support = value(annualSupport) * value(supportYears);
  const oneTimeCosts = useDime ? value(dimeDebt) + value(dimeEducation) : value(otherNeeds);
  const dollars = family
    ? support + housingCost + oneTimeCosts - value(lifeCoverage)
    : value(expenses) - value(continuingIncome) - value(benefit);
  return {
    label: (useDime ? copy('Estimated life insurance gap (DIME)', 'Brecha estimada de seguro de vida (DIME)')
      : family ? copy('Estimated life insurance gap', 'Brecha estimada de seguro de vida')
      : copy('Estimated monthly income shortfall', 'Déficit estimado de ingresos mensuales'))[locale],
    amount: missing.length ? null : Math.max(0, Math.round(dollars * 100) / 100),
    rows: missing.length ? [] : family ? [
      ...(useDime ? [row(copy('Debt excluding mortgage', 'Deudas sin incluir la hipoteca'), value(dimeDebt))] : []),
      row(copy('Family income support', 'Apoyo económico familiar'), support),
      ...(housingType === 'own' ? [row(copy('Remaining mortgage balance', 'Saldo pendiente de la hipoteca'), housingCost)]
        : housingType === 'rent' ? [row(copy('Five years of rent', 'Cinco años de alquiler'), housingCost)] : []),
      useDime
        ? row(copy('Education fund', 'Fondo para la educación'), value(dimeEducation))
        : row(copy('Other one-time needs', 'Otras necesidades únicas'), value(otherNeeds)),
      row(copy('Existing life insurance', 'Seguro de vida vigente'), -value(lifeCoverage)),
    ] : [
      row(copy('Essential monthly expenses', 'Gastos esenciales mensuales'), value(expenses)),
      row(copy('Continuing monthly income', 'Ingresos mensuales que continuarían'), -value(continuingIncome)),
      row(copy('Monthly disability benefit', 'Beneficio mensual por discapacidad'), -value(benefit)),
    ],
    missing: missing.map(field => field.label[locale]),
    note: (family
      ? copy('This planning estimate uses the support period and costs you entered. Confirm your existing coverage with your advisor.', 'Esta estimación usa el plazo de apoyo y los costos que ingresaste. Confirma tu cobertura vigente con tu asesor.')
      : copy('This estimate applies once disability benefits start. Before then, compare your expenses with continuing income and confirm how long savings can cover the difference.', 'Esta estimación aplica cuando comienzan los beneficios por discapacidad. Antes de ese momento, compara tus gastos con los ingresos que continuarían y confirma cuánto tiempo cubrirían tus ahorros la diferencia.'))[locale],
  };
}
