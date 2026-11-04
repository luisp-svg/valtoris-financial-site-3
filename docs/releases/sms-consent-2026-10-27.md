# SMS consent and policy repair — 2026-10-27

## Change

- Add public `/sms-consent` and `/sms-terms` pages; make the previously broken `/life-insurance` path serve the consent page.
- Reuse Agent CRM / LeadConnector for contact capture. The existing native A2P consent form is `CuhS3v7osbJkfS2PTuPm`; SMS consent is optional and not prechecked. No new backend, migration, automatic message, or marketing permission is introduced.
- Publish business-specific privacy disclosures, SMS data non-sharing, storage/provider information, STOP/HELP, frequency/rates, age eligibility, carrier delivery limitations, and customer-support contacts. Link the pages from the existing footer.

## Production source preservation

Production alias verified before release: `www.valtorisfinancial.com`, deployment `dpl_CGnxeNkpStx2VhDGYT8qTWLDbVpc`, project `prj_PizD9wgsixo5A7TE8inTAGXEVpQG`, team `team_IymBfBQsO7ozUdqvp1iOy8Zc`.

The latest GitHub main is not the current production release. The consent-only patch was applied to an isolated copy of the retained 2026-10-23 production release, preserving its existing routes, source, headers, and configuration. Its baseline build matches production CSS and business text; remaining bundle differences are deployment-generated metadata. This branch records only the requested consent change, not unrelated production/main reconciliation.

## Verification

- Production-source baseline and changed source: 436 test files passed, 34 skipped; 3,772 tests passed, 306 skipped; no failures.
- TypeScript check, Vite production build, function budget, ESM imports, and browser Activity insertion guard passed.
- Browser preview loads the real native form and shows the consent checkbox unchecked. Native form settings verified: SMS permission optional and unchecked. Generic business placeholders were replaced, customer-care consent and business policy links were added, and the unrelated marketing choice was removed. The former white-on-white labels and consent disclosure were corrected to brand navy.
- No live inquiry or text message was sent as a test. Delivery and CRM consent persistence have not been proven by a synthetic production submission.
- Carrier approval and enabling both numbers remain separate from publishing these pages. Fees and final registration submission require user confirmation.

## Published verification

Initial public deployment: `dpl_ERXy1SaGcBEj68nbRFvaEoxqbEJ9`. HTTP and browser checks confirm the consent, legacy, privacy, and terms routes. Agent CRM privacy and terms reviews each pass 7/7. The embedded chat widget could not be inspected by the automatic opt-in scan, so the existing native form was repaired and linked directly for review; the final page embeds that same native form. No registration charge or final submission has been authorized.
