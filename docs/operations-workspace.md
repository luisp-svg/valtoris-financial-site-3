# Operations workspace pilot

## Result

`/crm/operations` adds business projects, tasks, CRM roadmap stages, assignments, deadlines, priorities, blockers, and an authenticated user's existing client follow-up queue. Projects and tasks persist in Supabase; the dashboard refreshes every 30 seconds and after writes. It does not use browser storage or demo records. Workspace owners can add existing CRM users, create work, edit work, and assign it. Members see workspace work and change the status of their assigned items. Status changes and owner edits reject stale revisions.

Work stages: Backlog, Planned, In progress, Testing, Live / Done, Cancelled. Tasks may link to a project. Search and views cover all work, projects, personal work, CRM roadmap, and blocked work. Team work is visible to workspace members; client follow-ups retain existing household RLS and task action workflows. Client tasks are displayed only for the current assignee and are completed through the existing task queue.

## Deployment state

This is a development branch, not an activated production feature. The proposed SQL is `docs/proposed-migrations/082_operations_workspaces.sql`. It is deliberately outside the applied migration inventory until release review. Before activation, confirm production's current migration history and schema, validate with hosted Supabase Auth/PostgREST in CRM development, then promote it into the migration inventory, update inventory contracts, and apply using the established release process. Do not create workspaces or client test records in production during review.

Create the first workspace as an existing active CRM owner. Add yourself, Jaz, and Liz explicitly through Workspace team before assigning work. Membership allows reading all project work in that workspace; it does not grant client access. The proposed feature does not send email/SMS, synchronize AgentCRM tasks, or invite people.

## Platform architecture finding

The repository's legacy profiles, households, tasks, production cases, and owner helper are not agency-scoped. `crm_is_owner()` recognizes an active owner globally. No agency/tenant keys were found in the inspected CRM, platform, and migration sources. Operations isolation is a new boundary for this module only, not proof the full platform is safe for multiple agencies. The new module never grants unrelated global owners access to another workspace.

Before outside-agency onboarding:

1. Introduce agencies and agency memberships, and define user access across agencies.
2. Inventory every table, RPC, storage policy, background job, export, public assessment link, integration credential, and reporting path that reads or writes client data.
3. Backfill existing records to the legitimate Valtoris agency with reconciliation and rollback evidence.
4. Replace global owner assumptions with agency-scoped authorization and enforce cross-agency relationships in the database.
5. Exercise two-agency isolation with actual authenticated API sessions, including inactive/revoked members, reports, jobs, and file access.
6. Connect this Operations module to canonical agency membership instead of maintaining a separate long-term membership model.

No existing client RLS or historical migrations were altered by this pilot. A CRM owner can currently create an Operations workspace; this does not provision another agency or license the full CRM to it.

## Verification

- `npm run test:operations-db` runs the proposed SQL in an isolated in-memory PostgreSQL engine with minimal Auth/Profile scaffolding. It checks creation, global-owner isolation, member access, unauthorized creation/reassignment, status-only changes, stale revisions, nonmember assignee rejection, inactive membership, anonymous access, and project links across two workspaces. A task must reference a project in its own workspace; projects cannot have parents. It never touches a hosted database.
- `npm test` includes Operations workload summaries and the updated navigation registry contract.
- `npm run typecheck`, `npm run lint`, and `npm run build` cover application integration.

### Hosted development pilot — October 9, 2026

The approved schema was installed in Supabase project `cxgiaevervjttbuiramd` (`valtoris-crm-dev`) through the connected Supabase plugin as `operations_workspaces_pilot`. The SQL was first verified in a transaction that rolled back. The source SQL remains staged outside the production migration inventory; do not apply it again to development.

Signed-in Auth/PostgREST browser QA on the feature-branch Vercel preview passed: created Valtoris Operations, added its existing owner to the assignment list, created a CRM Roadmap project, linked and assigned a task, changed project/task status, and verified persistence after a reload. The project remains Testing and the verification task is Done. Existing client follow-ups remained accessible through their original queue. This also confirms this preview uses the development database.

Hosted checks confirmed RLS on all three Operations tables, seven policies, no anonymous execution of Operations routines, and zero workspace/item visibility for an outsider. The security advisor was reviewed: the three authenticated security-definer routines are intentional, use fixed search paths, and enforce active membership/ownership inside their bodies. Broader preexisting CRM advisor notices are outside this pilot. The isolated harness remains the evidence for other member, revision, parent-link, and cross-workspace cases; those have not all been repeated with separate hosted user sessions.

Production application code and database remain unchanged. The PR stays draft pending production migration reconciliation and release review. Notifications, full agency onboarding, integrations, and a separate platform administrator role are later work.


## Operations completion and My Day — development extension

Operations now includes project task-progress indicators, division and project filters, due/overdue view, board/list layouts, linked tasks, per-item discussions, and checklists. Members may post comments as themselves; only a workspace owner may create checklist steps, and only the owner or item assignee may toggle them. Checklist toggles reject stale state. Comment/checklist retry IDs prevent duplicate submissions.

Procedures & playbooks preserve immutable revisions. Owners publish revisions; members can read them and their history. The client prevents concurrent publication from overwriting another revision through the unique workspace/procedure/version constraint. Procedure text is rendered as text, not executable HTML.

The collaboration SQL is staged in `docs/proposed-migrations/operations_collaboration.sql`. In CRM development, comments/checklists were applied as `operations_collaboration_pilot` and procedures as `operations_procedures_pilot`; do not reapply this source to that environment. Production remains unchanged.

CRM Home now includes My Day for owners and advisors: their open client tasks, active assigned Operations work, and due production cases visible under existing case RLS. Production follow-ups are ordered oldest first and capped at 200; this is a queue, not a total agency metric. Clicking work opens its canonical queue or case; Operations links identify the workspace and item. Production detail also offers a manual follow-up task form with household/opportunity/title prefilled. This is not automatic task generation, appointment integration, or a separate assignment boundary for production cases.

The isolated SQL harness additionally checks author spoofing, checklist conflicts and outsider denial, member procedure-publication denial, and immutable procedure revisions. Production remains a draft release. Workflow templates, dependencies, notifications, external communications, automatic production task generation, appointment integration, and agency-wide isolation still require further development.

## Production follow-up tracking — development pilot

Owners can enable automatic tracking on each production case and select an active owner or the assigned household advisor. This generates a `system` task with the `production_follow_up` workflow in the existing Tasks queue. An unfinished task follows the case date/stage and assignee. Completion stays complete; changing the case date afterwards generates the next task. Clearing the date, deleting the case, or entering a terminal stage cancels unfinished tracked work. Pausing tracking leaves existing tasks available.

Reschedule production follow-ups on the case; the task action accepts completion but rejects independent rescheduling. My Day labels generated work and suppresses overlapping case reminders for tracked dates. No historical cases are enabled automatically. Tracking configuration has revision checks and retry protection. Direct writes to its table and calls to its private synchronization helpers are denied to browser roles. Assignee access is rechecked on each case synchronization; a lost assignment is reported on the case instead of blocking production updates.

CLI-generated proposed migration: `docs/proposed-migrations/20261009173309_production_follow_up_automation.sql`. Installed only in dev as `production_follow_up_task_pilot`, followed by terminal-stage alignment. Reconcile migration inventory before production rollout. Uses the existing single-agency household authorization model; does not establish platform-wide tenant isolation.

Validation: isolated PostgreSQL workflow checks cover retries, stale configuration, unauthorized users, open-task synchronization, completion, next cycle, pausing, cancellation and inactive assignees. A rollback-only hosted test exercised the real production create/update RPCs, task creation, date sync, task completion, next cycle and cleared-date cancellation without retaining fixture records. Supabase advisory flags the intentionally authenticated configuration RPC as SECURITY DEFINER; it enforces active-owner authorization with a fixed search path. Private helpers have no public/browser execution privileges.
