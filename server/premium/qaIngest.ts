import {ingestPublicReportCard,type IngestFamilyReportCardDeps} from '../ingest/familyReportCard/ingestFamilyReportCard.js';
/** Hosted QA saves internal CRM records only. Legacy Sheets webhooks can trigger downstream actions. */
export function premiumIngest(hostedQa:boolean,ingest:typeof ingestPublicReportCard=ingestPublicReportCard):typeof ingestPublicReportCard{
 const options:IngestFamilyReportCardDeps|undefined=hostedQa?{
  sheetsWriter:async()=>({status:'skipped'}),
  runStudentLoanDryRun:async()=>null,
 }:undefined;
 return body=>ingest(body,options);
}
