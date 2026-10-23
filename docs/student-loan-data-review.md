# Student loan data and recommendations

TAC provides a Student Loans menu at `/crm/student-loans` and a Student Loan Data link on household pages. Uploads require an active owner/advisor session, access to the household or an assigned student-loan lead, a borrower permission reference, and confirmation of the selected household. The borrower obtains their My Aid Data text file themselves. FSA credentials are never requested.

## Flow

The original .txt file is stored in a private `student-loan-data` bucket (512 KB limit). Each unique household/file hash is retained once. New files form a version history. Upload metadata, original downloads, generation requests and completed recommendations have audit entries. A file may be linked to an existing student-loan service case.

A deterministic parser accepts the official Loan Type Code/Description format and the older Loan Type format. It extracts allowlisted types, balances, interest, current status, repayment plan, earliest recognized disbursement and source line references. Missing values remain unknown and prevent incomplete totals from being shown as complete. Names, DOB, SSNs, award IDs, addresses and contact fields remain in the private original and are excluded from parsed facts and AI input.

When the AI provider is configured, the upload flow requests generation automatically. It retrieves current Federal Student Aid guidance, sends only structured loan facts and relevant numeric/controlled income-intake fields to the direct OpenAI API, and saves source URLs, retrieval times, source hashes, model, input intake version and output history. Response storage is disabled (`store:false`); this does not assert zero retention of all provider-side logs. There is no Liz approval gate. Generated review paths are educational and do not change accounts, submit applications, promise outcomes or determine eligibility.

The UI labels AI output clearly and displays the source date, missing facts and citations. If AI is unconfigured or a provider/guidance request fails, the file and parsed summary remain saved. An explicit generation/retry control is available. Interrupted generation expires after five minutes. Durable per-upload locking prevents concurrent duplicate generations; ten generation attempts per household per day bound use.

## Configuration

`OPENAI_API_KEY` is a server-only Production secret in Vercel. Never use a `VITE_` prefix, place a key in source, or paste one into chat. Optional `STUDENT_LOAN_AI_MODEL` defaults to the verified `gpt-6.1-sol` model. Node.js 22 is required by the installed, pinned AI SDK. The model connection is direct; Vercel AI Gateway is not required.

The existing session function dispatches the workflow at `POST /api/crm/session?workflow=student-loans`, preserving the existing GET session behavior and the 12-function hosting budget. Every action revalidates the session and active CRM profile; resource operations additionally check `student_loan_can_access`. Client roles have SELECT-only access to new tables under RLS. Mutation functions are service-role-only and validate the actor/resource relationship. Loan-scoped access never changes general household assignment or reveals unrelated household records.

## Rollout and verification

Apply the additive intake contract/validation, Liz default routing, and private upload/review migrations. Existing completed intakes lacking DOB remain readable. New completions require a valid non-future DOB. Student-loan referral attribution is retained separately from the default assignee; possible duplicate status is retained.

Run focused parser, API and RLS/database tests, typecheck, build, function-budget and server-import checks. The production database must be verified after migrations, and the deployed UI/API checked with an existing authenticated owner session. Live AI generation can only be certified after a configured/funded provider successfully handles a synthetic test.
