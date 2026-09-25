import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto'
import {validLifeSensitive,type LifeSensitiveAnswers} from '../../modules/lifeIntakeSensitive/contract.js'
function key(){const value=process.env.LIFE_INTAKE_ENCRYPTION_KEY_V1;if(!value||!/^[0-9a-f]{64}$/i.test(value))throw new Error('Protected intake is unavailable.');return Buffer.from(value,'hex')}
const aad=(intakeId:string,memberId:string)=>Buffer.from(`valtoris:life-intake:v1:${intakeId}:${memberId}`)
export function encryptLifeSensitive(value:LifeSensitiveAnswers,intakeId:string,memberId:string):string{
 if(!validLifeSensitive(value))throw new Error('Invalid protected intake.')
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);cipher.setAAD(aad(intakeId,memberId))
 const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()])
 return Buffer.concat([iv,cipher.getAuthTag(),ciphertext]).toString('base64')
}
export function decryptLifeSensitive(value:string,intakeId:string,memberId:string):LifeSensitiveAnswers{
 try{const packed=Buffer.from(value,'base64');if(packed.length<29||packed.length>50000)throw new Error();const decipher=createDecipheriv('aes-256-gcm',key(),packed.subarray(0,12));decipher.setAAD(aad(intakeId,memberId));decipher.setAuthTag(packed.subarray(12,28));const raw:unknown=JSON.parse(Buffer.concat([decipher.update(packed.subarray(28)),decipher.final()]).toString('utf8'));if(!validLifeSensitive(raw))throw new Error();return raw}catch{throw new Error('Protected intake could not be opened.')}
}
