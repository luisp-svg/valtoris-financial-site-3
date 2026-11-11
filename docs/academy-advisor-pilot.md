# Valtoris Academy advisor pilot

The pilot opens with Valtoris Core for active Valtoris advisors and owners. Four original practice lessons cover how Valtoris works, cross-selling and referrals, marketing, and networking. Completing all four checks unlocks Student Loan Client Review for the advisor’s account. That specialty uses three fictional scenarios to practice a first conversation, verification of account facts, and a documented handoff. The [CSLA Institute](https://cslainstitute.org/home) is an external program. The pilot uses original materials and issues no designation or CE credit.

To view the pilot, run `VITE_TAC_ACADEMY_PILOT=true npm run dev` locally with an authorized development login, then open Academy pilot in TAC. The development build flag is also required by the route, so setting the variable in a production build cannot enable it. Saved progress requires the reviewed development setup in `scripts/sql/academy/pilot-progress.sql`. Apply it to the verified development project before running this draft against it. The database checks the active TAC profile, saves the last lesson and passed practice checks, and enforces the Core prerequisite. Previous in-memory completions cannot be recovered.

## Further implementation, in order

1. **Release gate — isolate and verify development.** Review [hardening draft #23](https://github.com/luisp-svg/valtoris-financial-site-3/pull/23) against current development and production inventories. Resolve drift that affects Academy schema, grants, and deployment. Capture scoped recovery evidence, verify existing CRM flows, and separately authorize any hosted hardening. Verify that a future preview targets development. No blanket privilege changes.
2. **First persisted course — course versions and learner progress.** Use active advisor/owner identity. Add versioned published lessons and per-advisor enrollment, completion, and attempt records in development. Enforce row and column access in the database. Learners read published content and their own records; inactive, unprovisioned, anonymous, and cross-advisor access fail. Track version with progress so published changes cannot silently rewrite completion.
3. **Assessment — grade on the server.** Keep answer keys outside learner-readable payloads. Enforce attempts and scoring server-side; test direct API requests, repeated submissions, and cross-advisor denial. Confirm the pass mark, retry policy, and whether completion requires an instructor review before implementing them.
4. **Instructor and owner views.** Confirm who can author, review, publish, and view learner results. Use explicit assignments for instructors; do not infer permission from a menu link. Show status, last activity, and the course version. Review content and fictional scenarios before publishing.
5. **Internal completion record and rollout.** Record course version, completion date, and the internal training title. Do not present it as CSLP certification or CE. Run advisor/owner walkthroughs against development with synthetic records, then seek separate production approval.

The development pilot includes saved progress, server-graded Core and student loan exams, owner progress views, and completion certificates. Versioned courses, instructor review, and production rollout remain further work.

The proposed Advisor progress view requires `scripts/sql/academy/pilot-owner-overview.sql` after the progress setup. The read-only function returns practice completion and last lesson for active advisors. It checks the caller’s active owner profile before returning any rows.

The proposed graded Core exam requires `scripts/sql/academy/pilot-core-exam.sql` after both earlier development setup scripts. Advisors open it after passing the four Core practice checks. The database grades seven original questions, keeps the best result across retries, and reports that result to active owners. Six correct answers meet the proposed 85% threshold. The student loan course remains tied to Core practice completion during this pilot.

The Core completion certificate uses `scripts/sql/academy/pilot-core-certificate.sql` after the exam setup. Active advisors receive one internal training certificate on passing. The saved name, ID, and issue date remain stable across retries. Existing active advisor passes receive the rollout date because earlier exam records have no attempt timestamp. Owners can view certificate status and identifiers in Advisor progress.

The proposed student loan exam follows the three Student Loan Client Review practice checks. It uses seven original workflow scenarios on intake, account verification, secure handling of records, and follow-up. Six correct answers pass and the best score is saved separately from Core. Apply `scripts/sql/academy/pilot-student-loan-exam.sql` after the Core certificate setup to enable grading and the owner score column.


## Student loan curriculum expansion

The next phase deepens the student loan track toward the competencies in the [CSLA public curriculum](https://cslainstitute.org/home). Build original instruction and cases in this order.

1. Loan identification and borrower roles. Lesson 1 now adds federal and private loan classification, parent PLUS borrower responsibility, cosigner roles, and a three-loan TAC exercise. Primary source links and a review date appear inside the lesson.
2. Interest and balances. Lesson 2 now includes principal, accrued interest, capitalization, daily interest estimates, payment allocation, and a TAC calculation exercise with dated primary references. Fixed and variable rate comparisons remain further content.
3. Consolidation and refinancing. Lesson 3 now adds transaction identification, illustrative weighted-rate and scheduled-payment calculations, protection changes, and a TAC comparison handoff. Current eligibility and program effects require separate dated verification.
4. Repayment analysis. Build a dated comparison of available plans, eligibility, cash flow, and total cost using verified current rules.
5. Forgiveness and financial planning. Add employment verification, tax coordination, household planning, and specialist escalation cases with current primary sources.

Each expansion needs an original case, a TAC exercise, and an assessment coverage review. The current seven-question exam measures the initial three-lesson client-review workflow. Added reading does not create a new exam version or establish mastery of the expanded curriculum.

Student loan certificates use `scripts/sql/academy/pilot-student-loan-certificate.sql`, applied to development with approval. The server issues stable certificate records for qualifying advisors. Advisor progress includes certificate ID and issue date. Earlier qualifying passes use the rollout date because the original exam records have no pass timestamp.
