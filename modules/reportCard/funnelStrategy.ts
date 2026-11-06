import { familyAreas, businessAreas } from './combined/cardProfiles.js';
import { ROUTES } from '../../constants/routes.js';
import {readinessRating} from './readinessRating.js';
import { combinedQuestions, PRIORITIES, validCombinedQuestion, type CombinedAnswers, type Priority } from './combined/engine.js';
import type { ShortDiagnostic } from './shortForm/contract.js';
export const specializedFunnels: {id:string;title:[string,string];selected:Priority[];path:string;directOnly?:true}[] = [
 {id:'family',title:['Family Financial Report Card','Report Card Financiero Familiar'],selected:familyAreas,path:ROUTES.reportCard},
 {id:'business',title:['Business Owner Financial Report Card','Report Card para Dueños de Negocios'],selected:businessAreas,path:ROUTES.businessReportCard},
 {id:'student_loan',title:['Student Loans','Préstamos estudiantiles'],selected:['student_loan'],path:'/student-loan-report-card'},
 {id:'health',title:['Health & Disability','Salud y discapacidad'],selected:['health','protection'],path:'/health-insurance-report-card'},
 {id:'trucking',title:['Commercial Trucking','Transporte comercial'],selected:['trucking'],directOnly:true,path:'/commercial-trucking-report-card'},
 {id:'home_buyer',title:['Home Buyer Readiness','Preparación para comprar vivienda'],selected:['home_buyer'],path:'/home-buyer-report-card'},
 {id:'retirement',title:['Retirement, TSP & Government Benefits','Jubilación, TSP y beneficios gubernamentales'],selected:['retirement'],path:'/retirement-report-card'},
 {id:'life',title:['Life Insurance / Protection Gap','Seguro de vida / brecha de protección'],selected:['family','protection'],path:'/life-insurance-report-card'},
 {id:'credit',title:['Credit Repair & Readiness','Reparación y preparación crediticia'],selected:['credit'],path:ROUTES.creditReportCard},
];
export const mainReportCards = specializedFunnels.slice(0, 2);
export const supportingReportCards = specializedFunnels.filter(card => ['health', 'student_loan', 'retirement', 'home_buyer', 'credit'].includes(card.id));
export const publicReportCards = [...mainReportCards, ...supportingReportCards];

export function reportCardForFocus(focus: string | null | undefined) {
 const aliases: Record<string, string> = {
  lifestyle: 'family', tax: 'family', commercial: 'business', benefits: 'business', tsp: 'retirement', protection: 'life',
 };
 return specializedFunnels.find(card => card.id === (focus ? aliases[focus] ?? focus : focus));
}

export type DiscoveryScope='family'|'business';
export function discoveryQuestions(scope:DiscoveryScope) {
 const types:Priority[]=scope==='family'?['student_loan','health','family','protection','lifestyle','credit','home_buyer','retirement','tsp','tax']:PRIORITIES.map(p=>p.id);
 const shared=combinedQuestions(types,{}).filter(q=>q.id.startsWith('shared.'));
 const reviews:Priority[]=scope==='family'?['family','protection','retirement','tax','health','student_loan']:['family','protection','business','benefits'];
 return [...shared,...types.map(type=>{const q=combinedQuestions([type],{}).find(q=>q.id===type+'.status')!;return {...q,question:{...q.question,options:[...q.question.options!,{value:'not_applicable',label:{en:'Not applicable to my situation',es:'No aplica a mi situación'}}]}}}),...reviews.map(type=>{const q=combinedQuestions([type],{}).find(q=>q.id===type+'.review')!;return {...q,question:{...q.question,options:[...q.question.options!,{value:'not_applicable',label:{en:'Not applicable to my situation',es:'No aplica a mi situación'}}]}}})];
}
export function discoverySeed(answers:CombinedAnswers,previous:unknown={}):ShortDiagnostic {
 const prior=previous&&typeof previous==='object'&&!Array.isArray(previous)?previous as ShortDiagnostic:{};
 // Original answers always win, including unknown: never ask the same question twice.
 const seed={...prior,...answers.diagnostic};
 if(seed['student_loan.loan_type']==='none'){seed['student_loan.status']='not_applicable';seed['student_loan.review']='not_applicable'}
 return seed;
}
export function discoveryPlan(scope:DiscoveryScope,answers:CombinedAnswers,previous?:unknown){
 const questions=discoveryQuestions(scope),seed=discoverySeed(answers,previous);
 const reused=questions.filter(q=>validCombinedQuestion(q,seed[q.id]));
 return {scope,total:questions.length,reused:reused.map(q=>q.id),questions:questions.filter(q=>!reused.includes(q)),seed};
}
export function validateDiscovery(scope:DiscoveryScope,answers:CombinedAnswers,input:unknown,previous?:unknown):ShortDiagnostic|null {
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const data=input as ShortDiagnostic,plan=discoveryPlan(scope,answers,previous),allowed=new Set(plan.questions.map(q=>q.id));
 if(Object.keys(data).some(id=>!allowed.has(id))||plan.questions.some(q=>!validCombinedQuestion(q,data[q.id])))return null;
 const merged={...plan.seed,...data};
 return Object.fromEntries(discoveryQuestions(scope).map(q=>[q.id,merged[q.id]]));
}
export function discoverySummary(scope:DiscoveryScope,diagnostic:ShortDiagnostic,locale:'en'|'es'='en') {
 const questions=discoveryQuestions(scope);
 const answerRows=questions.map(q=>({id:q.id,label:q.question.label[locale],value:q.question.options?.find(o=>o.value===diagnostic[q.id])?.label[locale]??String(diagnostic[q.id]??'unknown')}));
 const opportunities=questions.filter(q=>q.id.endsWith('.status')&&!['current','not_applicable'].includes(String(diagnostic[q.id]))).map(q=>({service:q.reviews[0],title:PRIORITIES.find(p=>p.id===q.reviews[0])![locale],reason:diagnostic[q.id]==='unknown'?'Confirm missing information':'Review reported planning gap',nextStep:'Discuss priorities and verify records during the complimentary consultation'}));
 return {rating:readinessRating(questions.filter(q=>/\.(status|review)$/.test(q.id)).map(q=>diagnostic[q.id])),answerRows,opportunities,nextStep:'Confirm priorities, review supporting records, and agree on next steps with the advisor. No product recommendation or referral has been made.'};
}

export function readDiscoverySummary(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return undefined;
 const value=raw as Record<string,unknown>;
 if((value.scope!=='family'&&value.scope!=='business')||!value.diagnostic||typeof value.diagnostic!=='object'||Array.isArray(value.diagnostic))return undefined;
 const d=value.diagnostic as ShortDiagnostic;
 if(discoveryQuestions(value.scope).some(q=>!validCombinedQuestion(q,d[q.id])))return undefined;
 return {scope:value.scope,completedAt:typeof value.completedAt==='string'?value.completedAt:null,...discoverySummary(value.scope,d)};
}
const retirementPreparation = {
 private: ['Bring statements for your workplace plans and IRAs.', 'Trae los estados de cuenta de tus planes de trabajo e IRA.'],
 federal: ['Bring your latest TSP statement and any federal or military pension estimate.', 'Trae tu estado de cuenta más reciente del TSP y cualquier estimación de pensión federal o militar.'],
 both: ['Bring statements for your TSP, workplace plans and IRAs, plus any federal or military pension estimate.', 'Trae los estados de cuenta de tu TSP, planes de trabajo e IRA, además de cualquier estimación de pensión federal o militar.'],
} as const;

export function specializedNextSteps(answers:CombinedAnswers){
 const path = answers.diagnostic['retirement.path'];
 const retirementStep = path === 'private' || path === 'federal' || path === 'both'
  ? retirementPreparation[path][answers.locale === 'es' ? 1 : 0]
  : undefined;
 const fundingPurpose = answers.diagnostic['business.funding.purpose'];
 const fundingStep = typeof fundingPurpose === 'string' && !['none', 'unknown'].includes(fundingPurpose)
  ? answers.locale === 'es'
    ? 'Prepara tus estados bancarios y financieros recientes y calcula cuánto financiamiento necesita tu negocio.'
    : 'Gather recent business bank statements and financial statements, and estimate how much funding the business needs.'
  : undefined;
 return answers.selected.map(service=>({service,title:PRIORITIES.find(p=>p.id===service)![answers.locale],text:service === 'retirement' && retirementStep ? retirementStep : service === 'business' && fundingStep ? fundingStep : answers.locale==='es'?'Prepara los registros actuales y tus preguntas. Confirma la información faltante con tu asesor durante la consulta sin costo.':service==='student_loan'?'Gather current servicer statements and identify federal versus private loans. Discuss payment concerns and options with your advisor before making changes.':service==='health'?'Prepare your current benefits summary and any coverage-change date. Discuss provider networks and total costs with a licensed professional.':service==='trucking'?'Prepare policy summaries, operating details and renewal dates. Ask a licensed agent to review cargo, drivers and required filings.':'Prepare current records, coverage summaries or planning documents. Confirm reported gaps and missing information during your complimentary consultation.'}));
}
