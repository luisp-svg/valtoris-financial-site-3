import type { ShortQuestion } from '../shortForm/catalog.js'
import type { ShortDiagnostic } from '../shortForm/contract.js'
const c = (en:string,es:string)=>({en,es})
function choice(id:string,en:string,es:string,rows:string[][],kind:'select'|'multi'='select'):ShortQuestion {
 return {id,label:c(en,es),kind,options:rows.map(([value,en,es])=>({value,label:c(en,es)}))}
}
const unsure=['unknown','Not sure','No sé']
export const lifestyleQuestions:ShortQuestion[]=[
 {id:'state',kind:'state',label:c('In which state is the primary property or business to review?','¿En qué estado está la propiedad principal o negocio por revisar?'),helper:c('Other property locations can be confirmed during your consultation.','Otras ubicaciones se confirman durante la consulta.')},
 choice('renewal','When is your next insurance renewal?','¿Cuándo es tu próxima renovación de seguro?', [['30','Within 30 days','En 30 días'],['60','In 31–60 days','En 31–60 días'],['90','In 61–90 days','En 61–90 días'],['later','More than 90 days away','En más de 90 días'],unsure]),
 choice('assets','Which assets would you like included in your coverage review?','¿Qué activos deseas incluir en tu revisión de cobertura?', [['home','Primary home','Vivienda principal'],['rental','Rental or second properties','Propiedades de alquiler o secundarias'],['vehicles','Vehicles','Vehículos'],['valuables','Valuables and collections','Objetos de valor y colecciones'],['recreation','Boats and recreational vehicles','Embarcaciones y vehículos recreativos'],['business','Business property and liability','Propiedad y responsabilidad del negocio'],unsure],'multi'),
 choice('property_use','How are these properties used?','¿Cómo se usan estas propiedades?', [['primary','Primary residence','Vivienda principal'],['secondary','Second or seasonal home','Segunda vivienda o de temporada'],['long_rental','Long-term rental','Alquiler a largo plazo'],['short_rental','Short-term rental','Alquiler a corto plazo'],unsure],'multi'),
 choice('property_value','About what is the value of the highest-value home to review?','¿Cuál es el valor aproximado de la vivienda de mayor valor por revisar?', [['under_750','Under $750,000','Menos de $750,000'],['750_1500','$750,000–$1.5 million','$750,000–$1.5 millones'],['1500_3000','$1.5–$3 million','$1.5–$3 millones'],['over_3000','Over $3 million','Más de $3 millones'],unsure]),
 choice('renovation','Have there been major renovations since the last policy review?','¿Ha habido renovaciones importantes desde la última revisión?', [['yes','Yes','Sí'],['no','No','No'],unsure]),
 choice('drivers','Are there young or newly licensed drivers in the household?','¿Hay conductores jóvenes o recién licenciados en el hogar?', [['yes','Yes','Sí'],['no','No','No'],unsure]),
 choice('special_assets','Which specialty assets should we discuss?','¿Qué activos especiales debemos revisar?', [['jewelry','Jewelry, art, or collections','Joyas, arte o colecciones'],['boats','Boats or watercraft','Embarcaciones'],['rv','Recreational vehicles','Vehículos recreativos'],unsure],'multi'),
 choice('commercial','Which business exposures should be reviewed?','¿Qué riesgos del negocio deben revisarse?', [['property','Premises, equipment, or inventory','Local, equipos o inventario'],['liability','Customer or professional liability','Responsabilidad ante clientes o profesional'],['vehicles','Business vehicles','Vehículos comerciales'],['employees','Employees and workplace risks','Empleados y riesgos laborales'],['cyber','Customer data and cyber risks','Datos de clientes y riesgos cibernéticos'],unsure],'multi'),
 {id:'business_state',kind:'state',label:c('In which state does your business primarily operate?','¿En qué estado opera principalmente tu negocio?')},
 choice('review','When were your property and liability limits last reviewed together?','¿Cuándo se revisaron juntos tus límites de propiedad y responsabilidad?', [['recent','Within the past year','Durante el último año'],['older','More than a year ago','Hace más de un año'],['never','Never reviewed together','Nunca se revisaron juntos'],unsure]),
 choice('changes','What has changed since your last coverage review?','¿Qué ha cambiado desde tu última revisión de cobertura?', [['property','Purchased or renovated property','Compra o renovación de propiedad'],['vehicles','Added vehicles or recreational assets','Nuevos vehículos o activos recreativos'],['business','Business or rental activity changed','Cambio de actividad comercial o de alquiler'],['wealth','Assets or liability exposure increased','Aumento de activos o responsabilidad'],['none','No significant changes','Sin cambios importantes'],unsure],'multi'),
 choice('umbrella','Do you currently have umbrella or excess liability coverage?','¿Tienes cobertura adicional de responsabilidad (umbrella)?', [['yes','Yes — limits need confirmation','Sí — límites por confirmar'],['no','No','No'],unsure]),
 choice('deadline','Is there a time-sensitive reason for this review?','¿Hay un motivo urgente para esta revisión?', [['notice','Cancellation or nonrenewal notice','Aviso de cancelación o no renovación'],['purchase','Upcoming property purchase or closing','Próxima compra o cierre de propiedad'],['change','Business change or new contract','Cambio comercial o nuevo contrato'],['none','Routine review','Revisión habitual'],unsure]),
]
// Business operating state is deliberately distinct from a property location.
export function visibleLifestyleQuestions(d:ShortDiagnostic):ShortQuestion[]{
 const assets=Array.isArray(d.assets)?d.assets:[]
 return lifestyleQuestions.filter(q=>{
  if(['property_use','property_value','renovation'].includes(q.id))return assets.some(x=>['home','rental'].includes(x))
  if(q.id==='drivers')return assets.includes('vehicles')
  if(q.id==='special_assets')return assets.some(x=>['valuables','recreation'].includes(x))
  if(['commercial','business_state'].includes(q.id))return assets.includes('business')
  return true
 })
}
