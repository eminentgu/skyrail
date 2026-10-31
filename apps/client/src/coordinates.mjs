export function mapPoint(rect,imageWidth,imageHeight,clientX,clientY,clamp=false){
 if(!imageWidth||!imageHeight||!rect.width||!rect.height)return null;
 const scale=Math.min(rect.width/imageWidth,rect.height/imageHeight);const width=imageWidth*scale,height=imageHeight*scale;
 let x=(clientX-rect.left-(rect.width-width)/2)/width,y=(clientY-rect.top-(rect.height-height)/2)/height;
 if(!clamp&&(x<0||y<0||x>1||y>1))return null;
 return{x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))};
}
