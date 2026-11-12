import { mainReportCard } from './cardProfiles.js';
import { isProtectionArea, protectionEstimate } from './protectionCalculator.js';
import {readinessRating, type ReadinessRating} from '../readinessRating.js';
import { combinedResults as legacyResults } from './legacyResults.js';
import { COMBINED_FORMAT, PRIORITIES, combinedQuestions, type CombinedAnswers } from './engine.js';
export type PreparationGrade={score:number|null;grade:string|null;status:'preliminary'|'needs-review';known:number;total:number};
const letter=(score:number)=>score>=90?'A':score>=80?'B':score>=70?'C':score>=60?'D':'F';
const wellnessLetter=(score:number)=>score>=90?'A':score>=75?'B':score>=60?'C':score>=40?'D':'F';

function reportRating(values: unknown[], useWellnessScale: boolean): ReadinessRating {
 const rating = readinessRating(values);
 if (!useWellnessScale) return rating;
 return { ...rating, scale: 'wellness', code: rating.score === null ? rating.code : wellnessLetter(rating.score) };
}
export function adaptiveReportCard(answers:Pick<CombinedAnswers,'format'|'selected'|'diagnostic'|'locale'|'consultationOnly'|'insuranceRoutingVersion'|'strategyVersion'|'cardVersion'|'planningVersion'|'familySupplementVersion'>){
 if(answers.consultationOnly||answers.format!==COMBINED_FORMAT)return null;
 const questions=combinedQuestions(answers.selected,answers.diagnostic,answers.insuranceRoutingVersion,answers.strategyVersion,answers.cardVersion,answers.familySupplementVersion,answers.planningVersion);
 const profile = answers.cardVersion === 1 ? mainReportCard(answers.selected) : undefined;
 const scoredAreasBase = answers.cardVersion === 1
  ? answers.selected.filter(type => !isProtectionArea(type) || profile === 'family')
  : answers.selected;
 const scoredAreas = answers.planningVersion === 1 && profile === 'family' ? [...scoredAreasBase, 'health' as const] : answers.planningVersion === 1 && profile === 'business' ? [...scoredAreasBase, 'retirement' as const] : scoredAreasBase;
 if (!scoredAreas.length) return null;
 const scoringValues: unknown[] = [];
 const categories=scoredAreas.map(type=>{
  const indicators=questions.filter(q=>q.reviews.includes(type)&&!q.id.startsWith('owner_estate.')&&/\.(status|review)$/.test(q.id));
  const values=indicators.map(q=>answers.diagnostic[q.id]);
  if (answers.planningVersion === 1 && profile === 'family' && type === 'health') {
   values.push(({ all:'current', some:'partial', none:'missing' } as Record<string,string>)[String(answers.diagnostic['family_health.coverage'])] ?? 'unknown');
   values.push(({ yes:'missing', no:'current' } as Record<string,string>)[String(answers.diagnostic['family_health.cost_difficulty'])] ?? 'unknown');
  }
  if (answers.planningVersion === 1 && profile === 'family' && type === 'credit' && answers.diagnostic['family_loans.has_loans'] !== 'no') {
   values.push(({ current:'current', deferred:'partial', late:'missing', mixed:'partial' } as Record<string,string>)[String(answers.diagnostic['family_loans.repayment'])] ?? 'unknown');
  }
  scoringValues.push(...(profile === 'business' && type === 'benefits' && answers.diagnostic['benefits.workforce'] === 'none' ? ['not_applicable'] : values));
  const points=values.flatMap(v=>v==='current'?[100]:v==='partial'?[50]:v==='missing'?[0]:[]);
  const rating=reportRating(profile === 'business' && type === 'benefits' && answers.diagnostic['benefits.workforce'] === 'none'
   ? ['not_applicable']
   : values, Boolean(profile));
  const score=answers.strategyVersion===1?rating.score:points.length?Math.round(points.reduce((a,b)=>a+b,0)/points.length):null;
  return {id:type as string,rating,type,title:answers.planningVersion === 1 && profile === 'family' && type === 'health' ? (answers.locale === 'es' ? 'Salud y discapacidad' : 'Health & Disability') : answers.planningVersion === 1 && profile === 'family' && type === 'credit' ? (answers.locale === 'es' ? 'Crédito y préstamos estudiantiles' : 'Credit & Student Loans') :profile === 'family' && type === 'family' ? (answers.locale === 'es' ? 'Flujo de efectivo, ahorros y patrimonio' : 'Cash Flow, Savings & Estate Basics') : profile === 'family' && type === 'protection' ? (answers.locale === 'es' ? 'Preparación de seguro de vida' : 'Life Insurance Readiness') : PRIORITIES.find(p=>p.id===type)![answers.locale],score,grade:score===null?null:profile?wellnessLetter(score):letter(score),status:points.length<2?'needs-review' as const:'preliminary' as const,known:points.length,total:answers.strategyVersion===1?rating.applicable:indicators.length};
 });
 if (answers.planningVersion === 1 && profile === 'business') {
  const values = questions.filter(q => q.id.startsWith('owner_estate.')).map(q => answers.diagnostic[q.id]);
  scoringValues.push(...values);
  const rating = reportRating(values, true);
  categories.push({ id:'estate_exit', type:'business', title:answers.locale === 'es' ? 'Planificación patrimonial y estrategia de salida' : 'Estate Planning & Exit Strategy', rating, score:rating.score, grade:rating.score === null ? null : wellnessLetter(rating.score), status:rating.known < rating.applicable ? 'needs-review' : 'preliminary', known:rating.known, total:rating.applicable });
 }
 // Preserve legacy category weighting; the new strategy uses explicitly preliminary known-answer grades.
 const known=categories.filter(c=>c.score!==null);
 let rating=reportRating(questions.filter(q=>/\.(status|review)$/.test(q.id)).map(q=>answers.diagnostic[q.id]), Boolean(profile));
 if (answers.planningVersion === 1) rating = reportRating(scoringValues, Boolean(profile));
 const score=answers.strategyVersion===1?rating.score:known.length>=Math.ceil(categories.length*.8)?Math.round(known.reduce((sum,c)=>sum+c.score!,0)/known.length):null;
 return {rating,rubricVersion:answers.strategyVersion===1?2:1,overall:{score,grade:score===null?null:profile?wellnessLetter(score):letter(score),status:categories.some(c=>c.status==='needs-review')?'needs-review' as const:'preliminary' as const,known:known.length,total:categories.filter(category => category.rating.code !== 'NA').length},categories};
}
export function combinedResults(answers:Pick<CombinedAnswers,'selected'|'diagnostic'|'locale'|'consultationOnly'|'insuranceRoutingVersion'|'strategyVersion'|'cardVersion'|'planningVersion'|'familySupplementVersion'> & {format?:CombinedAnswers['format']}){
 if(answers.format!==COMBINED_FORMAT)return legacyResults(answers as Parameters<typeof legacyResults>[0]);
 const card=adaptiveReportCard({...answers,format:COMBINED_FORMAT});
 if (answers.consultationOnly) return [];
 type AdaptiveReview = { type: CombinedAnswers['selected'][number]; title: string; kind: 'adaptive'; result: NonNullable<ReturnType<typeof adaptiveReportCard>>['categories'][number] };
 type ProtectionReview = { type: 'family' | 'protection'; title: string; kind: 'protection-estimate'; result: ReturnType<typeof protectionEstimate> };
 const useDime = answers.cardVersion === 1 && mainReportCard(answers.selected) === 'family';
 const reviews = answers.selected.flatMap<AdaptiveReview | ProtectionReview>(type => {
  const title = useDime && isProtectionArea(type)
   ? answers.locale === 'es' ? 'Protección familiar e ingresos' : 'Family & Income Protection'
   : PRIORITIES.find(priority => priority.id === type)![answers.locale];
  if (useDime && type === 'protection') return [];
  if (answers.cardVersion === 1 && isProtectionArea(type)) {
   return [{ type, title, kind: 'protection-estimate' as const, result: protectionEstimate(type, answers.diagnostic, answers.locale, useDime) }];
  }
  const category = card?.categories.find(entry => entry.type === type);
  return category ? [{ type, title, kind: 'adaptive' as const, result: category }] : [];
 });
 if (answers.planningVersion === 1) for (const category of card?.categories ?? []) {
  if (!answers.selected.includes(category.type) || category.id === 'estate_exit') reviews.push({type:category.type,title:category.title,kind:'adaptive',result:category});
 }
 return reviews;
}
