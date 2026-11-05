import {it,expect,vi} from 'vitest';
import {premiumIngest} from './qaIngest';
import type {ingestPublicReportCard} from '../ingest/familyReportCard/ingestFamilyReportCard';
it('hosted QA saves through the normal ingest but suppresses external delivery hooks',async()=>{
 const ingest=vi.fn().mockResolvedValue({ok:true});
 await premiumIngest(true,ingest as typeof ingestPublicReportCard)({synthetic:true});
 const options=ingest.mock.calls[0][1];
 expect(await options.sheetsWriter({})).toEqual({status:'skipped'});
 expect(await options.runStudentLoanDryRun({})).toBeNull();
 expect(options.orchestrateFollowUpTask).toBeUndefined();
});
it('preserves the normal production ingest configuration',async()=>{
 const ingest=vi.fn().mockResolvedValue({ok:true});
 await premiumIngest(false,ingest as typeof ingestPublicReportCard)({synthetic:true});
 expect(ingest.mock.calls[0][1]).toBeUndefined();
});
