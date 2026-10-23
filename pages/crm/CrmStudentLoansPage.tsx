import {useEffect,useState} from 'react'
import {useSearchParams} from 'react-router-dom'
import {loanRequest} from '../../crm/studentLoans/api'
import StudentLoanWorkspace from '../../crm/studentLoans/StudentLoanWorkspace'
import type {LoanWorkspace} from '../../modules/studentLoanReview/contract'
export default function CrmStudentLoansPage() {
 const [params,setParams]=useSearchParams(),[households,setHouseholds]=useState<LoanWorkspace[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[search,setSearch]=useState('')
 const selected=params.get('household')??''
 useEffect(()=>{
  const controller=new AbortController()
  void loanRequest<{households:LoanWorkspace[]}>({action:'workspace'},controller.signal).then(data=>setHouseholds(data.households)).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Student loan queue unavailable.')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
  return()=>controller.abort()
 },[])
 return <div className="student-loan-queue"><header><p className="crm-eyebrow">TAC · STUDENT LOANS</p><h1>Student loan workspace</h1><p>Private aid data, organized loan facts, and automatic recommendations.</p></header>
  {error&&<p role="alert">{error}</p>}
  <section className="crm-panel"><h2>Student loan households</h2><label>Find a household<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search household names"/></label>
   {loading?<p role="status">Loading your student loan households…</p>:<div className="student-loan-queue-list">{households.filter(h=>h.household_name.toLowerCase().includes(search.toLowerCase())).map(h=><button type="button" key={h.household_id} className="crm-secondary-btn" aria-pressed={selected===h.household_id} onClick={()=>setParams({household:h.household_id})}>{h.household_name}<br/><small>{h.report_count} reports · {h.upload_count} files{h.pending_reviews>0?` · ${h.pending_reviews} processing`:''}</small></button>)}{!households.length&&<p>No student loan households are assigned to you yet. Owners can also open Student Loan Data from an existing household.</p>}</div>}
  </section>
  {selected?<StudentLoanWorkspace key={selected} householdId={selected}/>:<p>Select a household to upload its student loan data.</p>}
 </div>
}
