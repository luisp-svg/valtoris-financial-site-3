-- DEPRECATED monolithic repair.
-- Replaced by staged plan:
--   scripts/sql/repair-dev-auth/README.md
--   scripts/sql/repair-dev-auth/phase-a-verify.sql
--   scripts/sql/repair-dev-auth/phase-b-neutralize-auth.sql
--   scripts/sql/repair-dev-auth/phase-c-create-users.mjs
--   scripts/sql/repair-dev-auth/phase-d-remap-public.sql
--   scripts/sql/repair-dev-auth/phase-e-delete-auth.sql
--
-- Do not execute this file.

do $$
begin
  raise exception 'Deprecated: use scripts/sql/repair-dev-auth/ staged phases (see README.md)';
end $$;
