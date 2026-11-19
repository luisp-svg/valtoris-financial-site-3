import type { ShortQuestion } from '../shortForm/catalog.js';
import type { ShortDiagnostic } from '../shortForm/contract.js';

export const STUDENT_LOAN_CONCERN = 'student_loan.concern';
export const STUDENT_LOAN_TIMING = 'shared.timing';
const option = (value: string, en: string, es: string) => ({ value, label: { en, es } });
const unknown = option('unknown', 'I’m not sure', 'No sé');
const question = (id: string, en: string, es: string, options: NonNullable<ShortQuestion['options']>, unsure = unknown): ShortQuestion =>
  ({ id, label: { en, es }, kind: 'select', options: [...options, unsure] });

export const studentLoanConcern = question(STUDENT_LOAN_CONCERN, 'What do you most want help with?', '¿Con qué necesitas más ayuda?', [
  option('payments', 'My monthly payment feels too high', 'Mi pago mensual parece demasiado alto'),
  option('options', 'SAVE or other repayment changes', 'SAVE u otros cambios en los planes de pago'),
  option('pslf', 'Understanding my PSLF progress', 'Entender mi progreso en PSLF'),
  option('past_due', 'Past-due loans or default', 'Préstamos atrasados o en incumplimiento'),
  option('records', 'Loan and servicer records', 'Registros de préstamos y administradores'),
], option('unknown', 'I don’t know where to start', 'No sé por dónde empezar'));

const followUps: Partial<Record<string, ShortQuestion>> = {
  payments: question('student_loan.payment_range', 'What is your required monthly payment?', '¿Cuál es tu pago mensual requerido?', [
    option('under_100', 'Under $100', 'Menos de $100'), option('100_249', '$100–$249', '$100–$249'),
    option('250_499', '$250–$499', '$250–$499'), option('500_plus', '$500 or more', '$500 o más'),
    option('no_payment', 'I don’t currently have a payment due', 'Actualmente no tengo un pago pendiente'),
  ]),
  options: question('student_loan.repayment_update', 'What does your servicer show right now?', '¿Qué muestra tu administrador actualmente?', [
    option('payment_due', 'A payment is due', 'Hay un pago pendiente'),
    option('paused', 'My payments are paused', 'Mis pagos están en pausa'),
    option('notice', 'I received a notice about my plan', 'Recibí un aviso sobre mi plan'),
  ]),
  pslf: question('student_loan.pslf_count', 'Have you checked your qualifying payment count?', '¿Has revisado cuántos pagos califican?', [
    option('yes', 'Yes', 'Sí'), option('no', 'No', 'No'),
    option('where', 'I’m not sure where to find it', 'No sé dónde encontrarlo'),
  ]),
  past_due: question('student_loan.latest_notice', 'What does your latest notice say?', '¿Qué dice tu aviso más reciente?', [
    option('past_due', 'My payments are past due', 'Mis pagos están atrasados'),
    option('default', 'My loan is in default', 'Mi préstamo está en incumplimiento'),
    option('collections', 'I received a collection notice', 'Recibí un aviso de cobranza'),
    option('no_notice', 'I don’t have a notice', 'No tengo un aviso'),
  ]),
  records: question('student_loan.records_available', 'Can you find your most recent loan statement?', '¿Puedes encontrar tu estado de cuenta más reciente?', [
    option('yes', 'Yes', 'Sí'), option('no', 'No', 'No'),
  ]),
};

const loanType = question('student_loan.loan_type', 'What kind of student loans are you reviewing?', '¿Qué tipo de préstamos estudiantiles estás revisando?', [
  option('federal', 'Federal', 'Federales'), option('private', 'Private', 'Privados'),
  option('both', 'Both', 'Ambos'), option('helping', 'I’m helping someone else', 'Estoy ayudando a otra persona'),
  option('none', 'No current loans', 'Sin préstamos actuales'),
]);

const context = question('student_loan.context', 'What are you preparing for?', '¿Para qué te estás preparando?', [
  option('family', 'Helping someone with their loans', 'Ayudar a alguien con sus préstamos'),
  option('future', 'Future education costs', 'Gastos educativos futuros'),
]);

const status = question('student_loan.status', 'What is the current status of the loans?', '¿Cuál es el estado actual de los préstamos?', [
  option('current', 'Payments are current', 'Pagos al día'),
  option('partial', 'Payments are paused or difficult to make', 'Los pagos están en pausa o son difíciles de hacer'),
  option('missing', 'Past due or in default', 'En atraso o incumplimiento'),
]);

export const studentLoanBookingTiming = question(STUDENT_LOAN_TIMING, 'When would you like help?', '¿Cuándo deseas ayuda?', [
  option('immediately', 'As soon as possible', 'Lo antes posible'),
  option('month', 'Within 30 days', 'En 30 días'),
  option('later', 'I’m exploring my options', 'Estoy explorando mis opciones'),
]);

export function studentLoanReviewQuestions(answers: ShortDiagnostic): ShortQuestion[] {
  const concern = answers[STUDENT_LOAN_CONCERN];
  const branch = typeof concern === 'string' && Object.prototype.hasOwnProperty.call(followUps, concern)
    ? followUps[concern]
    : undefined;
  const noCurrentLoan = answers[loanType.id] === 'none' || answers[loanType.id] === 'helping';
  const needsStatus = !noCurrentLoan && concern !== 'past_due' && concern !== 'options';
  return [
    studentLoanConcern,
    ...(branch ? [branch] : []),
    loanType,
    ...(noCurrentLoan ? [context] : needsStatus ? [status] : []),
    { id: 'shared.state', label: { en: 'Which state do you live in?', es: '¿En qué estado vives?' }, kind: 'state' },
    studentLoanBookingTiming,
  ];
}
