# Valtoris Academy advisor pilot

The pilot is an original, internal workflow lesson for active Valtoris advisors and owners. It walks through a first student loan conversation, verification of account facts, and a documented handoff. Three fictional scenarios give immediate practice feedback. The [CSLA Institute](https://cslainstitute.org/home) is an external program; this pilot uses no licensed lessons or exams and awards no designation or CE credit.

To view the pilot, run `VITE_TAC_ACADEMY_PILOT=true npm run dev` locally with an authorized development login, then open Academy pilot in TAC. The development build flag is also required by the route, so setting the variable in a production build cannot enable it. Progress lives in memory for the current visit; the pilot reads no client records and writes no data.

## Remaining implementation, in order

1. **Release gate — isolate and verify development.** Review [hardening draft #23](https://github.com/luisp-svg/valtoris-financial-site-3/pull/23) against current development and production inventories. Resolve drift that affects Academy schema, grants, and deployment. Capture scoped recovery evidence, verify existing CRM flows, and separately authorize any hosted hardening. Verify that a future preview targets development. No blanket privilege changes.
2. **First persisted course — course versions and learner progress.** Use active advisor/owner identity. Add versioned published lessons and per-advisor enrollment, completion, and attempt records in development. Enforce row and column access in the database. Learners read published content and their own records; inactive, unprovisioned, anonymous, and cross-advisor access fail. Track version with progress so published changes cannot silently rewrite completion.
3. **Assessment — grade on the server.** Keep answer keys outside learner-readable payloads. Enforce attempts and scoring server-side; test direct API requests, repeated submissions, and cross-advisor denial. Confirm the pass mark, retry policy, and whether completion requires an instructor review before implementing them.
4. **Instructor and owner views.** Confirm who can author, review, publish, and view learner results. Use explicit assignments for instructors; do not infer permission from a menu link. Show status, last activity, and the course version. Review content and fictional scenarios before publishing.
5. **Internal completion record and rollout.** Record course version, completion date, and the internal training title. Do not present it as CSLP certification or CE. Run advisor/owner walkthroughs against development with synthetic records, then seek separate production approval.

The pilot demonstrates navigation and learning flow only. It does not validate hosted permissions, persistent tracking, formal exams, instructor access, or production readiness.
