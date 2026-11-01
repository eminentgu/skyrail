import React,{useEffect,useRef,useState} from 'react';
import type RFB from '@novnc/novnc';
type Props={post:(path:string,data?:object)=>Promise<any>;clientId:string;locked?:boolean;onClose:()=>void};
type Session={ticket:string;expiresAt:number};
export function RemoteDesktop({post,clientId,locked,onClose}:Props){
 const [open,setOpen]=useState(false),[stage,setStage]=useState('setup'),[error,setError]=useState(''),[available,setAvailable]=useState(false),[active,setActive]=useState(false),[credentialTypes,setCredentialTypes]=useState<string[]>([]),[keyboard,setKeyboard]=useState(false),[fit,setFit]=useState(true),[pan,setPan]=useState(false);
 const screen=useRef<HTMLDivElement>(null),surface=useRef<HTMLDialogElement>(null),user=useRef<HTMLInputElement>(null),password=useRef<HTMLInputElement>(null),typing=useRef<HTMLInputElement>(null),rfb=useRef<RFB|null>(null),session=useRef<Session|null>(null),generation=useRef(0),credentials=useRef<Record<string,string>[]>([]),composing=useRef(false),postRef=useRef(post),onCloseRef=useRef(onClose);postRef.current=post;onCloseRef.current=onClose;
 const termination=useRef<Promise<unknown>>(Promise.resolve());
 const erase=()=>{for(const value of credentials.current)for(const key of Object.keys(value))delete value[key];credentials.current=[];if(password.current)password.current.value='';if(user.current)user.current.value='';if(typing.current)typing.current.value=''};
 const disconnect=()=>{generation.current++;const previous=session.current;session.current=null;rfb.current?.blur();rfb.current?.disconnect();rfb.current=null;screen.current?.replaceChildren();erase();if(previous)termination.current=postRef.current('desktop/stop',{clientId,ticket:previous.ticket}).catch(()=>{});return previous};
 useEffect(()=>{
  const leave=()=>disconnect();window.addEventListener('pagehide',leave);
  const heartbeat=setInterval(()=>{const s=session.current;if(!s||!rfb.current)return;void postRef.current('desktop/renew',{clientId,ticket:s.ticket}).catch(()=>{disconnect();setError('连接已过期，请重新连接；未重放任何输入。');setStage('disconnected')})},12000);
  return()=>{clearInterval(heartbeat);window.removeEventListener('pagehide',leave);disconnect()};
 },[]);
 useEffect(()=>{if(rfb.current){rfb.current.scaleViewport=fit;rfb.current.clipViewport=!fit;rfb.current.dragViewport=!fit&&pan}},[fit,pan]);
 useEffect(()=>{if(keyboard)typing.current?.focus()},[keyboard]);
 useEffect(()=>{if(open&&!surface.current?.open)surface.current?.showModal()},[open]);
 async function check(){setError('');try{const status=await postRef.current('desktop/status');setAvailable(status.available);setActive(status.active)}catch(e){setError((e as Error).message)}}
 async function connect(){
  setStage('connecting');setError('');setCredentialTypes([]);const attempt=++generation.current;
  try{
   const s:Session=await postRef.current('desktop/start',{clientId});
   if(attempt!==generation.current){void postRef.current('desktop/stop',{clientId,ticket:s.ticket}).catch(()=>{});return}session.current=s;
   const [{default:Client},{initLogging}]=await Promise.all([import('@novnc/novnc'),import('skyrail-novnc-logging')]);initLogging('none');
   if(attempt!==generation.current||!screen.current)return;
   const url=new URL('/v1/desktop/socket',window.location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';
   const client=new Client(screen.current,url.href,{shared:true,wsProtocols:['binary','skyrail.'+s.ticket]});rfb.current=client;client.scaleViewport=true;client.resizeSession=false;client.focusOnClick=true;client.showDotCursor=true;
   client.addEventListener('credentialsrequired',event=>{if(attempt!==generation.current)return;const types=(event as CustomEvent<{types:string[]}>).detail.types;if(types.some(t=>!['username','password'].includes(t))){setError('系统请求了尚不支持的认证方式，请使用系统账户认证。');disconnect();setStage('disconnected');return}setCredentialTypes(types);setStage('credentials')});
   client.addEventListener('connect',()=>{if(attempt!==generation.current)return;erase();setStage('live');setFit(true);setPan(false);client.focus()});
   client.addEventListener('securityfailure',()=>{if(attempt===generation.current)setError('系统账户认证失败。请重新连接后检查用户名与密码。')});
   client.addEventListener('disconnect',()=>{if(attempt!==generation.current)return;disconnect();setStage('disconnected');setError(previous=>previous||'全桌面连接已结束。重新连接不会重放按键。')});
  }catch(e){if(attempt===generation.current){disconnect();setStage('disconnected');setError((e as Error).message)}}
 }
 async function close(){disconnect();setOpen(false);setKeyboard(false);setStage('setup');if(document.fullscreenElement===surface.current)void document.exitFullscreen();await termination.current;onCloseRef.current()}
 function sendText(input:HTMLInputElement){const value=input.value;input.value='';if(stage!=='live')return;for(const character of value){const code=character.codePointAt(0)!;rfb.current?.sendKey(code<=255?code:0x01000000|code)}}
 function key(symbol:number,code:string){rfb.current?.sendKey(symbol,code)}
 return <>
  <div className="desktop-entry"><div><strong>{locked?'Mac 已锁屏':'人工全桌面'}</strong><small>{locked?'远程输入密码，解锁后继续原对话':'查看完整桌面或处理系统登录画面'}</small></div><button className="primary" onClick={()=>{setOpen(true);setStage('setup');void check()}}>{locked?'人工解锁':'打开全桌面'}</button></div>
  {open&&<dialog className="desktop-console" ref={surface} onCancel={e=>e.preventDefault()} aria-label="人工全桌面控制台">
   <div className="desktop-toolbar"><div><strong>人工全桌面</strong><span role="status">{stage==='live'?'已连接 · 由你操作':stage==='credentials'?'验证 Mac 账户':stage==='connecting'?'正在连接…':'尚未连接'}</span></div><div><button onClick={()=>surface.current?.requestFullscreen?.().catch(()=>setError('当前浏览器不支持全屏，请使用横屏或隐藏地址栏。'))}>全屏</button><button onClick={()=>void close()}>{stage==='live'?'结束并返回 Codex':'关闭'}</button></div></div>
   <p className="desktop-privacy">共享整个 Mac 桌面。密码请在这里输入；画面与按键不写入聊天。人工控制期间 Codex 电脑操作暂停。</p>
   {error&&<p className="desktop-error" role="alert">{error}</p>}
   <div className="desktop-screen" ref={screen} hidden={stage!=='live'&&stage!=='connecting'}/>
   {stage==='credentials'&&<form className="desktop-form" onSubmit={e=>{e.preventDefault();const value:Record<string,string>={};if(credentialTypes.includes('username'))value.username=user.current?.value||'';value.password=password.current?.value||'';credentials.current.push(value);rfb.current?.sendCredentials(value);if(password.current)password.current.value='';setStage('connecting')}}><h2>登录这台 Mac</h2><p>使用 Mac 的系统账户，不是 Skyrail 访问密码。系统有时还会显示登录画面，需要再次输入。</p>{credentialTypes.includes('username')&&<label>Mac 用户名<input ref={user} name="mac-user" autoComplete="off" autoCapitalize="none" spellCheck={false} required/></label>}<label>Mac 密码<input ref={password} name="mac-password" type="password" autoComplete="off" required/></label><button className="primary">连接系统桌面</button></form>}
   {['setup','disconnected'].includes(stage)&&<div className="desktop-form"><h2>{available?'连接系统桌面':'先开启 Mac 屏幕共享'}</h2><p>{available?'你将直接操作本机完整桌面；当前应用连接会断开。连接过程中如出现会话选择，请选择共享现有桌面。':'在 Mac 上打开「系统设置 → 通用 → 共享 → 屏幕共享」，仅允许你的账户访问。开启后回到这里刷新状态。'}</p>{!available&&<p>无需启用“任何人请求控制”或单独设置传统 VNC 密码。</p>}{active&&<p>已有页面正在使用人工控制台，请先在那个页面断开。</p>}<div className="desktop-actions"><button onClick={()=>void check()}>刷新状态</button><button className="primary" disabled={!available||active} onClick={()=>void connect()}>连接全桌面</button></div></div>}
   {stage==='connecting'&&<p className="desktop-connecting" role="status">正在等待系统画面…</p>}
   {stage==='live'&&<div className="desktop-controls"><button onClick={()=>setFit(!fit)}>{fit?'原尺寸':'适应屏幕'}</button><button disabled={fit} aria-pressed={pan} onClick={()=>setPan(!pan)}>{pan?'正在平移':'平移画面'}</button><button aria-pressed={keyboard} onClick={()=>setKeyboard(!keyboard)}>键盘</button>{[[0xff09,'Tab','Tab'],[0xff0d,'Enter','回车'],[0xff08,'Backspace','退格'],[0xff1b,'Escape','Esc']].map(([symbol,code,label])=><button key={code} onClick={()=>key(Number(symbol),String(code))}>{label}</button>)}{keyboard&&<input className="desktop-keyboard" ref={typing} type="password" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-label="远程键盘，输入立即发送且不保留" placeholder="点此输入到 Mac" onCompositionStart={()=>{composing.current=true}} onCompositionEnd={e=>{composing.current=false;sendText(e.currentTarget)}} onChange={e=>{if(!composing.current)sendText(e.currentTarget)}} onKeyDown={e=>{if(e.nativeEvent.isComposing)return;if(e.key==='Enter'||e.key==='Backspace'){e.preventDefault();key(e.key==='Enter'?0xff0d:0xff08,e.key)}}}/>}</div>}
  </dialog>}
 </>
}
