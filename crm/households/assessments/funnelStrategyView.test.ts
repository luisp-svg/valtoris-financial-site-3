import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {StaticRouter} from 'react-router-dom/server'
import {expect,it} from 'vitest'
import {combinedQuestions,validateCombined} from '../../../modules/reportCard/combined/engine'
import {combinedFixture} from '../../../server/premium/testFixtures'
import {discoveryPlan,discoveryQuestions} from '../../../modules/reportCard/funnelStrategy'
import {mapPublicFamilyDiagnosticDetail} from './diagnosticFormatters'
import PublicFamilyDiagnosticDetailView from './PublicFamilyDiagnosticDetailView'

it.each(['page','embedded'] as const)('shows one discovery summary and consistent preliminary grades in the %s advisor view',variant=>{
 const answers={...combinedFixture(['student_loan']),strategyVersion:1 as const};
 answers.diagnostic=Object.fromEntries(combinedQuestions(answers.selected,{},1,1).map(q=>[q.id,q.question.kind==='state'?'AR':q.id==='shared.timing'?'month':'unknown']));
 answers.diagnostic['student_loan.status']='current';answers.diagnostic['student_loan.review']='partial';
 expect(validateCombined(answers)).not.toBeNull();
 const plan=discoveryPlan('family',answers);
 const diagnostic={...plan.seed,...Object.fromEntries(plan.questions.map(q=>[q.id,'unknown']))};
 const snapshot=Object.fromEntries(discoveryQuestions('family').map(q=>[q.id,diagnostic[q.id]]));
 const detail=mapPublicFamilyDiagnosticDetail({id:'synthetic-assessment',assessment_type:'student_loan',capture_channel:'public_self_report',status:'completed',completed_at:'2026-10-29T00:00:00Z',answers,derived_metrics:{comprehensiveDiscovery:{scope:'family',diagnostic:snapshot,completedAt:'2026-10-29T00:00:00Z'}}},'synthetic-household',null)!;
 expect(detail.combinedReports?.[0].kind).toBe('adaptive');
 expect(detail.discovery).toBeTruthy();
 const html=renderToStaticMarkup(createElement(StaticRouter,{location:'/'},createElement(PublicFamilyDiagnosticDetailView,{detail,variant})));
 expect(html.match(/<h2>Family Financial Discovery<\/h2>/g)).toHaveLength(1);
 expect(html.match(/Comprehensive discovery answers/g)).toHaveLength(1);
 expect(html).toContain('Preliminary C');
 expect(html).toContain('Information to confirm');
 expect(html).not.toContain('>NR<');
 expect(html).toContain('student');
});
