import {it,expect} from 'vitest'
import {restoreStoredCombined,validateCombined,COMBINED_VERSION} from './legacyEngine'
import {combinedFixture} from '../../../server/premium/legacyTestFixtures'
it('restores only new missing fields for stored health reviews without relaxing intake',()=>{
 const old=combinedFixture(['health']);delete old.diagnostic['health.owner_status'];delete old.diagnostic['health.cost_records']
 expect(validateCombined(old)).toBeNull()
 const restored=restoreStoredCombined(old)!
 expect(restored.diagnostic['health.owner_status']).toBe('unknown');expect(restored.diagnostic['health.cost_records']).toBe('unknown')
 expect(old.diagnostic['health.owner_status']).toBeUndefined()
 delete old.diagnostic['health.purpose'];expect(restoreStoredCombined(old)).toBeNull()
 expect(COMBINED_VERSION).toBe(6)
})
it('restores new employer fields and retains existing answers',()=>{
 const old=combinedFixture(['benefits']);old.diagnostic['benefits.employees']='10'
 const restored=restoreStoredCombined(old)
 // Old minimal fixtures may reveal preexisting conditional questions; these must not be silently repaired.
 expect(restored).toBeNull()
 const valid=combinedFixture(['benefits']);delete valid.diagnostic['benefits.personal_review'];expect(restoreStoredCombined(valid)).not.toBeNull()
})
