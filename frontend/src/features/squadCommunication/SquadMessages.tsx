import {MessageText} from '../../components/chat/MessageText';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {BellRing,Check,MessageCircle,Send,Share2,Trash2} from 'lucide-react';
import {extractApiErrorMessage} from '../../utils/apiError';
import {Link} from 'react-router-dom';
import {subscribeNotificationsChanged} from '../../utils/notifications';
import * as api from './api';
import {UpdateInteractions} from './UpdateInteractions';
import {AnnouncementComposer} from '../announcements/AnnouncementComposer';
import {PinnedState} from '../announcements/PinnedState';
import {ReadReceipts} from '../announcements/ReadReceipts';
import {isPinned} from '../announcements/pinning';
import './squad-communication.css';
const when=(s:string)=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(s));
const errorText=(e:unknown)=>extractApiErrorMessage(e,'This could not be saved. Please try again.');
export function SquadMessages({space,kind,thread,onSent}:{space:api.SquadOverview;kind:'CHAT'|'ANNOUNCEMENT';thread:number|null;onSent:()=>void}) {
 const [rows,setRows]=useState<api.SquadMessage[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0),[older,setOlder]=useState<api.SquadMessage[]>([]),[more,setMore]=useState(false);
 const [body,setBody]=useState(''),[busy,setBusy]=useState(false);
 const request=useRef<{signature:string;id:string}|null>(null),log=useRef<HTMLDivElement>(null),follow=useRef(true),sending=useRef(false);
 const refresh=()=>setRevision(n=>n+1);
 useEffect(()=>{let active=true;const abort=new AbortController();
  const load=()=>{if(document.hidden)return;void api.messages(space.id,kind,thread,abort.signal).then(data=>{if(!active)return;if(log.current)follow.current=log.current.scrollHeight-log.current.scrollTop-log.current.clientHeight<100;setRows(data);setLoading(false);setError('');if(data.length&&!document.hidden)void api.markRead(space.id,data[0].id,thread).catch(()=>{});}).catch(e=>{if(active){setRows([]);setOlder([]);setError(errorText(e));setLoading(false);}});};
  load();const timer=setInterval(load,10000);return()=>{active=false;abort.abort();clearInterval(timer);};
 },[space.id,kind,thread,revision]);
 useEffect(()=>{if(kind==='CHAT'&&follow.current&&log.current)log.current.scrollTop=log.current.scrollHeight;},[rows,kind]);
 useEffect(()=>{const viewport=log.current;if(kind!=='CHAT'||!viewport||typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(()=>{if(follow.current)viewport.scrollTop=viewport.scrollHeight;});observer.observe(viewport);return()=>observer.disconnect();},[loading,kind]);
 useEffect(()=>subscribeNotificationsChanged(()=>setRevision(n=>n+1)),[]);
 // Chat reads oldest first; announcements newest first, with those still pinned on top.
 const merged=[...new Map([...older,...rows].map(r=>[r.id,r])).values()].sort((a,b)=>kind==='CHAT'?a.id-b.id:(Number(isPinned(b))-Number(isPinned(a)))||b.id-a.id);
 const send=async(e:FormEvent)=>{e.preventDefault();if(sending.current)return;sending.current=true;setBusy(true);setError('');
  const signature=JSON.stringify([body]);if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
  try{await api.postMessage(space.id,{requestId:request.current.id,kind,threadUserId:thread,title:null,body,important:false});setBody('');request.current=null;refresh();onSent();follow.current=true;if(log.current)log.current.scrollTop=log.current.scrollHeight;}catch(e){setError(errorText(e));}finally{setBusy(false);sending.current=false;}};
 const action=async(fn:()=>Promise<unknown>)=>{setBusy(true);try{await fn();setOlder([]);refresh();}catch(e){setError(errorText(e));}finally{setBusy(false);}};
 const canPost=kind==='CHAT'||space.can_manage;
 return <section className={`squad-messages ${kind==='CHAT'?'squad-conversation':'squad-announcements'}`} aria-label={kind==='ANNOUNCEMENT'?'Announcements':thread?'Private coach conversation':'Squad group chat'}>
  <div className="squad-channel-intro">{kind==='ANNOUNCEMENT'&&<Link className="squad-notifications-link" to="/notifications?scope=personal"><BellRing size={16}/>Notifications</Link>}<h2>{kind==='ANNOUNCEMENT'?'Announcements':thread?(space.can_manage?'Family conversation':'Message your coaches'):'Your squad conversation'}</h2><p>{kind==='ANNOUNCEMENT'?'Training changes, kit and travel from the coaches. Pinned ones also show on Home until they expire.':thread?'Visible to this family or player and the current coaching team.':'For squad players, their linked parents and the coaching team.'}</p></div>
  {error&&<p className="squad-error" role="alert">{error}</p>}
  {canPost&&kind==='ANNOUNCEMENT'&&<AnnouncementComposer space={space} onPosted={()=>{setOlder([]);refresh();onSent();}}/>}
  {loading?<p role="status">Loading messages…</p>:!merged.length?<div className="squad-empty"><MessageCircle/><h3>{kind==='ANNOUNCEMENT'?'No announcements yet':'Start the conversation'}</h3><p>{kind==='ANNOUNCEMENT'?'The coaches’ next announcement will appear here.':'Ask a question, introduce yourself or share a useful reminder.'}</p></div>:<div ref={log} onScroll={()=>{const viewport=log.current;if(viewport)follow.current=viewport.scrollHeight-viewport.scrollTop-viewport.clientHeight<100;}} role={kind==='CHAT'?'log':undefined} className={kind==='CHAT'?'squad-chat-log':'squad-notice-list'}>{merged.map(m=><article id={`squad-update-${m.id}`} key={m.id} className={`squad-message ${m.author_id===space.viewer_id?'is-mine':''} ${m.important?'is-important':''} ${m.acknowledged_at?'is-acknowledged':m.acknowledgement_requested?'awaiting-acknowledgement':''}`}>{kind==='ANNOUNCEMENT'&&<span className="squad-news-bell" aria-hidden="true"><BellRing size={20}/></span>}<header><strong>{m.author_name}</strong><time dateTime={m.created_at}>{when(m.created_at)}</time>{kind==='ANNOUNCEMENT'&&<PinnedState message={m}/>}{m.acknowledgement_requested&&!m.acknowledged_at&&<span className="squad-count">Please confirm you’ve read it</span>}</header>{m.title&&<h3>{m.title}</h3>}<p className="squad-message-body"><MessageText text={m.body}/></p><footer>{m.acknowledgement_requested&&(m.acknowledged_at?<span className="squad-ack"><Check size={15}/>Read</span>:<button disabled={busy} onClick={()=>void action(()=>api.acknowledge(space.id,m.id))}><Check size={15}/>Mark as read</button>)}{kind==='ANNOUNCEMENT'&&<a target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${space.name}: ${m.title}\n${m.body}\n${location.origin}/squads/${space.id}`)}`}><Share2 size={14}/>Share on WhatsApp</a>}{(space.can_manage||m.author_id===space.viewer_id)&&<button aria-label={`Remove message from ${m.author_name}`} disabled={busy} onClick={()=>{if(window.confirm('Remove this message for everyone in this conversation?'))void action(()=>api.removeMessage(space.id,m.id));}}><Trash2 size={14}/></button>}</footer>{kind==='ANNOUNCEMENT'&&space.can_manage&&m.important&&<ReadReceipts squadId={space.id} message={m}/>}{kind==='ANNOUNCEMENT'&&<UpdateInteractions space={space} message={m} onChanged={refresh}/>}</article>)}</div>}
  {rows.length===50&&<button disabled={more} onClick={async()=>{setMore(true);try{const before=Math.min(...merged.map(r=>r.id));const data=await api.messages(space.id,kind,thread,undefined,before);setOlder(prev=>[...prev,...data]);}catch(e){setError(errorText(e));}finally{setMore(false);}}}>Load older messages</button>}
  {canPost&&kind==='CHAT'&&<form className="squad-composer squad-chat-composer" onSubmit={send}><label className="sr-only" htmlFor="squad-message">Message</label><textarea id="squad-message" required maxLength={4000} value={body} onChange={e=>setBody(e.target.value)} placeholder={thread?(space.can_manage?'Write a reply…':'Message the coaches…'):'Message your squad…'}/><button className="squad-primary" disabled={busy||!body.trim()} aria-label="Send message"><Send size={18}/></button></form>}
 </section>;
}

