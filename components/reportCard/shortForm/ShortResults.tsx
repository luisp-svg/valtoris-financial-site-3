import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AssessmentBrandHeader from '../../AssessmentBrandHeader'
import SpecializedLocaleSwitcher, { useSpecializedDocumentLang } from '../../assessment/specialized/SpecializedLocaleSwitcher'
import { readSpecializedLocale, withSpecializedLocale } from '../../assessment/specialized/locale'
import { SHORT_CARDS, type Locale } from '../../../modules/reportCard/shortForm/catalog'
import { isShortForm, validQuestion, visibleQuestions, type ShortDiagnostic } from '../../../modules/reportCard/shortForm/contract'
import { buildShortResult, shortAnswerRows, type ShortResult } from '../../../modules/reportCard/shortForm/results'
import type { PublicReportCardAssessmentType } from '../../../modules/reportCard/publicIngestCatalog'
import './shortForm.css'

export function ShortResultBody({result,locale='en'}:{result:ShortResult;locale?:Locale}) {
  const es=locale==='es'
  return <><p>{result.limitations[locale]}</p>{result.metrics.length?<section aria-label={es?'Cálculos simples':'Simple calculations'}>{result.metrics.map(metric=><div key={metric.id}><h3>{metric.label[locale]}</h3><p className="short-metric">{new Intl.NumberFormat(es?'es-US':'en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(metric.value)}{metric.unit==='USD/month'?(es?' / mes':' / month'):''}</p></div>)}</section>:null}<section><h2>{es?'Observaciones y próximos pasos':'Observations and next steps'}</h2>{result.findings.map(f=><article key={f.id}><p>{f.status==='unknown'?(es?'Información por confirmar':'Information to confirm'):f.status==='review'?(es?'Tema para revisar':'Review topic'):(es?'Según tus respuestas':'Based on your answers')}</p><h3>{f.title[locale]}</h3><p>{f.detail[locale]}</p></article>)}</section></>
}
function loadSession(state:unknown,key:string):unknown {
  if(state&&typeof state==='object'&&'answers' in state)return (state as {answers:unknown}).answers
  try {const raw=sessionStorage.getItem(key);return raw?JSON.parse(raw):null}catch{return null}
}
export default function VersionedReportResults({assessmentType,legacy}:{assessmentType:PublicReportCardAssessmentType;legacy:ReactNode}) {
  const location=useLocation(),locale=readSpecializedLocale(location.search),card=SHORT_CARDS[assessmentType]
  useSpecializedDocumentLang(locale)
  const heading=useRef<HTMLHeadingElement>(null)
  const saved=loadSession(location.state,card.storageKey)
  const short=isShortForm(saved)
  useEffect(()=>{if(short){window.scrollTo(0,0);heading.current?.focus({preventScroll:true})}},[assessmentType,short])
  if(!isShortForm(saved)) return <>{legacy}</>
  const diagnostic=saved.diagnostic
  const valid=saved.assessmentType===assessmentType&&diagnostic&&typeof diagnostic==='object'&&!Array.isArray(diagnostic)&&visibleQuestions(assessmentType,diagnostic).every(q=>validQuestion(q,diagnostic[q.id]))
  return <div className="short-results"><AssessmentBrandHeader/><SpecializedLocaleSwitcher locale={locale} groupLabel={locale==='es'?'Idioma':'Language'} englishLabel="English" spanishLabel="Español"/><h1 ref={heading} tabIndex={-1}>{card.title[locale]}</h1>{valid?<><ShortResultBody result={buildShortResult(assessmentType,diagnostic)} locale={locale}/><section><h2>{locale==='es'?'Tus respuestas':'Your answers'}</h2><dl>{shortAnswerRows(assessmentType,diagnostic as ShortDiagnostic,locale).map(row=><div key={row.id}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></section><p>{locale==='es'?'Puedes revisar los detalles pendientes en una conversación opcional con un asesor.':'You can review deferred details in an optional advisor conversation.'}</p><Link to={withSpecializedLocale('/schedule',locale,location.search)}>{locale==='es'?'Programar una revisión opcional':'Schedule an optional review'}</Link></>:<p role="status">{locale==='es'?'No pudimos cargar estas respuestas. Comienza una nueva revisión.':'These answers could not be loaded. Start a new review.'}</p>}<p><Link to={withSpecializedLocale(card.assessmentPath,locale,location.search)}>{locale==='es'?'Comenzar una nueva revisión':'Start a new review'}</Link></p></div>
}
