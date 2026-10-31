// Finger motion defaults to scrolling. Remote mouse-down is emitted only in
// explicit drag mode or after an unambiguous tap, never for a scrolling gesture.
export class TouchGesture {
 constructor(mode,x,y,point){this.mode=mode;this.start={x,y};this.last={x,y};this.origin=point;this.moved=false}
 begin(){return this.mode==='drag'?[{kind:'down',...this.origin,button:0}]:[]}
 move(x,y,point){
  const dx=this.last.x-x,dy=this.last.y-y;
  if(dx===0&&dy===0)return [];
  if(!this.moved&&Math.hypot(x-this.start.x,y-this.start.y)<8)return [];
  this.moved=true;this.last={x,y};
  return this.mode==='drag'?[{kind:'move',...point,button:0}]:[{kind:'scroll',...point,deltaX:Math.round(dx),deltaY:Math.round(dy)}];
 }
 end(point){return this.mode==='drag'?[{kind:'up',...point,button:0}]:this.moved?[]:[{kind:'down',...point,button:0,clickCount:1},{kind:'up',...point,button:0,clickCount:1}]}
}
