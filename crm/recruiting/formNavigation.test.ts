import { expect, it } from 'vitest'
import { licensingFormKey } from './formNavigation'
it('isolates drafts for license, E&O, generic carrier, and each specific carrier',()=>{
 const keys=[licensingFormKey({kind:'credential',credentialKind:'license'}),licensingFormKey({kind:'credential',credentialKind:'eo'}),licensingFormKey({kind:'carrier'}),licensingFormKey({kind:'carrier',item:{carrier_id:'a'}}),licensingFormKey({kind:'carrier',item:{carrier_id:'b'}})]
 expect(new Set(keys).size).toBe(keys.length)
})
