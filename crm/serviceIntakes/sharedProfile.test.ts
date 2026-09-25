import {expect,it} from 'vitest'
import {emptySharedFacts,validateSharedFacts} from './sharedProfile'
import {parseIntakeOrigin,studentLoanIntakePath} from './intakeSource'
it('rejects sensitive fields and requires dated income',()=>{
 const f={...emptySharedFacts(),firstName:'Test',lastName:'Client'}
 expect(validateSharedFacts(f)).toEqual([])
 expect(validateSharedFacts({...f,ssn:'forbidden'})).not.toEqual([])
 expect(validateSharedFacts({...f,annualIncome:'12000'})).not.toEqual([])
 expect(validateSharedFacts({...f,annualIncome:'12000',incomeAsOf:'2026-01-01'})).toEqual([])
 expect(validateSharedFacts({...f,birthDate:'2026-02-30'})).not.toEqual([])
})
it('supports explicit member origins without accepting ambiguous sources',()=>{
 const h='11111111-1111-4111-8111-111111111111',m='22222222-2222-4222-8222-222222222222'
 const origin=parseIntakeOrigin(h,new URLSearchParams({member:m}))!
 expect(origin).toEqual({kind:'member',id:m,householdId:h})
 expect(studentLoanIntakePath(origin)).toContain('?member=')
 expect(parseIntakeOrigin(h,new URLSearchParams({member:m,contact:m}))).toBeNull()
})
