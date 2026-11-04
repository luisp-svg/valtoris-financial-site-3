# Read-only privilege baseline

`scripts/sql/academy/privilege-snapshot.sql` is a single SELECT over public-schema
catalogs. It reads effective relation/function privileges for anon/authenticated
and explicit default ACL entries, including PUBLIC. It reads no customer rows,
secrets or function bodies and changes no role, session, schema or data.

Use an already authorized administrative read connection. Save the JSON value of
the returned `snapshot` column outside Git; do not save the SQL client envelope.
The local report command does not connect to Supabase or load environment files:

```sh
node scripts/audit-database-privileges.mjs /outside/repo/snapshot.json
node scripts/audit-database-privileges.mjs /outside/repo/snapshot.json --fail-on-high
node --test scripts/audit-database-privileges.test.mjs
```

High findings include dangerous base-table privileges, accessible ordinary or
partitioned tables with RLS disabled, callable definer functions lacking a
function-level search path, and dangerous explicit defaults for new relations.
View grants are reported separately: they are not proof of truncatable base
tables. Definer execution alone is a review item, not proof of an exploit.

This snapshot does not establish Data API exposure, policy correctness, column
grants, sequence access, intended authorization or session isolation. Explicit
default ACL entries are not a complete model of effective future privileges:
built-in PUBLIC function EXECUTE, inherited memberships and global/schema defaults
still need review. A search_path setting is not proof its schemas are trusted.
Empty/partial results cannot prove safety. Always compare counts with the full
administrative inventory and test actual role behavior in an authorized test
environment before changing grants.

Do not automatically revoke every flagged privilege or SECURITY DEFINER function.
Document intended callers, preserve authorized CRM operations, and prepare a
separate reviewed hardening migration. Neither this query nor its report applies
any hardening changes.
