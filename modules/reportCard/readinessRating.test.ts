import {describe,it,expect} from 'vitest';
import {readinessRating,readinessRatingLabel} from './readinessRating';
import {specializedFunnels,discoveryQuestions,discoverySummary,readDiscoverySummary} from './funnelStrategy';
import {combinedQuestions,COMBINED_FORMAT} from './combined/engine';
import {adaptiveReportCard} from './combined/results';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ReadinessGrade from '../../components/premium/ReadinessGrade';
describe('every completed report has an explicit final grade',()=>{
 it.each(specializedFunnels)('$id returns preliminary A–F or missing-information guidance, never a blank final grade',f=>{
  for(const answer of ['current','partial','missing','unknown']){
   const questions=combinedQuestions(f.selected,{},1,1),diagnostic=Object.fromEntries(questions.map(q=>[q.id,/\.(status|review)$/.test(q.id)?answer:'unknown']));
   const card=adaptiveReportCard({format:COMBINED_FORMAT,strategyVersion:1,insuranceRoutingVersion:1,selected:f.selected,diagnostic,locale:'en'})!;
   expect(card.rating.code).toBe(answer==='current'?'A':answer==='unknown'?'PENDING':'F');
   expect(renderToStaticMarkup(createElement(ReadinessGrade,{rating:card.rating}))).toContain('Your Preliminary Grade');
  }
 });
 it.each(['family','business'] as const)('%s comprehensive discovery supplies and restores a final grade',scope=>{
  for(const answer of ['current','partial','missing','unknown','not_applicable']){
   const diagnostic=Object.fromEntries(discoveryQuestions(scope).map(q=>[q.id,q.id.startsWith('shared.')?'unknown':answer]));
   const summary=discoverySummary(scope,diagnostic);
   expect(summary.rating.code).toBe(answer==='current'?'A':answer==='unknown'?'PENDING':answer==='not_applicable'?'NA':'F');
   expect(readDiscoverySummary({version:1,scope,diagnostic})!.rating).toEqual(summary.rating);
  }
 });
 it('provides NA for no current loans without inventing a score',()=>{
  const diagnostic={'student_loan.loan_type':'none'};
  const card=adaptiveReportCard({format:COMBINED_FORMAT,strategyVersion:1,insuranceRoutingVersion:1,selected:['student_loan'],diagnostic,locale:'en'})!;
  expect(card.rating).toMatchObject({code:'NA',score:null});
 });
 it('uses partial answers for a preliminary grade and flags what is missing',()=>{
  const rating=readinessRating(['partial','unknown','unknown']);
  const html=renderToStaticMarkup(createElement(ReadinessGrade,{rating}));
  expect(html).toContain('Preliminary F');expect(html).toContain('2 checks have missing information');expect(html).not.toContain('NR');
 });
 it('does not invent a grade when every answer is unknown',()=>{
  expect(readinessRating(['unknown','unknown'])).toMatchObject({code:'PENDING',score:null});
 });
 it('requires sufficient evidence and excludes inapplicable checks',()=>{
  expect(readinessRating(['current','unknown'])).toMatchObject({code:'A',score:100,known:1,applicable:2});
  expect(readinessRating(['current','current','not_applicable'])).toMatchObject({code:'A',score:100});
  expect(readinessRating(['missing','missing'])).toMatchObject({code:'F',score:0});
  expect(readinessRatingLabel(readinessRating(['unknown','unknown']),'es')).toContain('Se necesita más información');
 });
});
