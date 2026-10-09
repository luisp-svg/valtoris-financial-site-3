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

- `npm run test:operations-db` runs the proposed SQL in an isolated in-memory PostgreSQL engine with minimal Auth/Profile scaffolding. It checks creation, global-owner isolation, member access, unauthorized creation/reassignment, status-only changes, stale revisions, nonmember assignee rejection, inactive membership, and anonymous access. It never touches a hosted database.
- `npm test` includes Operations workload summaries and the updated navigation registry contract.
- `npm run typecheck`, `npm run lint`, and `npm run build` cover application integration.

The isolated database harness does not replace hosted Auth/PostgREST or signed-in browser QA. This development environment has no CRM-development credentials or deployment linkage, so those checks remain pending. Procedures/wiki, notifications, full agency onboarding, integrations, and a separate platform administrator role are later work.
