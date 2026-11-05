import HorizontalScroll from '../components/ui/HorizontalScroll'
import { useRef, useState, type ReactNode } from 'react'
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import './stageBoard.css'
export type BoardItem = {id:string;stage:string;label:string;content:ReactNode}
export type BoardColumn = {id:string;label:string;disabled?:boolean}
type Props = {label:string;items:BoardItem[];columns:BoardColumn[];disabled?:boolean;onMove:(id:string,stage:string)=>void|Promise<void>}
function Card({item,columns,disabled,onMove}: {item:BoardItem;columns:BoardColumn[];disabled:boolean;onMove:Props['onMove']}){
 const {attributes,listeners,setNodeRef,setActivatorNodeRef,isDragging}=useDraggable({id:item.id,disabled})
 return <div ref={setNodeRef} className={`tac-stage-card${isDragging?' is-dragging':''}`}>
  {!disabled&&<div className="tac-stage-card-controls"><button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} className="tac-stage-drag-handle" aria-label={`Drag ${item.label} to another stage`}>⠿ <span>Drag</span></button><label><span className="tac-stage-sr-only">Move {item.label} to</span><select aria-label={`Move ${item.label} to`} value="" onChange={e=>{if(e.target.value)void onMove(item.id,e.target.value)}}><option value="">Move to…</option>{columns.filter(c=>c.id!==item.stage&&!c.disabled).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label></div>}
  {item.content}
 </div>
}
function Column({column,items,columns,disabled,onMove}: {column:BoardColumn;items:BoardItem[];columns:BoardColumn[];disabled:boolean;onMove:Props['onMove']}){
 const {setNodeRef,isOver}=useDroppable({id:column.id,disabled:disabled||column.disabled})
 return <section ref={setNodeRef} className={`tac-stage-column${isOver?' is-over':''}`} aria-label={column.label}><h3>{column.label}<span>{items.length}</span></h3><div className="tac-stage-column-body">{items.length?items.map(item=><Card key={item.id} item={item} columns={columns} disabled={disabled} onMove={onMove}/>):<p className="tac-stage-empty">{disabled?'No records in this stage.':'Drop a card here'}</p>}</div></section>
}
export default function StageBoard({label,items,columns,disabled=false,onMove}:Props){
 const [activeId,setActiveId]=useState<string|null>(null),[moving,setMoving]=useState(false)
 const inFlight=useRef(false)
 const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:6}}),useSensor(TouchSensor,{activationConstraint:{delay:220,tolerance:6}}))
 async function move(id:string,stage:string){
  const item=items.find(i=>i.id===id),column=columns.find(c=>c.id===stage)
  if(disabled||inFlight.current||!item||!column||column.disabled||item.stage===stage)return
  inFlight.current=true;setMoving(true)
  try{await onMove(id,stage)}finally{inFlight.current=false;setMoving(false)}
 }
 function end(event:DragEndEvent){setActiveId(null);if(event.over)void move(String(event.active.id),String(event.over.id))}
 const active=items.find(i=>i.id===activeId)
 return <DndContext accessibility={{screenReaderInstructions:{draggable:'Use the Move to menu to change stages with a keyboard. Pointer and touch users can drag this handle.'}}} sensors={sensors} onDragStart={event=>setActiveId(String(event.active.id))} onDragCancel={()=>setActiveId(null)} onDragEnd={end}>
  <HorizontalScroll className="tac-stage-board" label={label} busy={moving}>{columns.map(column=><Column key={column.id} column={column} items={items.filter(i=>i.stage===column.id)} columns={columns} disabled={disabled||moving} onMove={move}/>)}</HorizontalScroll>
  <DragOverlay>{active?<div className="tac-stage-overlay">{active.label}</div>:null}</DragOverlay>
 </DndContext>
}
