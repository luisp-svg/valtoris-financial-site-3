import { useEffect } from 'react'
import PublicLink from '../PublicLink'
import type { PublicLocale } from '../locale'
import { funnelContent, funnelAnswerGraph, FUNNEL_PATHS, type DiscoverableFunnel } from './funnelContent'
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
   {['lifestyle','commercial','trucking'].includes(priority)&&<nav aria-label={es?'Otras revisiones de seguros':'Other insurance reviews'}>{(['lifestyle','commercial','trucking']as const).filter(t=>t!==priority).map(t=><p key={t}><PublicLink to={FUNNEL_PATHS[t]}>{funnelContent[t][locale].title}</PublicLink></p>)}</nav>}
   <script type="application/ld+json" data-valtoris-funnel={priority} dangerouslySetInnerHTML={{__html:serializeStructuredData(funnelAnswerGraph(priority,locale))}}/>
  </section>
 </>
}
