import { MAX_AID_DATA_BYTES, type AidInventory, type LoanFact } from '../../modules/studentLoanReview/contract.js'
const loanTypes = ['DIRECT STAFFORD SUBSIDIZED','DIRECT STAFFORD UNSUBSIDIZED','DIRECT SUBSIDIZED','DIRECT UNSUBSIDIZED','DIRECT PLUS GRADUATE','DIRECT PLUS PARENT','DIRECT CONSOLIDATED SUBSIDIZED','DIRECT CONSOLIDATED UNSUBSIDIZED','FFEL','PERKINS','STAFFORD','PLUS','CONSOLIDATION']
const typeCodes:Record<string,string>={D0:'DIRECT STAFFORD SUBSIDIZED',D1:'DIRECT STAFFORD SUBSIDIZED',D2:'DIRECT STAFFORD UNSUBSIDIZED',D3:'DIRECT PLUS GRADUATE',D4:'DIRECT PLUS PARENT',D5:'DIRECT CONSOLIDATED UNSUBSIDIZED',D6:'DIRECT CONSOLIDATED SUBSIDIZED',D7:'DIRECT PLUS CONSOLIDATED',D8:'DIRECT UNSUBSIDIZED (TEACH)',D9:'DIRECT CONSOLIDATED SUBSIDIZED',CL:'FFEL CONSOLIDATED',GB:'FFEL PLUS GRADUATE',PL:'FFEL PLUS PARENT',RF:'FFEL REFINANCED',SF:'FFEL STAFFORD SUBSIDIZED',SL:'FFEL SUPPLEMENTAL',SU:'FFEL STAFFORD UNSUBSIDIZED',SN:'FFEL STAFFORD NON-SUBSIDIZED',FI:'FEDERALLY INSURED',PU:'FEDERAL PERKINS',IC:'INCOME CONTINGENT',DU:'NATIONAL DEFENSE (PERKINS)',NU:'NATIONAL DIRECT (PERKINS)',EU:'PERKINS EXPANDED'}
const plans = ['SAVE','IBR','PAYE','ICR','REPAYE','STANDARD','GRADUATED','EXTENDED','INCOME BASED','INCOME CONTINGENT','PAY AS YOU EARN','REPAYMENT ASSISTANCE','TIERED STANDARD']
function known(value: string, options: string[], fallback: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g,' ').trim()
  return options.find(v => clean === v || clean.includes(v)) ?? fallback
}
function amount(value: string, max = 100_000_000): number | null {
  if (!/^\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,3})?%?$/.test(value.trim())) return null
  const n = Number(value.replace(/[$,%\s]/g,''))
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null
}
export function aidDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s|$)/.exec(value.trim())
  const iso = match ? `${match[3]}-${match[1]}-${match[2]}` : /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : ''
  return iso && Number.isFinite(Date.parse(iso)) && new Date(iso).toISOString().slice(0,10) === iso ? iso : null
}
/** Only typed, allowlisted financial facts survive. Student identity and contact lines are never copied. */
export function parseAidData(text: string): AidInventory {
  if (Buffer.byteLength(text,'utf8') > MAX_AID_DATA_BYTES || text.includes('\0') || !text.trim()) throw new Error('Upload a plain-text My Aid Data file up to 512 KB.')
  const lines = text.replace(/^\uFEFF/,'').split(/\r?\n/)
  if (lines.length > 16000) throw new Error('This file contains too many lines.')
  if (!lines.some(l => /^File Source:\s*.*(?:DEPARTMENT OF EDUCATION|NSLDS|STUDENTAID)/i.test(l)) || !lines.some(l => /^File Request Date:/i.test(l))) throw new Error('This does not appear to be a StudentAid.gov My Aid Data file.')
  const loans: LoanFact[] = []; let current: LoanFact | null = null; let sourceDate: string | null = null
  const warnings: string[] = []
  for (const [index,line] of lines.entries()) {
    const colon = line.indexOf(':'); if (colon < 0) continue
    const key = line.slice(0,colon).trim().toLowerCase(), value = line.slice(colon+1).trim()
    if (key === 'file request date') sourceDate = aidDate(value)
    if (key === 'loan type' || key === 'loan type code') {
      if (loans.length >= 300) throw new Error('This file exceeds 300 loan records; review it manually.')
      current = { number: loans.length+1, type: typeCodes[value] ?? known(value,loanTypes,'Unknown federal loan type'), principal:null,interest:null,interestRate:null,status:'Unknown',repaymentPlan:'Unknown',disbursedAt:null,evidenceLines:[index+1] }
      loans.push(current); continue
    }
    // Stop at unrelated grant/overpayment sections, so later fields cannot mutate the last loan.
    if (/^(grant type|grant award year|overpayment type)$/.test(key)) { current = null; continue }
    if (!current) continue
    let recognized = true
    switch (key) {
      case 'loan type description': if(current.type==='Unknown federal loan type')current.type=known(value,loanTypes,'Unknown federal loan type'); break
      case 'loan outstanding principal balance': current.principal=amount(value); break
      case 'loan outstanding interest balance': current.interest=amount(value); break
      case 'loan actual interest rate': current.interestRate=amount(value,100); break
      case 'loan statutory interest rate':
      case 'loan interest rate': if(current.interestRate===null)current.interestRate=amount(value,100); break
      case 'current loan status': current.status=/^[A-Z0-9]{1,3}$/.test(value)?value:'Unknown'; break
      case 'current loan status description': if(current.status==='Unknown')current.status=known(value,['IN REPAYMENT','DEFAULT','DELINQUENT','FORBEARANCE','DEFERRED','PAID IN FULL','IN SCHOOL','GRACE'],'Unknown'); break
      case 'loan status': if (current.status === 'Unknown') current.status=/^[A-Z0-9]{1,3}$/.test(value) ? value : 'Unknown'; break
      case 'loan status description': if (current.status === 'Unknown') current.status=known(value,['IN REPAYMENT','DEFAULT','DELINQUENT','FORBEARANCE','DEFERRED','PAID IN FULL','IN SCHOOL','GRACE'],'Unknown'); break
      case 'loan repayment plan type': current.repaymentPlan=known(value,plans,'Unknown'); break
      case 'loan disbursement date': { const date=aidDate(value);if(date&&(!current.disbursedAt||date<current.disbursedAt))current.disbursedAt=date; break }
      default: recognized=false
    }
    if (recognized && current.evidenceLines.length < 24) current.evidenceLines.push(index+1)
  }
  if (!loans.length) throw new Error('No supported loan records were found. Upload the complete My Aid Data text file or review it manually.')
  if (!sourceDate) warnings.push('The file download date is missing or invalid.')
  else if (Date.parse(sourceDate) > Date.now()+86400000) throw new Error('The file download date is in the future.')
  else if (Date.now()-Date.parse(sourceDate)>90*86400000) warnings.push('The file is more than 90 days old. Request an updated download before making decisions.')
  if (loans.some(l=>l.principal===null || l.interest===null)) warnings.push('Some balance fields are missing or unrecognized; totals are incomplete.')
  if (loans.some(l=>l.type==='Unknown federal loan type')) warnings.push('Some loan types need manual confirmation against the original file.')
  if(loans.some(l=>['DF','DB','DL','DU','DX','DZ','DEFAULT','DELINQUENT'].includes(l.status)))warnings.push('A default or delinquency status appears in the file. Confirm the current status and any notice deadlines promptly with the servicer.')
  if(loans.some(l=>l.type.includes('PARENT')))warnings.push('Parent PLUS loans need a borrower-specific review; do not use the student’s income or employment as a substitute for the parent borrower’s facts.')
  warnings.push('This is a dated federal aid snapshot. Verify current balances, loan status, private loans, and official payment counts separately.')
  const total=(field:'principal'|'interest')=>loans.some(l=>l[field]===null)?null:Math.round(loans.reduce((n,l)=>n+l[field]!,0)*100)/100
  return {version:1,sourceDate,loans,totalPrincipal:total('principal'),totalInterest:total('interest'),warnings}
}
