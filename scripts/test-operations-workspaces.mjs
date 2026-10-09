import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA extensions;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE FUNCTION extensions.gen_random_uuid() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
CREATE TABLE profiles(id uuid PRIMARY KEY,role text,is_active boolean DEFAULT true,deleted_at timestamptz);
GRANT SELECT ON profiles TO authenticated;
CREATE FUNCTION crm_is_owner() RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$ SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='owner' AND is_active AND deleted_at IS NULL) $$;
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=clock_timestamp();RETURN NEW;END $$;`);
await db.exec(
  readFileSync(
    new URL(
      "../docs/proposed-migrations/082_operations_workspaces.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
const a = "00000000-0000-0000-0000-000000000001",
  b = "00000000-0000-0000-0000-000000000002",
  c = "00000000-0000-0000-0000-000000000003";
await db.query(
  `INSERT INTO profiles(id,role) VALUES($1,'owner'),($2,'owner'),($3,'advisor')`,
  [a, b, c],
);
const as = async (id) => {
  await db.exec("RESET ROLE");
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [id]);
  await db.exec("SET ROLE authenticated");
};
await as(a);
const w = (
  await db.query(
    `INSERT INTO operations_workspaces(name,owner_user_id) VALUES('Valtoris',$1) RETURNING id`,
    [a],
  )
).rows[0].id;
await db.query(`INSERT INTO operations_members VALUES($1,$2),($1,$3)`, [
  w,
  a,
  c,
]);
const task = (
  await db.query(
    `INSERT INTO operations_items(workspace_id,kind,title,assigned_user_id) VALUES($1,'task','Review health intake',$2) RETURNING *`,
    [w, c],
  )
).rows[0];
await as(b);
assert.equal((await db.query("SELECT * FROM operations_items")).rows.length, 0);
assert.equal(
  (await db.query("SELECT * FROM operations_workspaces")).rows.length,
  0,
);
await assert.rejects(
  db.query(
    `INSERT INTO operations_items(workspace_id,kind,title) VALUES($1,'task','Spoof')`,
    [w],
  ),
);
await assert.rejects(
  db.query(`SELECT operations_set_status($1,'done',$2)`, [
    task.id,
    task.updated_at,
  ]),
);
const otherWorkspace = (
  await db.query(
    `INSERT INTO operations_workspaces(name,owner_user_id) VALUES('Other agency',$1) RETURNING id`,
    [b],
  )
).rows[0].id;
const otherProject = (
  await db.query(
    `INSERT INTO operations_items(workspace_id,kind,title) VALUES($1,'project','Other project') RETURNING id`,
    [otherWorkspace],
  )
).rows[0].id;
await as(a);
await assert.rejects(
  db.query(
    `INSERT INTO operations_items(workspace_id,kind,title,parent_id) VALUES($1,'task','Cross-workspace link',$2)`,
    [w, otherProject],
  ),
);
await assert.rejects(
  db.query(
    `INSERT INTO operations_items(workspace_id,kind,title,parent_id) VALUES($1,'task','Task parent',$2)`,
    [w, task.id],
  ),
);
const project = (
  await db.query(
    `INSERT INTO operations_items(workspace_id,kind,title) VALUES($1,'project','Health launch') RETURNING id`,
    [w],
  )
).rows[0].id;
await assert.rejects(
  db.query(
    `INSERT INTO operations_items(workspace_id,kind,title,parent_id) VALUES($1,'project','Nested project',$2)`,
    [w, project],
  ),
);
await db.query(
  `INSERT INTO operations_items(workspace_id,kind,title,parent_id) VALUES($1,'task','Valid project task',$2)`,
  [w, project],
);
await as(c);
assert.equal((await db.query("SELECT * FROM operations_items")).rows.length, 3);
assert.equal(
  (
    await db.query(
      `UPDATE operations_items SET assigned_user_id=$1 WHERE id=$2 RETURNING id`,
      [a, task.id],
    )
  ).rows.length,
  0,
);
await assert.rejects(
  db.query(
    `INSERT INTO operations_items(workspace_id,kind,title) VALUES($1,'task','Unauthorized')`,
    [w],
  ),
);
await db.query(`SELECT operations_set_status($1,'in_progress',$2)`, [
  task.id,
  task.updated_at,
]);
await assert.rejects(
  db.query(`SELECT operations_set_status($1,'done',$2)`, [
    task.id,
    task.updated_at,
  ]),
);
await as(a);
await assert.rejects(
  db.query(
    `INSERT INTO operations_items(workspace_id,kind,title,assigned_user_id) VALUES($1,'task','Nonmember',$2)`,
    [w, b],
  ),
);
await db.exec("RESET ROLE");
await db.query("UPDATE profiles SET is_active=false WHERE id=$1", [c]);
await as(c);
assert.equal((await db.query("SELECT * FROM operations_items")).rows.length, 0);
await db.exec("RESET ROLE; SET ROLE anon");
await assert.rejects(db.query("SELECT * FROM operations_items"));
console.log(
  "Operations SQL checks passed: workspace isolation, cross-workspace project-link rejection, project-parent validation, global owner isolation, member read access, assignment boundaries, status-only actions, optimistic conflict, inactive user denial, anonymous denial.",
);
await db.close();
