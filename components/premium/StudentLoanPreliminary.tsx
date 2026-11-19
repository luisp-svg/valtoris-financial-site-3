import type { RefObject } from 'react';

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

export function StudentLoanPreliminary({ locale, goal, heading, onBook, onBack }: {
  locale: 'en' | 'es';
  goal: unknown;
  heading: RefObject<HTMLHeadingElement>;
  onBook: () => void;
  onBack: () => void;
}) {
  const es = locale === 'es';
  const topic = typeof goal === 'string' && Object.hasOwn(nextSteps, goal)
    ? goal as keyof typeof nextSteps
    : 'unknown';
  const [title, action] = nextSteps[topic][es ? 1 : 0];

  return (
    <>
      <p className="premium-step-count">{es ? 'Tu resultado preliminar' : 'Your preliminary result'}</p>
      <h1 ref={heading} tabIndex={-1}>{title}</h1>
      <p>{action}</p>
      <p>{es
        ? 'En tu consulta sin costo, revisaremos tu inquietud, qué datos faltan y qué opciones vale la pena verificar.'
        : 'In your complimentary consultation, we’ll review your concern, what information is missing, and which options are worth checking.'}</p>
      <div className="premium-question-actions">
        <button type="button" className="premium-secondary" onClick={onBack}>{es ? 'Atrás' : 'Back'}</button>
        <button type="button" className="premium-button" onClick={onBook}>
          {es ? 'Revisar mis opciones de préstamos estudiantiles' : 'Review My Student Loan Options'}
        </button>
      </div>
    </>
  );
}
