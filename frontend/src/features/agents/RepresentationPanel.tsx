import { EmptyState } from '../../components/ui/EmptyState';
import { Handshake } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import './representation.css';

type Connection = { id:number; recordKey?:string; recordType?:'REQUEST'|'RECORDED_CONNECTION'; agent_user_id:number; player_user_id:number|null; requested_by:number|null; representation_type:string; message:string; status:string; agent_name:string; player_name:string|null; canRespond:boolean; representation_id?:number|null; representation_generation?:number|null; recordedConnection?:boolean; protectedIdentity?:boolean };
type Context = { relevant:boolean; canRequest:boolean; alreadyRepresented:boolean; reason:string; agentId:number; playerId:number; requests:Connection[] };
type HistoryPage = { items:Connection[]; page:number; size:number; total:number; hasMore:boolean };
const types:Record<string,string>={FULL:'Full representation',LIMITED:'Limited scope',INTERMEDIARY:'Introductions'};
const states:Record<string,string>={PENDING:'Awaiting response',ACTIVE:'Representation active',DECLINED:'Declined',CANCELLED:'Withdrawn',ENDED:'Ended'};
function refresh(){window.dispatchEvent(new Event('representation-updated'));}
function useConnections<T>(path:string){
    const [data,setData]=useState<T>();const [error,setError]=useState('');const [version,setVersion]=useState(0);
    useEffect(()=>{const update=()=>setVersion(n=>n+1);const focus=()=>{if(!document.hidden)update();};window.addEventListener('representation-updated',update);window.addEventListener('focus',focus);const timer=window.setInterval(focus,15000);return()=>{window.clearInterval(timer);window.removeEventListener('representation-updated',update);window.removeEventListener('focus',focus);};},[]);
    useEffect(()=>{if(!path)return;const control=new AbortController();apiClient.get<T>(path,{signal:control.signal}).then(r=>{if(!control.signal.aborted){setData(r.data);setError('');}}).catch(()=>{if(!control.signal.aborted)setError('Representation details could not load.');});return()=>control.abort();},[path,version]);
    return {data,error,retry:()=>setVersion(n=>n+1)};
}
function keyOf(connection:Connection){return connection.recordKey??`request:${connection.id}`;}
function mergeConnections(first:Connection[],second:Connection[]){const seen=new Set<string>();return [...first,...second].filter(item=>{const key=keyOf(item);if(seen.has(key))return false;seen.add(key);return true;});}
function useHistory(enabled:boolean){
    const [items,setItems]=useState<Connection[]>([]),[page,setPage]=useState<HistoryPage>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[version,setVersion]=useState(0);
    useEffect(()=>{if(!enabled)return;const update=()=>{setItems([]);setPage(undefined);setVersion(n=>n+1);};window.addEventListener('representation-updated',update);return()=>window.removeEventListener('representation-updated',update);},[enabled]);
    useEffect(()=>{if(!enabled)return;const control=new AbortController();setBusy(true);apiClient.get<HistoryPage>('/representation-requests/history',{params:{page:0,size:50},signal:control.signal}).then(response=>{if(!control.signal.aborted){setItems(response.data.items);setPage(response.data);setError('');}}).catch(()=>{if(!control.signal.aborted)setError('Representation history could not load.');}).finally(()=>{if(!control.signal.aborted)setBusy(false);});return()=>control.abort();},[enabled,version]);
    async function more(){if(busy||!page?.hasMore)return;setBusy(true);setError('');try{const response=await apiClient.get<HistoryPage>('/representation-requests/history',{params:{page:page.page+1,size:page.size}});setItems(current=>mergeConnections(current,response.data.items));setPage(response.data);}catch{setError('Older representation history could not load.');}finally{setBusy(false);}}
    return {items,page,busy,error,more,retry:()=>setVersion(n=>n+1)};
}
function ConnectionCard({connection:c,userId}:{connection:Connection;userId:number}){
    const [busy,setBusy]=useState(false),[error,setError]=useState(''),[ending,setEnding]=useState(false);
    const asAgent=c.agent_user_id===userId;
    async function act(action:string){if(busy)return;setBusy(true);setError('');try{const endRepresentation=action==='END'&&c.representation_id&&c.representation_generation;await apiClient.patch(endRepresentation?`/representation-requests/representations/${c.representation_id}`:`/representation-requests/${c.id}`,endRepresentation?{action,expectedGeneration:c.representation_generation}:{action});setEnding(false);refresh();}catch(e){setError(extractApiErrorMessage(e,'Could not update this request. Please try again.'));}finally{setBusy(false);}}
    return <article id={`representation-${keyOf(c).replaceAll(':','-')}`} tabIndex={-1} className="representation-card"><div className="representation-card-heading">{c.protectedIdentity?<strong>Protected recorded connection</strong>:<Link to={`/profile/${asAgent?c.player_user_id:c.agent_user_id}`}>{asAgent?c.player_name:c.agent_name}</Link>}<span className={`representation-state is-${c.status.toLowerCase()}`}>{states[c.status]||c.status}</span></div><p>{types[c.representation_type]||c.representation_type}</p>{c.protectedIdentity&&<p>Player identity is withheld under the current age and consent boundary. Either participant can still end the recorded connection.</p>}{c.recordedConnection&&<p className="representation-record-note">Recorded connection. GrassKickZ does not verify contract terms or legal authority for this record.</p>}{c.message&&<p className="representation-message">{c.message}</p>}
        {c.status==='PENDING'&&<p>{c.canRespond?'Review this proposal before deciding.':'Your request has been sent. The other person must accept.'}</p>}
        {error&&<p role="alert">{error}</p>}<div className="representation-actions">
        {c.status==='PENDING'&&(c.canRespond?<><button disabled={busy} onClick={()=>void act('ACCEPT')}>Accept representation</button><button disabled={busy} onClick={()=>void act('DECLINE')}>Decline</button></>:<button disabled={busy} onClick={()=>void act('CANCEL')}>Withdraw request</button>)}
        {c.status==='ACTIVE'&&!ending&&<button onClick={()=>setEnding(true)}>End representation</button>}
        {ending&&<><p>End this connection? Both people will keep its history.</p><button disabled={busy} onClick={()=>void act('END')}>Confirm end</button><button disabled={busy} onClick={()=>setEnding(false)}>Keep connection</button></>}
        </div></article>;
}
function RequestForm({context,userId}:{context:Context;userId:number}){
    const [open,setOpen]=useState(false),[type,setType]=useState('FULL'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
    const active=context.requests.some(r=>['PENDING','ACTIVE'].includes(r.status));
    if(context.alreadyRepresented&&!active)return <p>This player already has an active connection with you.</p>;
    if(!context.relevant||active)return null;
    if(!context.canRequest)return <p>{context.reason}</p>;
    if(!open)return <button className="representation-primary" onClick={()=>setOpen(true)}>{userId===context.agentId?'Offer representation':'Request representation'}</button>;
    return <form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await apiClient.post('/representation-requests',{agentId:context.agentId,playerId:context.playerId,representationType:type,message});setOpen(false);refresh();}catch(error){setError(extractApiErrorMessage(error,'Could not send the request. Please try again.'));}finally{setBusy(false);}}}>
        <label>Representation scope<select value={type} disabled={busy} onChange={e=>setType(e.target.value)}>{Object.entries(types).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label>Your proposal<textarea maxLength={2000} value={message} disabled={busy} onChange={e=>setMessage(e.target.value)} placeholder="Explain how you would work together"/></label>
        <p>The other person must accept. Contract terms and qualifications are agreed and checked separately.</p>
        {error&&<p role="alert">{error}</p>}<div className="representation-actions"><button className="representation-primary" disabled={busy}>{busy?'Sending…':'Send representation request'}</button><button type="button" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button></div>
    </form>;
}
function ConnectionList({requests,userId,history}:{requests:Connection[];userId:number;history?:ReturnType<typeof useHistory>}){
    const location=useLocation(),[focused,setFocused]=useState<{focus:string;item:Connection}>(),[focusFailure,setFocusFailure]=useState<{focus:string;message:string}>(),[historyState,setHistoryState]=useState<{focus:string;open:boolean}>();
    const query=new URLSearchParams(location.search),request=query.get('representation'),record=query.get('representationRecord'),generation=query.get('representationGeneration');
    const focus=record?`representation:${record}:${generation??''}`:request?`request:${request}`:'',all=mergeConnections(requests,focused?.focus===focus?[focused.item]:[]);
    const matchesFocus=(item:Connection)=>request?item.recordType!=='RECORDED_CONNECTION'&&keyOf(item)===`request:${request}`:record?item.representation_id===Number(record)&&(!generation||item.representation_generation===Number(generation)):false;
    const hasFocus=Boolean(focus&&all.some(matchesFocus)),focusMatchKey=focus?(all.find(matchesFocus)?.recordKey??''):'';
    const current=all.filter(r=>['PENDING','ACTIVE'].includes(r.status)),past=all.filter(r=>!['PENDING','ACTIVE'].includes(r.status));
    const focusInHistory=Boolean(focus&&past.some(matchesFocus)),historyOpen=historyState?.focus===focus?historyState.open:focusInHistory;
    useEffect(()=>{if(!focus||hasFocus||focusFailure?.focus===focus)return;const control=new AbortController(),path=record?`/representation-requests/representations/${record}`:`/representation-requests/${request}`;apiClient.get<Connection>(path,{params:generation?{generation:Number(generation)}:undefined,signal:control.signal}).then(response=>{if(!control.signal.aborted){setFocused({focus,item:response.data});setFocusFailure(undefined);}}).catch(()=>{if(!control.signal.aborted)setFocusFailure({focus,message:'The linked representation record is no longer available.'});});return()=>control.abort();},[focus,hasFocus,record,request,generation,focusFailure?.focus]);
    useEffect(()=>{if(!focusMatchKey)return;const target=document.getElementById(`representation-${focusMatchKey.replaceAll(':','-')}`);target?.focus();target?.scrollIntoView?.({block:'center'});},[focusMatchKey]);
    return <div className="representation-list">{focusFailure?.focus===focus&&<p role="alert">{focusFailure.message}</p>}{current.map(c=><ConnectionCard key={keyOf(c)} connection={c} userId={userId}/>)}{past.length>0&&<details className="representation-history" open={historyOpen} onToggle={event=>setHistoryState({focus,open:event.currentTarget.open})}><summary>Past requests & connections ({past.length}{history?.page?` of ${history.page.total}`:''})</summary>{past.map(c=><ConnectionCard key={keyOf(c)} connection={c} userId={userId}/>)}{history?.page?.hasMore&&<button disabled={history.busy} onClick={()=>void history.more()}>{history.busy?'Loading…':'Load older history'}</button>}{history?.error&&<p role="alert">{history.error} <button onClick={history.retry}>Retry</button></p>}</details>}</div>;
}
export function RepresentationPanel({profileId,own,roles}:{profileId:number;own:boolean;roles:readonly string[]}){
    const {user}=useAuth();if(!user)return null;
    return <RepresentationContent key={`${user.id}:${profileId}`} profileId={profileId} own={own} userId={user.id} isAgent={roles.includes('AGENT')}/>;
}
export function RepresentationShortcut({profileId,className,onOpen}:{profileId:number;className:string;onOpen:()=>void}){
    const {user}=useAuth();
    const {data}=useConnections<Context>(user&&user.id!==profileId?`/representation-requests/profile/${profileId}`:'');
    if(!user||!data?.relevant)return null;
    const pending=data.requests.some(r=>['PENDING','ACTIVE'].includes(r.status));
    return <button type="button" className={className} onClick={onOpen}>{data.alreadyRepresented||pending?'View representation':data.canRequest?(user.id===data.agentId?'Offer representation':'Request representation'):'Representation details'}</button>;
}
function RepresentationContent({profileId,own,userId,isAgent}:{profileId:number;own:boolean;userId:number;isAgent:boolean}){
    const {data,error,retry}=useConnections<Context|Connection[]>(own?'/representation-requests':`/representation-requests/profile/${profileId}`);
    const history=useHistory(own);
    if(!own&&data&&!Array.isArray(data)&&!data.relevant)return null;
    const context=data&&!Array.isArray(data)?data:undefined,requests=mergeConnections(Array.isArray(data)?data:context?.requests??[],own?history.items:[]);
    return <section id="representation" className="representation-panel" aria-label="Representation"><h2>Representation</h2>{own&&isAgent&&<Link className="representation-primary" to="/agent?tab=portfolio">Find players & manage requests →</Link>}{error?<p role="alert">{error} <button onClick={retry}>Retry</button></p>:!data?<p role="status">Loading representation…</p>:<>{own&&!isAgent&&!requests.length&&<EmptyState compact icon={Handshake} title="Your representation connections" description="Representation requests will appear here. You can also request representation from an agent’s profile and review the proposed terms before accepting."/>}{context&&<RequestForm context={context} userId={userId}/>}<ConnectionList requests={requests} userId={userId} history={own?history:undefined}/></>}</section>;
}
export function AgentConnections(){
    const {user}=useAuth();const [query,setQuery]=useState(''),[results,setResults]=useState<{id:number;name:string}[]>([]),[selected,setSelected]=useState<number|null>(null),[searchError,setSearchError]=useState('');
    const {data,error,retry}=useConnections<Connection[]>('/representation-requests');
    const history=useHistory(true);
    useEffect(()=>{const control=new AbortController();const timer=window.setTimeout(()=>{if(query.trim().length<2){setResults([]);setSearchError('');return;}apiClient.get<{id:number;name:string}[]>('/representation-requests/players',{params:{q:query.trim()},signal:control.signal}).then(r=>{if(!control.signal.aborted){setResults(r.data);setSearchError(r.data.length?'':'No adult player profiles match this name.');}}).catch(()=>{if(!control.signal.aborted)setSearchError('Player search could not load. Try again.');});},250);return()=>{clearTimeout(timer);control.abort();};},[query]);
    if(!user)return null;
    return <section className="representation-panel agent-connections" aria-label="Representation requests"><h2>Connect with a player</h2><p>Find a player or open their profile from a squad. Send a proposal; representation becomes active after they accept.</p><label>Find a player<input value={query} onChange={e=>{setQuery(e.target.value);setSelected(null);}} placeholder="Search by name or username"/></label>{searchError&&<p role="status">{searchError}</p>}
        <ul className="representation-search">{results.map(p=><li key={p.id}><Link to={`/profile/${p.id}`}>{p.name}</Link><button onClick={()=>setSelected(p.id)}>Propose representation</button></li>)}</ul>
        {selected&&<RepresentationPanel key={selected} profileId={selected} own={false} roles={['PLAYER']}/>}
        <h3>Your requests & connections</h3>{error?<p role="alert">{error} <button onClick={retry}>Retry</button></p>:data?<div className="representation-list">{data.length||history.items.length?<ConnectionList requests={mergeConnections(data,history.items)} userId={user.id} history={history}/>:<EmptyState compact icon={Handshake} title="No requests yet. Choose a player to get started." description="Search above and send a representation proposal. The connection becomes active only after the player accepts."/>}</div>:<p role="status">Loading requests…</p>}
    </section>;
}
