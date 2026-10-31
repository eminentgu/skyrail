export class TouchGesture {
 constructor(mode:'scroll'|'drag',x:number,y:number,point:{x:number;y:number});
 begin():object[];
 move(x:number,y:number,point:{x:number;y:number}):object[];
 end(point:{x:number;y:number}):object[];
}
