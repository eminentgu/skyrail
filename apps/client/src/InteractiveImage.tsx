import React,{useEffect,useRef,useState} from 'react';
import {mapPoint} from './coordinates.mjs';
type Props={src?:string;name:string;enabled:boolean;epoch:number;threadId:string;clientId:string;post:(path:string,data?:object)=>Promise<any>;onError:(message:string)=>void};
export function InteractiveImage({src,name,enabled,epoch,threadId,clientId,post,onError}:Props){
 const image=useRef<HTMLImageElement>(null),keyboard=useRef<HTMLTextAreaElement>(null),queue=useRef(Promise.resolve()),down=useRef(false),lastMove=useRef(0),composing=useRef(false),[focused,setFocused]=useState(false);
 const session=useRef({enabled,epoch,threadId});session.current={enabled,epoch,threadId};
 function send(input:object){const expected={epoch,threadId};queue.current=queue.current.then(async()=>{if(!session.current.enabled||session.current.epoch!==expected.epoch||session.current.threadId!==expected.threadId)return;await post('mac/input',{...expected,clientId,input})}).catch(e=>{onError(e.message);down.current=false})}
 function release(){down.current=false;setFocused(false);keyboard.current?.blur();if(enabled)queue.current=queue.current.then(()=>post('mac/release',{epoch,clientId})).catch(()=>{})}
 useEffect(()=>{const blur=()=>release();window.addEventListener('blur',blur);document.addEventListener('visibilitychange',blur);return()=>{window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',blur);release()}},[enabled,epoch,threadId]);
 useEffect(()=>{const el=image.current;if(!el||!enabled)return;const wheel=(e:WheelEvent)=>{const p=mapPoint(el.getBoundingClientRect(),el.naturalWidth,el.naturalHeight,e.clientX,e.clientY);if(!p)return;e.preventDefault();send({kind:'scroll',...p,deltaX:Math.round(e.deltaX),deltaY:Math.round(e.deltaY)})};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel)},[enabled,epoch,threadId]);
 const point=(e:{clientX:number;clientY:number},clamp=false)=>image.current?mapPoint(image.current.getBoundingClientRect(),image.current.naturalWidth,image.current.naturalHeight,e.clientX,e.clientY,clamp):null;
 const flags=(e:React.MouseEvent|React.KeyboardEvent|React.WheelEvent)=>({shift:e.shiftKey,meta:e.metaKey,alt:e.altKey,ctrl:e.ctrlKey});
 function text(value:string){if(value)send({kind:'text',text:value.slice(0,4000)})}
 return <div className={'interactive-image '+(enabled?'can-control':'')}>
 <img ref={image} className="live-image" src={src} alt={`${name}的实时窗口画面`} draggable={false} onContextMenu={e=>{if(enabled)e.preventDefault()}}
 onPointerDown={e=>{if(!enabled)return;const p=point(e);if(!p)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);down.current=true;keyboard.current?.focus({preventScroll:true});setFocused(true);send({kind:'down',...p,button:e.button,clickCount:e.detail||1,...flags(e)})}}
 onPointerMove={e=>{if(!enabled||!down.current||Date.now()-lastMove.current<70)return;const p=point(e,true);if(!p)return;lastMove.current=Date.now();send({kind:'move',...p,button:e.buttons===2?2:0,...flags(e)})}}
 onPointerUp={e=>{if(!enabled||!down.current)return;const p=point(e,true);down.current=false;if(p)send({kind:'up',...p,button:e.button,...flags(e)});if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}
 onPointerCancel={()=>release()}/>
 <textarea ref={keyboard} className="remote-keyboard" aria-label="远程键盘输入，按 Escape 退出" disabled={!enabled} onFocus={()=>setFocused(true)} onBlur={()=>release()}
 onKeyDown={e=>{if(e.nativeEvent.isComposing||composing.current)return;if(e.key==='Escape'){e.preventDefault();release();return}const specials=['Enter','Tab','Backspace','Delete','ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Home','End','PageUp','PageDown'];if(specials.includes(e.key)||e.metaKey||e.ctrlKey||e.altKey){e.preventDefault();send({kind:'key',code:e.code,...flags(e)})}}}
 onCompositionStart={()=>{composing.current=true}} onCompositionEnd={e=>{composing.current=false;text(e.currentTarget.value);e.currentTarget.value=''}} onInput={e=>{if(composing.current||(e.nativeEvent as InputEvent).isComposing)return;text(e.currentTarget.value);e.currentTarget.value=''}} onPaste={e=>{e.preventDefault();text(e.clipboardData.getData('text/plain'))}}/>
 {enabled&&<div className="keyboard-hint">{focused?'键盘已连接 · Escape 退出输入':'点击画面操作 · 支持拖动、滚轮与输入'}</div>}
 </div>
}
