import {afterEach,expect,it,vi} from 'vitest'
import {encryptLifeSensitive,decryptLifeSensitive} from './crypto'
import {emptyLifeSensitive,validLifeSensitive} from '../../modules/lifeIntakeSensitive/contract'
afterEach(()=>vi.unstubAllEnvs())
it('encrypts with a unique nonce and binds ciphertext to intake and insured',()=>{
 vi.stubEnv('LIFE_INTAKE_ENCRYPTION_KEY_V1','ab'.repeat(32))
 const value={...emptyLifeSensitive(),confirmedInsured:true,collectionNote:'Synthetic permission reference',ssn:'123456789'}
 const a=encryptLifeSensitive(value,'intake','member'),b=encryptLifeSensitive(value,'intake','member')
 expect(a).not.toBe(b);expect(a).not.toContain(value.ssn)
 expect(decryptLifeSensitive(a,'intake','member')).toEqual(value)
 expect(()=>decryptLifeSensitive(a,'other','member')).toThrow('could not be opened')
 const bytes=Buffer.from(a,'base64');bytes[30]^=1
 expect(()=>decryptLifeSensitive(bytes.toString('base64'),'intake','member')).toThrow('could not be opened')
})
it('fails closed without a configured key',()=>{
 vi.stubEnv('LIFE_INTAKE_ENCRYPTION_KEY_V1','')
 expect(()=>encryptLifeSensitive({...emptyLifeSensitive(),confirmedInsured:true,collectionNote:'Synthetic permission reference'},'i','m')).toThrow('unavailable')
})
it('rejects unknown fields and requires confirmation of the insured',()=>{
 expect(validLifeSensitive(emptyLifeSensitive())).toBe(false)
 expect(validLifeSensitive({...emptyLifeSensitive(),confirmedInsured:true,collectionNote:'Synthetic permission reference',extra:'not allowed'})).toBe(false)
 expect(validLifeSensitive({...emptyLifeSensitive(),confirmedInsured:true,collectionNote:'Synthetic permission reference',ssn:'000001234'})).toBe(false)
 expect(validLifeSensitive({...emptyLifeSensitive(),confirmedInsured:true,collectionNote:'Synthetic permission reference'})).toBe(true)
})
