import type { RefObject } from 'react';
import type { ShortDiagnostic } from '../../modules/reportCard/shortForm/contract';
import { STUDENT_LOAN_CONCERN, studentLoanReviewQuestions } from '../../modules/reportCard/combined/studentLoanRouting';

const nextSteps = {
  payments: [
    ['Start with your monthly payment', 'Find your required payment and the name of your current repayment plan on your latest servicer statement.'],
    ['Empieza por tu pago mensual', 'Busca el pago requerido y el nombre de tu plan actual en el último estado de cuenta de tu administrador.'],
  ],
  options: [
    ['Confirm your current repayment plan', 'Check the plan and loan status shown by your servicer. Have any recent notices about changes handy.'],
    ['Confirma tu plan de pago actual', 'Verifica el plan y el estado que muestra tu administrador. Ten a mano los avisos recientes sobre cambios.'],
  ],
  pslf: [
    ['Check your PSLF records', 'Find your reported qualifying payment count and the dates covered by your most recent employer certification.'],
    ['Revisa tus registros de PSLF', 'Busca el número registrado de pagos que califican y las fechas cubiertas por tu certificación de empleo más reciente.'],
  ],
  past_due: [
    ['Confirm your loan status', 'Find the latest notice and check whether your servicer lists the loan as past due or in default. Note any deadline on the notice.'],
    ['Confirma el estado de tu préstamo', 'Busca el aviso más reciente y verifica si tu administrador indica atraso o incumplimiento. Anota cualquier fecha límite.'],
  ],
  records: [
    ['Identify who services each loan', 'Make a list of your servicers and note which loans are federal or private.'],
    ['Identifica quién administra cada préstamo', 'Haz una lista de tus administradores y anota cuáles préstamos son federales o privados.'],
  ],
  unknown: [
    ['Start by identifying the loan type', 'Check a recent statement or notice to see who services the loan and whether it is federal or private.'],
    ['Empieza por identificar el tipo de préstamo', 'Consulta un estado de cuenta o aviso reciente para saber quién administra el préstamo y si es federal o privado.'],
  ],
} as const;

export function StudentLoanPreliminary({ locale, answers, heading, onBook, onBack }: {
  locale: 'en' | 'es';
  answers: ShortDiagnostic;
  heading: RefObject<HTMLHeadingElement>;
  onBook: () => void;
  onBack: () => void;
}) {
  const es = locale === 'es';
  const goal = answers[STUDENT_LOAN_CONCERN];
  const facts = studentLoanReviewQuestions(answers)
    .filter(question => question.id.startsWith('student_loan.'))
    .flatMap(question => {
      const option = question.options?.find(item => item.value === answers[question.id]);
      return option ? [{ id: question.id, label: question.label[locale], value: option.label[locale] }] : [];
    });
  const topic = typeof goal === 'string' && Object.prototype.hasOwnProperty.call(nextSteps, goal)
    ? goal as keyof typeof nextSteps
    : 'unknown';
  const [title, action] = nextSteps[topic][es ? 1 : 0];
  const futureEducation = answers['student_loan.context'] === 'future';
  const consult = {
    payments: ['We’ll review what’s driving your payment and which options are worth checking.', 'Revisaremos qué determina tu pago y qué opciones vale la pena verificar.'],
    options: ['We’ll review what your servicer shows and discuss questions about your current plan.', 'Revisaremos lo que muestra tu administrador y las preguntas sobre tu plan actual.'],
    pslf: ['We’ll review your records and identify gaps in your payment or employment history to verify.', 'Revisaremos tus registros e identificaremos datos de pagos o empleo pendientes de verificar.'],
    past_due: ['We’ll review the status, any deadline you report, and which next steps to confirm with your servicer.', 'Revisaremos el estado, los plazos indicados y los pasos que conviene confirmar con tu administrador.'],
    records: ['We’ll identify which records to gather and how to use them to clarify your options.', 'Identificaremos qué registros reunir y cómo usarlos para aclarar tus opciones.'],
    unknown: ['We’ll help you organize your loan information and identify the first question to resolve.', 'Te ayudaremos a organizar la información de tus préstamos e identificar la primera pregunta que conviene resolver.'],
  }[topic][es ? 1 : 0];

  return (
    <>
      <h1 ref={heading} tabIndex={-1}>{es ? 'Tu Report Card preliminar' : 'Your Preliminary Student Loan Report Card'}</h1>
      <h2>{es ? 'Lo que nos contaste' : 'What You Told Us'}</h2>
      <dl>
        {facts.map(fact => <div key={fact.id}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
      </dl>
      <h2>{es ? 'Qué verificar' : 'What to Verify'}</h2>
      <p><strong>{futureEducation ? (es ? 'Revisa los costos de estudio' : 'Review your education costs') : title}.</strong>{' '}
        {futureEducation
          ? (es ? 'Busca el costo de asistencia y la información de ayuda económica de tu escuela.' : 'Gather your school’s cost of attendance and any financial aid information you have.')
          : action}</p>
      <h2>{es ? 'Qué cubriremos en tu consulta sin costo' : 'What We’ll Cover on Your Complimentary Call'}</h2>
      <p>{futureEducation
        ? (es ? 'Revisaremos tus preguntas sobre costos y qué información de ayuda económica conviene confirmar.' : 'We’ll review your cost questions and which financial aid details to confirm.')
        : consult}</p>
      <div className="premium-question-actions">
        <button type="button" className="premium-secondary" onClick={onBack}>{es ? 'Atrás' : 'Back'}</button>
        <button type="button" className="premium-button" onClick={onBook}>
          {es ? 'Revisar mis opciones de préstamos estudiantiles' : 'Review My Student Loan Options'}
        </button>
      </div>
    </>
  );
}
