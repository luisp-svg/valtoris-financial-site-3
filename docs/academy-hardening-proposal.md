# Browser privilege hardening proposal

This is a review-only SQL candidate under scripts/sql/academy, outside automatic
Supabase migrations. It has not been applied to either hosted database. It is
tested only in disposable, in-memory PostgreSQL (PGlite) with synthetic records.

Scope:

- Revoke TRUNCATE, REFERENCES, TRIGGER and MAINTAIN from PUBLIC/anon/authenticated on
  postgres-owned public ordinary and partitioned tables.
- Revoke column-level REFERENCES on those tables as well; preserve column DML.
- Revoke direct execution on the zero-argument internal trigger helpers
  handle_new_auth_user and rls_auto_enable when present and shaped as expected.
- Remove those four privileges from postgres's schema-local future table defaults.
- Leave DML, policies, RLS, intended RPCs, view grants, service_role grants,
  function definitions, sequences and managed-owner defaults unchanged.

PostgreSQL 17 or newer is required. The transaction aborts for unexpected owners/helper types, dangerous global
defaults, or inherited privileges that remain after direct revocation. It uses
RESTRICT, not CASCADE. Do not resolve an abort by broadening the script blindly.
Other roles relying only on PUBLIC grants may lose these privileges; inventory
their intended access before any hosted use.
Membership in pg_maintain also stops the proposal for separate review.

Tests:

```sh
node --test scripts/test-academy-hardening-db.mjs
```

The repository already declares @electric-sql/pglite. Tests use no connection URL
or environment files. They verify preserved advisor DML and cross-advisor RLS,
continued execution of an attached trigger despite direct EXECUTE revocation,
intended RPC/service-role access, future-object defaults, repeat application and
transaction rollback when inherited/global grants or unexpected shapes exist.
Tests also cover column-only REFERENCES, quoted column names, MAINTAIN,
maintenance-role membership, partitions and zero-column tables. They passed using
PGlite 0.5.8 (PostgreSQL 18.3) and a separate PGlite 0.3.14 compatibility runtime
(PostgreSQL 17.5). The repository dependency remains unchanged. These fixtures are
not a full hosted Supabase or CRM integration test.

Remaining before hosted authorization: capture complete ACL backups; review
supabase_admin defaults and other object owners; review global/inherited grants;
verify other column/sequence privileges, Data API settings and function-default
EXECUTE separately; run full CRM regressions with actual advisor sessions. This
proposal intentionally does not claim to complete every privilege-hardening item.

Recovery must restore reviewed captured ACLs rather than GRANT ALL. No automatic
rollback script is supplied because the original intended grants vary by object.
Any hosted execution or promotion into automatic migrations requires a separate
explicit request. References:

- https://www.postgresql.org/docs/17/sql-revoke.html
- https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html
