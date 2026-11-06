import { useEffect } from 'react'
import PublicLink from '../PublicLink'
import { ROUTES } from '../../../constants/routes'
import type { PublicLocale } from '../locale'
import { funnelContent, funnelAnswerGraph, type DiscoverableFunnel } from './funnelContent'
import { serializeStructuredData } from './structuredData'
export default function FunnelAnswers({priority,locale}:{priority:DiscoverableFunnel;locale:PublicLocale}){
 useEffect(()=>{document.getElementById('valtoris-funnel-prerender')?.remove()},[])
 const copy=funnelContent[priority][locale],es=locale==='es'
 return <>
  <section className="premium-review-focus container" aria-labelledby="funnel-preparation-heading">
   <h2 id="funnel-preparation-heading">{es?'Prepara tu consulta':'Prepare for Your Consultation'}</h2>
   <ul>{copy.prepare.map(item=><li key={item}>{item}</li>)}</ul><p>{copy.availability}</p>
  </section>
  <section className="premium-review-focus container" id="answers" aria-labelledby="funnel-answers-heading">
   <h2 id="funnel-answers-heading">{es?'Preguntas frecuentes':'Common Questions'}</h2>
   {copy.answers.map(({question,answer})=><article key={question}><h3>{question}</h3><p>{answer}</p></article>)}
   <p>{es?'Publicado por Valtoris Financial.':'Published by Valtoris Financial.'}</p>
   {priority === 'trucking' && <nav aria-label={es ? 'Otras revisiones de seguros' : 'Other insurance reviews'}>
    <p><PublicLink to={ROUTES.reportCard}>{es ? 'Report Card Financiero Familiar' : 'Family Financial Report Card'}</PublicLink></p>
    <p><PublicLink to={ROUTES.businessReportCard}>{es ? 'Report Card Financiero Empresarial' : 'Business Owner Financial Report Card'}</PublicLink></p>
   </nav>}
   <script type="application/ld+json" data-valtoris-funnel={priority} dangerouslySetInnerHTML={{__html:serializeStructuredData(funnelAnswerGraph(priority,locale))}}/>
  </section>
 </>
}
