import {MessageText} from '../../components/chat/MessageText';
import {useEffect,useRef} from 'react';
import {useAuth} from '../../context/AuthContext';
import {useSquadConversation} from './useSquadConversation';
import {BellRing,Check,MessageCircle,Send,Share2,Trash2} from 'lucide-react';
import {Link} from 'react-router-dom';
import * as api from './api';
import {UpdateInteractions} from './UpdateInteractions';
import {AnnouncementComposer} from '../announcements/AnnouncementComposer';
import {PinnedState} from '../announcements/PinnedState';
import {ReadReceipts} from '../announcements/ReadReceipts';
import {isPinned} from '../announcements/pinning';
import {useJourneyCopy} from './journeyCopy';
import './squad-communication.css';
const when=(s:string)=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(s));
/** readOnly: a guardian reading their 13-17 child's private thread; guardiansCanView: the thread's player is a minor whose guardians can read it. */
type Props={space:api.SquadOverview;kind:'CHAT'|'ANNOUNCEMENT';thread:number|null;onSent:()=>void;readOnly?:boolean;guardiansCanView?:boolean};
export function SquadMessages(props:Props) {
 const {sessionId}=useAuth();
 return <SquadMessageScope key={JSON.stringify([sessionId,props.space.viewer_id,props.space.id,props.kind,props.thread,props.readOnly])} {...props}/>;
}
function SquadMessageScope({space,kind,thread,onSent,readOnly=false,guardiansCanView=false}:Props) {
 const copy=useJourneyCopy();
 const log=useRef<HTMLDivElement>(null),follow=useRef(true);
 const {rows,body,setBody,error,loading,busy,more,hasOlder,unavailable,refresh,loadOlder,send,action}=useSquadConversation({space,kind,thread,onSent,readOnly,follow});
 useEffect(()=>{if(kind==='CHAT'&&follow.current&&log.current)log.current.scrollTop=log.current.scrollHeight;},[rows,kind]);
 useEffect(()=>{const viewport=log.current;if(kind!=='CHAT'||!viewport||typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(()=>{if(follow.current)viewport.scrollTop=viewport.scrollHeight;});observer.observe(viewport);return()=>observer.disconnect();},[loading,kind]);
 // Chat reads oldest first; announcements newest first, with pinned updates on top.
 const merged=[...rows].sort((a,b)=>kind==='CHAT'?a.id-b.id:(Number(isPinned(b))-Number(isPinned(a)))||b.id-a.id);
 const canPost=(kind==='CHAT'||space.can_manage)&&!readOnly&&!unavailable;
 return <section className={`squad-messages ${kind==='CHAT'?'squad-conversation':'squad-announcements'}`} aria-label={kind==='ANNOUNCEMENT'?copy('Coach updates','მწვრთნელის განახლებები'):thread?copy('Private coach conversation','პირადი საუბარი მწვრთნელთან'):copy('Squad group chat','გუნდის ჩატი')}>
  <div className="squad-channel-intro">{kind==='ANNOUNCEMENT'&&<Link className="squad-notifications-link" to="/requests?view=updates&scope=personal"><BellRing size={16}/>{copy('Notifications','შეტყობინებები')}</Link>}<h2>{kind==='ANNOUNCEMENT'?copy('Coach updates','მწვრთნელის განახლებები'):thread?(readOnly?copy('Conversation with the coaches','საუბარი მწვრთნელებთან'):space.can_manage?copy('Parent conversation','საუბარი მშობელთან'):copy('Message the coaches','მისწერეთ მწვრთნელებს')):copy('Squad chat','გუნდის ჩატი')}</h2><p>{kind==='ANNOUNCEMENT'?copy('Training changes, kit and travel from the coaches.','ცვლილებები, ფორმა და გასვლები მწვრთნელებისგან.'):thread?(readOnly?copy('You can read this because you are this player’s parent or guardian. Only the player and the coaches write here.','ამ საუბარს ხედავთ, როგორც მოთამაშის მშობელი ან მეურვე. წერენ მხოლოდ მოთამაშე და მწვრთნელები.'):guardiansCanView?copy('This player, their parents or guardians and the coaches see it.','ხედავენ ეს მოთამაშე, მისი მშობლები ან მეურვეები და მწვრთნელები.'):copy('Only this parent or guardian and the coaches see it.','ხედავენ მხოლოდ ეს მშობელი ან მეურვე და მწვრთნელები.')):copy('For the squad’s parents, guardians and coaches.','გუნდის მშობლებისთვის, მეურვეებისა და მწვრთნელებისთვის.')}</p></div>
  {error&&<p className="squad-error" role="alert">{error}{!unavailable&&<button type="button" onClick={()=>void refresh()}>{copy('Try again','სცადეთ ხელახლა')}</button>}</p>}
  {canPost&&kind==='ANNOUNCEMENT'&&<AnnouncementComposer space={space} onPosted={()=>{void refresh();onSent();}}/>}
  {unavailable?null:loading?<p role="status">{copy('Loading…','იტვირთება…')}</p>:error&&!merged.length?null:!merged.length?<div className="squad-empty"><MessageCircle/><h3>{kind==='ANNOUNCEMENT'?copy('No updates yet','განახლებები ჯერ არ არის'):copy('Start the conversation','დაიწყეთ საუბარი')}</h3><p>{kind==='ANNOUNCEMENT'?copy('The coaches’ next update will appear here.','მწვრთნელების შემდეგი განახლება აქ გამოჩნდება.'):copy('Ask a question or share a useful reminder.','დასვით კითხვა ან გააზიარეთ შეხსენება.')}</p></div>:<div ref={log} onScroll={()=>{const viewport=log.current;if(viewport)follow.current=viewport.scrollHeight-viewport.scrollTop-viewport.clientHeight<100;}} role={kind==='CHAT'?'log':undefined} className={kind==='CHAT'?'squad-chat-log':'squad-notice-list'}>{merged.map(m=><article id={`squad-update-${m.id}`} key={m.id} className={`squad-message ${m.author_id===space.viewer_id?'is-mine':''} ${m.important?'is-important':''} ${m.acknowledged_at?'is-acknowledged':m.acknowledgement_requested?'awaiting-acknowledgement':''}`}>{kind==='ANNOUNCEMENT'&&<span className="squad-news-bell" aria-hidden="true"><BellRing size={20}/></span>}<header><strong>{m.author_name}</strong><time dateTime={m.created_at}>{when(m.created_at)}</time>{kind==='ANNOUNCEMENT'&&<PinnedState message={m}/>}{m.acknowledgement_requested&&!m.acknowledged_at&&<span className="squad-count">{copy('Not acknowledged','დაუდასტურებელია')}</span>}</header>{m.title&&<h3>{m.title}</h3>}<p className="squad-message-body"><MessageText text={m.body}/></p><footer>{m.acknowledgement_requested&&(m.acknowledged_at?<span className="squad-ack"><Check size={15}/>{copy('Acknowledged','დადასტურებულია')}</span>:<button disabled={busy} onClick={()=>void action(()=>api.acknowledge(space.id,m.id))}><Check size={15}/>{copy('I’ve read it','წავიკითხე')}</button>)}{kind==='ANNOUNCEMENT'&&<a target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${space.name}: ${m.title}\n${m.body}\n${location.origin}/squads/${space.id}`)}`}><Share2 size={14}/>{copy('Share on WhatsApp','გაზიარება WhatsApp-ში')}</a>}{(space.can_manage||m.author_id===space.viewer_id)&&<button aria-label={copy(`Remove message from ${m.author_name}`,`შეტყობინების წაშლა: ${m.author_name}`)} disabled={busy} onClick={()=>{if(window.confirm(copy('Remove this message for everyone in this conversation?','წაიშალოს ეს შეტყობინება ყველასთვის?')))void action(()=>api.removeMessage(space.id,m.id));}}><Trash2 size={14}/></button>}</footer>{kind==='ANNOUNCEMENT'&&space.can_manage&&m.important&&<ReadReceipts squadId={space.id} message={m}/>}{kind==='ANNOUNCEMENT'&&<UpdateInteractions space={space} message={m} onChanged={refresh}/>}</article>)}</div>}
  {hasOlder&&<button disabled={more} onClick={()=>void loadOlder()}>{copy('Load older messages','ძველი შეტყობინებები')}</button>}
  {canPost&&kind==='CHAT'&&<form className="squad-composer squad-chat-composer" onSubmit={send}><label className="sr-only" htmlFor="squad-message">{copy('Message','შეტყობინება')}</label><textarea id="squad-message" required maxLength={4000} value={body} onChange={e=>setBody(e.target.value)} placeholder={thread?(space.can_manage?copy('Write a reply…','დაწერეთ პასუხი…'):copy('Message the coaches…','მისწერეთ მწვრთნელებს…')):copy('Message the squad…','მისწერეთ გუნდს…')}/><button className="squad-primary" disabled={busy||!body.trim()} aria-label={copy('Send message','გაგზავნა')}><Send size={18}/></button></form>}
 </section>;
}

