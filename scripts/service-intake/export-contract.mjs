import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
const cache = new Map()
function load(filename) {
  const absolute = path.resolve(filename)
  if (cache.has(absolute)) return cache.get(absolute)
  const module = { exports: {} }
  cache.set(absolute, module.exports)
  const js = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const requireLocal = specifier => {
    if (!specifier.startsWith('./')) throw new Error('Only local intake schemas may be imported')
    return load(path.resolve(path.dirname(absolute), `${specifier}.ts`))
  }
  new Function('module', 'exports', 'require', js)(module, module.exports, requireLocal)
  return module.exports
}
const schema = load('crm/serviceIntakes/additionalServiceSchema.ts')
const contracts = Object.fromEntries(Object.entries(schema.ADDITIONAL_SERVICE_CONTRACTS).map(([id,c])=>[id,{...c,tracks:[id]}]))
const sql = `-- Generated from additionalServiceSchema.ts.
CREATE OR REPLACE FUNCTION public.additional_service_intake_contract(p_service text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $contract$
SELECT $json$${JSON.stringify(contracts)}$json$::jsonb -> p_service;
$contract$;
REVOKE ALL ON FUNCTION public.additional_service_intake_contract(text) FROM PUBLIC, anon, authenticated;
`
const out = 'supabase/migrations/068_service_intake_contracts.sql'
if(process.argv.includes('--check')){if(fs.readFileSync(out,'utf8')!==sql)throw new Error('Service intake contract mismatch')}else fs.writeFileSync(out,sql)
