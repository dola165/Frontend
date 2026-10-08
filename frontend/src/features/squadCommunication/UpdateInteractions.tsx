import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {MessageCircle,SmilePlus,Trash2} from 'lucide-react';
import {extractApiErrorMessage} from '../../utils/apiError';
import * as api from './api';
import './update-interactions.css';

const reactions: {kind:api.ReactionKind;emoji:string;label:string}[]=[
 {kind:'LIKE',emoji:'👍',label:'Thumbs up'}, {kind:'DISLIKE',emoji:'👎',label:'Thumbs down'},
 {kind:'LAUGH',emoji:'😄',label:'Laugh'}, {kind:'CELEBRATE',emoji:'🎉',label:'Celebrate'},
 {kind:'CONFUSED',emoji:'😕',label:'Confused'}, {kind:'HEART',emoji:'❤️',label:'Heart'},
 {kind:'ROCKET',emoji:'🚀',label:'Rocket'}, {kind:'EYES',emoji:'👀',label:'Eyes'},
];
const errorMessage=(e:unknown)=>extractApiErrorMessage(e,'This could not be saved. Please try again.');

function AcknowledgedBy({people}:{people:api.Receipt[]}) {
 const [open,setOpen]=useState(false),[pinned,setPinned]=useState(false);
 const root=useRef<HTMLDivElement>(null),id=useId();
 useEffect(()=>{
  if(!open)return;
  const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node)){setOpen(false);setPinned(false);}};
  document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
 },[open]);
 return <div ref={root} className="update-acknowledgers" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>{if(!pinned)setOpen(false);}}
  onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget)){setOpen(false);setPinned(false);}}}
  onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);setPinned(false);}}}>
  <button type="button" className="update-ack-line" aria-expanded={open} aria-controls={id} onFocus={()=>setOpen(true)} onClick={()=>{setPinned(!pinned);setOpen(!pinned);}}>
   Acknowledged by <span>{people.length} {people.length===1?'person':'people'}</span>
  </button>
  {open&&<div id={id} className="update-people-popover" role="region" aria-label="People who acknowledged" tabIndex={0}>
   <strong>Acknowledged by</strong>
   {people.length?<ul>{people.map(person=><li key={person.user_id}><span className="update-person-avatar" aria-hidden="true">{person.full_name.slice(0,1)}</span><span>{person.full_name}</span></li>)}</ul>:<p>No acknowledgements yet.</p>}
  </div>}
 </div>;
}

export function UpdateInteractions({space,message,onChanged}:{space:api.SquadOverview;message:api.SquadMessage;onChanged:()=>void}) {
 const [picker,setPicker]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState(''),[commentsOpen,setCommentsOpen]=useState(false);
 const [commentsVisited,setCommentsVisited]=useState(false);
 const busy=useRef(false),pickerRoot=useRef<HTMLDivElement>(null),pickerButton=useRef<HTMLButtonElement>(null),commentsId=useId();
 useEffect(()=>{
  if(!picker)return;
  const close=(e:PointerEvent)=>{if(!pickerRoot.current?.contains(e.target as Node))setPicker(false);};
  document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);
 },[picker]);
 const toggle=async(kind:api.ReactionKind)=>{
  if(busy.current)return;busy.current=true;setPending(true);setError('');
  const active=!(message.reactions??[]).some(r=>r.reaction===kind&&r.user_id===space.viewer_id);
  try{await api.setReaction(space.id,message.id,kind,active);setPicker(false);onChanged();}
  catch(e){setError(errorMessage(e));}finally{busy.current=false;setPending(false);}
 };
 return <div className="update-interactions">
  {message.important&&<AcknowledgedBy people={message.acknowledged_by??[]}/>}
  <div className="update-social-actions">
   {reactions.map(({kind,emoji,label})=>{
    const people=(message.reactions??[]).filter(r=>r.reaction===kind);
    return people.length>0&&<button key={kind} type="button" className="update-reaction" aria-label={`${label}, ${people.length} ${people.length===1?'reaction':'reactions'}`} aria-pressed={people.some(r=>r.user_id===space.viewer_id)}
     title={`${label}: ${people.map(r=>r.full_name).join(', ')}`} disabled={pending} onClick={()=>void toggle(kind)}><span aria-hidden="true">{emoji}</span>{people.length}</button>;
   })}
   <div ref={pickerRoot} className="update-reaction-picker" onKeyDown={e=>{if(e.key==='Escape'){setPicker(false);pickerButton.current?.focus();}}}>
    <button ref={pickerButton} type="button" className="update-add-reaction" aria-label="Add a reaction" aria-expanded={picker} disabled={pending} onClick={()=>setPicker(!picker)}><SmilePlus size={16}/></button>
    {picker&&<div className="update-emoji-picker" role="group" aria-label="Choose a reaction">{reactions.map(({kind,emoji,label})=><button type="button" key={kind} aria-label={label} title={label} aria-pressed={(message.reactions??[]).some(r=>r.reaction===kind&&r.user_id===space.viewer_id)} disabled={pending} onClick={()=>void toggle(kind)}>{emoji}</button>)}</div>}
   </div>
   <button type="button" className="update-comments-toggle" aria-expanded={commentsOpen} aria-controls={commentsId} onClick={()=>{setCommentsVisited(true);setCommentsOpen(!commentsOpen);}}><MessageCircle size={15}/>{message.comment_count??0} {(message.comment_count??0)===1?'comment':'comments'}</button>
  </div>
  {error&&<p className="squad-error" role="alert">{error}</p>}
  <div id={commentsId} hidden={!commentsOpen}>{commentsVisited&&<UpdateComments space={space} messageId={message.id} onChanged={onChanged} active={commentsOpen}/>}</div>
 </div>;
}

function UpdateComments({space,messageId,onChanged,active:visible}:{space:api.SquadOverview;messageId:number;onChanged:()=>void;active:boolean}) {
 const [rows,setRows]=useState<api.UpdateComment[]>([]),[older,setOlder]=useState<api.UpdateComment[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[loadError,setLoadError]=useState('');
 const [draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[more,setMore]=useState(false),[hasMore,setHasMore]=useState(true);
 const sending=useRef(false),request=useRef<{body:string;id:string}|null>(null);
 useEffect(()=>{
  if(!visible)return;
  const controller=new AbortController();let active=true;
  const load=()=>{if(document.hidden)return;void api.updateComments(space.id,messageId,controller.signal).then(data=>{if(active){setRows(data);setLoading(false);setLoadError('');}}).catch(e=>{if(active){setLoadError(errorMessage(e));setLoading(false);}});};
  load();const timer=setInterval(load,10000);return()=>{active=false;controller.abort();clearInterval(timer);};
 },[space.id,messageId,revision,visible]);
 const refresh=()=>{setRevision(n=>n+1);onChanged();};
 const send=async(e:FormEvent)=>{
  e.preventDefault();const body=draft.trim();if(!body||sending.current)return;
  sending.current=true;setBusy(true);setError('');
  if(request.current?.body!==body)request.current={body,id:crypto.randomUUID()};
  try{await api.addUpdateComment(space.id,messageId,request.current.id,body);setDraft('');request.current=null;refresh();}
  catch(e){setError(errorMessage(e));}finally{sending.current=false;setBusy(false);}
 };
 const merged=[...new Map([...older,...rows].map(c=>[c.id,c])).values()].sort((a,b)=>a.id-b.id);
 return <section className="update-comments" aria-label="Comments on this update">
  <p className="update-comments-audience">Visible to this squad’s families, players and coaches.</p>
  {loading?<p role="status">Loading comments…</p>:loadError?<p role="alert">{loadError} <button onClick={()=>setRevision(n=>n+1)}>Retry</button></p>:<>
   {rows.length===50&&hasMore&&<button disabled={more} onClick={async()=>{setMore(true);try{const data=await api.updateComments(space.id,messageId,undefined,Math.min(...merged.map(c=>c.id)));setOlder(prev=>[...prev,...data]);setHasMore(data.length===50);}catch(e){setError(errorMessage(e));}finally{setMore(false);}}}>Load earlier comments</button>}
   {!merged.length&&<p className="update-comments-empty">No comments yet. Start the conversation.</p>}
   {merged.map(comment=><div className="update-comment" key={comment.id}>
    <span className="update-person-avatar" aria-hidden="true">{comment.author_name.slice(0,1)}</span>
    <div><header><strong>{comment.author_name}</strong><time dateTime={comment.created_at}>{new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(comment.created_at))}</time>
     {(space.can_manage||comment.author_id===space.viewer_id)&&<button type="button" aria-label={`Remove comment from ${comment.author_name}`} disabled={busy} onClick={async()=>{if(!window.confirm('Remove this comment for everyone?'))return;setBusy(true);try{await api.removeUpdateComment(space.id,messageId,comment.id);setOlder(prev=>prev.filter(c=>c.id!==comment.id));refresh();}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}}><Trash2 size={13}/></button>}
    </header><p>{comment.body}</p></div>
   </div>)}
  </>}
  <form onSubmit={e=>void send(e)}><label>Write a comment<textarea aria-label="Write a comment on this update" value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)} required maxLength={2000} placeholder="Ask a question or leave a reply…"/></label><button type="submit" disabled={busy||!draft.trim()}>Comment</button></form>
  {error&&<p className="squad-error" role="alert">{error}</p>}
 </section>;
}
