import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../../supabase/migrations/20261028150953_household_directory_pagination.sql', import.meta.url), 'utf8')
const hardening = readFileSync(new URL('../../supabase/migrations/20261028150954_crm_privilege_hardening.sql', import.meta.url), 'utf8')
const owner = '00000000-0000-4000-8000-000000000001'
const advisor = '00000000-0000-4000-8000-000000000002'
const other = '00000000-0000-4000-8000-000000000003'
const outsider = '00000000-0000-4000-8000-000000000004'
const stage = '00000000-0000-4000-8000-000000000005'
const inactive = '00000000-0000-4000-8000-000000000006'
type Directory = { total: number; page: number; pageSize: number; rows: Array<{ id: string; display_name: string; members: Array<Record<string, unknown>> }>; advisors: Array<{ id: string }>; stages: Array<{ id: string }> }
let db: PGlite
async function asUser(id: string, role = 'authenticated') {
  await db.exec('RESET ROLE')
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id])
  await db.exec(`SET ROLE ${role}`)
}
async function search(text = '', page = 1, args: { stage?: string; advisor?: string; assignment?: string; pageSize?: number } = {}) {
  const result = await db.query<{ result: Directory }>(
    'SELECT public.search_household_directory($1,$2,$3,$4,$5,$6) AS result',
    [text, args.stage ?? null, args.advisor ?? null, args.assignment ?? 'all', page, args.pageSize ?? 50],
  )
  return result.rows[0].result
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    CREATE TABLE profiles(id uuid PRIMARY KEY, role text, is_active boolean DEFAULT true, deleted_at timestamptz);
    CREATE FUNCTION crm_is_owner() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
      SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='owner' AND is_active AND deleted_at IS NULL)
    $$;
    CREATE TABLE advisor_profiles(id uuid PRIMARY KEY, display_name text);
    CREATE TABLE pipeline_stages(id uuid PRIMARY KEY, name text, code text);
    CREATE TABLE households(id uuid PRIMARY KEY, display_name text, status text DEFAULT 'client', primary_email text, primary_phone text,
      assigned_advisor_id uuid, summary_user_id uuid, relationship_stage_id uuid, updated_at timestamptz,
      deleted_at timestamptz, merged_into_household_id uuid, lead_source text);
    CREATE TABLE household_members(id uuid PRIMARY KEY, household_id uuid, first_name text, last_name text,
      relationship text DEFAULT 'primary', is_primary_contact boolean DEFAULT true, email text, phone text,
      date_of_birth date DEFAULT '1980-01-01', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), deleted_at timestamptz);
    ALTER TABLE households ENABLE ROW LEVEL SECURITY;
    ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
    CREATE POLICY household_scope ON households FOR SELECT TO authenticated USING (
      crm_is_owner() OR (EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='advisor' AND is_active AND deleted_at IS NULL)
        AND (assigned_advisor_id=auth.uid() OR summary_user_id=auth.uid())));
    CREATE POLICY member_scope ON household_members FOR SELECT TO authenticated USING (
      crm_is_owner() OR EXISTS(SELECT 1 FROM households h WHERE h.id=household_id AND h.assigned_advisor_id=auth.uid()));
    GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO anon;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    CREATE TABLE auth_users(id uuid PRIMARY KEY);
    CREATE FUNCTION handle_new_auth_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
      BEGIN INSERT INTO profiles(id,role) VALUES(NEW.id,'advisor'); RETURN NEW; END
    $$;
    CREATE TRIGGER new_auth AFTER INSERT ON auth_users FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
    GRANT INSERT ON auth_users TO authenticated;
    CREATE FUNCTION sp_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable'; END $$;
  `)
  await db.query("INSERT INTO profiles(id, role) VALUES ($1,'owner'),($2,'advisor'),($3,'advisor')", [owner, advisor, other])
  await db.query("INSERT INTO profiles(id,role,is_active) VALUES ($1,'advisor',false)", [inactive])
  await db.query("INSERT INTO advisor_profiles VALUES ($1,'Advisor A'),($2,'Advisor B');", [advisor, other])
  await db.query("INSERT INTO pipeline_stages VALUES ($1,'Active','active')", [stage])
  await db.query(`INSERT INTO households(id,display_name,assigned_advisor_id,relationship_stage_id,updated_at)
    SELECT md5('household'||i)::uuid, 'Household '||i,
      CASE WHEN i>1570 THEN NULL WHEN i%2=0 THEN $1::uuid ELSE $2::uuid END,
      CASE WHEN i%2=0 THEN $3::uuid ELSE NULL END,
      '2026-10-28T12:00:00Z'::timestamptz - i*interval '1 second'
    FROM generate_series(1,1581) i`, [advisor, other, stage])
  await db.exec(`
    INSERT INTO household_members(id,household_id,first_name,last_name)
      VALUES(md5('member')::uuid,md5('household1581')::uuid,'Hidden %','Member_1581');
    INSERT INTO household_members(id,household_id,first_name,last_name,deleted_at)
      VALUES(md5('archived_member')::uuid,md5('household2')::uuid,'Archived','Person',now());
    INSERT INTO households(id,display_name,updated_at,status,lead_source) VALUES(md5('network')::uuid,'Networking only',now(),'lead','manual_contact');
    INSERT INTO households(id,display_name,updated_at,deleted_at) VALUES(md5('deleted')::uuid,'Archived household',now(),now());
    INSERT INTO households(id,display_name,updated_at,merged_into_household_id) VALUES(md5('merged')::uuid,'Merged household',now(),md5('household1')::uuid);
  `)
  await db.exec(migration)
}, 30_000)
afterAll(async () => { await db?.close() })
afterEach(async () => {
  await db.exec('RESET ROLE')
  await db.exec(`
    UPDATE households SET summary_user_id=NULL WHERE id=md5('household3')::uuid;
    DELETE FROM household_members WHERE id=md5('summary-member')::uuid;
    UPDATE households SET updated_at='2026-10-28T12:00:00Z'::timestamptz - interval '1 second' WHERE id=md5('household1')::uuid;
    UPDATE households SET updated_at='2026-10-28T12:00:00Z'::timestamptz - interval '2 seconds' WHERE id=md5('household2')::uuid;
    UPDATE households SET deleted_at=NULL WHERE id=md5('household1581')::uuid;
  `)
  await db.query("UPDATE households SET assigned_advisor_id=$1 WHERE id=md5('household2')::uuid", [advisor])
})

describe('household directory with database RLS', () => {
  it('retrieves every household beyond the old 1,000 cap without duplicates', async () => {
    await asUser(owner)
    const ids: string[] = []
    for (let page = 1; page <= 32; page++) {
      const result = await search('', page)
      expect(result.total).toBe(1581)
      expect(result.rows.length).toBe(page === 32 ? 31 : 50)
      ids.push(...result.rows.map(row => row.id))
    }
    expect(new Set(ids).size).toBe(1581)
    const lastRows = (await search('', 32)).rows
    expect(lastRows[lastRows.length - 1]?.display_name).toBe('Household 1581')
  })
  it('searches member names beyond the first page and treats %/_ literally', async () => {
    await asUser(owner)
    const result = await search('hidden % member_1581')
    expect(result.total).toBe(1)
    expect(result.rows[0].display_name).toBe('Household 1581')
    expect(result.rows[0].members[0]).not.toHaveProperty('date_of_birth')
    expect((await search('%')).total).toBe(1)
    expect((await search('Archived Person')).total).toBe(0)
  })
  it('applies filters before count/page and preserves filter options on empty searches', async () => {
    await asUser(owner)
    expect((await search('', 1, { assignment: 'unassigned' })).total).toBe(11)
    expect((await search('', 1, { advisor })).total).toBe(785)
    expect((await search('', 1, { stage })).total).toBe(790)
    const empty = await search('No such person', 99)
    expect(empty.total).toBe(0)
    expect(empty.page).toBe(1)
    expect(empty.rows).toEqual([])
    expect(empty.advisors).toHaveLength(2)
    expect(empty.stages).toHaveLength(1)
  })
  it('clamps vanished last pages and uses an id tie-breaker for equal timestamps', async () => {
    await asUser(owner)
    expect((await search('', 999)).page).toBe(32)
    await db.exec('RESET ROLE')
    await db.exec("UPDATE households SET updated_at='2026-10-28T12:00:00Z' WHERE display_name IN ('Household 1','Household 2')")
    await asUser(owner)
    const rows = (await search()).rows.slice(0,2)
    expect(rows.map(row => row.id)).toEqual(rows.map(row => row.id).sort())
    await db.exec('RESET ROLE')
    await db.exec("UPDATE households SET deleted_at=now() WHERE display_name='Household 1581'")
    await asUser(owner)
    expect((await search('', 33)).page).toBe(32)
  })
  it('does not leak rows, counts, member search or filter options outside RLS', async () => {
    await asUser(advisor)
    const result = await search()
    expect(result.total).toBe(785)
    expect(result.advisors.map(a => a.id)).toEqual([advisor])
    expect((await search('Household 1')).rows.every(row => Number(row.display_name.split(' ')[1])%2===0)).toBe(true)
    await db.exec('RESET ROLE')
    await db.query('UPDATE households SET summary_user_id=$1 WHERE display_name=$2', [advisor,'Household 3'])
    await db.exec("INSERT INTO household_members(id,household_id,first_name,last_name) VALUES(md5('summary-member')::uuid,md5('household3')::uuid,'Secret','Intake Member')")
    await asUser(advisor)
    expect((await search('Household 3')).rows.find(row => row.display_name==='Household 3')?.members).toEqual([])
    expect((await search('Secret Intake Member')).total).toBe(0)
    await asUser(outsider)
    const denied = await search()
    expect(denied.total).toBe(0)
    expect(denied.rows).toEqual([])
    expect(denied.advisors).toEqual([])
    expect(denied.stages).toEqual([])
    await asUser(outsider, 'anon')
    await expect(search()).rejects.toThrow(/permission denied/)
  })
  it('rejects invalid pages, oversized requests and invalid assignment values', async () => {
    await asUser(owner)
    await expect(search('', 0)).rejects.toThrow(/Invalid household/)
    await expect(search('', 1, { pageSize: 101 })).rejects.toThrow(/Invalid household/)
    await expect(search('', 1, { assignment: 'anything' })).rejects.toThrow(/Invalid household/)
    await expect(search('x'.repeat(257))).rejects.toThrow(/Invalid household/)
  })
  it('denies an inactive assigned advisor and authenticated requests without a user identity', async () => {
    await db.exec('RESET ROLE')
    await db.query("UPDATE households SET assigned_advisor_id=$1 WHERE id=md5('household2')::uuid", [inactive])
    await asUser(inactive)
    expect((await search()).total).toBe(0)
    await asUser('')
    expect((await search()).rows).toEqual([])
  })
})

describe('CRM privilege hardening', () => {
  it('removes structural browser grants, preserves DML/service grants and auth trigger execution', async () => {
    await db.exec('RESET ROLE')
    await db.exec(hardening)
    const privileges = (await db.query<{ can_truncate: boolean; can_reference: boolean; can_trigger: boolean; can_select: boolean; can_insert: boolean; service_truncate: boolean; anon_auth_trigger: boolean; search_path: string[] }>(`SELECT
      has_table_privilege('authenticated','households','TRUNCATE') AS can_truncate,
      has_table_privilege('authenticated','households','REFERENCES') AS can_reference,
      has_table_privilege('anon','households','TRIGGER') AS can_trigger,
      has_table_privilege('authenticated','households','SELECT') AS can_select,
      has_table_privilege('authenticated','households','INSERT') AS can_insert,
      has_table_privilege('service_role','households','TRUNCATE') AS service_truncate,
      has_function_privilege('anon','handle_new_auth_user()','EXECUTE') AS anon_auth_trigger,
      (SELECT proconfig FROM pg_proc WHERE oid='sp_history_immutable()'::regprocedure) AS search_path
    `)).rows[0]
    expect(privileges).toMatchObject({ can_truncate: false, can_reference: false, can_trigger: false, can_select: true, can_insert: true, service_truncate: true, anon_auth_trigger: false })
    expect(privileges.search_path).toEqual(['search_path=pg_catalog, public'])
    await asUser(owner)
    const created = '00000000-0000-4000-8000-000000000099'
    await db.query('INSERT INTO auth_users(id) VALUES($1)',[created])
    await db.exec('RESET ROLE')
    expect((await db.query('SELECT role FROM profiles WHERE id=$1',[created])).rows).toEqual([{role:'advisor'}])
    await asUser(advisor)
    expect((await search()).total).toBe(785)
  })
})
