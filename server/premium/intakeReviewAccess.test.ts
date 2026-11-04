import {it,expect} from 'vitest'
import {execFileSync} from 'node:child_process'
it('enforces actual Postgres review-assignment visibility and owner-only reassignment',()=>{expect(execFileSync(process.execPath,['scripts/test-intake-review-assignment.mjs'],{encoding:'utf8'})).toContain('PASS: owner sees all')},30000)
