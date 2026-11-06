export type ReadinessRating = {
 rubricVersion:2;
 scale?: 'wellness';
 code: 'A'|'B'|'C'|'D'|'F'|'PENDING'|'NA';
 score:number|null;
 known:number;
 applicable:number;
};
export function readinessRating(values:unknown[]):ReadinessRating {
 const applicable=values.filter(value=>value!=='not_applicable');
 const points=applicable.flatMap(value=>value==='current'?[100]:value==='partial'?[50]:value==='missing'?[0]:[]);
 if(!applicable.length)return {rubricVersion:2,code:'NA',score:null,known:0,applicable:0};
 if(!points.length)return {rubricVersion:2,code:'PENDING',score:null,known:points.length,applicable:applicable.length};
 const score=Math.round(points.reduce((sum,value)=>sum+value,0)/points.length);
 return {rubricVersion:2,code:score>=90?'A':score>=80?'B':score>=70?'C':score>=60?'D':'F',score,known:points.length,applicable:applicable.length};
}
export function readinessRatingLabel(rating:ReadinessRating,locale:'en'|'es'='en'){
 return rating.code==='PENDING'?(locale==='es'?'Se necesita más información':'More information needed'):rating.code==='NA'?(locale==='es'?'NA — No aplica':'NA — Not Applicable'):`${locale==='es'?'Preliminar':'Preliminary'} ${rating.code}`;
}
