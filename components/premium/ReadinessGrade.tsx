import {readinessRatingLabel,type ReadinessRating} from '../../modules/reportCard/readinessRating';
export default function ReadinessGrade({rating,locale='en'}:{rating:ReadinessRating;locale?:'en'|'es'}){
 const es=locale==='es';
 return <section className="premium-grade" aria-label={es?'Calificación final de preparación':'Final readiness grade'}>
  <h2>{es?'Tu calificación preliminar':'Your Preliminary Grade'}</h2>
  <strong>{readinessRatingLabel(rating,locale)}{rating.score!==null?` · ${rating.score}/100`:''}</strong>
  <p>{rating.code==='NA'?(es?'Las verificaciones no aplican según tus respuestas. Puedes revisar otras prioridades durante tu consulta.':'These checks do not apply based on your answers. You can discuss other priorities during your consultation.'):rating.code==='PENDING'?(es?'Aún no hay respuestas que permitan calcular una nota. Confirma la información con tu asesor.':'No scorable answers were provided yet. Confirm the missing information with your advisor to receive your preliminary grade.'):(es?'Calificación preliminar de preparación basada en tus respuestas.':'Preliminary planning-readiness grade based on your answers.')}</p>
  {rating.known>0 && rating.known<rating.applicable && <p><strong>{es?'Información por confirmar:':'Information to confirm:'}</strong> {rating.applicable-rating.known} {es?'verificaciones sin información. La nota puede cambiar al confirmar los detalles.':'checks have missing information. Your preliminary grade may change when these details are confirmed.'} ({rating.known}/{rating.applicable} {es?'conocidas':'known'})</p>}
  <p>{es?'Rúbrica: actualizado = 100; parcial = 50; no atendido = 0. La nota usa únicamente las respuestas conocidas. Lo desconocido no se puntúa; lo no aplicable se excluye.':'Rubric: current/reviewed = 100; partial = 50; not addressed = 0. The grade uses only the known answers. Unknown answers are unscored; not-applicable checks are excluded.'} {rating.scale === 'wellness' ? 'A 90–100 · B 75–89 · C 60–74 · D 40–59 · F 0–39.' : 'A ≥90, B ≥80, C ≥70, D ≥60, F <60.'}</p>
  <p>{es?'No determina elegibilidad, suficiencia de cobertura ni salud financiera.':'This does not determine eligibility, coverage adequacy or financial health.'}</p>
 </section>;
}
