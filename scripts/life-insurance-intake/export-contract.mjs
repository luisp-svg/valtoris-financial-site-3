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
const schema = load('crm/serviceIntakes/lifeInsuranceSchema.ts')
const contract = { tracks: schema.LIFE_INTAKE_TRACKS, sections: schema.LIFE_INTAKE_SECTIONS }
const sql = `-- Generated from lifeInsuranceSchema.ts; verify with node scripts/life-insurance-intake/export-contract.mjs --check.\nCREATE OR REPLACE FUNCTION public.life_insurance_intake_contract()\nRETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $contract$\nSELECT $json$${JSON.stringify(contract)}$json$::jsonb;\n$contract$;\nREVOKE ALL ON FUNCTION public.life_insurance_intake_contract() FROM PUBLIC, anon, authenticated;\n`
const out = 'supabase/migrations/063_life_insurance_intake_contract.sql'
if (process.argv.includes('--check')) {
  if (fs.readFileSync(out, 'utf8') !== sql) throw new Error('Life intake database contract differs from form schema')
} else fs.writeFileSync(out, sql)
