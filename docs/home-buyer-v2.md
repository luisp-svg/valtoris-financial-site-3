# Home Buyer Report Card V2

V2 extends the existing public Report Card flow. No migration or new endpoint is required. Credit remains `public_self_report`; IDIQ and verified-credit ingestion remain deferred.

## Contract and compatibility

- V1 requests use `assessmentVersion: 1` with the original exact diagnostic shape.
- V2 requests use `assessmentVersion: 2`. `diagnostic.v2` contains the canonical V2 questionnaire evidence. The remaining diagnostic fields are a deterministic compatibility projection for the existing readiness categories.
- The server checks supported versions, exact keys, field visibility, enum membership, exclusive multiselects, decimal bounds, and professional contact formats. It rebuilds the compatibility projection from V2 evidence rather than trusting client-supplied bands.
- Only Home Buyer version dispatch changes. Existing reports and other products keep their existing contracts.
- Persisted V2 `derived_metrics.affordability` includes calculator version, assumptions snapshot, status, scenario calculations, factors, and target gap. CRM displays that saved snapshot. The public results page uses the shared pure engine with the same configuration as the server build.
- Browser results sessions omit primary contact data except first name, realtor details, and the free-text barrier response. Exact monetary inputs needed for local results remain in session storage until that browser session ends; no new local-storage persistence is introduced.

## Questions and readiness

The flow remains contact/consent plus ten diagnostic groups. V2 adds new/resale, detailed timeline, source-specific incomes, industry duration, applying parties and conditional co-applicant income, numeric debts/housing, separate savings/retirement/purchase funds/reserves, lender/preapproval status, optional professional agent details, and purchase-plan questions. English and Spanish use canonical values with localized labels.

Unknown amounts can be left blank; zero must be explicitly entered. Business net losses can be negative and reduce combined income. Incomes share an explicit monthly/annual period per applicant. W-2 base income excludes separately entered commission/bonus. Debts are combined obligations of participating applicants, with shared debts entered once.

Readiness scoring version 2 retains the eight category weights and existing grade thresholds. Income amount bands are derived from reported annualized income, and debt/housing bands from reported amounts. Down-payment progress, reserve months, cash-flow cushion, documents, and confidence remain separate self-reported readiness inputs. V2 gives the same income-type points for positive known income across sources and neutralizes timeline timing points; urgency still affects review flags when financial gaps exist. Realtor, lender, first-time status, home type, target price, and expected years in the home do not directly add or subtract readiness points. Changing calculator assumptions does not change the grade. V1 scoring is unchanged.

## Educational calculation

`components/assessment/homeBuyer/affordability.ts` owns the pure engine and configurable `DEFAULT_AFFORDABILITY_ASSUMPTIONS`. These are staff-configured illustrative assumptions, not live rate quotes or lending eligibility thresholds. Expected HOA is an optional respondent override. Configuration version must be incremented when assumptions change; stored CRM results preserve their original assumptions.

Initial illustrative configuration:

| Assumption | Value |
| --- | --- |
| Term | 30 years |
| Scenario interest | 7.0% / 6.5% |
| Housing-budget ratios | 28% / 32% |
| Total-debt-budget ratios | 36% / 43% |
| Property tax | 1.25% of price annually |
| Homeowners insurance | 0.50% of price annually |
| Mortgage insurance | 0.60% of initial loan annually when down payment is below 20% |
| Down payment | 5% of price |
| Closing costs | 3% of price |
| Protected reserve floor | $3,000 |
| HOA default | $0/month, explicitly shown |

For each scenario, housing capacity is the lesser of the housing-income budget and the total-debt budget minus continuing debts/housing. The amortization factor handles zero-interest assumptions. Price is limited by both monthly capacity and funds for down payment plus closing costs, then rounded down to $1,000. The displayed payment includes principal, interest, estimated taxes, insurance, mortgage insurance, and HOA. Maintenance, utilities, and other living expenses are excluded and disclosed.

Purchase funds are reported after reserves. Only a shortfall between separately protected reserves and the configured reserve floor is additionally set aside; protected reserves are not subtracted twice. Savings and retirement balances are not automatically added to purchase funds. The model uses its displayed fixed down-payment scenario rather than optimizing loan programs or spending every remaining dollar.

Current DTI includes non-housing debts and current housing when owned; rent is not debt. Projected DTI includes the modeled payment and continuing debts/housing. The denominator uses W-2 gross, business net, and other reported recurring income for confirmed applicants. Missing required numeric evidence, nonpositive combined income, unsupported ownership/occupancy, invalid configuration, or lack of positive capacity produces an explicit unavailable state. A price estimate currently supports a primary residence for the respondent with an optional co-applicant. A target gap compares target price with the upper scenario and is not a cash shortage calculation.

Definition references: [CFPB DTI explanation](https://www.consumerfinance.gov/ask-cfpb/what-is-a-debt-to-income-ratio-en-1791/) and [CFPB home loan toolkit](https://www.consumerfinance.gov/documents/5982/cfpb_your-home-loan-toolkit.pdf). The illustrative defaults above are product assumptions, not values presented as current lender rules by these sources.

## Privacy and integrations

Existing consent, service-only ingest RPC, household access policies, identity matching, idempotency, CRM lead labels, and AgentCRM source/tag behavior are reused. No new messaging, external custom fields, or opportunities are created by this change.

The existing V2 Sheets export keeps primary contact and readiness summary but replaces raw-answer export with only assessment version, credit source, home type, and timeline. Exact financial evidence and professional agent details stay in private assessment JSON. V1 export behavior is preserved. Intake gains localized-label answer formatting and saved affordability display. The separate household workspace assessment allowlist remains unchanged.

## Validation and release gate

New tests cover version compatibility, hostile/invalid input, branch clearing, projection tampering, income normalization and losses, applicant selection, independent zero-interest arithmetic, cash/reserve constraints, current/projected housing, unknown states, monotonicity, snapshots, export minimization, bilingual output, and existing ingest/Intake integration.

Release candidate verified against production base `de735a9` on September 24, 2026. Full configured suite: 3,039 passed, zero failed, 292 skipped (368 test files passed, 29 skipped); remote development database reads used a 30-second timeout. TypeScript, lint, production build, function count, server ESM imports, browser Activity guard, and whitespace checks pass. The released CRM answer display and insurance features are preserved. No database migration is needed.

The HOA input is capped at $100,000/month to match the saved-assumption validator. Seventeen V2 regression tests cover the original contract plus saved CRM answer/affordability rendering and the HOA boundary.

Fresh browser QA was unavailable because the browser tool could not verify its administrator-enforced access policy. Earlier browser QA is historical and is not represented as current release verification. Skipped environment-dependent tests are not passes. No real client records were used during local verification.
