import { useCallback, useEffect, useRef, useState } from 'react'

type Reservation={state:string;startTime:string;timezone?:string}
export default function TacConsultationBooking({assessmentId,locale,onBooked,onReservationPending,consultationOnly=false}:{consultationOnly?:boolean;assessmentId:string;locale:'en'|'es';onBooked:()=>void;onReservationPending?:()=>void}){
 const es=locale==='es'
 const t=useCallback((en:string,spanish:string)=>es?spanish:en,[es])
 const initialZone=Intl.DateTimeFormat().resolvedOptions().timeZone||'America/Chicago'
 const [timezone,setTimezone]=useState(initialZone)
 const [day,setDay]=useState(()=>new Intl.DateTimeFormat('en-CA',{timeZone:initialZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))
 const [slots,setSlots]=useState<string[]>([]),[chosen,setChosen]=useState(''),[booking,setBooking]=useState<Reservation|null>(null)
 const [refresh,setRefresh]=useState(0)
 const [loading,setLoading]=useState(false),[submitting,setSubmitting]=useState(false),[message,setMessage]=useState('')
 const sending=useRef(false)
 const callbacks=useRef({onBooked,onReservationPending})
 useEffect(()=>{callbacks.current={onBooked,onReservationPending}},[onBooked,onReservationPending])
 const endpoint='/api/ingest-family-report-card?flow=premium'
 useEffect(()=>{
  let disposed=false
  const controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(),20000)
  setLoading(true);setMessage('');setSlots([]);setChosen('')
  void fetch(`${endpoint}&action=slots&${new URLSearchParams({assessment:assessmentId,day,timezone})}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal})
   .then(async response=>{const data=await response.json();if(!response.ok||!data.ok)throw new Error('unavailable');if(controller.signal.aborted)return
    if(disposed)return
    setSlots(Array.isArray(data.slots)?data.slots:[]);setBooking(data.booking??null)
    if(data.booking?.state==='confirmed')callbacks.current.onBooked()
    else if(data.booking?.state==='pending')callbacks.current.onReservationPending?.()
    if(data.booking?.startTime){setChosen(data.booking.startTime);if(data.booking.timezone)setTimezone(data.booking.timezone)}
   }).catch(()=>{if(!disposed)setMessage(t('Scheduling is temporarily unavailable. Your assessment is saved. Please try again shortly.','La agenda no está disponible por el momento. Tu evaluación está guardada. Intenta de nuevo en breve.'))})
   .finally(()=>{clearTimeout(timeout);if(!disposed)setLoading(false)})
  return()=>{disposed=true;clearTimeout(timeout);controller.abort()}
 },[assessmentId,day,timezone,t,refresh])
 const display=(slot:string)=>new Intl.DateTimeFormat(es?'es-US':'en-US',{timeZone:timezone,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(slot))
 async function reserve(){
  if(sending.current||!chosen)return
  sending.current=true;setSubmitting(true);setMessage('')
  try{
   const response=await fetch(`${endpoint}&action=book`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId:assessmentId,startTime:chosen,timezone}),cache:'no-store',signal:AbortSignal.timeout(20000)})
   const data=await response.json()
   if(!response.ok||!data.ok){
    if(data.code==='booking_slot_unavailable')setMessage(t('That time is no longer available. Choose another date or time.','Ese horario ya no está disponible. Elige otra fecha u hora.'))
    else {setRefresh(value=>value+1);setMessage(t('We could not confirm your reservation yet. Your assessment remains saved. Check this reservation again before choosing another time.','Aún no pudimos confirmar tu reserva. Tu evaluación sigue guardada. Verifica esta reserva antes de elegir otro horario.'))}
    return
   }
   setBooking({state:data.state,startTime:data.startTime})
   if(data.state==='confirmed')callbacks.current.onBooked()
   else {callbacks.current.onReservationPending?.();setMessage(t('Your reservation is saved and awaiting confirmation. Your results will open automatically once it is verified.','Tu reserva está guardada y espera confirmación. Los resultados se abrirán automáticamente al verificarla.'))}
  }catch{setRefresh(value=>value+1);setMessage(t('Confirmation is taking longer than expected. Check this reservation again to avoid making a second booking.','La confirmación está tardando más de lo esperado. Verifica esta reserva para evitar crear otra cita.'))}
  finally{sending.current=false;setSubmitting(false)}
 }
 const zones=[...new Set([initialZone,timezone,'America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu'])]
 return <section className="tac-booking" aria-labelledby="consultation-booking-heading">
  <h2 id="consultation-booking-heading">{t('Reserve Your Consultation','Reserva tu consulta')}</h2>
  <p>{t(consultationOnly ? 'Choose an available time and confirm your consultation. We’ll complete your financial intake together during the meeting.' : 'Choose a time to complete your Report Card experience. We’ll complete your deeper intake together during the consultation.',consultationOnly ? 'Elige un horario disponible y confirma tu consulta. Completaremos la información financiera juntos durante la reunión.' : 'Elige un horario para completar tu experiencia Report Card. Completaremos la información adicional juntos durante la consulta.')}</p>
  <div className="tac-booking-fields">
   <label>{t('Date','Fecha')}<input type="date" min={new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())} value={day} disabled={submitting||!!booking} onChange={event=>setDay(event.target.value)} /></label>
   <label>{t('Time zone','Zona horaria')}<select value={timezone} disabled={submitting||!!booking} onChange={event=>setTimezone(event.target.value)}>{zones.map(zone=><option key={zone} value={zone}>{zone.replace(/_/g,' ')}</option>)}</select></label>
  </div>
  <button type="button" className="premium-secondary" disabled={submitting||!!booking||!day} onClick={()=>setDay(new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10))}>{t('Next Day →','Día siguiente →')}</button>
  {loading?<p role="status">{t('Finding available times…','Buscando horarios disponibles…')}</p>:booking?<p>{t('Your reservation','Tu reserva')}: {new Intl.DateTimeFormat(es?'es-US':'en-US',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(booking.startTime))}</p>:slots.length>0?<fieldset className="tac-booking-slots"><legend>{t('Available times · 30 minutes','Horarios disponibles · 30 minutos')}</legend>{slots.map(slot=><label key={slot}><input type="radio" name="consultation-time" value={slot} checked={chosen===slot} onChange={()=>setChosen(slot)} disabled={submitting}/><span>{display(slot)}</span></label>)}</fieldset>:!message?<p>{t('No times are available on this date. Please choose another date.','No hay horarios disponibles en esta fecha. Elige otra fecha.')}</p>:null}
  {booking?.state==='cancelled'&&<p>{t('This reservation was cancelled. Contact your advisor to arrange a new time; your assessment remains saved.','Esta reserva fue cancelada. Contacta a tu asesor para acordar otra hora; tu evaluación sigue guardada.')}</p>}
  <div role="status" aria-live="polite">{message&&<p>{message}</p>}</div>
  <button type="button" className="premium-button" disabled={!chosen||submitting||loading||booking?.state==='cancelled'} onClick={()=>void reserve()}>{submitting?t('Confirming…','Confirmando…'):booking?t('Check My Reservation','Verificar mi reserva'):t('Confirm My Consultation','Confirmar mi consulta')}</button>
  <button type="button" className="premium-secondary" disabled={loading||submitting} onClick={()=>setRefresh(value=>value+1)}>{t('Refresh Availability / Reservation','Actualizar horarios / reserva')}</button>
 </section>
}
