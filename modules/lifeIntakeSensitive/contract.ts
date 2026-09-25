export const HEALTH_FIELDS = [
 ['height','Height (include units)'],['weight','Weight (include units)'],['tobacco','Tobacco / nicotine use, type, frequency, and last use'],['conditions','Diagnosed conditions, dates, and current status'],['treatment','Treatment, procedures, hospitalizations, and dates'],['medications','Medications, dosage, reason, and prescribing physician'],['physician','Primary physician / clinic and contact information'],['lastVisit','Most recent physician visit and reason'],['pending','Pending tests, referrals, or treatment'],['familyHistory','Relevant parents’ / family health history, ages, and cause of death if applicable'],
] as const
export type HealthKey=typeof HEALTH_FIELDS[number][0]
export type LifeSensitiveAnswers={version:1;ssn:string;health:Record<HealthKey,string>;confirmedInsured:boolean;collectionNote:string}
export const emptyLifeSensitive=():LifeSensitiveAnswers=>({version:1,ssn:'',health:Object.fromEntries(HEALTH_FIELDS.map(([k])=>[k,''])) as Record<HealthKey,string>,confirmedInsured:false,collectionNote:''})
export function validLifeSensitive(raw:unknown):raw is LifeSensitiveAnswers{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false
 const a=raw as LifeSensitiveAnswers
 if(Object.keys(a).sort().join(',')!=='collectionNote,confirmedInsured,health,ssn,version'||a.version!==1||a.confirmedInsured!==true||typeof a.ssn!=='string'||(a.ssn!==''&&!/^(?!000|666|9\d\d)\d{3}(?!00)\d{2}(?!0000)\d{4}$/.test(a.ssn))||typeof a.collectionNote!=='string'||!a.collectionNote.trim()||a.collectionNote.length>1000)return false
 if(!a.health||typeof a.health!=='object'||Array.isArray(a.health)||Object.keys(a.health).length!==HEALTH_FIELDS.length)return false
 return HEALTH_FIELDS.every(([k])=>typeof a.health[k]==='string'&&a.health[k].length<=2000)
}
