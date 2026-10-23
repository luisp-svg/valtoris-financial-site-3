import { createHash } from 'node:crypto'
import type { GuidanceSource } from '../../modules/studentLoanReview/contract.js'
const officialSources = [
  { id:'repayment', title:'Federal Student Aid: Compare Repayment Plans', url:'https://studentaid.gov/articles/repayment-calculator/' },
  { id:'idr', title:'Federal Student Aid: Income-Driven Repayment FAQs', url:'https://studentaid.gov/articles/faqs-idr-plan/' },
  { id:'save', title:'Federal Student Aid: SAVE Plan Updates', url:'https://studentaid.gov/articles/save/' },
]
export async function fetchOfficialGuidance(fetcher: typeof fetch = fetch): Promise<GuidanceSource[]> {
  const sources=await Promise.all(officialSources.map(async source=>{
    const response=await fetcher(source.url,{redirect:'error',signal:AbortSignal.timeout(6000),headers:{Accept:'text/html'}})
    if(!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Official guidance unavailable')
    const reader=response.body?.getReader(); if(!reader)throw new Error('Official guidance unavailable')
    let bytes=0,html='';const decoder=new TextDecoder()
    try { while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>500000)throw new Error('Guidance exceeds limit');html+=decoder.decode(value,{stream:true})} } finally { await reader.cancel() }
    html=html.replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
    const article=/<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1] ?? /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? html
    const text=article.replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim()
    if(text.length<800 || !/repayment|loan|borrower/i.test(text))throw new Error('Official guidance unavailable')
    return {...source, checkedAt:new Date().toISOString(), sha256:createHash('sha256').update(text).digest('hex'),excerpt:text.slice(0,14000)}
  }))
  return sources
}
