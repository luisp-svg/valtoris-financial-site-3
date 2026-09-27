import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AssessmentLayout from '../../assessment/AssessmentLayout'
import SpecializedLocaleSwitcher, { useSpecializedDocumentLang } from '../../assessment/specialized/SpecializedLocaleSwitcher'
import { readSpecializedLocale, withSpecializedLocale } from '../../assessment/specialized/locale'
import FamilyConsentSection from '../../assessment/steps/FamilyConsentSection'
import { US_STATES } from '../../assessment/constants'
import { SHORT_CARDS, SHORT_FORM_FORMAT } from '../../../modules/reportCard/shortForm/catalog'
import { updateShortAnswer, validQuestion, validateShortAnswers, visibleQuestions, type ShortAnswers, type ShortDiagnostic } from '../../../modules/reportCard/shortForm/contract'
import { REPORT_PATH_BY_ASSESSMENT, type PublicReportCardAssessmentType } from '../../../modules/reportCard/publicIngestCatalog'
import { completePublicReportCardCrmSubmission } from '../familyIngest/completeFamilyReportCardSubmission'
import { beginNewFamilyAssessmentSession, createEmptyFamilyIngestSession, ensureFamilySubmissionId } from '../familyIngest/submissionSession'
import { applyPhoneChangeToConsent, INITIAL_FAMILY_CONSENT_STATE, validateRequiredFamilyConsent } from '../familyIngest/familyConsent'
import './shortForm.css'

export default function ShortAssessment({ assessmentType }: { assessmentType: PublicReportCardAssessmentType }) {
  const location = useLocation(), navigate = useNavigate(), locale = readSpecializedLocale(location.search)
  useSpecializedDocumentLang(locale)
  const es = locale === 'es', t = (en: string, spanish: string) => es ? spanish : en
  const card = SHORT_CARDS[assessmentType], storageKey = `valtoris-${assessmentType}-short-v3-ingest`
  const [diagnostic, setDiagnostic] = useState<ShortDiagnostic>({})
  const [contact, setContact] = useState({ fullName: '', email: '', phone: '' })
  const [step, setStep] = useState(-1), [consent,setConsent] = useState({...INITIAL_FAMILY_CONSENT_STATE})
  const [honeypot,setHoneypot] = useState(''), [busy,setBusy] = useState(false), [locked,setLocked] = useState(false), [error,setError] = useState('')
  const [showErrors,setShowErrors] = useState(false)
  const session = useRef(createEmptyFamilyIngestSession()), inFlight = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const questions = visibleQuestions(assessmentType,diagnostic), question = questions[step], total=questions.length+3
  const atContact=step>=questions.length, welcome=step<0
  useEffect(()=>{ heading.current?.focus() },[step])
  function begin() {
    session.current=beginNewFamilyAssessmentSession({search:location.search,referrer:document.referrer||null,storageKey})
    setStep(0)
  }
  function change(value: string|string[]) { if (!question || locked) return; setDiagnostic(d=>updateShortAnswer(assessmentType,d,question.id,value)); setShowErrors(false); setError('') }
  async function next() {
    if(inFlight.current) return
    if(!atContact) {
      if (!validQuestion(question,diagnostic[question.id])) {setShowErrors(true);return}
      setStep(step+1);setShowErrors(false);return
    }
    const answers: ShortAnswers={format:SHORT_FORM_FORMAT,assessmentType,diagnostic,contact}
    if(!validateShortAnswers(assessmentType,answers)||!validateRequiredFamilyConsent(consent).ok) {setShowErrors(true);setError(t('Review your answers, full name, email and required acknowledgments. Retirement age cannot be earlier than current age.','Revisa tus respuestas, nombre completo, correo y confirmaciones obligatorias. La edad de jubilación no puede ser menor que la edad actual.'));return}
    session.current=ensureFamilySubmissionId(session.current,undefined,storageKey).session
    inFlight.current=true;setBusy(true);setLocked(true);setError('')
    try {
      const completed=await completePublicReportCardCrmSubmission({assessmentType,answers,consent,session:session.current,honeypotWebsite:honeypot,storageKey,phone:contact.phone})
      session.current=completed.session
      if(!completed.result.ok) {setError(t('We could not confirm the save. Your answers are kept here. Retry uses the same submission to avoid duplicates.','No pudimos confirmar el guardado. Tus respuestas siguen aquí. Reintentar usa el mismo envío para evitar duplicados.'));return}
      const saved={format:SHORT_FORM_FORMAT,assessmentType,diagnostic}
      try {sessionStorage.setItem(card.storageKey,JSON.stringify(saved))} catch { /* In-memory navigation still works. */ }
      navigate(withSpecializedLocale(REPORT_PATH_BY_ASSESSMENT[assessmentType],locale,location.search),{state:{answers:saved,crmSubmitted:true}})
    } catch {setError(t('The connection was interrupted. Please retry the same submission.','La conexión se interrumpió. Reintenta el mismo envío.'))}
    finally {inFlight.current=false;setBusy(false)}
  }
  const countText=welcome?t(`Up to ${total} questions`,`Hasta ${total} preguntas`):atContact?t(`Questions ${questions.length+1}–${total} of ${total}`,`Preguntas ${questions.length+1}–${total} de ${total}`):t(`Question ${step+1} of ${total}`,`Pregunta ${step+1} de ${total}`)
  return <AssessmentLayout currentStep={welcome?0:Math.min(step,total)} totalSteps={total} stepIndicator={countText} headerExtra={<SpecializedLocaleSwitcher locale={locale} groupLabel={t("Language","Idioma")} englishLabel="English" spanishLabel="Español"/>}
    footer={!welcome?<div className="short-actions"><button type="button" className="button-secondary" disabled={busy||locked} onClick={()=>{setStep(step-1);setShowErrors(false);setError('')}}>{t('Back','Atrás')}</button><button type="button" className="button-primary" disabled={busy} onClick={()=>void next()}>{busy?t('Saving…','Guardando…'):atContact?t(locked?'Retry save':'Save and view my report',locked?'Reintentar guardado':'Guardar y ver mi reporte'):t('Continue','Continuar')}</button></div>:undefined}>
    <div className="short-form">
    <p className="short-kicker">{card.title[locale]}</p>
    {welcome?<><h1 ref={heading} tabIndex={-1}>{t('A clearer first look at your next steps','Un primer vistazo claro a tus próximos pasos')}</h1><p>{t(`Answer up to ${total} questions, including your contact details. Detailed follow-ups belong in your private advisor intake.`,`Responde hasta ${total} preguntas, incluyendo tus datos de contacto. Los detalles adicionales van en el formulario privado con tu asesor.`)}</p><p>{t('This short review provides observations and next steps. It does not assign the old full-report grade or promise eligibility, approval, or outcomes.','Esta revisión breve ofrece observaciones y próximos pasos. No asigna la calificación del reporte completo anterior ni promete elegibilidad, aprobación o resultados.')}</p><button type="button" className="button-primary" onClick={begin}>{t('Start my review','Comenzar mi revisión')}</button></>:question?<>
      <h1 ref={heading} tabIndex={-1} id="short-question-title">{question.label[locale]}</h1>
      {question.unit?<p id="short-question-help">{question.unit[locale]}</p>:null}
      {question.kind==='number'?<div className="short-input"><input aria-labelledby="short-question-title" aria-describedby={question.unit?'short-question-help':undefined} inputMode="decimal" maxLength={14} value={diagnostic[question.id]==='unknown'?'':String(diagnostic[question.id]??'')} disabled={locked||diagnostic[question.id]==='unknown'} onChange={e=>change(e.target.value)} aria-invalid={showErrors||undefined}/><label><input type="checkbox" checked={diagnostic[question.id]==='unknown'} disabled={locked} onChange={e=>change(e.target.checked?'unknown':'')}/>{t('I’m not sure','No sé')}</label></div>:question.kind==='state'?<select aria-labelledby="short-question-title" value={String(diagnostic[question.id]??'')} onChange={e=>change(e.target.value)}><option value="">{t('Select a state','Selecciona un estado')}</option>{US_STATES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}<option value="unknown">{t('Not sure','No sé')}</option></select>:<fieldset className="short-options" aria-labelledby="short-question-title"><legend className="visually-hidden">{question.label[locale]}</legend>{question.options?.map(option=>{
        const value=diagnostic[question.id],checked=question.kind==='multi'?Array.isArray(value)&&value.includes(option.value):value===option.value
        return <label key={option.value} className={checked?'is-selected':''}><input type={question.kind==='multi'?'checkbox':'radio'} name={question.id} value={option.value} checked={checked} disabled={locked} onChange={()=>{
          if(question.kind!=='multi'){change(option.value);return}
          const current=Array.isArray(value)?value:[]
          const nextValue=checked?current.filter(v=>v!==option.value):['none','unknown'].includes(option.value)?[option.value]:[...current.filter(v=>!['none','unknown'].includes(v)),option.value]
          change(nextValue)
        }}/><span>{option.label[locale]}</span></label>
      })}</fieldset>}
      {showErrors?<p role="alert">{t('Choose an answer or enter a valid non-negative amount. “Not sure” is available when you do not know.','Selecciona una respuesta o ingresa una cantidad válida no negativa. Puedes elegir “No sé”.')}</p>:null}
    </>:<><h1 ref={heading} tabIndex={-1}>{t('Your details and results','Tus datos y resultados')}</h1><p>{t('Contact details do not affect your review. Phone and follow-up permission are optional.','Los datos de contacto no afectan tu revisión. El teléfono y el permiso de contacto son opcionales.')}</p>
      <label className="short-contact">{questions.length+1}. {t('Full name (first and last)','Nombre completo (nombre y apellido)')}<input autoComplete="name" maxLength={201} value={contact.fullName} disabled={busy||locked} onChange={e=>setContact({...contact,fullName:e.target.value})}/></label>
      <label className="short-contact">{questions.length+2}. {t('Email','Correo electrónico')}<input type="email" autoComplete="email" maxLength={254} value={contact.email} disabled={busy||locked} onChange={e=>setContact({...contact,email:e.target.value})}/></label>
      <label className="short-contact">{questions.length+3}. {t('Phone (optional)','Teléfono (opcional)')}<input type="tel" autoComplete="tel" maxLength={30} value={contact.phone} disabled={busy||locked} onChange={e=>{setContact({...contact,phone:e.target.value});setConsent(c=>applyPhoneChangeToConsent(c,e.target.value))}}/></label>
      <fieldset disabled={busy||locked} className="short-consent"><FamilyConsentSection consent={consent} phone={contact.phone} onChange={(field,value)=>setConsent(c=>({...c,[field]:value}))} honeypotValue={honeypot} onHoneypotChange={setHoneypot} showErrors={showErrors} missing={validateRequiredFamilyConsent(consent).missing} productTitle={card.title[locale]} storageResultName={card.title[locale]} intro={t('Required acknowledgments are separate from the question count. Follow-up and marketing permissions are optional.','Las confirmaciones obligatorias son separadas de las preguntas. Los permisos de contacto y publicidad son opcionales.')} labels={es?{
        heading:'Confirmaciones',storage:'Entiendo que Valtoris usará mis datos para preparar y guardar mi revisión y sus resultados.',storageHint:'Confirmación obligatoria para guardar la revisión.',storageError:'Confirma el uso y almacenamiento de tus datos.',contact:'Doy permiso a Valtoris para contactarme sobre mis resultados y posibles próximos pasos.',emailMarketing:'Acepto recibir correos de publicidad ocasionales. Puedo cancelar mi suscripción.',sms:'Acepto recibir mensajes de texto publicitarios recurrentes. El consentimiento no es condición para recibir mi reporte. Pueden aplicarse cargos. Responde STOP para cancelar.',smsPhoneNote:'Agrega un teléfono para habilitar esta opción.',privacyBefore:'Confirmo que revisé la',privacyLink:'Política de Privacidad de Valtoris',privacyAfter:'.',privacyHint:'Confirmación de privacidad obligatoria.',privacyError:'Confirma que revisaste la política.',disclaimer:'Revisión educativa basada en tus respuestas. No constituye asesoría financiera, legal, fiscal, crediticia o de seguros ni garantiza resultados.',honeypot:'Sitio web de la empresa'
      }:{disclaimer:'Educational review based on your answers. Not financial, legal, tax, credit, or insurance advice and not a guarantee of outcomes.'}}/></fieldset>
    </>}
    {error?<p role="alert" className="short-error">{error}</p>:null}
    </div>
  </AssessmentLayout>
}
