import { SPECIALTY_CARDS, type Answers, type Specialty } from './catalog.js'
import { visibleQuestions, valid, error, report } from './engine.js'
import { gradeReport } from './grading.js'
import { validShortContact } from '../shortForm/contract.js'
export const GUIDED_REPORT_VERSION=4
export const GUIDED_REPORT_FORMAT='guided-report-v4' as const
export type GuidedReportAnswers={format:typeof GUIDED_REPORT_FORMAT;assessmentType:Specialty;diagnostic:Answers;contact:{fullName:string;email:string;phone:string};locale:'en'|'es'}
export function isGuidedReport(raw:unknown):raw is GuidedReportAnswers{return !!raw&&typeof raw==='object'&&(raw as {format?:unknown}).format===GUIDED_REPORT_FORMAT}
const plain=(raw:unknown):raw is Record<string,unknown>=>!!raw&&typeof raw==='object'&&!Array.isArray(raw)&&(Object.getPrototypeOf(raw)===Object.prototype||Object.getPrototypeOf(raw)===null)
export function validateGuidedReport(type:string,raw:unknown):GuidedReportAnswers|null{
 if(!Object.prototype.hasOwnProperty.call(SPECIALTY_CARDS,type)||!plain(raw)||!isGuidedReport(raw)||raw.assessmentType!==type||Object.keys(raw).some(k=>!['format','assessmentType','diagnostic','contact','locale'].includes(k)))return null
 if(!['en','es'].includes(raw.locale)||!plain(raw.diagnostic)||!plain(raw.contact)||Object.keys(raw.contact).some(k=>!['fullName','email','phone'].includes(k)))return null
 if(!(['fullName','email','phone'] as const).every(k=>typeof raw.contact[k]==='string')||!validShortContact(raw.contact))return null
 const active=visibleQuestions(raw.assessmentType,raw.diagnostic),ids=new Set(active.map(q=>q.id))
 if(Object.keys(raw.diagnostic).some(k=>!ids.has(k))||active.some(q=>!valid(q,raw.diagnostic[q.id]))||error(raw.assessmentType,raw.diagnostic))return null
 return {format:GUIDED_REPORT_FORMAT,assessmentType:raw.assessmentType,locale:raw.locale,diagnostic:raw.diagnostic,contact:{fullName:raw.contact.fullName.trim(),email:raw.contact.email.trim(),phone:raw.contact.phone.trim()}}
}
export function guidedResult(type:Specialty,diagnostic:Answers,locale:'en'|'es'='en'){
 const result=report(type,diagnostic),grade=gradeReport(type,diagnostic)
 const display=(id:string)=>{const q=SPECIALTY_CARDS[type].questions.find(q=>q.id===id)!;const value=diagnostic[id];return value==='unknown'?(locale==='es'?'No sé':'Not sure'):Array.isArray(value)?value.map(v=>q.options?.find(o=>o[0]===v)?.[locale==='es'?2:1]??v).join(', '):q.options?.find(o=>o[0]===value)?.[locale==='es'?2:1]??value}
 return {version:GUIDED_REPORT_VERSION,kind:'guided-report-review' as const,grade,overallScore:grade.provisional?null:grade.score,overallGrade:grade.provisional?null:grade.letter,priorities:result.review.map(q=>({level:'review',title:q.label[locale],why:q.next[locale],timeline:'Advisor review'})),critical:result.critical.map(q=>({id:q.id,title:q.label[locale],detail:q.next[locale]})),unknown:result.unknown.map(q=>({id:q.id,label:q.label[locale],next:q.next[locale]})),pathways:result.pathways,answerRows:visibleQuestions(type,diagnostic).map(q=>({id:q.id,label:q.label[locale],value:display(q.id)}))}
}
