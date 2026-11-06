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
export function adaptiveReportCard(answers:Pick<CombinedAnswers,'format'|'selected'|'diagnostic'|'locale'|'consultationOnly'|'insuranceRoutingVersion'|'strategyVersion'|'cardVersion'>){
 if(answers.consultationOnly||answers.format!==COMBINED_FORMAT)return null;
 const questions=combinedQuestions(answers.selected,answers.diagnostic,answers.insuranceRoutingVersion,answers.strategyVersion,answers.cardVersion);
 const profile = answers.cardVersion === 1 ? mainReportCard(answers.selected) : undefined;
 const scoredAreas = answers.cardVersion === 1
  ? answers.selected.filter(type => !isProtectionArea(type) || profile === 'family')
  : answers.selected;
 if (!scoredAreas.length) return null;
 const categories=scoredAreas.map(type=>{
  const indicators=questions.filter(q=>q.reviews.includes(type)&&/\.(status|review)$/.test(q.id));
  const values=indicators.map(q=>answers.diagnostic[q.id]);
  const points=values.flatMap(v=>v==='current'?[100]:v==='partial'?[50]:v==='missing'?[0]:[]);
  const rating=reportRating(profile === 'business' && type === 'benefits' && answers.diagnostic['benefits.workforce'] === 'none'
   ? ['not_applicable']
   : values, Boolean(profile));
  const score=answers.strategyVersion===1?rating.score:points.length?Math.round(points.reduce((a,b)=>a+b,0)/points.length):null;
  return {rating,type,title:PRIORITIES.find(p=>p.id===type)![answers.locale],score,grade:score===null?null:profile?wellnessLetter(score):letter(score),status:points.length<2?'needs-review' as const:'preliminary' as const,known:points.length,total:indicators.length};
 });
 // Preserve legacy category weighting; the new strategy uses explicitly preliminary known-answer grades.
 const known=categories.filter(c=>c.score!==null);
 const rating=reportRating(questions.filter(q=>/\.(status|review)$/.test(q.id)).map(q=>answers.diagnostic[q.id]), Boolean(profile));
 const score=answers.strategyVersion===1?rating.score:known.length>=Math.ceil(categories.length*.8)?Math.round(known.reduce((sum,c)=>sum+c.score!,0)/known.length):null;
 return {rating,rubricVersion:answers.strategyVersion===1?2:1,overall:{score,grade:score===null?null:profile?wellnessLetter(score):letter(score),status:categories.some(c=>c.status==='needs-review')?'needs-review' as const:'preliminary' as const,known:known.length,total:categories.filter(category => category.rating.code !== 'NA').length},categories};
}
export function combinedResults(answers:Pick<CombinedAnswers,'selected'|'diagnostic'|'locale'|'consultationOnly'|'insuranceRoutingVersion'|'strategyVersion'|'cardVersion'> & {format?:CombinedAnswers['format']}){
 if(answers.format!==COMBINED_FORMAT)return legacyResults(answers as Parameters<typeof legacyResults>[0]);
 const card=adaptiveReportCard({...answers,format:COMBINED_FORMAT});
 if (answers.consultationOnly) return [];
 type AdaptiveReview = { type: CombinedAnswers['selected'][number]; title: string; kind: 'adaptive'; result: NonNullable<ReturnType<typeof adaptiveReportCard>>['categories'][number] };
 type ProtectionReview = { type: 'family' | 'protection'; title: string; kind: 'protection-estimate'; result: ReturnType<typeof protectionEstimate> };
 return answers.selected.flatMap<AdaptiveReview | ProtectionReview>(type => {
  const title = PRIORITIES.find(priority => priority.id === type)![answers.locale];
  if (answers.cardVersion === 1 && isProtectionArea(type)) {
   return [{ type, title, kind: 'protection-estimate' as const, result: protectionEstimate(type, answers.diagnostic, answers.locale) }];
  }
  const category = card?.categories.find(entry => entry.type === type);
  return category ? [{ type, title, kind: 'adaptive' as const, result: category }] : [];
 });
}
