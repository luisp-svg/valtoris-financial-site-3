import type { FlagshipSummary } from '../../modules/reportCard/combined/flagship';

export default function FlagshipFindings({report,locale}:{report:FlagshipSummary;locale:'en'|'es'}) {
 const t=(en:string,es:string)=>locale==='es'?es:en;
 const groups=[
  {state:'strength',title:t('What appears established','Lo que parece establecido')},
  {state:'attention',title:t('What deserves a closer look','Lo que merece revisión')},
  {state:'unknown',title:t('Information to confirm','Información por confirmar')},
  {state:'private',title:t('Reserved for a private conversation','Para conversar en privado')},
 ];
 return <section id="report-focus" className="flagship-findings" aria-labelledby="flagship-summary-title">
  <p className="report-eyebrow">{t('YOUR SITUATION · YOUR PRIORITIES','TU SITUACIÓN · TUS PRIORIDADES')}</p>
  <h2 id="flagship-summary-title">{t('A review built around your answers','Una revisión basada en tus respuestas')}</h2>
  <dl className="flagship-context"><div><dt>{t('What matters most','Tu prioridad')}</dt><dd>{report.priority||t('To discuss','Por conversar')}</dd></div><div><dt>{t('Approaching change','Cambio próximo')}</dt><dd>{report.change||t('To confirm','Por confirmar')}</dd></div><div><dt>{t('Decision timing','Plazo de decisión')}</dt><dd>{report.timing||t('To confirm','Por confirmar')}</dd></div></dl>
  <p>{t('This report organizes self-reported planning practices. It does not verify documents, establish adequate coverage or determine product suitability.','Este informe organiza prácticas de planificación informadas por ti. No verifica documentos, confirma cobertura adecuada ni determina la idoneidad de productos.')}</p>
  <p><strong>{report.known} / {report.total}</strong> {t('applicable planning questions have a substantive answer. Unknown and private answers are shown separately and do not count as failures.','preguntas de planificación aplicables tienen una respuesta sustantiva. Las respuestas desconocidas y privadas se muestran aparte y no cuentan como fallas.')}</p>
  <details><summary>{t("What this review is based on","En qué se basa esta revisión")}</summary><dl>{report.context.map(item=><div key={item.label}><dt><strong>{item.label}</strong></dt><dd>{item.value||t("Not answered","Sin respuesta")}</dd></div>)}</dl></details>
  <div className="flagship-findings-grid">{groups.map(group=>{
   const items=report.findings.filter(f=>f.state===group.state);
   return <section key={group.state} className={`flagship-finding-group flagship-${group.state}`}><h3>{group.title} <span>({items.length})</span></h3>{items.length ? <ul>{items.map(f=><li key={f.id}><strong>{f.title}</strong><p>{t('You reported:','Informaste:')} {f.answer||t('Not answered','Sin respuesta')}</p><p>{f.reason}</p></li>)}</ul>:<p>{t('No items in this group from your current answers.','No hay elementos en este grupo según tus respuestas actuales.')}</p>}</section>;
  })}</div>
  <h3>{t('Your three priorities for review','Tus tres prioridades de revisión')}</h3>
  <p>{t('Reported review tasks come first, followed by information to confirm. Within each group we prioritize your selected goal. These are discussion priorities, not verified risk rankings.','Primero se muestran tareas de revisión, seguidas de información por confirmar. En cada grupo priorizamos tu meta elegida. Son prioridades de conversación, no clasificaciones de riesgo verificadas.')}</p>
  <ol className="flagship-priorities">{report.priorities.map(f=><li key={f.id}><h4>{f.title}</h4><p><strong>{t('Why it appears here:','Por qué aparece aquí:')}</strong> {f.reason}</p><p><strong>{t('Next step:','Siguiente paso:')}</strong> {f.action}</p><p><strong>{t('Who to involve:','A quién involucrar:')}</strong> {f.professional}</p></li>)}</ol>
  <details><summary>{t('How the preparation grade works','Cómo funciona la calificación de preparación')}</summary><p>{t('Each applicable planning practice marked current contributes 100 points; in place but needing review contributes 50; not in place contributes 0. Unknown, private and not-applicable answers are excluded from the average. Each scored practice has equal weight. The grade summarizes preparation, not wealth, investment performance, coverage adequacy or creditworthiness. A high grade with limited answers is not assurance that everything is in order.','Cada práctica aplicable vigente aporta 100 puntos; existente pero pendiente de revisión, 50; no establecida, 0. Las respuestas desconocidas, privadas y no aplicables se excluyen del promedio. Cada práctica puntuada tiene el mismo peso. La calificación resume preparación, no riqueza, rendimiento, cobertura adecuada o solvencia. Una calificación alta con pocas respuestas no garantiza que todo esté en orden.')}</p><p>A 90–100 · B 75–89 · C 60–74 · D 40–59 · F 0–39</p></details>
 </section>;
}
