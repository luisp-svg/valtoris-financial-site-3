# Scoped ACL capture and recovery review

Before any separately authorized hosted hardening, capture the grants that the
proposal could change using `scripts/sql/academy/acl-recovery-snapshot.sql`.
Replace its `REPLACE_WITH_PROJECT_REF` source label with the independently verified
project ref. The query is read-only: it returns object identity, owners, explicit
grants, grantors, grant options, column types and helper-definition hashes. It
returns no customer rows, credentials or function bodies.

Save the JSON value of the `snapshot` column outside Git. Capture another snapshot
after the separately authorized operation using the same verified source label.
The planner reads those local JSON files only:

```sh
node scripts/plan-acl-recovery.mjs /outside/repo/before.json /outside/repo/current.json
node --test scripts/test-academy-recovery-db.mjs
```

It produces JSON containing review-only GRANT statements for missing captured
privileges. It preserves grant options and handles PUBLIC distinctly from named
roles. It never issues GRANT ALL, connects to a database, or executes recovery.
It refuses changed owners/object identities/helper definitions/column types,
unrelated privilege changes, newly added grants, unexpected grantors, missing
objects, duplicate rows and mismatched source labels.

This is a scoped recovery inventory, not a complete database backup. It covers
public base tables and columns, the two zero-argument internal trigger helpers,
and postgres's schema-local future table defaults. Views, other functions,
managed-role/global defaults, role memberships, policies and data are outside
this scope. Complete ACL backups and intended-access review remain prerequisites.

Source labels are assertions supplied by the operator; matching labels do not
independently prove project identity. Snapshots can be partial or become stale.
Verify the project, complete inventory, current privileges and execution role
again immediately before any separately authorized recovery. Do not pipe this
output into a database client. Restoring old grants can reintroduce the risks the
proposal removes, so every restoration needs a deliberate review.

In-memory tests show exact restoration of the captured ACL rows, including grant
options, and refusal of unrelated drift. They do not prove hosted recovery or
full CRM behavior. No backup artifact or private snapshot is committed.
