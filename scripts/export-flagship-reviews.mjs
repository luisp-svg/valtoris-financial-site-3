import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const output=process.argv[2];
if(!output)throw new Error('Pass an output directory for fictional review reports.');
await mkdir(resolve(output),{recursive:true});
const server=await createServer({server:{middlewareMode:true,hmr:false}});
try {
 const [{default:Report},{sampleReportAnswers},{adaptiveReportCard,combinedResults},{familyAreas,businessAreas}]=await Promise.all([
  server.ssrLoadModule('/components/premium/ReportResultsOverview.tsx'),server.ssrLoadModule('/modules/reportCard/combined/samples.ts'),server.ssrLoadModule('/modules/reportCard/combined/results.ts'),server.ssrLoadModule('/modules/reportCard/combined/cardProfiles.ts'),
 ]);
 const css=(await Promise.all(['src/styles.css','components/premium/premium.css','components/premium/atelier.css','components/premium/reportResultsOverview.css'].map(file=>readFile(file,'utf8')))).join('\n');
 for(const [type,areas,title] of [['family',familyAreas,'Family Financial Report Card'],['business',businessAreas,'Business Owner Financial Report Card']]){
  const answers=sampleReportAnswers(areas,'en',1,1);
  const content=renderToStaticMarkup(createElement(Report,{card:adaptiveReportCard(answers),selected:areas,locale:'en',strategyVersion:1,mainCard:true,protectionReviews:combinedResults(answers).filter(r=>r.kind==='protection-estimate')}));
  const document=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — draft example</title><style>${css}\nbody{margin:0;background:#f7f5ef}.review-deliverable{max-width:1120px;margin:auto;padding:24px}.review-notice{background:#fff3d6;border:1px solid #d4bd85;padding:20px;margin-bottom:24px;line-height:1.6}@media print{.review-notice{display:none}}</style></head><body><main class="review-deliverable"><div class="review-notice"><h1>${title}</h1><p><strong>Draft example — fictional answers.</strong> Generated from the implemented flagship questionnaire and report engine. This is for design and content review, not a real customer report, personalized advice, or a published change.</p></div>${content}</main></body></html>`;
  const filename=resolve(output,`valtoris-${type}-flagship-example.html`);
  await writeFile(filename,document);console.log(filename);
 }
}finally{await server.close();}
