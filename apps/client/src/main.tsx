import React,{useEffect,useState} from 'react';
import{createRoot}from'react-dom/client';
import './style.css';
import {Conversation,type ChatMessage,type ChatApproval} from './Conversation';
import {MacWorkspace, type Lease, type StreamState} from './MacWorkspace';
type Message=ChatMessage;type Thread={id:string;title:string;messages:Message[];status:string;error?:string};type State={threads:Thread[];deletedThreads?:{id:string;title:string;deletedAt:string}[];runtime:string;lease:Lease;stream?:StreamState;approvals?:ChatApproval[]};
function App(){
 const [state,setState]=useState<State>({threads:[],runtime:'disconnected',lease:{owner:'none',epoch:0}}),[token,setToken]=useState(''),[selected,select]=useState(''),[text,setText]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[panel,open]=useState(false),[history,showHistory]=useState(false),[full,setFull]=useState(false),[dark,setDark]=useState(false),[guide,showGuide]=useState(false),[trash,showTrash]=useState(false),[deletedId,setDeletedId]=useState('');
 const autoOpened=React.useRef('');
 const thread=state.threads.find(t=>t.id===selected);const running=['running','submitting'].includes(thread?.status||'');
 const sourceRef=React.useRef<EventSource|null>(null);
 const messagesRef=React.useRef<HTMLDivElement|null>(null);const follows=React.useRef(true);
 function selectThread(id:string){select(id);localStorage.setItem('skyrail.thread',id);follows.current=true}
 useEffect(()=>{
  let disposed=false;let timer:ReturnType<typeof setTimeout>;
  async function attach(initial=false){
   try{
    const response=await fetch('/v1/bootstrap');if(!response.ok)throw Error('bootstrap failed');const s=await response.json();if(disposed)return;
    setToken(s.token);setState(s);
    if(initial){const saved=localStorage.getItem('skyrail.thread');selectThread(s.threads.some((t:Thread)=>t.id===saved)?saved:s.threads[0]?.id||'')}
    sourceRef.current?.close();const source=new EventSource('/v1/events');sourceRef.current=source;
    source.onmessage=e=>{if(!disposed)setState(JSON.parse(e.data))};
    source.onopen=()=>setError(e=>e.startsWith('本地服务')?'':e);
    source.onerror=()=>{source.close();if(!disposed){setError('本地服务连接中断，正在重连…');timer=setTimeout(()=>attach(),2000)}};
   }catch{if(!disposed){setError('本地服务连接失败，正在重连…');timer=setTimeout(()=>attach(initial),3000)}}
  }
  attach(true);return()=>{disposed=true;clearTimeout(timer);sourceRef.current?.close()}
 },[]);
 React.useLayoutEffect(()=>{const el=messagesRef.current;if(el&&follows.current)el.scrollTop=el.scrollHeight},[thread?.messages.map(m=>m.text).join(''),selected]);
 useEffect(()=>{if(state.lease.app&&state.lease.threadId===selected){const binding=selected+state.lease.app;if(autoOpened.current!==binding){autoOpened.current=binding;open(true)}}},[state.lease.app,state.lease.threadId,selected]);
 async function post(path:string,data:object={}){const r=await fetch('/v1/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Skyrail-Token':token},body:JSON.stringify(data)});const s=await r.json();if(!r.ok)throw Error(s.message);return s}
 async function act(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function connect(){await act(async()=>setState(await post('connect')))}
 async function create(){const t=await post('threads');selectThread(t.id);setState(s=>({...s,threads:s.threads.some(x=>x.id===t.id)?s.threads:[t,...s.threads]}));return t.id}
 async function deleteThread(id:string){await act(async()=>{const next=await post(`threads/${id}/delete`);setState(next);setDeletedId(id);if(selected===id)selectThread(next.threads[0]?.id||'')})}
 async function restoreThread(id:string){await act(async()=>{const next=await post(`threads/${id}/restore`);setState(next);setDeletedId('');selectThread(id);showTrash(false)})}
 async function send(){if(!text.trim()||running||busy||state.runtime!=='connected')return;const value=text;await act(async()=>{const id=selected||await create();try{setText('');await post(`threads/${id}/messages`,{text:value,clientMessageId:crypto.randomUUID()})}catch(e){setText(value);throw e}})}
 return <div className={dark?'app dark':'app'}>
 <header><div className="brand"><span className="mark">╱</span> Skyrail</div><div className="header-actions"><button onClick={()=>showHistory(!history)} aria-expanded={history}>☷ <span>历史</span></button><button onClick={()=>setDark(!dark)} aria-label="切换主题">{dark?'☀':'☾'}</button><button className={panel?'selected':''} onClick={()=>open(!panel)} aria-expanded={panel}>▣ 电脑</button></div></header>
 {history&&<aside className="history"><div className="row"><h3>{trash?'最近删除':'你的对话'}</h3><button onClick={()=>showHistory(false)} aria-label="关闭历史">×</button></div><div className="history-tabs"><button onClick={()=>showTrash(false)} className={!trash?'selected':''}>对话</button><button onClick={()=>showTrash(true)} className={trash?'selected':''}>最近删除{state.deletedThreads?.length?' ('+state.deletedThreads.length+')':''}</button></div>{!trash?<><button className="new" onClick={()=>act(async()=>{await create();showHistory(false)})}>＋ 新对话</button>{state.threads.map(t=><div className="history-row" key={t.id}><button className="history-item" onClick={()=>{selectThread(t.id);showHistory(false)}}>{t.title}<small>{{idle:'尚未开始',completed:'已完成',running:'进行中',submitting:'正在发送',interrupted:'已中断',failed:'未完成'}[t.status]||t.status}</small></button><button className="delete-chat" disabled={busy||['running','submitting'].includes(t.status)} aria-label={'删除对话：'+t.title} title="移到最近删除，可恢复" onClick={()=>deleteThread(t.id)}>×</button></div>)}</>:<>{!(state.deletedThreads?.length)&&<p className="history-empty">没有已删除的对话。</p>}{state.deletedThreads?.map(t=><div className="history-row" key={t.id}><span>{t.title}</span><button onClick={()=>restoreThread(t.id)}>恢复</button></div>)}</>}<p className="history-note">删除后可在“最近删除”恢复。正在执行的任务请先停止。</p></aside>}
 {deletedId&&<div className="undo-toast" role="status">对话已移到最近删除<button onClick={()=>restoreThread(deletedId)}>撤销</button><button onClick={()=>setDeletedId('')} aria-label="关闭撤销提示">×</button></div>}

 <main className={`${panel?'split':''} ${full?'full':''}`}>
 <section className="chat"><div className="conversation-heading"><span className="dot"/> {thread?.title||'让想法，开始发生。'}<button className="guide-trigger" onClick={()=>showGuide(!guide)} aria-expanded={guide}>电脑操作指南</button><span className="connection">{state.runtime==='connected'?'Codex 已连接':'Codex 未连接'}</span></div>
 {guide&&<div className="chat-guide"><strong>用一句话开始 Mac 任务</strong><p>例如“打开本机计算器，计算 2 的 10 次方”。Codex 会先请求连接应用；在对话中允许后，就能查看实时画面并确认操作。</p><p>系统权限、应用访问和控制权分别管理。需要时从电脑面板申请系统权限、接管或断开窗口。</p><button onClick={()=>{setText('打开本机计算器，计算 2 的 10 次方');showGuide(false)}}>试试计算器</button><button onClick={()=>open(true)}>查看电脑连接</button></div>}
 <div className="messages" ref={messagesRef} onScroll={()=>{const el=messagesRef.current;if(el)follows.current=el.scrollHeight-el.scrollTop-el.clientHeight<80}} aria-live="polite">{!thread?.messages.length?<div className="welcome"><div className="orbit">╱</div><h1>从一句话开始，<br/>一起把事情做好。</h1><p>和你的 Codex 对话。需要电脑时，<br/>在这里展开工作区，随时查看与接手。</p><div className="suggestions">{['打开本机计算器，计算 2 的 10 次方','梳理一个项目的实施计划','帮我比较两种技术方案'].map(s=><button key={s} onClick={()=>setText(s)}>{s} <span>↗</span></button>)}</div></div>:<Conversation messages={thread.messages} approvals={(state.approvals||[]).filter(a=>a.threadId===selected)} decide={async(id,allow,allowAll)=>{await post('approval',{id,allow,allowAll})}}/>}{running&&<div className="working">{(state.approvals||[]).some(a=>a.threadId===selected)?'◈ 等待你在上方确认':'◌ Codex 正在处理你的任务'}</div>}{thread?.error&&<p className="error">{thread.error}</p>}</div>
 <div className="composer-area">{error&&<div className="error" role="alert">{error}</div>}{state.runtime!=='connected'&&<div className="connect-strip"><span>使用本机已登录的 Codex</span><button disabled={busy} onClick={connect}>{busy?'正在连接…':'连接 Codex'}</button></div>}<form className="composer" onSubmit={e=>{e.preventDefault();send()}}><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="告诉 Codex，你想完成什么…" aria-label="消息" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send()}}}/><div className="composer-tools"><span>↵ 发送 · Shift + Enter 换行</span>{running?<button type="button" onClick={()=>act(async()=>{await post(`threads/${selected}/stop`)})}>停止任务</button>:<button className="send" disabled={busy||!text.trim()||state.runtime!=='connected'} aria-label="发送消息">↑</button>}</div></form><p className="footnote">本地优先 · 对话留在这台电脑 · 直接连接本机 Mac 应用</p></div></section>
 {panel&&<MacWorkspace running={running} lease={state.lease} stream={state.stream} approvals={[]} selected={selected} full={full} setFull={setFull} collapse={()=>{open(false);setFull(false)}} post={post} onSnapshot={setState} ensureThread={async()=>selected||await create()} switchThread={selectThread}/>}

 </main></div>
}
createRoot(document.getElementById('root')!).render(<App/>);
