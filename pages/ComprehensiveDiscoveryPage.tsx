import ReadinessGrade from "../components/premium/ReadinessGrade";
import {useHomeDocumentMeta} from "../components/publicSite/home/useHomeDocumentMeta";
import {usePublicDocumentLang} from "../components/publicSite/usePublicDocumentLang";
import {useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import AssessmentBrandHeader from '../components/AssessmentBrandHeader';
import {US_STATES} from '../components/assessment/constants';
import type {discoveryPlan,discoverySummary} from '../modules/reportCard/funnelStrategy';
import {validCombinedQuestion} from '../modules/reportCard/combined/engine';
import type {ShortDiagnostic} from '../modules/reportCard/shortForm/contract';
import '../components/premium/premium.css';
import '../components/premium/atelier.css';
type Plan=ReturnType<typeof discoveryPlan>;
export default function ComprehensiveDiscoveryPage(){
 const {search}=useLocation(),params=new URLSearchParams(search),id=params.get('assessment')??'',scope=params.get('scope')==='business'?'business':'family',locale=params.get('lang')==='es'?'es':'en',es=locale==='es';
 const t=(en:string,spanish:string)=>es?spanish:en;
 const [plan,setPlan]=useState<Plan|null>(null),[diagnostic,setDiagnostic]=useState<ShortDiagnostic>({}),[step,setStep]=useState(0),[summary,setSummary]=useState<ReturnType<typeof discoverySummary>|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 usePublicDocumentLang(locale);
 useHomeDocumentMeta({metaTitle:scope==='family'?'Family Financial Report Card | Valtoris Financial':'Business Owner Financial Report Card | Valtoris Financial',metaDescription:'Optional private comprehensive financial discovery.'});
 const sending=useRef(false),heading=useRef<HTMLHeadingElement>(null);
 const endpoint='/api/ingest-family-report-card?flow=premium';
 useEffect(()=>{
  const controller=new AbortController();setPlan(null);setStep(0);setSummary(null);setDiagnostic({});setError('');
  void fetch(`${endpoint}&action=discovery&${new URLSearchParams({assessment:id,scope})}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal})
  .then(async response=>{const data=await response.json();if(!response.ok||!data.ok)throw Error();if(!controller.signal.aborted){setPlan(data);if(data.completed)setSummary(data.summary)}})
  .catch(()=>{if(!controller.signal.aborted)setError(es?'Abre esta revisión desde tus resultados guardados.':'Open this review from your saved assessment results.');});
  return()=>controller.abort();
 },[id,scope,es]);
 useEffect(()=>{heading.current?.focus()},[step,summary]);
 const q=plan?.questions[step];
 async function next(){
  if(!plan||sending.current)return;
  if(q&&!validCombinedQuestion(q,diagnostic[q.id])){setError(t('Please choose an answer.','Selecciona una respuesta.'));return}
  setError('');
  if(q&&step<plan.questions.length-1){setStep(s=>s+1);return}
  sending.current=true;setBusy(true);
  try{
   const response=await fetch(`${endpoint}&action=save-discovery`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId:id,scope,diagnostic}),signal:AbortSignal.timeout(20000)});
   const data=await response.json();if(!response.ok||!data.ok)throw Error();setSummary(data.summary);
  }catch{setError(t('Your answers remain here. Please retry. Your booking remains available from your results.','Tus respuestas permanecen aquí. Intenta de nuevo. Tu reserva sigue disponible desde tus resultados.'))}
  finally{sending.current=false;setBusy(false)}
 }
 return <main className="premium-assessment"><header className="premium-assessment-header"><AssessmentBrandHeader/></header><div className="premium-assessment-inner">
 <p className="premium-kicker">{t('OPTIONAL COMPREHENSIVE DISCOVERY','REVISIÓN INTEGRAL OPCIONAL')}</p>
 <h1 ref={heading} tabIndex={-1}>{scope==='family'?t('Family Financial Report Card','Report Card Financiero Familiar'):t('Business Owner Financial Report Card','Report Card Financiero Empresarial')}</h1>
 <p>{t('You can book now or complete this later. Your previous answers carry forward. No new contact details or marketing permission are requested.','Puedes reservar ahora o completar esto después. Conservamos tus respuestas anteriores. No pedimos de nuevo datos de contacto ni permisos publicitarios.')}</p>
 <Link className="premium-secondary" to={`/assessment-results?assessment=${encodeURIComponent(id)}&lang=${locale}`}>{t('Return to Results & Complimentary Booking','Volver a resultados y reserva sin costo')}</Link>
 {error&&<p role="alert">{error}</p>}
 {summary?<section className="premium-question-card"><h2>{t('Saved for Your Advisor','Guardado para tu asesor')}</h2><p>{t('Both stages are together in your original prospect record. These are discussion topics to verify, not product recommendations.','Ambas etapas están juntas en tu registro original. Son temas para confirmar, no recomendaciones de productos.')}</p><ul>{summary.opportunities.map(o=><li key={o.service}>{o.title} — {es?'Revisar información y prioridades durante la consulta.':o.nextStep}</li>)}</ul><details><summary>{t('Your discovery answers','Tus respuestas')}</summary><dl>{summary.answerRows.map(row=><div key={row.id}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></details><ReadinessGrade rating={summary.rating} locale={locale}/></section>:plan?<section className="premium-question-card"><p>{plan.total} {t('questions in this review','preguntas en esta revisión')} · {plan.reused.length} {t('already answered and carried forward','ya respondidas y conservadas')}</p>{q?<><p>{t('New question','Pregunta nueva')} {step+1}/{plan.questions.length}</p><label className="premium-field">{q.question.label[locale]}<select value={String(diagnostic[q.id]??'')} onChange={event=>setDiagnostic(d=>({...d,[q.id]:event.target.value}))} disabled={busy}><option value="">{t('Choose an answer','Selecciona una respuesta')}</option>{q.question.kind==='state'?US_STATES.map(state=><option key={state.value} value={state.value}>{state.label}</option>):q.question.options?.map(option=><option key={option.value} value={option.value}>{option.label[locale]}</option>)}</select></label></>:<p>{t('All answers already carry forward. Save to add this discovery view to your advisor workflow.','Todas las respuestas ya están conservadas. Guarda para agregar esta revisión al flujo de tu asesor.')}</p>}{step>0&&<button className="premium-secondary" disabled={busy} onClick={()=>setStep(s=>s-1)}>{t('Back','Atrás')}</button>}<button className="premium-button" disabled={busy} onClick={()=>void next()}>{busy?t('Saving…','Guardando…'):q&&step<plan.questions.length-1?t('Continue','Continuar'):t('Save Discovery','Guardar revisión')}</button></section>:!error?<p role="status">{t('Loading your previous answers…','Cargando tus respuestas anteriores…')}</p>:null}
 </div></main>
}
