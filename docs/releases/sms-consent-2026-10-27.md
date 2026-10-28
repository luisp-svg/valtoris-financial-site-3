# SMS consent and policy repair — 2026-10-27

## Change

- Add public `/sms-consent` and `/sms-terms` pages; make the previously broken `/life-insurance` path serve the consent page.
- Reuse Agent CRM / LeadConnector for contact capture. The dedicated customer-care widget is `6ae141dd6118072e0e608d55`; SMS consent is optional and not prechecked. No new backend, migration, automatic message, or marketing permission is introduced.
- Publish business-specific privacy disclosures, SMS data non-sharing, storage/provider information, STOP/HELP, frequency/rates, age eligibility, carrier delivery limitations, and customer-support contacts. Link the pages from the existing footer.

## Production source preservation

Production alias verified before release: `www.valtorisfinancial.com`, deployment `dpl_CGnxeNkpStx2VhDGYT8qTWLDbVpc`, project `prj_PizD9wgsixo5A7TE8inTAGXEVpQG`, team `team_IymBfBQsO7ozUdqvp1iOy8Zc`.

The latest GitHub main is not the current production release. The consent-only patch was applied to an isolated copy of the retained 2026-10-23 production release, preserving its existing routes, source, headers, and configuration. Its baseline build matches production CSS and business text; remaining bundle differences are deployment-generated metadata. This branch records only the requested consent change, not unrelated production/main reconciliation.

## Verification

- Production-source baseline and changed source: 436 test files passed, 34 skipped; 3,772 tests passed, 306 skipped; no failures.
- TypeScript check, Vite production build, function budget, ESM imports, and browser Activity insertion guard passed.
- Browser preview loads the real inline widget and shows the consent checkbox unchecked. Widget settings verified: consent enabled, checkbox required off, precheck off.
- No live inquiry or text message was sent as a test. Delivery and CRM consent persistence have not been proven by a synthetic production submission.
- Carrier approval and enabling both numbers remain separate from publishing these pages. Fees and final registration submission require user confirmation.
