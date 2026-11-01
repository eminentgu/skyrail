import {spawn} from 'node:child_process';
// Chat tasks hold the CPU; a viewer or snapshot may additionally wake display.
// Existing virtual-display deployments can opt out of physical display wake.
export class MacPower {
 constructor({platform=process.platform,launch=spawn,wakeDisplay=process.env.SKYRAIL_DISPLAY_MODE!=='headless',onError=()=>{}}={}){this.platform=platform;this.launch=launch;this.wakeDisplay=wakeDisplay;this.onError=onError;this.child=null;this.closed=false;this.active=false;this.displayActive=false;this.captures=0;this.grace=false}
 sync(){
  const display=this.wakeDisplay&&(this.displayActive||this.captures>0||this.grace);
  if((this.active||this.captures>0||this.grace)&&!this.closed&&this.platform==='darwin'){
   if(this.child&&this.childDisplay===display)return false;
   const args=[...(display?['-d','-u']:[]),'-i','-w',String(process.pid)];
   const child=this.launch('/usr/bin/caffeinate',args,{stdio:'ignore'});const previous=this.child;this.child=child;this.childDisplay=display;
   const clear=()=>{if(this.child===child)this.child=null};
   child.once('error',e=>{clear();this.onError(e)});child.once('exit',clear);child.unref();previous?.kill();return true;
  }
  const child=this.child;this.child=null;child?.kill();return false;
 }
 setActive(active,{display=this.wakeDisplay}={}){this.active=active;this.displayActive=active&&display;this.sync()}
 async withCapture(action){
  this.captures++;const started=this.sync();let succeeded=false;
  try{if(started&&this.wakeDisplay)await new Promise(r=>setTimeout(r,700));const result=await action();succeeded=true;return result}
  finally{
   this.captures--;
   if(succeeded&&this.wakeDisplay&&this.captures===0&&!this.closed){
    // Retain the display across the successful bind -> video subscription gap.
    this.grace=true;clearTimeout(this.releaseTimer);this.releaseTimer=setTimeout(()=>{this.grace=false;this.sync()},1500);this.releaseTimer.unref();
   }
   this.sync();
  }
 }
 close(){this.closed=true;this.active=false;this.grace=false;clearTimeout(this.releaseTimer);this.sync()}
}
