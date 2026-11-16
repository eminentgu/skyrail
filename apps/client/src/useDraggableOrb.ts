import { useEffect, useRef, useState, type RefObject, type PointerEvent, type MouseEvent } from 'react';

type Position={left:number;top:number};
export function useDraggableOrb(host:RefObject<HTMLButtonElement|null>,toggle:()=>void){
  const [position,setPosition]=useState<Position|null>(()=>{
    try{const value=JSON.parse(localStorage.getItem('skyrail.computer-orb-position')||'null');
      return Number.isFinite(value?.left)&&Number.isFinite(value?.top)?value:null;}catch{return null;}
  });
  const current=useRef(position);current.current=position;
  const gesture=useRef<{id:number;x:number;y:number;start:Position;moved:boolean}|null>(null);
  const suppress=useRef(false);
  const bound=(p:Position)=>{
    const v=window.visualViewport,rect=host.current?.getBoundingClientRect();
    const left=(v?.offsetLeft||0)+8,top=(v?.offsetTop||0)+8;
    return{left:Math.max(left,Math.min(p.left,left+(v?.width||innerWidth)-(rect?.width||52)-16)),
      top:Math.max(top,Math.min(p.top,top+(v?.height||innerHeight)-(rect?.height||52)-16))};
  };
  useEffect(()=>{
    const resize=()=>{if(current.current)setPosition(bound(current.current));};resize();
    window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);
    return()=>{window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('scroll',resize);};
  },[]);
  const end=(event:PointerEvent<HTMLButtonElement>)=>{
    const g=gesture.current;if(g?.id!==event.pointerId)return;
    suppress.current=g.moved;gesture.current=null;
    if(g.moved&&current.current)try{localStorage.setItem('skyrail.computer-orb-position',JSON.stringify(current.current));}catch{}
  };
  return{style:position?{...position,bottom:'auto',right:'auto'}:undefined,
    onPointerDown:(event:PointerEvent<HTMLButtonElement>)=>{
      if(event.button!==0)return;const rect=event.currentTarget.getBoundingClientRect();suppress.current=false;
      gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,start:{left:rect.left,top:rect.top},moved:false};
      event.currentTarget.setPointerCapture(event.pointerId);
    },onPointerMove:(event:PointerEvent<HTMLButtonElement>)=>{
      const g=gesture.current;if(g?.id!==event.pointerId)return;
      const dx=event.clientX-g.x,dy=event.clientY-g.y;
      if(!g.moved&&Math.hypot(dx,dy)<6)return;
      g.moved=true;event.preventDefault();event.stopPropagation();
      const next=bound({left:g.start.left+dx,top:g.start.top+dy});current.current=next;setPosition(next);
    },onPointerUp:end,onPointerCancel:()=>{gesture.current=null;suppress.current=false;},
    onLostPointerCapture:()=>{if(gesture.current){gesture.current=null;suppress.current=false;}},
    onClick:(event:MouseEvent<HTMLButtonElement>)=>{
      if(suppress.current&&event.detail!==0){suppress.current=false;event.preventDefault();event.stopPropagation();return;}
      suppress.current=false;toggle();
    }};
}
