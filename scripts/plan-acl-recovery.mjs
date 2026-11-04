import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const targetRoles = new Set(['PUBLIC','anon','authenticated'])
const tablePrivileges = new Set(['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'])
const quote = value => `"${value.replaceAll('"','""')}"`
const objectKey = row => JSON.stringify([row.kind,row.objectId,row.subId])
const grantKey = row => JSON.stringify([row.grantor,row.grantee,row.privilege,row.grantable])
const targeted = (object, grant) => targetRoles.has(grant.grantee) && (
  object.kind === 'function' ? grant.privilege === 'EXECUTE'
    : object.kind === 'column' ? grant.privilege === 'REFERENCES'
      : tablePrivileges.has(grant.privilege))

function validate(snapshot) {
  const fail = () => { throw new Error('Invalid recovery snapshot; use the scoped query and a verified source label') }
  if (!snapshot || snapshot.formatVersion!==1 || snapshot.scope!=='academy-browser-hardening'
    || typeof snapshot.sourceLabel!=='string' || !snapshot.sourceLabel.trim()
    || snapshot.sourceLabel==='REPLACE_WITH_PROJECT_REF' || typeof snapshot.database!=='string'
    || !Number.isInteger(snapshot.serverMajor) || snapshot.serverMajor<17
    || !Array.isArray(snapshot.objects) || !snapshot.objects.length) fail()
  const objects = new Map()
  for (const o of snapshot.objects) {
    if (!o || !['table','column','function','default'].includes(o.kind) || o.owner!=='postgres'
      || typeof o.name!=='string' || !o.name || typeof o.objectId!=='string' || !o.objectId
      || !Number.isInteger(o.subId) || !Array.isArray(o.grants)) fail()
    if (o.kind==='column' ? typeof o.column!=='string' || !o.column || o.subId<1
      : o.column!==null || o.subId!==0) fail()
    if (o.kind==='function' && (!['handle_new_auth_user','rls_auto_enable'].includes(o.name)
      || !['trigger','event_trigger'].includes(o.returnType))) fail()
    if (o.kind!=='function' && o.returnType!==null) fail()
    if (o.kind==='default' ? o.shape!==null : typeof o.shape!=='string' || !o.shape) fail()
    if (o.kind==='table' && !['r','p'].includes(o.shape)) fail()
    if (o.kind==='function' && !/^[0-9a-f]{32}$/.test(o.shape)) fail()
    if (o.kind==='default' && (o.name!=='tables' || o.objectId!=='postgres/public/tables')) fail()
    if (o.kind!=='default' && !/^\d+$/.test(o.objectId)) fail()
    if (objects.has(objectKey(o))) fail()
    const grants = new Set()
    const allowed=o.kind==='function'?new Set(['EXECUTE'])
      :o.kind==='column'?new Set(['SELECT','INSERT','UPDATE','REFERENCES'])
        :new Set(['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'])
    for (const g of o.grants) {
      if (!g || typeof g.grantor!=='string' || !g.grantor || typeof g.grantee!=='string' || !g.grantee
        || !allowed.has(g.privilege) || typeof g.grantable!=='boolean') fail()
      if (grants.has(grantKey(g))) fail()
      grants.add(grantKey(g))
      // Recovery preserves grant provenance. Do not reissue another grantor's grants.
      if (targeted(o,g) && g.grantor!=='postgres') fail()
    }
    objects.set(objectKey(o),o)
  }
  if ([...objects.values()].filter(o=>o.kind==='default').length!==1) fail()
  for (const o of objects.values()) if (o.kind==='column') {
    const parent=objects.get(JSON.stringify(['table',o.objectId,0]))
    if (!parent || parent.name!==o.name) fail()
  }
  return objects
}

export function planAclRecovery(before, current) {
  const original=validate(before), now=validate(current)
  if (before.sourceLabel!==current.sourceLabel || before.database!==current.database || before.serverMajor!==current.serverMajor) {
    throw new Error('Recovery source mismatch; verify both snapshots came from the same database')
  }
  if (original.size!==now.size) throw new Error('Object inventory changed; recovery requires manual review')
  const statements=[]
  for (const [key,o] of [...original].sort(([a],[b])=>a.localeCompare(b,'en'))) {
    const c=now.get(key)
    if (!c || ['kind','objectId','subId','name','column','owner','returnType','shape'].some(k=>o[k]!==c[k])) {
      throw new Error('Object identity or ownership changed; recovery requires manual review')
    }
    const oldGrants=new Set(o.grants.map(grantKey)), currentGrants=new Set(c.grants.map(grantKey))
    if (c.grants.some(g=>!oldGrants.has(grantKey(g)))) throw new Error('Grants were added or changed; recovery requires manual review')
    for (const g of [...o.grants].sort((a,b)=>grantKey(a).localeCompare(grantKey(b),'en'))) {
      if (currentGrants.has(grantKey(g))) continue
      if (!targeted(o,g)) throw new Error('Unrelated privileges changed; recovery requires manual review')
      const role=g.grantee==='PUBLIC'?'PUBLIC':quote(g.grantee)
      const suffix=` TO ${role}${g.grantable?' WITH GRANT OPTION':''};`
      const qualified=`${quote('public')}.${quote(o.name)}`
      if (o.kind==='table') statements.push(`GRANT ${g.privilege} ON TABLE ${qualified}${suffix}`)
      else if (o.kind==='column') statements.push(`GRANT REFERENCES (${quote(o.column)}) ON TABLE ${qualified}${suffix}`)
      else if (o.kind==='function') statements.push(`GRANT EXECUTE ON FUNCTION ${qualified}()${suffix}`)
      else statements.push(`ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ${g.privilege} ON TABLES${suffix}`)
    }
  }
  return {
    formatVersion:1,status:'manual-review-required',sourceLabel:before.sourceLabel,
    objectCount:original.size,removedGrantCount:statements.length,statements,
    limitations:[
      'These statements restore only removed grants within the captured proposal scope; they do not roll back data, definitions, role memberships or policies.',
      'Source labels are operator assertions, not independently verified database identities. Verify project identity and capture complete snapshots.',
      'Snapshots can become stale. Recollect and compare immediately before separately authorized recovery; this tool does not connect to or modify a database.',
      'The full database ACL backup, including managed-owner/global defaults and grant chains outside this proposal, remains a separate prerequisite.',
      'Function definition hashes and column types are checked; table data, policies, memberships and the rest of the schema are not compared.',
    ],
  }
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length!==4) throw new Error('Usage: node scripts/plan-acl-recovery.mjs <before.json> <current.json>')
    let before,current
    try { before=JSON.parse(readFileSync(process.argv[2],'utf8')); current=JSON.parse(readFileSync(process.argv[3],'utf8')) }
    catch { throw new Error('Cannot read valid recovery snapshot JSON files') }
    process.stdout.write(`${JSON.stringify(planAclRecovery(before,current),null,2)}\n`)
  } catch(error) { process.stderr.write(`ACL recovery: ${error.message}\n`); process.exitCode=1 }
}
