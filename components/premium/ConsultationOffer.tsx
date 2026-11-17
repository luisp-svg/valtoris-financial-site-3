export default function ConsultationOffer({locale}:{locale:'en'|'es'}) {
 const es=locale==='es';
 return <aside className="premium-report" aria-label={es?'Qué incluye tu revisión':'What your review includes'}>
  <h3>{es?'Tu revisión de Report Card de 30 minutos con Luis Perez':'Your 30-minute Report Card Review with Luis Perez'}</h3>
  <p>{es?'Sin costo y sin obligación de comprar. Usaremos tus respuestas guardadas para centrarnos en tus dos prioridades principales.':'Complimentary, with no obligation to buy. We’ll use your saved answers to focus on your two leading priorities.'}</p>
  <ul>
   <li>{es?'Aclarar qué está establecido y qué información falta confirmar.':'Clarify what is established and what information still needs confirmation.'}</li>
   <li>{es?'Definir dónde pueden ayudar Luis y tus profesionales actuales, incluidos tu contador, abogado o asesor.':'Identify where Luis and your existing professionals—including your CPA, attorney or adviser—can help.'}</li>
   <li>{es?'Acordar una lista breve de prioridades, responsables y siguientes pasos.':'Agree on a short priority list, who to involve and the next steps.'}</li>
  </ul>
  <p>{es?'Antes de cualquier implementación, explicaremos el alcance propuesto, los costos y la compensación aplicable para que puedas decidir. Las decisiones fiscales y legales corresponden a profesionales calificados. No necesitas números de cuenta ni documentos para reservar.':'Before any implementation, we’ll explain the proposed scope, applicable costs and compensation so you can decide. Tax and legal decisions remain with qualified professionals. You don’t need account numbers or documents to book.'}</p>
 </aside>;
}
