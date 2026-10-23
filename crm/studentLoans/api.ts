import {STUDENT_LOAN_WORKFLOW_URL} from '../../modules/studentLoanReview/contract'
export async function loanRequest<T>(body:Record<string,unknown>,signal?:AbortSignal):Promise<T> {
 const response=await fetch(STUDENT_LOAN_WORKFLOW_URL,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal})
 const data=await response.json()
 if(!response.ok||!data.ok)throw new Error(data.error||'The student loan request could not be completed.')
 return data as T
}
