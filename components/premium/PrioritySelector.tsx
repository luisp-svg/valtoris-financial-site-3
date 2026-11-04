import { PRIORITIES, PRIORITY_GROUPS, type Priority } from '../../modules/reportCard/combined/engine';
export default function PrioritySelector({selected,onChange,locale='en',disabled=false}:{selected:Priority[];onChange:(next:Priority[])=>void;locale?:'en'|'es';disabled?:boolean}){
 return <div className="priority-groups">
 <button type="button" className="platform-btn platform-btn-secondary" disabled={disabled} onClick={()=>onChange(selected.length===PRIORITIES.length?[]:PRIORITIES.map(p=>p.id))}>{locale==='es'?(selected.length===PRIORITIES.length?'Borrar selección':'Ayuda en todas las áreas'):(selected.length===PRIORITIES.length?'Clear selection':'Help in all areas')}</button>
 {PRIORITY_GROUPS.map(group=><fieldset key={group.en} className="premium-priorities priority-group" disabled={disabled}><legend>{group[locale]}</legend>{group.ids.map(id=>{const priority=PRIORITIES.find(p=>p.id===id)!;return <label key={id} className={`premium-priority${selected.includes(id)?' is-selected':''}`}><input type="checkbox" value={id} checked={selected.includes(id)} onChange={e=>onChange(e.target.checked?[...selected,id]:selected.filter(p=>p!==id))}/><span>{priority[locale]}</span><span className="premium-priority-check" aria-hidden="true">{selected.includes(id)?'✓':'+'}</span></label>})}</fieldset>)}
 <p>{locale==='es'?'Elige una o varias áreas. Nunca más de 25 preguntas, incluidos los datos de contacto.':'Choose one or several areas. Never more than 25 questions, including contact details.'}</p>
 </div>;
}
