import {spawn} from 'node:child_process';
// The native window server needs an active display. Wake only during a remote
// viewer, model turn or snapshot. A virtual-display installation may opt out.
export class MacPower {
 constructor({platform=process.platform,launch=spawn,wakeDisplay=process.env.SKYRAIL_DISPLAY_MODE!=='headless',onError=()=>{}}={}){this.platform=platform;this.launch=launch;this.wakeDisplay=wakeDisplay;this.onError=onError;this.child=null;this.closed=false;this.active=false;this.captures=0}
 sync(){
  clearTimeout(this.releaseTimer);
  if((this.active||this.captures>0)&&!this.closed&&this.platform==='darwin'){
   if(this.child)return false;
   const args=[...(this.wakeDisplay?['-d','-u']:[]),'-i','-w',String(process.pid)];
   const child=this.launch('/usr/bin/caffeinate',args,{stdio:'ignore'});this.child=child;
   const clear=()=>{if(this.child===child)this.child=null};
   child.once('error',e=>{clear();this.onError(e)});child.once('exit',clear);child.unref();return true;
  }
  const child=this.child;this.child=null;child?.kill();return false;
 }
 setActive(active){this.active=active;this.sync()}
 async withCapture(action){
  this.captures++;const started=this.sync();
  let succeeded=false;
  try{if(started&&this.wakeDisplay)await new Promise(r=>setTimeout(r,700));const result=await action();succeeded=true;return result}
  finally{
   this.captures--;
   // Keep a successful bind awake long enough for its browser to attach video.
   if(succeeded&&this.wakeDisplay&&!this.active&&this.captures===0&&!this.closed){this.releaseTimer=setTimeout(()=>this.sync(),1500);this.releaseTimer.unref()}
   else this.sync();
  }
 }
 close(){this.closed=true;this.active=false;this.sync()}
}
