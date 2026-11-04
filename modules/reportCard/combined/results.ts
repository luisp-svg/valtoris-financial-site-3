import { combinedResults as legacyResults } from './legacyResults.js';
import { COMBINED_FORMAT, PRIORITIES, combinedQuestions, type CombinedAnswers } from './engine.js';
export type PreparationGrade={score:number|null;grade:string|null;status:'preliminary'|'needs-review';known:number;total:number};
const letter=(score:number)=>score>=90?'A':score>=80?'B':score>=70?'C':score>=60?'D':'F';
export function adaptiveReportCard(answers:Pick<CombinedAnswers,'format'|'selected'|'diagnostic'|'locale'|'consultationOnly'|'insuranceRoutingVersion'>){
 if(answers.consultationOnly||answers.format!==COMBINED_FORMAT)return null;
 const questions=combinedQuestions(answers.selected,answers.diagnostic,answers.insuranceRoutingVersion);
 const categories=answers.selected.map(type=>{
  const indicators=questions.filter(q=>q.reviews.includes(type)&&/\.(status|review)$/.test(q.id));
  const values=indicators.map(q=>answers.diagnostic[q.id]);
  const points=values.flatMap(v=>v==='current'?[100]:v==='partial'?[50]:v==='missing'?[0]:[]);
  const score=points.length?Math.round(points.reduce((a,b)=>a+b,0)/points.length):null;
  return {type,title:PRIORITIES.find(p=>p.id===type)![answers.locale],score,grade:score===null?null:letter(score),status:points.length<2?'needs-review' as const:'preliminary' as const,known:points.length,total:indicators.length};
 });
 // Equal category weights; an unknown category is never silently excluded from a confident overall grade.
 const known=categories.filter(c=>c.score!==null);
 const score=known.length>=Math.ceil(categories.length*.8)?Math.round(known.reduce((sum,c)=>sum+c.score!,0)/known.length):null;
 return {rubricVersion:1,overall:{score,grade:score===null?null:letter(score),status:categories.some(c=>c.status==='needs-review')?'needs-review' as const:'preliminary' as const,known:known.length,total:categories.length},categories};
}
export function combinedResults(answers:Pick<CombinedAnswers,'selected'|'diagnostic'|'locale'|'consultationOnly'|'insuranceRoutingVersion'> & {format?:CombinedAnswers['format']}){
 if(answers.format!==COMBINED_FORMAT)return legacyResults(answers as Parameters<typeof legacyResults>[0]);
 const card=adaptiveReportCard({...answers,format:COMBINED_FORMAT});
 return card?card.categories.map(category=>({type:category.type,title:category.title,kind:'adaptive' as const,result:category})):[];
}
