import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const proposal = readFileSync(new URL('./sql/academy/proposed-browser-privilege-hardening.sql', import.meta.url), 'utf8')
const fixture = async () => {
  const db = new PGlite() // In-memory only. No URL, environment, disk path or external service.
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    CREATE TABLE public.example(id integer PRIMARY KEY, owner_name text, touched boolean DEFAULT false);
    ALTER TABLE public.example ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_rows ON public.example TO authenticated
      USING (owner_name=current_setting('test.actor',true)) WITH CHECK (owner_name=current_setting('test.actor',true));
    GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.example TO authenticated;
    GRANT TRUNCATE,REFERENCES,TRIGGER ON public.example TO anon;
    GRANT ALL ON public.example TO service_role;
    CREATE FUNCTION public.handle_new_auth_user() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.touched:=true; RETURN NEW; END $$;
    CREATE TRIGGER fixture_trigger BEFORE INSERT ON public.example FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
    CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
    CREATE FUNCTION public.allowed_rpc() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;
    GRANT EXECUTE ON FUNCTION public.handle_new_auth_user(),public.rls_auto_enable(),public.allowed_rpc() TO anon,authenticated,service_role;
    CREATE VIEW public.example_view WITH (security_invoker=true) AS SELECT * FROM public.example;
    GRANT SELECT,TRUNCATE,REFERENCES,TRIGGER ON public.example_view TO authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
  `)
  return db
}
const scalar = async (db, sql) => Object.values((await db.query(sql)).rows[0])[0]

test('proposal removes dangerous access while preserving RLS, DML, RPCs and trigger execution', async () => {
  const db = await fixture()
  try {
    await db.exec(proposal)
    for (const role of ['anon','authenticated']) for (const privilege of ['TRUNCATE','REFERENCES','TRIGGER']) {
      assert.equal(await scalar(db, `SELECT has_table_privilege('${role}','public.example','${privilege}')`), false)
    }
    for (const privilege of ['SELECT','INSERT','UPDATE','DELETE']) {
      assert.equal(await scalar(db, `SELECT has_table_privilege('authenticated','public.example','${privilege}')`), true)
    }
    assert.equal(await scalar(db, "SELECT has_table_privilege('service_role','public.example','TRUNCATE')"), true)
    assert.equal(await scalar(db, "SELECT has_table_privilege('authenticated','public.example_view','TRIGGER')"), true)
    assert.equal(await scalar(db, "SELECT has_function_privilege('authenticated','public.allowed_rpc()','EXECUTE')"), true)
    assert.equal(await scalar(db, "SELECT has_function_privilege('anon','public.handle_new_auth_user()','EXECUTE')"), false)
    assert.equal(await scalar(db, "SELECT has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE')"), false)
    await db.exec("SET ROLE authenticated; SET test.actor='advisor-a'; INSERT INTO public.example(id,owner_name) VALUES(1,'advisor-a');")
    assert.equal(await scalar(db, 'SELECT touched FROM public.example WHERE id=1'), true)
    await assert.rejects(db.exec("INSERT INTO public.example(id,owner_name) VALUES(2,'advisor-b')"), /row-level security/)
    await db.exec("UPDATE public.example SET owner_name='advisor-a' WHERE id=1; SET test.actor='advisor-b';")
    assert.equal(await scalar(db, 'SELECT count(*)::integer FROM public.example'), 0)
    await db.exec("SET test.actor='advisor-a'; DELETE FROM public.example WHERE id=1; RESET ROLE;")
    await db.exec('CREATE TABLE public.future_example(id integer)')
    for (const privilege of ['TRUNCATE','REFERENCES','TRIGGER']) {
      assert.equal(await scalar(db, `SELECT has_table_privilege('authenticated','public.future_example','${privilege}')`), false)
    }
    assert.equal(await scalar(db, "SELECT has_table_privilege('authenticated','public.future_example','SELECT')"), true)
    assert.equal(await scalar(db, "SELECT has_table_privilege('service_role','public.future_example','TRUNCATE')"), true)
    await db.exec(proposal) // Safe to review/reapply without widening grants.
  } finally { await db.close() }
})

test('inherited dangerous privileges abort and roll back earlier revocations', async () => {
  const db = await fixture()
  try {
    await db.exec('CREATE ROLE inherited_access; GRANT inherited_access TO authenticated; GRANT TRUNCATE ON public.example TO inherited_access;')
    await assert.rejects(db.exec(proposal), /hardening_inherited_table_grant_review_required/)
    await db.exec('ROLLBACK')
    assert.equal(await scalar(db, "SELECT has_table_privilege('anon','public.example','TRIGGER')"), true)
    assert.equal(await scalar(db, "SELECT has_function_privilege('anon','public.handle_new_auth_user()','EXECUTE')"), true)
  } finally { await db.close() }
})

test('global defaults and unexpected object owners require separate review', async () => {
  for (const [setup, error] of [
    ['ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT TRUNCATE ON TABLES TO authenticated', /hardening_global_or_inherited_default_review_required/],
    ['ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT TRUNCATE ON TABLES TO PUBLIC', /hardening_global_or_inherited_default_review_required/],
    ['CREATE ROLE inherited_access; GRANT inherited_access TO authenticated; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT TRIGGER ON TABLES TO inherited_access', /hardening_global_or_inherited_default_review_required/],
    ['CREATE ROLE other_owner; ALTER TABLE public.example OWNER TO other_owner', /hardening_unexpected_table_owner/],
  ]) {
    const db = await fixture()
    try {
      await db.exec(setup)
      await assert.rejects(db.exec(proposal), error)
      await db.exec('ROLLBACK')
    } finally { await db.close() }
  }
})

test('unexpected helper signatures are not silently altered', async () => {
  const db = await fixture()
  try {
    await db.exec('DROP FUNCTION public.rls_auto_enable(); CREATE FUNCTION public.rls_auto_enable() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;')
    await assert.rejects(db.exec(proposal), /hardening_unexpected_helper_shape/)
    await db.exec('ROLLBACK')
  } finally { await db.close() }
})
